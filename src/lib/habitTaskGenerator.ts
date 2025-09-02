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

    // Generate new tasks with minimum 5 tasks rule
    console.log('Generating dates for habit:', habit.title, 'Rule:', habit.recurrence_rule)
    
    // First try 30 days worth
    let dates = this.generateDatesForHabit(habit, 30)
    console.log(`Generated ${dates.length} dates in 30 days for habit:`, dates.map(d => d.toDateString()).slice(0, 5))
    
    // If we have fewer than 5 tasks, extend the period to get at least 5
    if (dates.length < 5) {
      console.log(`Only ${dates.length} tasks in 30 days, extending to get minimum 5 tasks`)
      
      // Calculate smarter maximum based on habit frequency
      let maxDaysToTry = 365 // Default maximum
      
      if (habit.recurrence_rule.type === 'monthly') {
        // For monthly habits, 6 months should give us 6 tasks (more than minimum 5)
        maxDaysToTry = Math.min(180, 365) // 6 months max for monthly habits
      } else if (habit.recurrence_rule.type === 'weekly') {
        // For weekly habits, 6 weeks should give us 6+ tasks
        maxDaysToTry = Math.min(60, 365) // 2 months max for weekly habits
      }
      
      dates = this.generateDatesForHabit(habit, maxDaysToTry, 5) // 5 = minimum tasks
      console.log(`Extended generation (${maxDaysToTry} days max): ${dates.length} dates found:`, dates.map(d => d.toDateString()).slice(0, 10))
    }
    
    // Safety check - prevent generating too many tasks
    if (dates.length > 15) {
      console.warn(`Generating ${dates.length} tasks for habit ${habit.title}. Limiting to 10 to keep things manageable.`)
      dates.splice(10) // Keep only first 10
    }
    
    for (const date of dates) {
      console.log('Creating habit task for date:', date)
      await this.createHabitTask(habit, date)
    }
    
    console.log('Finished generating tasks for habit')
  }

  /**
   * Clear ALL incomplete habit tasks (for full regeneration)
   * Preserves today's active tasks to avoid deleting tasks the user is working on
   */
  async clearAllIncompleteHabitTasks(habitId: string): Promise<void> {
    console.log(`=== CLEARING ALL INCOMPLETE TASKS FOR HABIT ${habitId} ===`)

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD format

    // First, let's see ALL tasks for this habit to debug
    const { data: allTasks, error: allTasksError } = await this.supabase
      .from('tasks')
      .select('id, assigned_date, status')
      .eq('habit_id', habitId)
    
    if (allTasksError) {
      console.error('Error finding all tasks:', allTasksError)
    } else {
      console.log(`DEBUG: Found ${allTasks?.length || 0} TOTAL tasks for habit ${habitId}:`)
      allTasks?.forEach(t => {
        console.log(`  Task ${t.id}: ${t.assigned_date || 'no date'}, status: ${t.status}`)
      })
    }

    // Clear incomplete tasks BUT preserve today's active tasks
    const { data: tasksToDelete, error } = await this.supabase
      .from('tasks')
      .select('id, assigned_date, status')
      .eq('habit_id', habitId)
      .neq('status', 'completed')
      .not('and', `(assigned_date.eq.${todayStr},status.eq.active)`)

    if (error) {
      console.error('Error finding tasks to delete:', error)
      return
    }

    console.log(`Found ${tasksToDelete?.length || 0} incomplete tasks to delete for habit ${habitId} (preserving today's active tasks)`)
    if (tasksToDelete && tasksToDelete.length > 0) {
      console.log('Tasks being deleted:', tasksToDelete.map(t => `${t.id} (${t.assigned_date || 'no date'}, status: ${t.status})`))
    }

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
        console.log(`Successfully deleted ${taskIds.length} incomplete habit tasks and their items`)
      }
      
      // Verify deletion worked
      const { data: remainingTasks, error: verifyError } = await this.supabase
        .from('tasks')
        .select('id, assigned_date, status')
        .eq('habit_id', habitId)
      
      if (!verifyError && remainingTasks) {
        console.log(`VERIFICATION: ${remainingTasks.length} tasks remaining for habit ${habitId} after deletion`)
        if (remainingTasks.length > 0) {
          console.log('Remaining tasks:', remainingTasks.map(t => `${t.id} (${t.assigned_date}, ${t.status})`))
        }
      }
    } else {
      console.log('No incomplete tasks found to delete')
    }
    console.log(`=== FINISHED CLEARING TASKS FOR HABIT ${habitId} ===`)
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
  private generateDatesForHabit(habit: Habit, dayCount: number, minTasks: number = 1): Date[] {
    const rule = habit.recurrence_rule
    const todayForDebug = new Date().toISOString().split('T')[0]
    
    console.log(`=== DATE GENERATION DEBUG FOR HABIT: ${habit.title} ===`)
    console.log('Recurrence rule:', rule)
    console.log(`Today is: ${todayForDebug}`)
    
    // Helper to parse date string as local time (not UTC)
    const parseLocalDate = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day); // month is 0-indexed
    };
    
    const startDate = rule.start_date ? parseLocalDate(rule.start_date) : new Date()
    const today = new Date()
    
    // Reset time portion to compare dates only
    startDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    
    // Apply offset for daily habits
    let generateFrom = startDate > today ? startDate : today
    if (rule.type === 'daily' && rule.offset_days && rule.offset_days > 0) {
      const offsetStartDate = new Date(today)
      offsetStartDate.setDate(offsetStartDate.getDate() + rule.offset_days)
      generateFrom = offsetStartDate > generateFrom ? offsetStartDate : generateFrom
      console.log(`Daily habit with offset: ${rule.offset_days} days from today = ${offsetStartDate.toISOString().split('T')[0]}`)
    }
    
    console.log('Date generation details:', {
      habitTitle: habit.title,
      startDate: startDate.toISOString().split('T')[0],
      today: today.toISOString().split('T')[0],
      generateFrom: generateFrom.toISOString().split('T')[0],
      ruleType: rule.type,
      interval: rule.interval
    })

    let dates: Date[] = []
    let currentDayCount = dayCount

    // First attempt with normal day count
    switch (rule.type) {
      case 'daily':
        dates = this.generateDailyDatesByPeriod(generateFrom, currentDayCount, rule)
        break
      case 'weekly':
        dates = this.generateWeeklyDatesByPeriod(generateFrom, currentDayCount, rule)
        break
      case 'monthly':
        dates = this.generateMonthlyDatesByPeriod(generateFrom, currentDayCount, rule)
        break
      default:
        dates = this.generateDailyDatesByPeriod(generateFrom, currentDayCount, rule)
        break
    }
    
    console.log(`Generated ${dates.length} dates for ${habit.title}:`)
    dates.forEach((date, index) => {
      const dateStr = date.toISOString().split('T')[0]
      const isToday = dateStr === todayForDebug
      console.log(`  ${index + 1}. ${dateStr} ${isToday ? '← TODAY!' : ''}`)
    })
    
    const includesTo = dates.some(d => d.toISOString().split('T')[0] === todayForDebug)
    console.log(`❗ Does this habit include today (${todayForDebug})? ${includesTo ? 'YES' : 'NO'}`)

    // If we didn't get enough dates and haven't reached max days, extend the period
    while (dates.length < minTasks && currentDayCount < 365) {
      currentDayCount = Math.min(currentDayCount * 2, 365) // Double the period, cap at 1 year
      console.log(`Extending date generation period to ${currentDayCount} days to reach minimum ${minTasks} tasks (currently have ${dates.length})`)
      
      switch (rule.type) {
        case 'daily':
          dates = this.generateDailyDatesByPeriod(generateFrom, currentDayCount, rule)
          break
        case 'weekly':
          dates = this.generateWeeklyDatesByPeriod(generateFrom, currentDayCount, rule)
          break
        case 'monthly':
          dates = this.generateMonthlyDatesByPeriod(generateFrom, currentDayCount, rule)
          break
        default:
          dates = this.generateDailyDatesByPeriod(generateFrom, currentDayCount, rule)
          break
      }
    }

    // Limit to maximum tasks to prevent excessive generation
    const maxTasks = Math.max(minTasks, 10) // Never generate more than 10 tasks
    if (dates.length > maxTasks) {
      dates.splice(maxTasks) // Keep only the first maxTasks
      console.log(`Limited task generation to ${maxTasks} tasks`)
    }

    return dates
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

  // Period-based generation functions (generate all dates within a time period)
  private generateDailyDatesByPeriod(startDate: Date, daysPeriod: number, rule: RecurrenceRule): Date[] {
    const dates: Date[] = []
    const current = new Date(startDate)
    const interval = rule.interval || 1
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + daysPeriod)

    while (current < endDate) {
      if (this.shouldIncludeDate(current, rule)) {
        dates.push(new Date(current))
      }
      current.setDate(current.getDate() + interval)
    }

    return dates
  }

  private generateWeeklyDatesByPeriod(startDate: Date, daysPeriod: number, rule: RecurrenceRule): Date[] {
    const dates: Date[] = []
    const interval = rule.interval || 1
    const daysOfWeek = rule.days_of_week || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    
    // Map day names to numbers (0 = Sunday, 1 = Monday, etc.)
    const dayMap: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    }
    
    const targetDays = daysOfWeek.map(day => dayMap[day]).filter(d => d !== undefined)
    
    let checkDate = new Date(startDate)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + daysPeriod)
    
    let currentWeekStart = new Date(startDate)
    // Find the start of the current week (Sunday)
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay())
    
    while (currentWeekStart < endDate) {
      // Check each target day in this week
      for (const dayNum of targetDays) {
        const dateToCheck = new Date(currentWeekStart)
        dateToCheck.setDate(dateToCheck.getDate() + dayNum)
        
        if (dateToCheck >= startDate && dateToCheck < endDate && this.shouldIncludeDate(dateToCheck, rule)) {
          dates.push(new Date(dateToCheck))
        }
      }
      
      // Move to next interval week
      currentWeekStart.setDate(currentWeekStart.getDate() + 7 * interval)
    }

    return dates.sort((a, b) => a.getTime() - b.getTime())
  }

  private generateMonthlyDatesByPeriod(startDate: Date, daysPeriod: number, rule: RecurrenceRule): Date[] {
    const dates: Date[] = []
    const interval = rule.interval || 1
    const daysOfMonth = rule.days_of_month || [startDate.getDate()]
    
    let currentMonth = new Date(startDate)
    currentMonth.setDate(1) // Start at beginning of month
    
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + daysPeriod)
    
    while (currentMonth < endDate) {
      for (const dayOfMonth of daysOfMonth) {
        const targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), Math.abs(dayOfMonth))
        
        // Handle negative days (from end of month)
        if (dayOfMonth < 0) {
          targetDate.setMonth(targetDate.getMonth() + 1, 0) // Last day of month
          targetDate.setDate(targetDate.getDate() + dayOfMonth + 1) // Subtract from end
        }
        
        // Only include if it's a valid date, within our period, and meets criteria
        if (targetDate.getMonth() === currentMonth.getMonth() && 
            targetDate >= startDate && 
            targetDate < endDate &&
            this.shouldIncludeDate(targetDate, rule)) {
          dates.push(new Date(targetDate))
        }
      }
      
      // Move to next interval of months
      currentMonth.setMonth(currentMonth.getMonth() + interval)
    }

    return dates.sort((a, b) => a.getTime() - b.getTime())
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
   * Monthly regeneration (for 1st of month) - Cleans up and regenerates with rhythm preservation
   */
  async monthlyRegeneration(): Promise<void> {
    const today = new Date()
    const isFirstOfMonth = today.getDate() === 1
    
    if (!isFirstOfMonth) {
      console.log(`Monthly regeneration should only run on the 1st. Today is ${today.getDate()}`)
      // Optionally, you can remove this check to allow manual triggering
    }
    
    console.log('Starting monthly habit task regeneration...')
    
    // First, clean up any past incomplete tasks
    await this.cleanupPastHabitTasks()
    
    // Then regenerate all tasks with rhythm preservation
    await this.regenerateAllHabitTasks()
    
    console.log('Monthly regeneration complete')
  }

  /**
   * Regenerate tasks for all active habits (monthly maintenance)
   * Simple approach - always starts fresh from today
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


  /**
   * Emergency cleanup: Remove ALL habit tasks and regenerate fresh
   */
  async emergencyHabitTaskCleanup(): Promise<void> {
    console.log('Starting emergency habit task cleanup...')
    
    // First get all items for this user to get valid task IDs
    const { data: userItems, error: itemsError } = await this.supabase
      .from('items')
      .select('id')
      .eq('user_id', this.userId)
      .eq('item_type', 'task')

    if (itemsError) {
      console.error('Error finding user items:', itemsError)
      throw itemsError
    }

    if (!userItems || userItems.length === 0) {
      console.log('No user items found, nothing to clean up')
      return
    }

    const userTaskIds = userItems.map(item => item.id)
    console.log(`Found ${userTaskIds.length} total user task items`)

    // Now get habit tasks that belong to this user (process in batches to avoid URL length issues)
    const batchSize = 20  // Reduced from 50 to avoid URL length issues
    const allHabitTasks: any[] = []
    
    for (let i = 0; i < userTaskIds.length; i += batchSize) {
      const batchIds = userTaskIds.slice(i, i + batchSize)
      console.log(`Finding habit tasks batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(userTaskIds.length / batchSize)}`)
      
      const { data: habitTasksBatch, error: findError } = await this.supabase
        .from('tasks')
        .select('id, habit_id')
        .not('habit_id', 'is', null)
        .in('id', batchIds)

      if (findError) {
        console.error('Error finding habit tasks:', findError)
        throw findError
      }

      if (habitTasksBatch) {
        allHabitTasks.push(...habitTasksBatch)
      }
    }

    console.log(`Found ${allHabitTasks.length} habit tasks to clean up`)

    if (allHabitTasks && allHabitTasks.length > 0) {
      const taskIds = allHabitTasks.map(t => t.id)
      console.log(`Deleting ${taskIds.length} habit tasks in batches...`)
      
      // Delete in batches to avoid URL length issues
      for (let i = 0; i < taskIds.length; i += batchSize) {
        const batchDeleteIds = taskIds.slice(i, i + batchSize)
        console.log(`Deleting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(taskIds.length / batchSize)}`)
        
        // Delete from tasks table first
        const { error: taskDeleteError } = await this.supabase
          .from('tasks')
          .delete()
          .in('id', batchDeleteIds)

        if (taskDeleteError) {
          console.error('Error deleting habit tasks batch:', taskDeleteError)
          throw taskDeleteError
        }

        // Delete corresponding items
        const { error: itemDeleteError } = await this.supabase
          .from('items')
          .delete()
          .in('id', batchDeleteIds)
          
        if (itemDeleteError) {
          console.error('Error deleting habit task items batch:', itemDeleteError)
          throw itemDeleteError
        }
      }

      console.log(`Successfully cleaned up ${taskIds.length} habit tasks`)
    }

    // Now regenerate fresh tasks for all active habits
    console.log('Regenerating fresh habit tasks...')
    await this.regenerateAllHabitTasks()
    console.log('Emergency cleanup complete!')
  }
}