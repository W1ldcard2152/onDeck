import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HabitTaskGenerator } from '../../../src/lib/habitTaskGenerator.ts'

Deno.serve(async (req) => {
  try {
    // Create Supabase client with service role key for admin access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all users with active habits
    const { data: users, error: usersError } = await supabase
      .from('habits')
      .select('user_id')
      .eq('is_active', true)
      .distinct()

    if (usersError) throw usersError

    const results = []
    
    // Run monthly regeneration for each user
    for (const user of users || []) {
      try {
        const generator = new HabitTaskGenerator(supabase, user.user_id)
        await generator.monthlyRegeneration()
        results.push({ userId: user.user_id, status: 'success' })
      } catch (error) {
        console.error(`Failed regeneration for user ${user.user_id}:`, error)
        results.push({ userId: user.user_id, status: 'error', error: error.message })
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Monthly regeneration complete',
        timestamp: new Date().toISOString(),
        results 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})