'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabase-client'
import type {
  ChecklistTemplate,
  ChecklistItem,
  ChecklistContextAssignment,
  ChecklistTemplateWithDetails,
  RecurrenceRule,
  ChecklistCompletion,
  CheckedItem
} from '@/types/checklist.types'

export function useChecklists(userId: string | undefined) {
  const [templates, setTemplates] = useState<ChecklistTemplateWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabaseRef = useRef(getSupabaseClient())
  const isFetchingRef = useRef(false)

  const fetchTemplates = useCallback(async () => {
    if (isFetchingRef.current) return

    if (!userId) {
      setTemplates([])
      setIsLoading(false)
      return
    }

    isFetchingRef.current = true

    try {
      setIsLoading(true)
      const supabase = supabaseRef.current

      // Fetch templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (templatesError) throw templatesError

      if (!templatesData || templatesData.length === 0) {
        setTemplates([])
        return
      }

      // Fetch items for all templates
      const templateIds = templatesData.map(t => t.id)
      const { data: itemsData, error: itemsError } = await supabase
        .from('checklist_items')
        .select('*')
        .in('template_id', templateIds)
        .order('order_index', { ascending: true })

      if (itemsError) throw itemsError

      // Fetch contexts for all templates
      const { data: contextsData, error: contextsError } = await supabase
        .from('checklist_contexts')
        .select('*')
        .in('template_id', templateIds)

      if (contextsError) throw contextsError

      // Fetch completions for streak calculation
      const { data: completionsData, error: completionsError } = await supabase
        .from('checklist_completions')
        .select('template_id, completed_at')
        .in('template_id', templateIds)
        .order('completed_at', { ascending: false })

      if (completionsError) throw completionsError

      // Combine data
      const templatesWithDetails: ChecklistTemplateWithDetails[] = templatesData.map(template => {
        const items = (itemsData || []).filter(item => item.template_id === template.id)
        const contexts = (contextsData || []).filter(ctx => ctx.template_id === template.id)
        const completions = (completionsData || []).filter(comp => comp.template_id === template.id)

        // Calculate streak
        const streak = calculateStreak(completions.map(c => c.completed_at), template.recurrence_rule)

        // Check if completed today (using local timezone)
        const now = new Date()
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        const completedToday = completions.some(c => {
          const d = new Date(c.completed_at)
          const localStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          return localStr === todayStr
        })

        return {
          ...template,
          items,
          contexts,
          streak,
          completedToday
        }
      })

      setTemplates(templatesWithDetails)

    } catch (e) {
      console.error('Error in fetchTemplates:', e)
      setError(e instanceof Error ? e : new Error('An error occurred while fetching checklists'))
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [userId])

  const createTemplate = useCallback(async (
    name: string,
    items: string[],
    contexts: string[],
    recurrenceRule: RecurrenceRule | null
  ) => {
    if (!userId) throw new Error('User ID required')

    const supabase = supabaseRef.current

    // Create template
    const { data: templateData, error: templateError } = await supabase
      .from('checklist_templates')
      .insert({
        user_id: userId,
        name,
        version: 1.0,
        recurrence_rule: recurrenceRule
      })
      .select()
      .single()

    if (templateError) throw templateError

    // Create items
    if (items.length > 0) {
      const itemsToInsert = items.map((item_text, index) => ({
        template_id: templateData.id,
        item_text,
        order_index: index
      }))

      const { error: itemsError } = await supabase
        .from('checklist_items')
        .insert(itemsToInsert)

      if (itemsError) {
        // Clean up template if items creation fails
        await supabase.from('checklist_templates').delete().eq('id', templateData.id)
        throw itemsError
      }
    }

    // Create contexts
    if (contexts.length > 0) {
      const contextsToInsert = contexts.map(context => ({
        template_id: templateData.id,
        context
      }))

      const { error: contextsError } = await supabase
        .from('checklist_contexts')
        .insert(contextsToInsert)

      if (contextsError) {
        // Clean up template if contexts creation fails
        await supabase.from('checklist_templates').delete().eq('id', templateData.id)
        throw contextsError
      }
    }

    await fetchTemplates()
    return templateData
  }, [userId, fetchTemplates])

  const updateTemplate = useCallback(async (
    templateId: string,
    name: string,
    items: { id?: string; item_text: string; order_index: number }[],
    contexts: string[],
    recurrenceRule: RecurrenceRule | null,
    isMajorUpdate: boolean
  ) => {
    if (!userId) throw new Error('User ID required')

    const supabase = supabaseRef.current

    // Get current template to calculate new version
    const { data: currentTemplate, error: fetchError } = await supabase
      .from('checklist_templates')
      .select('version')
      .eq('id', templateId)
      .single()

    if (fetchError) throw fetchError

    const currentVersion = currentTemplate.version
    const newVersion = isMajorUpdate
      ? Math.floor(currentVersion) + 1.0
      : currentVersion + 0.1

    // Update template
    const { error: templateError } = await supabase
      .from('checklist_templates')
      .update({
        name,
        version: newVersion,
        recurrence_rule: recurrenceRule
      })
      .eq('id', templateId)

    if (templateError) throw templateError

    // Delete all existing items and contexts, then recreate
    await supabase.from('checklist_items').delete().eq('template_id', templateId)
    await supabase.from('checklist_contexts').delete().eq('template_id', templateId)

    // Create items
    if (items.length > 0) {
      const itemsToInsert = items.map(item => ({
        template_id: templateId,
        item_text: item.item_text,
        order_index: item.order_index
      }))

      const { error: itemsError } = await supabase
        .from('checklist_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError
    }

    // Create contexts
    if (contexts.length > 0) {
      const contextsToInsert = contexts.map(context => ({
        template_id: templateId,
        context
      }))

      const { error: contextsError } = await supabase
        .from('checklist_contexts')
        .insert(contextsToInsert)

      if (contextsError) throw contextsError
    }

    await fetchTemplates()
  }, [userId, fetchTemplates])

  const deleteTemplate = useCallback(async (templateId: string) => {
    const supabase = supabaseRef.current

    const { error } = await supabase
      .from('checklist_templates')
      .delete()
      .eq('id', templateId)

    if (error) throw error

    await fetchTemplates()
  }, [fetchTemplates])

  const completeChecklist = useCallback(async (
    templateId: string,
    checkedItems: CheckedItem[],
    notes: string | null
  ) => {
    if (!userId) throw new Error('User ID required')

    const supabase = supabaseRef.current

    // Get template version
    const { data: template, error: templateError } = await supabase
      .from('checklist_templates')
      .select('version')
      .eq('id', templateId)
      .single()

    if (templateError) throw templateError

    // Create completion
    const { error: completionError } = await supabase
      .from('checklist_completions')
      .insert({
        user_id: userId,
        template_id: templateId,
        template_version: template.version,
        checked_items: checkedItems,
        notes
      })

    if (completionError) throw completionError

    await fetchTemplates()
  }, [userId, fetchTemplates])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  return {
    templates,
    isLoading,
    error,
    refetch: fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    completeChecklist
  }
}

// Helper function to calculate streak based on completions and recurrence rule
function calculateStreak(completionDates: string[], recurrenceRule: RecurrenceRule | null): number {
  if (!recurrenceRule || completionDates.length === 0) return 0

  const sortedDates = completionDates
    .map(d => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime())

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let streak = 0
  let checkDate = new Date(today)

  // Check if we need to count today or yesterday as the start
  const lastCompletion = sortedDates[0]
  lastCompletion.setHours(0, 0, 0, 0)

  // If last completion wasn't today or the last expected day, streak is 0
  if (!shouldCountCompletion(lastCompletion, checkDate, recurrenceRule)) {
    return 0
  }

  // Count backwards through completions
  for (const completionDate of sortedDates) {
    const completion = new Date(completionDate)
    completion.setHours(0, 0, 0, 0)

    if (shouldCountCompletion(completion, checkDate, recurrenceRule)) {
      streak++
      checkDate = getNextExpectedDate(checkDate, recurrenceRule, -1)
    } else {
      break
    }
  }

  return streak
}

function shouldCountCompletion(completionDate: Date, expectedDate: Date, rule: RecurrenceRule): boolean {
  const diffDays = Math.floor((expectedDate.getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24))

  // Allow completion on the expected date
  if (diffDays === 0) return true

  // For daily habits, allow a 1-day grace period
  if (rule.type === 'daily' && diffDays <= 1) return true

  return false
}

function getNextExpectedDate(date: Date, rule: RecurrenceRule, direction: number = 1): Date {
  const newDate = new Date(date)

  switch (rule.type) {
    case 'daily':
      newDate.setDate(newDate.getDate() + (direction * rule.interval))
      break
    case 'weekly':
      newDate.setDate(newDate.getDate() + (direction * rule.interval * 7))
      break
    case 'monthly':
      newDate.setMonth(newDate.getMonth() + (direction * rule.interval))
      break
    default:
      // For custom rules, assume daily for now
      newDate.setDate(newDate.getDate() + direction)
  }

  return newDate
}
