import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Habit, RecurrenceRule } from '@/hooks/useHabits'

export class HabitTaskGenerator {
  constructor(
    private supabase: SupabaseClient<Database>,
    private userId: string
  ) {}

  /**
   * Quick regeneration - only creates missing tasks for today and the future
   * Preserves all existing tasks
   */
  async quickRegenerateHabitTasks(habit: Habit): Promise<void> {
    console.log('Quick regeneration for habit:', habit.title)
    
    if (!habit.is_active) {
      console.log('Habit is inactive, skipping')
      return
    }

    // Check what tasks already exist
    const today = new Date().toISOString().split('T')[0]
    const { data: existingTasks } = await this.supabase
      .from('tasks')
      .select('id, assigned_date')
      .eq('habit_id', habit.id)
      .gte('assigned_date', today)
    
    const existingDates = new Set(existingTasks?.map(t => t.assigned_date) || [])
    console.log(`Found ${existingDates.size} existing future tasks for habit`)
    
    // Generate dates for the next 30 days
    const dates = this.generateDatesForHabit(habit, 30, 5)
    
    // Only create tasks for dates that don't exist yet
    let created = 0
    for (const date of dates) {
      const dateStr = date.toISOString().split('T')[0]
      if (!existingDates.has(dateStr)) {
        await this.createHabitTask(habit, date)
        created++
      }
    }
    
    console.log(`Created ${created} new tasks for habit ${habit.title}`)
  }

  /**
   * Generate tasks for a habit over the next 30 days
   */
  async generateTasksForHabit(habit: Habit, fullRegeneration: boolean = false): Promise<void> {
    console.log('generateTasksForHabit called with habit:', {
      id: habit.id,
      title: habit.title,
      recurrence_rule: habit.recurrence_rule,
      recurrence_rule_type: typeof habit.recurrence_rule,
      has_time_of_day: habit.recurrence_rule?.time_of_day,
      fullRegeneration
    })
    
    if (!habit.is_active) {
      throw new Error('Cannot generate tasks for inactive habit')
    }

    if (fullRegeneration) {
      // For full regeneration, clear ALL incomplete tasks for this habit
      console.log('Full regeneration: clearing ALL incomplete tasks for habit:', habit.id)
      await this.clearAllIncompleteHabitTasks(habit.id, true) // true = preserve today's and future tasks
      
      // Add a small delay to ensure deletion completes
      await new Promise(resolve => setTimeout(resolve, 500))
    } else {
      // For regular generation, check if tasks already exist
      const { data: existingTasks } = await this.supabase
        .from('tasks')
        .select('id')
        .eq('habit_id', habit.id)
        .gte('assigned_date', new Date().toISOString().split('T')[0])
        .limit(1)
      
      if (existingTasks && existingTasks.length > 0) {
        console.log('Tasks already exist for this habit, skipping generation to avoid duplicates')
        return
      }
      console.log('No existing future tasks found, proceeding with generation')
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
   * Preserves ALL of today's tasks (both active and on_deck) to avoid deleting current tasks
   */
  async clearAllIncompleteHabitTasks(habitId: string, preserveFuture: boolean = false): Promise<void> {
    console.log(`=== CLEARING ALL INCOMPLETE TASKS FOR HABIT ${habitId} (preserveFuture: ${preserveFuture}) ===`)

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

    // Get all incomplete tasks first, then filter based on preserveFuture parameter
    const { data: allIncomplete, error } = await this.supabase
      .from('tasks')
      .select('id, assigned_date, status')
      .eq('habit_id', habitId)
      .neq('status', 'completed')

    if (error) {
      console.error('Error finding incomplete tasks:', error)
      return
    }

    // Determine which tasks to delete based on preserveFuture parameter
    let tasksToDelete
    if (preserveFuture) {
      // Only delete past incomplete tasks when doing full regeneration
      tasksToDelete = allIncomplete?.filter(task => {
        if (!task.assigned_date) return true; // Delete tasks with no date
        return task.assigned_date < todayStr; // Only delete past tasks
      }) || []
      console.log(`Found ${tasksToDelete?.length || 0} past incomplete tasks to delete for habit ${habitId} (preserving today's and future tasks)`)
    } else {
      // Delete ALL incomplete tasks (used when deactivating a habit)
      tasksToDelete = allIncomplete || []
      console.log(`Found ${tasksToDelete?.length || 0} incomplete tasks to delete for habit ${habitId} (deleting ALL incomplete tasks)`)
    }

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
   * Clear only past on_deck habit tasks that have been superseded by newer tasks
   * Preserves past due active tasks and incomplete tasks without replacements
   */
  async clearPastIncompleteHabitTasks(habitId: string): Promise<void> {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    console.log(`Checking for superseded tasks for habit ${habitId}. Today: ${todayStr}`)

    // Get ALL tasks for this habit to check for replacements
    const { data: allHabitTasks, error: allError } = await this.supabase
      .from('tasks')
      .select('id, assigned_date, status')
      .eq('habit_id', habitId)
      .order('assigned_date', { ascending: true })

    if (allError) {
      console.error('Error finding habit tasks:', allError)
      return
    }

    if (!allHabitTasks || allHabitTasks.length === 0) {
      console.log('No tasks found for this habit')
      return
    }

    // Group tasks by date to find superseded ones
    const tasksByDate = new Map<string, typeof allHabitTasks>()
    for (const task of allHabitTasks) {
      const date = task.assigned_date || ''
      if (!tasksByDate.has(date)) {
        tasksByDate.set(date, [])
      }
      tasksByDate.get(date)!.push(task)
    }

    const tasksToDelete: string[] = []

    // Only delete past on_deck tasks for this habit if there's a newer task
    const pastHabitTasks = allHabitTasks.filter(t =>
      t.status === 'on_deck' &&
      t.assigned_date &&
      t.assigned_date < todayStr
    )

    for (const oldTask of pastHabitTasks) {
      // Check if there's any task (completed or not) that's newer than this one
      const hasNewerTask = allHabitTasks.some(t => 
        t.assigned_date && 
        oldTask.assigned_date &&
        t.assigned_date > oldTask.assigned_date
      )

      if (hasNewerTask) {
        console.log(`Task ${oldTask.id} (${oldTask.assigned_date}) will be deleted because newer tasks exist`)
        tasksToDelete.push(oldTask.id)
      } else {
        console.log(`Task ${oldTask.id} (${oldTask.assigned_date}) will be PRESERVED - no newer replacement exists`)
      }
    }

    if (tasksToDelete.length > 0) {
      // Delete from tasks table
      const { error: taskDeleteError } = await this.supabase
        .from('tasks')
        .delete()
        .in('id', tasksToDelete)

      if (taskDeleteError) {
        console.error('Error deleting superseded tasks:', taskDeleteError)
        return
      }

      // Delete corresponding items
      const { error: itemDeleteError } = await this.supabase
        .from('items')
        .delete()
        .in('id', tasksToDelete)
        
      if (itemDeleteError) {
        console.error('Error deleting superseded items:', itemDeleteError)
      } else {
        console.log(`Successfully deleted ${tasksToDelete.length} superseded habit tasks`)
      }
    } else {
      console.log('No superseded habit tasks found to delete')
    }
  }

  /**
   * Force update ALL habit tasks with times - more aggressive approach
   */
  async forceUpdateAllHabitTaskTimes(): Promise<void> {
    console.log('=== FORCE UPDATING ALL HABIT TASK TIMES ===');

    // First get ALL habit tasks for this user
    const { data: habitTasks, error: tasksError } = await this.supabase
      .from('tasks')
      .select('id, habit_id, assigned_date')
      .not('habit_id', 'is', null);

    if (tasksError || !habitTasks) {
      console.error('Error fetching habit tasks:', tasksError);
      return;
    }

    console.log(`Found ${habitTasks.length} total habit tasks to check`);

    // Get all habits
    const { data: habits, error: habitsError } = await this.supabase
      .from('habits')
      .select('id, title, recurrence_rule')
      .eq('user_id', this.userId);

    if (habitsError || !habits) {
      console.error('Error fetching habits:', habitsError);
      return;
    }

    // Create a map of habit_id to parsed habit data
    const habitMap = new Map();
    for (const habit of habits) {
      const rule = typeof habit.recurrence_rule === 'string'
        ? JSON.parse(habit.recurrence_rule)
        : habit.recurrence_rule;

      habitMap.set(habit.id, {
        title: habit.title,
        time_of_day: rule?.time_of_day
      });
    }

    console.log('Habit time mapping:', Array.from(habitMap.entries()));

    // Update each habit task
    let updatedCount = 0;
    for (const task of habitTasks) {
      const habitData = habitMap.get(task.habit_id);
      if (habitData?.time_of_day && task.assigned_date) {
        const [year, month, day] = task.assigned_date.split('-').map(Number);
        const [hours, minutes] = habitData.time_of_day.split(':').map(Number);
        const reminderDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
        const reminder_time = reminderDate.toISOString();

        const { error: updateError } = await this.supabase
          .from('tasks')
          .update({ reminder_time })
          .eq('id', task.id);

        if (!updateError) {
          updatedCount++;
          console.log(`Updated task ${task.id} for habit "${habitData.title}" with time ${habitData.time_of_day}`);
        }
      }
    }

    console.log(`Force updated ${updatedCount} habit tasks with times`);
  }

  /**
   * Update existing habit tasks with reminder_time from their habit's time_of_day
   */
  async updateExistingHabitTaskTimes(): Promise<void> {
    console.log('=== UPDATING EXISTING HABIT TASK TIMES ===');
    console.log(`Running for user: ${this.userId}`);

    // Get all habits with time_of_day
    const { data: habits, error: habitsError } = await this.supabase
      .from('habits')
      .select('id, title, recurrence_rule')
      .eq('user_id', this.userId)
      .eq('is_active', true);

    if (habitsError) {
      console.error('Error fetching habits:', habitsError);
      return;
    }

    if (!habits || habits.length === 0) {
      console.log('No active habits found');
      return;
    }

    // Parse recurrence_rule if it's stored as JSON string
    const habitsWithParsedRules = habits.map(h => ({
      ...h,
      recurrence_rule: typeof h.recurrence_rule === 'string'
        ? JSON.parse(h.recurrence_rule)
        : h.recurrence_rule
    }));

    // Filter habits that have time_of_day
    const habitsWithTime = habitsWithParsedRules.filter(h => h.recurrence_rule?.time_of_day);
    console.log(`Found ${habitsWithTime.length} habits with time_of_day`);
    console.log('Habits with time:', habitsWithTime.map(h => ({
      id: h.id,
      title: h.title,
      time_of_day: h.recurrence_rule?.time_of_day,
      recurrence_rule_type: typeof h.recurrence_rule
    })));

    for (const habit of habitsWithTime) {
      const time = habit.recurrence_rule.time_of_day;

      // Get all tasks for this habit that don't have reminder_time set
      const { data: tasks, error: tasksError } = await this.supabase
        .from('tasks')
        .select('id, assigned_date')
        .eq('habit_id', habit.id)
        .is('reminder_time', null)
        .not('assigned_date', 'is', null);

      if (tasksError) {
        console.error(`Error fetching tasks for habit ${habit.id}:`, tasksError);
        continue;
      }

      if (!tasks || tasks.length === 0) {
        console.log(`No tasks without reminder_time for habit ${habit.id}`);
        continue;
      }

      console.log(`Updating ${tasks.length} tasks for habit ${habit.id} with time ${time}`);

      // Update each task with the reminder_time
      for (const task of tasks) {
        const [year, month, day] = task.assigned_date.split('-').map(Number);
        const [hours, minutes] = time.split(':').map(Number);
        const reminderDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
        const reminder_time = reminderDate.toISOString();

        console.log(`  Updating task ${task.id} (${task.assigned_date}) with reminder_time: ${reminder_time}`);

        const { error: updateError } = await this.supabase
          .from('tasks')
          .update({ reminder_time })
          .eq('id', task.id);

        if (updateError) {
          console.error(`Error updating task ${task.id}:`, updateError);
        } else {
          console.log(`  Successfully updated task ${task.id}`);
        }
      }
    }

    console.log('Finished updating existing habit task times');
  }

  /**
   * Generate dates based on recurrence rule
   */
  private generateDatesForHabit(habit: Habit, dayCount: number, minTasks: number = 1): Date[] {
    // Parse recurrence_rule if it's a string
    const rule = typeof habit.recurrence_rule === 'string'
      ? JSON.parse(habit.recurrence_rule)
      : habit.recurrence_rule
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
    console.log(`createHabitTask called for "${habit.title}" on ${dateStr}`);
    console.log(`  recurrence_rule exists: ${!!habit.recurrence_rule}`);
    console.log(`  time_of_day: ${habit.recurrence_rule?.time_of_day || 'NOT SET'}`)
    
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

    // Combine assigned date with time of day for reminder_time
    let reminder_time = null;

    // Parse recurrence_rule if it's a string
    const recurrenceRule = typeof habit.recurrence_rule === 'string'
      ? JSON.parse(habit.recurrence_rule)
      : habit.recurrence_rule;

    if (recurrenceRule?.time_of_day && dateStr) {
      // Parse the date string and add the time
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = recurrenceRule.time_of_day.split(':').map(Number);
      const reminderDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
      reminder_time = reminderDate.toISOString();
      console.log(`Setting reminder_time for habit task: ${habit.title} on ${dateStr} at ${recurrenceRule.time_of_day} => ${reminder_time}`);
    } else {
      console.log(`No time_of_day for habit: ${habit.title}, time_of_day: ${recurrenceRule?.time_of_day}, dateStr: ${dateStr}, recurrence_rule type: ${typeof habit.recurrence_rule}`);
    }

    // Create task
    const { error: taskError } = await this.supabase
      .from('tasks')
      .insert({
        id: item.id,
        assigned_date: dateStr,
        due_date: null,
        reminder_time: reminder_time,
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
   * Also cleans up ALL incomplete tasks for inactive habits
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

    // Also clean up ALL incomplete tasks for inactive habits
    const { data: inactiveHabits, error: inactiveError } = await this.supabase
      .from('habits')
      .select('id')
      .eq('user_id', this.userId)
      .eq('is_active', false)

    if (inactiveError) {
      console.error('Error fetching inactive habits:', inactiveError)
    } else {
      for (const habit of inactiveHabits || []) {
        try {
          console.log(`Cleaning up ALL incomplete tasks for inactive habit ${habit.id}`)
          await this.clearAllIncompleteHabitTasks(habit.id, false) // false = delete ALL incomplete tasks
        } catch (e) {
          console.error(`Failed to cleanup tasks for inactive habit ${habit.id}:`, e)
        }
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