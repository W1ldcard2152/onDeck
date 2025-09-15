import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export class HabitTaskActivator {
  constructor(
    private supabase: SupabaseClient<Database>,
    private userId: string
  ) {}

  /**
   * Activate all habit tasks that are assigned for today and still on_deck
   */
  async activateTodaysTasks(): Promise<void> {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD format
    
    console.log(`=== HABIT ACTIVATION DEBUG ===`)
    console.log(`Today's date: ${todayStr}`)
    console.log(`Looking for habit tasks assigned for today...`)

    try {
      // First, let's see ALL habit tasks and their assigned dates
      const { data: allHabitTasks } = await this.supabase
        .from('tasks')
        .select('id, habit_id, status, assigned_date')
        .not('habit_id', 'is', null)
        .order('assigned_date', { ascending: true })
      
      console.log(`Total habit tasks in database: ${allHabitTasks?.length || 0}`)
      
      const todayTasks = allHabitTasks?.filter(t => t.assigned_date === todayStr) || []
      const habitTodayTasks = todayTasks.filter(t => t.status === 'habit')
      const activeTodayTasks = todayTasks.filter(t => t.status === 'active')
      
      console.log(`Tasks for today (${todayStr}): ${todayTasks.length}`)
      console.log(`- Habit status: ${habitTodayTasks.length}`)
      console.log(`- Active: ${activeTodayTasks.length}`)
      console.log('Today task details:', todayTasks.map(t => ({ id: t.id, status: t.status, assigned_date: t.assigned_date })))

      if (todayTasks.length === 0) {
        console.log('❌ NO HABIT TASKS SCHEDULED FOR TODAY')
        console.log('Sample of upcoming tasks:', allHabitTasks?.filter(t => t.assigned_date && t.assigned_date > todayStr).slice(0, 5).map(t => ({ assigned_date: t.assigned_date, status: t.status })))
        return
      }
      // Find all habit status habit tasks assigned for today
      const { data: tasksToActivate, error: findError } = await this.supabase
        .from('tasks')
        .select('id, habit_id, status, assigned_date')
        .eq('assigned_date', todayStr)
        .eq('status', 'habit')
        .not('habit_id', 'is', null)

      if (findError) {
        console.error('Error finding tasks to activate:', findError)
        throw findError
      }

      if (!tasksToActivate || tasksToActivate.length === 0) {
        console.log('No habit status habit tasks found for today')
        return
      }

      console.log(`Found ${tasksToActivate.length} habit tasks to activate for today:`, tasksToActivate.map(t => t.id))

      // Update all found tasks to active status
      const taskIds = tasksToActivate.map(t => t.id)
      
      const { error: updateError } = await this.supabase
        .from('tasks')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .in('id', taskIds)

      if (updateError) {
        console.error('Error activating tasks:', updateError)
        throw updateError
      }

      // Also update the corresponding items' updated_at timestamp
      const { error: itemUpdateError } = await this.supabase
        .from('items')
        .update({ 
          updated_at: new Date().toISOString()
        })
        .in('id', taskIds)

      if (itemUpdateError) {
        console.error('Error updating item timestamps:', itemUpdateError)
        // Don't throw here, as the main update succeeded
      }

      console.log(`Successfully activated ${taskIds.length} habit tasks for today`)
      
      // Verify the activation worked
      const { data: verifyTasks } = await this.supabase
        .from('tasks')
        .select('id, status, assigned_date')
        .in('id', taskIds)
      
      console.log('Verification - activated tasks now have status:', verifyTasks?.map(t => `${t.id}: ${t.status}`))
      
    } catch (error) {
      console.error('Failed to activate today\'s tasks:', error)
      throw error
    }
  }

  /**
   * Check and activate tasks if needed (safe to call multiple times)
   */
  async ensureTodaysTasksAreActive(): Promise<boolean> {
    try {
      await this.activateTodaysTasks()
      return true
    } catch (error) {
      console.error('Error in ensureTodaysTasksAreActive:', error)
      return false
    }
  }
}