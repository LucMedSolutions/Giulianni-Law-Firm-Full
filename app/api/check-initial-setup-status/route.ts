import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic' // Ensure fresh data on each request

export async function GET() {
  // Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Supabase URL or Service Role Key is not defined.')
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

  try {
    const { data, error, count } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .eq('role', 'admin')
      .limit(1) // We only need to know if at least one exists

    if (error) {
      console.error('Error checking for admin user:', error)
      return NextResponse.json({ error: 'Database error while checking admin status.' }, { status: 500 })
    }

    const isAdminSetupComplete = count !== null && count > 0
    return NextResponse.json({ isAdminSetupComplete })
  } catch (e: any) {
    console.error('Unexpected error in check-initial-setup-status:', e)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}
