import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutError = new Error('Operation timed out')): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(timeoutError), ms))
  ]);
}

const SUPABASE_TIMEOUT_MS = 10000; // 10 seconds, adjust as needed


export async function POST(request: Request) {
  try {
    // For request.json(), timeout is less critical unless expecting very large payloads
    // However, to be consistent, one could wrap it if needed:
    // const { email, password, fullName, role, staffRole } = await withTimeout(request.json(), 5000, new Error('Request body parsing timed out'));
    const { email, password, fullName, role, staffRole } = await request.json();

    // Validate input
    if (!email || !password || !fullName || !role) {
      return NextResponse.json({ error: "Email, password, full name, and role are required" }, { status: 400 })
    }

    // Validate staff role if role is staff
    if (role === "staff" && !staffRole) {
      return NextResponse.json({ error: "Staff role is required for staff users" }, { status: 400 })
    }

    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing required environment variables")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Get the current user for audit logging
    const supabaseClient = createRouteHandlerClient({ cookies });
    let sessionWrapper;
    try {
      sessionWrapper = await withTimeout(
        supabaseClient.auth.getSession(),
        SUPABASE_TIMEOUT_MS,
        new Error('Timeout getting session for audit logging')
      );
    } catch (error: any) {
      console.error("Error getting session for audit log:", error.message);
      // Non-critical for user creation itself, but log it. Could choose to proceed or return error.
      // For now, let's proceed but log that audit might be incomplete.
      sessionWrapper = { data: { session: null }, error: null }; // Default to allow proceeding
      if (error.message.includes('Timeout')) {
        // Optionally, handle timeout specifically, e.g., by returning an error or logging differently
        console.warn('Session fetch for audit log timed out. User creation will proceed without audit user context if not already available.');
      }
    }
    const session = sessionWrapper?.data?.session;


    // Create a direct Supabase client with the service role key
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Create the user with the admin API and explicitly set email_confirm to true
    const { data: authData, error: authError } = await withTimeout(
      supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Explicitly confirm the email
        user_metadata: {
          full_name: fullName,
          role,
          staff_role: staffRole,
        },
      }),
      SUPABASE_TIMEOUT_MS,
      new Error('Timeout creating user in auth')
    );

    if (authError) {
      console.error("Auth error:", authError.message);
      if (authError.message.includes("already exists") || authError.message.includes("duplicate")) {
        return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 });
      }
      const status = authError.message === 'Timeout creating user in auth' ? 504 : 500;
      return NextResponse.json({ error: authError.message }, { status });
    }

    if (!authData || !authData.user) {
      console.error("No user data returned from auth.admin.createUser");
      return NextResponse.json({ error: "Failed to create user in auth" }, { status: 500 });
    }

    // Insert the user directly into the users table
    const { error: insertError } = await withTimeout(
      supabaseAdmin.from("users").insert({
        id: authData.user.id,
        email: email,
        full_name: fullName,
        role: role,
        staff_role: role === "staff" ? staffRole : null,
        created_at: new Date().toISOString(),
      }),
      SUPABASE_TIMEOUT_MS,
      new Error('Timeout inserting user into public.users table')
    );

    if (insertError) {
      console.error("Insert error:", insertError.message);
      // If we fail to insert into the users table, try to delete the auth user to maintain consistency
      try {
        await withTimeout(
          supabaseAdmin.auth.admin.deleteUser(authData.user.id),
          SUPABASE_TIMEOUT_MS,
          new Error('Timeout deleting auth user after insert error')
        );
      } catch (deleteError: any) {
        console.error("Failed to clean up auth user after insert error:", deleteError.message);
        // Log the delete error, but the primary error is the insertError
      }
      const status = insertError.message === 'Timeout inserting user into public.users table' ? 504 : 500;
      return NextResponse.json({ error: insertError.message }, { status });
    }

    // Log the user creation in audit logs
    if (session && session.user) { // Ensure session and session.user exist
      try {
        await withTimeout(
          supabaseAdmin.from("audit_logs").insert({
            user_id: session.user.id,
            action: "create_user",
            details: `Created user: ${fullName} (${email}) with role: ${role}${role === "staff" ? ` (${staffRole})` : ""}`,
            resource_type: "user",
            resource_id: authData.user.id,
            ip_address: "API request", // Consider how to get a real IP if needed
          }),
          SUPABASE_TIMEOUT_MS,
          new Error('Timeout inserting audit log')
        );
      } catch (auditError: any) {
        console.error("Audit log error:", auditError.message);
        // Non-critical, so don't fail the request, but log it.
        if (auditError.message === 'Timeout inserting audit log') {
          console.warn('Audit log insertion timed out.');
        }
      }
    } else {
      console.warn("No session or session user found, skipping audit log for user creation.");
    }

    return NextResponse.json({
      success: true,
      message: `User ${fullName} created successfully with role: ${role}${role === "staff" ? ` (${staffRole})` : ""}`,
      note: "Email confirmation has been bypassed. User can log in immediately.",
    });
  } catch (error: any) {
    console.error("Unexpected error in create-user API:", error.message, error);
    if (error.message && error.message.toLowerCase().includes('timeout')) {
      return NextResponse.json({ error: 'An operation timed out.', details: error.message }, { status: 504 });
    }
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 });
  }
}
