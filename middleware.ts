import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Allow direct access to /setup without authentication
  if (req.nextUrl.pathname === "/setup") {
    return res
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // If user is not signed in and the current path is not / redirect the user to /
    if (!session && req.nextUrl.pathname !== "/") {
      return NextResponse.redirect(new URL("/", req.url))
    }

    // If user is trying to access admin routes, check if they are an admin
    if (req.nextUrl.pathname.startsWith("/admin-dashboard")) {
      if (!session) {
        return NextResponse.redirect(new URL("/", req.url))
      }

      try {
        // Get user role
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single()

        if (userError) {
          console.error("Error fetching user role:", userError)
          return NextResponse.redirect(new URL("/", req.url))
        }

        if (!userData || userData.role !== "admin") {
          // Redirect non-admin users to the appropriate dashboard
          if (userData?.role === "staff") {
            return NextResponse.redirect(new URL("/staff-dashboard", req.url))
          } else if (userData?.role === "client") {
            return NextResponse.redirect(new URL("/client-dashboard", req.url))
          } else {
            return NextResponse.redirect(new URL("/", req.url))
          }
        }
      } catch (error) {
        console.error("Error in admin authorization check:", error)
        return NextResponse.redirect(new URL("/", req.url))
      }
    }

    // If user is trying to access staff routes, check if they are staff or admin
    if (req.nextUrl.pathname.startsWith("/staff-dashboard")) {
      if (!session) {
        return NextResponse.redirect(new URL("/", req.url))
      }

      try {
        // Get user role
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single()

        if (userError) {
          console.error("Error fetching user role:", userError)
          return NextResponse.redirect(new URL("/", req.url))
        }

        // Allow both staff and admin to access staff dashboard
        if (!userData || (userData.role !== "staff" && userData.role !== "admin")) {
          // Redirect non-staff users to the appropriate dashboard
          if (userData?.role === "client") {
            return NextResponse.redirect(new URL("/client-dashboard", req.url))
          } else {
            return NextResponse.redirect(new URL("/", req.url))
          }
        }
      } catch (error) {
        console.error("Error in staff authorization check:", error)
        return NextResponse.redirect(new URL("/", req.url))
      }
    }

    // If user is trying to access client routes, check if they are client
    if (req.nextUrl.pathname.startsWith("/client-dashboard")) {
      if (!session) {
        return NextResponse.redirect(new URL("/", req.url))
      }

      try {
        // Get user role
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single()

        if (userError) {
          console.error("Error fetching user role:", userError)
          return NextResponse.redirect(new URL("/", req.url))
        }

        // Allow both client and admin to access client dashboard
        if (!userData || (userData.role !== "client" && userData.role !== "admin")) {
          // Redirect non-client users to the appropriate dashboard
          if (userData?.role === "staff") {
            return NextResponse.redirect(new URL("/staff-dashboard", req.url))
          } else {
            return NextResponse.redirect(new URL("/", req.url))
          }
        }
      } catch (error) {
        console.error("Error in client authorization check:", error)
        return NextResponse.redirect(new URL("/", req.url))
      }
    }

    return res
  } catch (error) {
    console.error("Middleware error:", error)
    // In case of any error, redirect to login page
    return NextResponse.redirect(new URL("/", req.url))
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
