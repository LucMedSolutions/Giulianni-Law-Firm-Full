import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Publicly accessible routes (API and pages)
  const publicRoutes = [
    "/setup",
    "/api/login",
    "/api/check-auth",
    // Add /api/register-client and /api/create-user if they are public registration endpoints
    // For now, assuming /api/create-user might be protected or has different logic later
  ];

  if (publicRoutes.includes(req.nextUrl.pathname)) {
    return res
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // If user is not signed in and not on root, redirect to login
    // (already handled for non-public routes by this point)
    if (!session && req.nextUrl.pathname !== "/") {
      return NextResponse.redirect(new URL("/", req.url))
    }

    // If there IS a session, proceed with role checks for protected routes
    if (session) {
      let userRole: string | null = null
      try {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single()

        if (userError) throw userError
        userRole = userData?.role || null
      } catch (error) {
        console.error("Error fetching user role in middleware:", error)
        // Redirect to login or an error page if user role cannot be determined
        return NextResponse.redirect(new URL("/", req.url))
      }

      // API Route Protection
      if (req.nextUrl.pathname.startsWith("/api/")) {
        // Check if it's one of the explicitly public API routes already handled.
        // This check might be redundant if publicRoutes check above is comprehensive.
        // However, keeping it ensures clarity for API specific public routes.
        const publicApiRoutes = ["/api/login", "/api/check-auth"]; // Should align with publicRoutes
        if (publicApiRoutes.includes(req.nextUrl.pathname)) {
            return res;
        }

        const adminApiPrefixes = [
          "/api/admin-confirm-email/",
          "/api/cleanup-database/",
          "/api/cleanup-database-direct/",
          "/api/cleanup-database-sql/",
          "/api/confirm-specific-email/",
          "/api/create-delete-cascade-function/",
          "/api/create-delete-function/",
          "/api/create-storage-bucket/",
          "/api/create-user-direct/",
          "/api/create-user-fallback/",
          "/api/create-user-memory/",
          "/api/create-user-raw/",
          "/api/create-user-simple/",
          "/api/delete-user-complete/",
          "/api/delete-user-direct/",
          "/api/delete-user-sql/",
          "/api/delete-user-sql-direct/",
          "/api/force-delete-case/",
          "/api/recover-user/", // Assuming admin for bypass scenarios
          "/api/setup-delete-function/",
          "/api/setup-delete-function-sql/",
          "/api/debug-", // Matches any route starting with /api/debug-
        ];

        // Exact paths that are admin-only (if not covered by prefixes)
        // For this list, most are covered by prefixes by adding a trailing slash or being specific.
        // Example: "/api/exact-admin-route"
        const exactAdminApiRoutes: string[] = [
            // if /api/create-user-direct is meant to be exact without trailing slash, add here.
            // but prefixes like "/api/create-user-direct/" cover it if it's a directory-like path.
        ];

        const pathIsAdminOnly = adminApiPrefixes.some(prefix => req.nextUrl.pathname.startsWith(prefix)) ||
                              exactAdminApiRoutes.includes(req.nextUrl.pathname);

        if (pathIsAdminOnly && userRole !== "admin") {
          console.warn(
            `Attempt to access admin API route ${req.nextUrl.pathname} by user ${session.user.id} with role: ${userRole}`,
          )
          // Redirect to their respective dashboard or a fallback
          if (userRole === "staff") {
            return NextResponse.redirect(new URL("/staff-dashboard", req.url))
          } else if (userRole === "client") {
            return NextResponse.redirect(new URL("/client-dashboard", req.url))
          }
          // Fallback for users with no specific role dashboard or if role is null
          return NextResponse.redirect(new URL("/", req.url))
          // Alternatively, for APIs, a 403 might be more appropriate:
          // return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // Dashboard Protection (using the fetched userRole)
      if (req.nextUrl.pathname.startsWith("/admin-dashboard")) {
        if (userRole !== "admin") {
          if (userRole === "staff") {
            return NextResponse.redirect(new URL("/staff-dashboard", req.url))
          } else if (userRole === "client") {
            return NextResponse.redirect(new URL("/client-dashboard", req.url))
          } else {
            return NextResponse.redirect(new URL("/", req.url))
          }
        }
      } else if (req.nextUrl.pathname.startsWith("/staff-dashboard")) {
        if (userRole !== "staff" && userRole !== "admin") {
          if (userRole === "client") {
            return NextResponse.redirect(new URL("/client-dashboard", req.url))
          } else {
            return NextResponse.redirect(new URL("/", req.url))
          }
        }
      } else if (req.nextUrl.pathname.startsWith("/client-dashboard")) {
        if (userRole !== "client" && userRole !== "admin") {
          if (userRole === "staff") {
            return NextResponse.redirect(new URL("/staff-dashboard", req.url))
          } else {
            return NextResponse.redirect(new URL("/", req.url))
          }
        }
      }
    } // End of if(session) block

    return res
  } catch (error) {
    console.error("Middleware error:", error)
    // In case of any other error, redirect to login page
    // In case of any error, redirect to login page
    return NextResponse.redirect(new URL("/", req.url))
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
