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
    // The role-checking logic below will need to be updated later to use
    // session.user.user_metadata.role once you log in with Supabase Auth users.
    // It currently queries your custom 'users' table.

    if (pathname.startsWith("/admin-dashboard")) {
      const { data: userData, error: userDbError } = await supabase.from("users").select("role").eq("id", session.user.id).single();
      if (userDbError || !userData || userData.role !== "admin") {
        console.log("Redirecting from /admin-dashboard. User ID:", session.user.id, "Error:", userDbError);
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    if (pathname.startsWith("/staff-dashboard")) {
      const { data: userData, error: userDbError } = await supabase.from("users").select("role").eq("id", session.user.id).single();
      if (userDbError || !userData || (userData.role !== "staff" && userData.role !== "admin")) {
        console.log("Redirecting from /staff-dashboard. User ID:", session.user.id, "Error:", userDbError);
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    if (pathname.startsWith("/client-dashboard")) {
      const { data: userData, error: userDbError } = await supabase.from("users").select("role").eq("id", session.user.id).single();
      if (userDbError || !userData || (userData.role !== "client" && userData.role !== "admin")) {
        console.log("Redirecting from /client-dashboard. User ID:", session.user.id, "Error:", userDbError);
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
After updating middleware.ts with this code:

Commit and push this change.
Let Vercel redeploy.
Try accessing /user-creation on your app's URL.
Please let me know if the page loads this time, or if the code is still not visible in this message.
