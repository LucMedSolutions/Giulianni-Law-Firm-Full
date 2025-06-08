import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { pathname } = req.nextUrl;

  // Define public paths that don't require authentication
  const publicPaths = ["/", "/setup", "/user-creation"];

  // Allow access to publicPaths and the user creation API route
  if (publicPaths.includes(pathname) || pathname.startsWith("/api/create-supabase-user")) {
    return res; // Allow request to proceed
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();

    // If no session, redirect to homepage (since public paths are already handled)
    if (!session) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // --- IMPORTANT NOTE ---
    // The role-checking logic below (for /admin-dashboard, /staff-dashboard, /client-dashboard)
    // currently uses `supabase.from("users").select("role")` which refers to your *custom* 'users' table.
    // This will NOT work correctly with `session.user.id` from Supabase Auth once you log in
    // with a Supabase Auth user, because the IDs will be different.
    // After you create your staff user in Supabase Auth and update your login page
    // to use `supabase.auth.signInWithPassword()`, you will need to change this logic
    // to check roles from `session.user.user_metadata.role`.

    if (pathname.startsWith("/admin-dashboard")) {
      const { data: userData, error: userDbError } = await supabase.from("users").select("role").eq("id", session.user.id).single();
      if (userDbError || !userData || userData.role !== "admin") {
        console.log("Redirecting from /admin-dashboard due to role mismatch or data issue. User ID from session:", session.user.id, "Error:", userDbError);
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    if (pathname.startsWith("/staff-dashboard")) {
      const { data: userData, error: userDbError } = await supabase.from("users").select("role").eq("id", session.user.id).single();
      if (userDbError || !userData || (userData.role !== "staff" && userData.role !== "admin")) {
        console.log("Redirecting from /staff-dashboard due to role mismatch or data issue. User ID from session:", session.user.id, "Error:", userDbError);
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    if (pathname.startsWith("/client-dashboard")) {
      const { data: userData, error: userDbError } = await supabase.from("users").select("role").eq("id", session.user.id).single();
      if (userDbError || !userData || (userData.role !== "client" && userData.role !== "admin")) {
        console.log("Redirecting from /client-dashboard due to role mismatch or data issue. User ID from session:", session.user.id, "Error:", userDbError);
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    return res; // Allow other authenticated requests to proceed
  } catch (error) {
    console.error("Middleware error:", error);
    return NextResponse.redirect(new URL("/", req.url)); // Fallback redirect
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
