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
    const body = await request.json();
    const { email, password, fullName } = body;

    // 1. Type Checking
    if (typeof email !== 'string' || typeof password !== 'string' || typeof fullName !== 'string') {
      console.warn(`[REGISTRATION_VALIDATION_FAIL] Operation: Type Check | Details: Invalid input types. Email: ${typeof email}, Password: ${typeof password}, FullName: ${typeof fullName}`);
      return NextResponse.json({ error: "Invalid input type. Email, password, and fullName must be strings." }, { status: 400 });
    }

    // 2. Input Sanitization
    const trimmedEmail = email.trim();
    const trimmedFullName = fullName.trim();
    // Password is not trimmed.

    // 3. Presence Check (using trimmed values where appropriate)
    // Updated error message to be more specific as per original instruction if needed, but "All fields are required" is also fine.
    if (!trimmedEmail || !password || !trimmedFullName) {
      console.warn(`[REGISTRATION_VALIDATION_FAIL] Operation: Presence Check | Details: A required field is empty after trimming. Email empty: ${!trimmedEmail}, Password empty: ${!password}, FullName empty: ${!trimmedFullName}`);
      return NextResponse.json({ error: "All fields are required (after trimming whitespace from email and full name)" }, { status: 400 });
    }

    // 4. Email Format Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Basic regex
    if (!emailRegex.test(trimmedEmail)) {
      console.warn(`[REGISTRATION_VALIDATION_FAIL] Operation: Email Format Check | Email: ${trimmedEmail} | Details: Invalid email format.`);
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // 5. Password Complexity (Minimum Length)
    if (password.length < 8) {
      console.warn(`[REGISTRATION_VALIDATION_FAIL] Operation: Password Length Check | Details: Password length is less than 8 characters.`);
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
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
        console.error(`[REGISTRATION_ERROR] Operation: supabaseAdmin.rpc('set_admin_flag') | Details: ${rpcError.message}`);
        const status = rpcError.message === 'Timeout setting admin flag via RPC' ? 504 : 500;
        return NextResponse.json({ error: "Server configuration step failed.", details: rpcError.message }, { status });
    }

    // Create the auth user with confirmed email
    const { data: authData, error: authError } = await withTimeout(
      supabaseAdmin.auth.admin.createUser({
        email: trimmedEmail, // Use trimmedEmail
        password, // Use original password
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: trimmedFullName, // Use trimmedFullName
          role: "client",
        },
      }),
      SUPABASE_TIMEOUT_MS,
      new Error('Timeout creating auth user')
    );

    if (authError) {
      console.error(`[REGISTRATION_ERROR] Operation: supabaseAdmin.auth.admin.createUser | Details: ${authError.message}`);
      const status = authError.message === 'Timeout creating auth user' ? 504 : (authError.message.includes("already exist") ? 409 : 500);
      return NextResponse.json({ error: "Failed to create user.", details: authError.message }, { status });
    }

    if (!authData || !authData.user) { // Ensure authData and authData.user are not null
      console.error("[REGISTRATION_ERROR] Operation: supabaseAdmin.auth.admin.createUser | Details: No user data returned from auth.admin.createUser call despite no authError.");
      return NextResponse.json({ error: "Failed to create user, no user data returned." }, { status: 500 });
    }

    // Create the user profile in the users table
    const { error: profileError } = await withTimeout(
      supabaseAdmin.from("users").insert({
        id: authData.user.id,
        email: trimmedEmail, // Use trimmedEmail, ensure it matches the auth user's email
        full_name: trimmedFullName, // Use trimmedFullName
        role: "client",
        created_at: new Date().toISOString(),
        last_login: null, // Explicitly set null if that's the desired default
      }),
      SUPABASE_TIMEOUT_MS,
      new Error('Timeout creating user profile')
    );

    if (profileError) {
      console.error(`[REGISTRATION_ERROR] Operation: supabaseAdmin.from('users').insert | UserID: ${authData.user.id} | Details: ${profileError.message}`);
      // If profile creation fails, attempt to clean up the auth user
      try {
        await withTimeout(
          supabaseAdmin.auth.admin.deleteUser(authData.user.id),
          SUPABASE_TIMEOUT_MS,
          new Error('Timeout deleting auth user during cleanup')
        );
        console.log(`[REGISTRATION_CLEANUP_INFO] Operation: supabaseAdmin.auth.admin.deleteUser | UserID: ${authData.user.id} | Details: Successfully cleaned up auth user after profile creation failure.`);
      } catch (cleanupError: any) {
        console.error(`[REGISTRATION_CLEANUP_ERROR] Operation: supabaseAdmin.auth.admin.deleteUser | UserID: ${authData.user.id} | Details: ${cleanupError.message}`);
        // Log this error, but the primary error to return is profileError
      }
      const status = profileError.message === 'Timeout creating user profile' ? 504 : 500;
      return NextResponse.json({ error: "Failed to create user profile.", details: profileError.message }, { status });
    }

    console.log(`[REGISTRATION_SUCCESS] Client registered successfully: ${trimmedEmail} | UserID: ${authData.user.id}`); // Use trimmedEmail for logging

    return NextResponse.json({
      success: true,
      message: "Client registered successfully",
      user: {
        id: authData.user.id,
        email: authData.user.email, // This will be the same as trimmedEmail from Supabase response
        role: "client",
      },
    })
  } catch (error: any) {
    // Catch if request.json() fails or any other unexpected error
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
      console.warn(`[REGISTRATION_VALIDATION_FAIL] Operation: JSON Parsing | Details: ${error.message}`);
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Enhanced error logging for unhandled errors
    console.error(
      `[REGISTRATION_UNHANDLED_ERROR] Type: ${error?.constructor?.name} | Message: ${error?.message} | Stack: ${error?.stack}`
    );

    // Determine status code (504 for timeout, 500 otherwise)
    // This checks if the error message itself indicates a timeout.
    // More specific timeout errors from `withTimeout` should be caught earlier.
    const status = (error?.message && typeof error.message === 'string' && error.message.toLowerCase().includes('timeout')) ? 504 : 500;

    const errorPayload = {
      error: "An unexpected error occurred during registration.",
      // Ensure detail is always a string and serializable
      detail: (error?.message && typeof error.message === 'string') ? error.message : "No additional details available."
    };

    // Log the payload and status that will be sent
    console.log(
      `[REGISTRATION_UNHANDLED_ERROR_RESPONSE] Attempting to send error payload: ${JSON.stringify(errorPayload)} with status: ${status}`
    );

    return NextResponse.json(errorPayload, { status });
  }
}
