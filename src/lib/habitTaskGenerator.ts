import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Habit, RecurrenceRule } from '@/hooks/useHabits'

export class HabitTaskGenerator {
  constructor(
    private supabase: SupabaseClient<Database>,
    private userId: string
  ) {}

  /**
   * Generate tasks for a habit over the next 30 days
   */
  async generateTasksForHabit(habit: Habit, fullRegeneration: boolean = false): Promise<void> {
    console.log('generateTasksForHabit called with habit:', habit, 'fullRegeneration:', fullRegeneration)
    
    if (!habit.is_active) {
      throw new Error('Cannot generate tasks for inactive habit')
    }

    if (fullRegeneration) {
      // For full regeneration, clear ALL incomplete tasks for this habit
      console.log('Full regeneration: clearing ALL incomplete tasks for habit:', habit.id)
      await this.clearAllIncompleteHabitTasks(habit.id)
      
      // Add a small delay to ensure deletion completes
      await new Promise(resolve => setTimeout(resolve, 500))
    } else {
      // For regular regeneration, clear all incomplete tasks to avoid duplicates
      console.log('Regular regeneration: clearing ALL incomplete habit tasks for habit:', habit.id)
      await this.clearAllIncompleteHabitTasks(habit.id)
    }

    // Generate new tasks
    console.log('Generating dates for habit:', habit.title, 'Rule:', habit.recurrence_rule)
    const dates = this.generateDatesForHabit(habit, 30)
    console.log('Generated dates for habit:', dates.length, dates.map(d => d.toDateString()).slice(0, 10)) // Show first 10 dates
    
    for (const date of dates) {
      console.log('Creating habit task for date:', date)
      await this.createHabitTask(habit, date)
    }
    
    console.log('Finished generating tasks for habit')
  }

  /**
   * Clear ALL incomplete habit tasks (for full regeneration)
   */
  async clearAllIncompleteHabitTasks(habitId: string): Promise<void> {
    console.log(`Clearing ALL incomplete tasks for habit ${habitId}`)

    const { data: tasksToDelete, error } = await this.supabase
      .from('tasks')
      .select('id')
      .eq('habit_id', habitId)
      .neq('status', 'completed')

    if (error) {
      console.error('Error finding tasks to delete:', error)
      return
    }

    console.log(`Found ${tasksToDelete?.length || 0} incomplete tasks to delete`)

    if (tasksToDelete && tasksToDelete.length > 0) {
      const taskIds = tasksToDelete.map(t => t.id)
      
      // Delete from tasks table
      const { error: taskDeleteError } = await this.supabase
        .from('tasks')
        .delete()
        .in('id', taskIds)

      if (taskDeleteError) {
        console.error('Error deleting tasks:', taskDeleteError)
        return
      }

      // Delete corresponding items
      const { error: itemDeleteError } = await this.supabase
        .from('items')
        .delete()
        .in('id', taskIds)
        
      if (itemDeleteError) {
        console.error('Error deleting items:', itemDeleteError)
      } else {
        console.log(`Successfully deleted ${taskIds.length} incomplete habit tasks`)
      }
    }
  }

  /**
   * Clear only past incomplete habit tasks (for daily cleanup)
   */
  async clearPastIncompleteHabitTasks(habitId: string): Promise<void> {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    console.log(`Cleaning past incomplete tasks for habit ${habitId}. Today: ${todayStr}`)

    // Get incomplete habit tasks that are before today
    const { data: tasksToDelete, error } = await this.supabase
      .from('tasks')
      .select('id, assigned_date, status')
      .eq('habit_id', habitId)
      .neq('status', 'completed')
      .lt('assigned_date', todayStr)

    if (error) {
      console.error('Error finding past tasks to delete:', error)
      return
    }

    console.log('Past incomplete tasks found for deletion:', tasksToDelete)

    if (tasksToDelete && tasksToDelete.length > 0) {
      const taskIds = tasksToDelete.map(t => t.id)
      
      // Delete from tasks table
      const { error: taskDeleteError } = await this.supabase
        .from('tasks')
        .delete()
        .in('id', taskIds)

      if (taskDeleteError) {
        console.error('Error deleting past tasks:', taskDeleteError)
        return
      }

      // Delete corresponding items
      const { error: itemDeleteError } = await this.supabase
        .from('items')
        .delete()
        .in('id', taskIds)
        
      if (itemDeleteError) {
        console.error('Error deleting past items:', itemDeleteError)
      } else {
        console.log(`Successfully deleted ${taskIds.length} past incomplete habit tasks`)
      }
    } else {
      console.log('No past incomplete habit tasks found to delete')
    }
  }

  /**
   * Generate dates based on recurrence rule
   */
  private generateDatesForHabit(habit: Habit, dayCount: number): Date[] {
    const dates: Date[] = []
    const rule = habit.recurrence_rule
    const startDate = new Date(rule.start_date || new Date())
    const today = new Date()
    
    // Reset time portion to compare dates only
    startDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    
    // Start from today or start_date, whichever is later
    const generateFrom = startDate > today ? startDate : today
    
    console.log('Date generation details:', {
      startDate: startDate.toISOString(),
      today: today.toISOString(),
      generateFrom: generateFrom.toISOString(),
      todayDateString: today.toDateString(),
      generateFromDateString: generateFrom.toDateString()
    })

    switch (rule.type) {
      case 'daily':
        return this.generateDailyDates(generateFrom, dayCount, rule)
      case 'weekly':
        return this.generateWeeklyDates(generateFrom, dayCount, rule)
      case 'monthly':
        return this.generateMonthlyDates(generateFrom, dayCount, rule)
      default:
        // For now, default to daily
        return this.generateDailyDates(generateFrom, dayCount, rule)
    }
  }

  private generateDailyDates(startDate: Date, dayCount: number, rule: RecurrenceRule): Date[] {
    const dates: Date[] = []
    const current = new Date(startDate)
    const interval = rule.interval || 1
    let daysGenerated = 0

    while (daysGenerated < dayCount) {
      // Check if this date should be included
      if (this.shouldIncludeDate(current, rule)) {
        dates.push(new Date(current))
        daysGenerated++
      }
      
      // Move to next potential date
      current.setDate(current.getDate() + interval)
    }

    return dates
  }

  private generateWeeklyDates(startDate: Date, dayCount: number, rule: RecurrenceRule): Date[] {
    const dates: Date[] = []
    const interval = rule.interval || 1
    const daysOfWeek = rule.days_of_week || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    
    // Map day names to numbers (0 = Sunday, 1 = Monday, etc.)
    const dayMap: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    }
    
    const targetDays = daysOfWeek.map(day => dayMap[day]).filter(d => d !== undefined)
    console.log('Weekly habit target days:', daysOfWeek, '-> numbers:', targetDays)
    
    // Start checking from startDate and look forward day by day
    let checkDate = new Date(startDate)
    let daysChecked = 0
    const maxDaysToCheck = dayCount * 7 * interval + 30 // Safety buffer
    
    while (dates.length < dayCount && daysChecked < maxDaysToCheck) {
      const dayOfWeek = checkDate.getDay()
      
      // Check if this day matches our target days
      if (targetDays.includes(dayOfWeek)) {
        // This is a target day - check if it should be included based on interval
        if (this.shouldIncludeDate(checkDate, rule)) {
          dates.push(new Date(checkDate))
          console.log(`Added weekly date: ${checkDate.toDateString()} (day ${dayOfWeek})`)
        }
      }
      
      // Move to next day
      checkDate.setDate(checkDate.getDate() + 1)
      daysChecked++
    }

    console.log(`Generated ${dates.length} weekly dates:`, dates.map(d => d.toDateString()))
    return dates
  }

  private generateMonthlyDates(startDate: Date, dayCount: number, rule: RecurrenceRule): Date[] {
    const dates: Date[] = []
    const current = new Date(startDate)
    const interval = rule.interval || 1
    const daysOfMonth = rule.days_of_month || [current.getDate()]
    
    let monthsChecked = 0
    const maxMonths = dayCount * interval + 2 // Buffer for safety
    
    while (dates.length < dayCount && monthsChecked < maxMonths) {
      for (const dayOfMonth of daysOfMonth) {
        if (dates.length >= dayCount) break
        
        const targetDate = new Date(current.getFullYear(), current.getMonth(), Math.abs(dayOfMonth))
        
        // Handle negative days (from end of month)
        if (dayOfMonth < 0) {
          targetDate.setMonth(targetDate.getMonth() + 1, 0) // Last day of month
          targetDate.setDate(targetDate.getDate() + dayOfMonth + 1) // Subtract from end
        }
        
        // Only include if it's a valid date and today or in the future
        if (targetDate.getMonth() === current.getMonth() && 
            targetDate >= startDate && 
            this.shouldIncludeDate(targetDate, rule)) {
          dates.push(new Date(targetDate))
        }
      }
      
      // Move to next interval of months
      current.setMonth(current.getMonth() + interval)
      monthsChecked += interval
    }

    return dates.sort((a, b) => a.getTime() - b.getTime()).slice(0, dayCount)
  }

  private shouldIncludeDate(date: Date, rule: RecurrenceRule): boolean {
    // Check custom exclusions
    if (rule.custom_exclusions?.some(exclusion => {
      const excludeDate = new Date(exclusion)
      return date.toDateString() === excludeDate.toDateString()
    })) {
      return false
    }

    // Add more filtering logic here as needed
    return true
  }

  /**
   * Create a task instance for a habit on a specific date
   */
  private async createHabitTask(habit: Habit, date: Date): Promise<void> {
    const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD format
    
    // Check if a task already exists for this habit on this date
    const { data: existingTask, error: checkError } = await this.supabase
      .from('tasks')
      .select('id')
      .eq('habit_id', habit.id)
      .eq('assigned_date', dateStr)
      .maybeSingle()
    
    if (checkError) {
      console.error('Error checking for existing task:', checkError)
      throw checkError
    }
    
    if (existingTask) {
      console.log(`Task already exists for habit ${habit.id} on ${dateStr}, skipping`)
      return
    }
    
    // Create item first
    const { data: item, error: itemError } = await this.supabase
      .from('items')
      .insert({
        user_id: this.userId,
        title: habit.title,
        item_type: 'task',
        is_archived: false
      })
      .select()
      .single()

    if (itemError) throw itemError

    // Create task
    const { error: taskError } = await this.supabase
      .from('tasks')
      .insert({
        id: item.id,
        assigned_date: dateStr,
        due_date: null,
        status: 'on_deck',
        description: habit.description,
        priority: habit.priority,
        habit_id: habit.id
      })

    if (taskError) {
      // Clean up item if task creation fails
      await this.supabase.from('items').delete().eq('id', item.id)
      throw taskError
    }
  }

  /**
   * Daily cleanup: Remove past incomplete habit tasks for all active habits
   */
  async cleanupPastHabitTasks(): Promise<void> {
    const { data: activeHabits, error } = await this.supabase
      .from('habits')
      .select('id')
      .eq('user_id', this.userId)
      .eq('is_active', true)

    if (error) throw error

    for (const habit of activeHabits || []) {
      try {
        await this.clearPastIncompleteHabitTasks(habit.id)
      } catch (e) {
        console.error(`Failed to cleanup tasks for habit ${habit.id}:`, e)
      }
    }
  }

  /**
   * Regenerate tasks for all active habits (monthly maintenance)
   */
  async regenerateAllHabitTasks(): Promise<void> {
    const { data: activeHabits, error } = await this.supabase
      .from('habits')
      .select('*')
      .eq('user_id', this.userId)
      .eq('is_active', true)

    if (error) throw error

    for (const habit of activeHabits || []) {
      try {
        await this.generateTasksForHabit(habit, true) // true = full regeneration
      } catch (e) {
        console.error(`Failed to generate tasks for habit ${habit.id}:`, e)
      }
    }
  }
}