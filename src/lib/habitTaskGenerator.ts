import type { SupabaseClient } from '@supabase/supabase-js'
import type { Habit, RecurrenceRule } from '@/hooks/useHabits'

export class HabitTaskGenerator {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  /**
   * Generate the next task for a habit based on its recurrence rule
   * Called when a habit is created or when a task is completed
   */
  async generateNextTask(habit: Habit, fromDate?: Date, isInitialTask: boolean = false): Promise<void> {
    console.log('=== generateNextTask DEBUG ===')
    console.log('Habit:', habit.title)
    console.log('isInitialTask:', isInitialTask)
    console.log('fromDate:', fromDate)
    console.log('fromDate (local string):', fromDate ? this.getLocalDateString(fromDate) : 'undefined')

    if (!habit.is_active) {
      console.log('Habit is inactive, skipping task generation')
      return
    }

    // Determine the base date for calculating the next occurrence
    const baseDate = fromDate || new Date()
    console.log('baseDate:', baseDate)
    console.log('baseDate (local string):', this.getLocalDateString(baseDate))

    // For initial task creation, use the base date as-is
    // For subsequent tasks (after completion), calculate next occurrence
    const nextDate = isInitialTask
      ? baseDate
      : this.calculateNextOccurrence(habit.recurrence_rule, baseDate)

    console.log('nextDate:', nextDate)
    console.log('nextDate (local string):', nextDate ? this.getLocalDateString(nextDate) : 'null')

    if (!nextDate) {
      console.log('No next occurrence calculated, skipping task generation')
      return
    }

    // Create the task
    await this.createHabitTask(habit, nextDate)
    console.log(`Generated ${isInitialTask ? 'initial' : 'next'} task for habit "${habit.title}" on ${this.getLocalDateString(nextDate)}`)
  }

  /**
   * Calculate the next occurrence date based on recurrence rule
   * For interval-based habits: adds interval to fromDate
   * For fixed schedule habits: finds next matching day/date
   */
  private calculateNextOccurrence(recurrenceRule: RecurrenceRule, fromDate: Date): Date | null {
    // Parse recurrence_rule if it's a string
    const rule = typeof recurrenceRule === 'string'
      ? JSON.parse(recurrenceRule)
      : recurrenceRule

    const current = new Date(fromDate)
    current.setHours(0, 0, 0, 0)

    switch (rule.type) {
      case 'daily':
        return this.calculateNextDailyOccurrence(current, rule)
      case 'weekly':
        return this.calculateNextWeeklyOccurrence(current, rule)
      case 'monthly':
        return this.calculateNextMonthlyOccurrence(current, rule)
      default:
        console.warn('Unknown recurrence type:', rule.type)
        return null
    }
  }

  /**
   * For daily habits: add interval days to fromDate
   * Example: Every 2 days, completed on Jan 3 → next is Jan 5
   */
  private calculateNextDailyOccurrence(fromDate: Date, rule: RecurrenceRule): Date {
    const interval = rule.interval || 1
    const nextDate = new Date(fromDate)
    nextDate.setDate(nextDate.getDate() + interval)
    return nextDate
  }

  /**
   * For weekly habits: find the next matching day of week
   * Example: Every Tuesday, completed on Thursday → next is following Tuesday
   */
  private calculateNextWeeklyOccurrence(fromDate: Date, rule: RecurrenceRule): Date | null {
    const interval = rule.interval || 1
    const daysOfWeek = rule.days_of_week || []

    if (daysOfWeek.length === 0) {
      console.warn('Weekly habit has no days_of_week specified')
      return null
    }

    // Map day names to numbers (0 = Sunday, 1 = Monday, etc.)
    const dayMap: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    }

    const targetDays = daysOfWeek.map(day => dayMap[day]).filter(d => d !== undefined)
    targetDays.sort((a, b) => a - b) // Sort days in order

    // Start checking from tomorrow
    const checkDate = new Date(fromDate)
    checkDate.setDate(checkDate.getDate() + 1)

    // Look for the next matching day within the next 2 weeks
    for (let i = 0; i < 14; i++) {
      const dayOfWeek = checkDate.getDay()
      if (targetDays.includes(dayOfWeek)) {
        return new Date(checkDate)
      }
      checkDate.setDate(checkDate.getDate() + 1)
    }

    console.warn('Could not find next weekly occurrence')
    return null
  }

  /**
   * For monthly habits: find the next matching day of month
   * Example: Every 1st of month, completed on Jan 3 → next is Feb 1
   */
  private calculateNextMonthlyOccurrence(fromDate: Date, rule: RecurrenceRule): Date | null {
    const interval = rule.interval || 1
    const daysOfMonth = rule.days_of_month || []

    if (daysOfMonth.length === 0) {
      console.warn('Monthly habit has no days_of_month specified')
      return null
    }

    // Start from next day
    const current = new Date(fromDate)
    current.setDate(current.getDate() + 1)

    // Look ahead up to 12 months
    for (let monthsAhead = 0; monthsAhead <= 12; monthsAhead++) {
      const checkMonth = new Date(fromDate)
      checkMonth.setMonth(checkMonth.getMonth() + monthsAhead)

      for (const dayOfMonth of daysOfMonth) {
        let targetDate: Date

        // Handle negative days (from end of month)
        if (dayOfMonth < 0) {
          targetDate = new Date(checkMonth.getFullYear(), checkMonth.getMonth() + 1, 0) // Last day of month
          targetDate.setDate(targetDate.getDate() + dayOfMonth + 1) // Subtract from end
        } else {
          // For positive days, cap at the last day of the month
          // Get last day of the target month
          const lastDayOfMonth = new Date(checkMonth.getFullYear(), checkMonth.getMonth() + 1, 0).getDate()
          const cappedDay = Math.min(dayOfMonth, lastDayOfMonth)
          targetDate = new Date(checkMonth.getFullYear(), checkMonth.getMonth(), cappedDay)
        }

        // Only return if it's in the future
        if (targetDate > fromDate) {
          return targetDate
        }
      }
    }

    console.warn('Could not find next monthly occurrence')
    return null
  }

  /**
   * Helper to get local date string in YYYY-MM-DD format without UTC conversion
   */
  private getLocalDateString(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * Create a task instance for a habit on a specific date
   */
  private async createHabitTask(habit: Habit, date: Date): Promise<void> {
    const dateStr = this.getLocalDateString(date) // YYYY-MM-DD format in local timezone
    console.log(`Creating habit task for "${habit.title}" on ${dateStr}`)

    // Check if a non-completed task already exists for this habit on this date
    const { data: existingTask, error: checkError } = await this.supabase
      .from('tasks')
      .select('id')
      .eq('habit_id', habit.id)
      .eq('assigned_date', dateStr)
      .neq('status', 'completed')
      .maybeSingle()

    if (checkError) {
      console.error('Error checking for existing task:', checkError)
      throw checkError
    }

    if (existingTask) {
      console.log(`Task already exists for habit ${habit.id} on ${dateStr}, skipping`)
      return
    }

    // Parse recurrence_rule to get daily_context
    const recurrenceRule = typeof habit.recurrence_rule === 'string'
      ? JSON.parse(habit.recurrence_rule)
      : habit.recurrence_rule

    // Get daily_context from recurrence rule (if specified)
    const daily_context = recurrenceRule?.daily_context
      ? JSON.stringify(recurrenceRule.daily_context)
      : null

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

    // Create task with status 'habit'
    const { error: taskError } = await this.supabase
      .from('tasks')
      .insert({
        id: item.id,
        assigned_date: dateStr,
        due_date: null,
        daily_context: daily_context,
        status: 'habit',
        description: habit.description,
        priority: habit.priority,
        habit_id: habit.id,
        checklist_template_id: habit.checklist_template_id || null
      })

    if (taskError) {
      // Clean up item if task creation fails
      await this.supabase.from('items').delete().eq('id', item.id)
      throw taskError
    }

    console.log(`Successfully created habit task for "${habit.title}" on ${dateStr}`)
  }

  /**
   * Calculate completion rate for a habit over a given period
   * Returns a number between 0 and 1 (e.g., 0.66 = 66%)
   */
  async getCompletionRate(habitId: string, days: number = 30): Promise<{ rate: number; completed: number; expected: number }> {
    // Get the habit
    const { data: habit, error: habitError } = await this.supabase
      .from('habits')
      .select('*')
      .eq('id', habitId)
      .single()

    if (habitError || !habit) {
      console.error('Error fetching habit:', habitError)
      return { rate: 0, completed: 0, expected: 0 }
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)

    // Calculate expected occurrences using the recurrence rule
    const expectedCount = this.calculateExpectedOccurrences(habit.recurrence_rule, startDate, endDate)

    // Count actual completions in this period
    const { data: completions, error: completionsError } = await this.supabase
      .from('tasks')
      .select('id, completed_at')
      .eq('habit_id', habitId)
      .eq('status', 'completed')
      .gte('completed_at', startDate.toISOString())
      .lte('completed_at', endDate.toISOString())

    if (completionsError) {
      console.error('Error fetching completions:', completionsError)
      return { rate: 0, completed: 0, expected: expectedCount }
    }

    const completedCount = completions?.length || 0
    const rate = expectedCount > 0 ? completedCount / expectedCount : 0

    return {
      rate,
      completed: completedCount,
      expected: expectedCount
    }
  }

  /**
   * Calculate how many times a habit should have occurred in a given period
   */
  private calculateExpectedOccurrences(recurrenceRule: RecurrenceRule, startDate: Date, endDate: Date): number {
    const rule = typeof recurrenceRule === 'string'
      ? JSON.parse(recurrenceRule)
      : recurrenceRule

    const dates: Date[] = []
    const current = new Date(startDate)
    current.setHours(0, 0, 0, 0)

    const end = new Date(endDate)
    end.setHours(0, 0, 0, 0)

    switch (rule.type) {
      case 'daily':
        const interval = rule.interval || 1
        while (current <= end) {
          dates.push(new Date(current))
          current.setDate(current.getDate() + interval)
        }
        break

      case 'weekly':
        const dayMap: Record<string, number> = {
          'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
          'Thursday': 4, 'Friday': 5, 'Saturday': 6
        }
        const daysOfWeek = rule.days_of_week || []
        const targetDays = daysOfWeek.map((day: string) => dayMap[day]).filter((d: number | undefined) => d !== undefined)

        while (current <= end) {
          if (targetDays.includes(current.getDay())) {
            dates.push(new Date(current))
          }
          current.setDate(current.getDate() + 1)
        }
        break

      case 'monthly':
        const daysOfMonth = rule.days_of_month || []
        const monthStart = new Date(startDate)
        monthStart.setDate(1)

        while (monthStart <= end) {
          for (const dayOfMonth of daysOfMonth) {
            let targetDate: Date

            // Handle negative days (from end of month)
            if (dayOfMonth < 0) {
              targetDate = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
              targetDate.setDate(targetDate.getDate() + dayOfMonth + 1)
            } else {
              // For positive days, cap at the last day of the month
              const lastDayOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()
              const cappedDay = Math.min(dayOfMonth, lastDayOfMonth)
              targetDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), cappedDay)
            }

            if (targetDate >= startDate && targetDate <= end) {
              dates.push(new Date(targetDate))
            }
          }
          monthStart.setMonth(monthStart.getMonth() + 1)
        }
        break
    }

    return dates.length
  }

  /**
   * Delete all incomplete habit tasks for a habit
   * Used when deactivating a habit
   */
  async deleteIncompleteHabitTasks(habitId: string): Promise<void> {
    console.log(`Deleting incomplete tasks for habit ${habitId}`)

    const { data: incompleteTasks, error: findError } = await this.supabase
      .from('tasks')
      .select('id')
      .eq('habit_id', habitId)
      .neq('status', 'completed')

    if (findError) {
      console.error('Error finding incomplete tasks:', findError)
      return
    }

    if (!incompleteTasks || incompleteTasks.length === 0) {
      console.log('No incomplete tasks to delete')
      return
    }

    const taskIds = incompleteTasks.map(t => t.id)

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
