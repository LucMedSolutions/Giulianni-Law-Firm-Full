import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutError = new Error('Operation timed out')): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(timeoutError), ms))
  ]);
}

const SUPABASE_TIMEOUT_MS = 10000; // 10 seconds, adjust as needed

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
  try {
    const { email, password, fullName } = await request.json()

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Create admin client for user creation
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // First, set the admin flag - This seems like a potentially problematic design.
    // Setting a global admin flag before user creation could have unintended side effects
    // if other operations are concurrent. However, I will add timeout as requested.
    const { error: rpcError } = await withTimeout(
        supabaseAdmin.rpc("set_admin_flag", { is_admin: true }),
        SUPABASE_TIMEOUT_MS,
        new Error('Timeout setting admin flag via RPC')
    );

    if (rpcError) {
        console.error("RPC set_admin_flag error:", rpcError.message);
        const status = rpcError.message === 'Timeout setting admin flag via RPC' ? 504 : 500;
        return NextResponse.json({ error: "Server configuration step failed.", details: rpcError.message }, { status });
    }

    // Create the auth user with confirmed email
    const { data: authData, error: authError } = await withTimeout(
      supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: fullName,
          role: "client",
        },
      }),
      SUPABASE_TIMEOUT_MS,
      new Error('Timeout creating auth user')
    );

    if (authError) {
      console.error("Auth user creation error:", authError.message);
      const status = authError.message === 'Timeout creating auth user' ? 504 : (authError.message.includes("already exist") ? 409 : 500);
      return NextResponse.json({ error: "Failed to create user.", details: authError.message }, { status });
    }

    if (!authData || !authData.user) { // Ensure authData and authData.user are not null
      console.error("No user data returned from auth.admin.createUser");
      return NextResponse.json({ error: "Failed to create user, no user data returned." }, { status: 500 });
    }

    // Create the user profile in the users table
    const { error: profileError } = await withTimeout(
      supabaseAdmin.from("users").insert({
        id: authData.user.id,
        email: authData.user.email!, // email should exist on user object from createUser
        full_name: fullName,
        role: "client",
        created_at: new Date().toISOString(),
        last_login: null, // Explicitly set null if that's the desired default
      }),
      SUPABASE_TIMEOUT_MS,
      new Error('Timeout creating user profile')
    );

    if (profileError) {
      console.error("Profile creation error:", profileError.message);
      // If profile creation fails, attempt to clean up the auth user
      try {
        await withTimeout(
          supabaseAdmin.auth.admin.deleteUser(authData.user.id),
          SUPABASE_TIMEOUT_MS,
          new Error('Timeout deleting auth user during cleanup')
        );
        console.log(`Cleaned up auth user ${authData.user.id} after profile creation failure.`);
      } catch (cleanupError: any) {
        console.error("Failed to clean up auth user:", cleanupError.message);
        // Log this error, but the primary error to return is profileError
      }
      const status = profileError.message === 'Timeout creating user profile' ? 504 : 500;
      return NextResponse.json({ error: "Failed to create user profile.", details: profileError.message }, { status });
    }

    console.log(`Client registered successfully: ${email}`);

    return NextResponse.json({
      success: true,
      message: "Client registered successfully",
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: "client",
      },
    })
  } catch (error: any) {
    console.error("Registration error:", error)
    return NextResponse.json(
      {
        error: error.message || "An unexpected error occurred during registration.",
        details: error.details || error.message, // provide more details if available
      },
      { status: (error.message && error.message.toLowerCase().includes('timeout')) ? 504 : 500 },
    );
  }
}
