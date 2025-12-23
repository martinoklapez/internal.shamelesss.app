import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Define protected routes that require authentication
  const protectedRoutes = ['/home', '/games', '/devices', '/feature-flags', '/characters', '/generate']
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(`${route}/`)
  )

  // Protect routes - redirect to / if not authenticated
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Check role-based access for authenticated users
  if (isProtectedRoute && user) {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const role = roleData?.role

    // Only allow admin, dev, developer, and promoter roles
    const allowedRoles = ['admin', 'dev', 'developer', 'promoter']
    if (!role || !allowedRoles.includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    // Promoters cannot access games and feature flags
    if (role === 'promoter') {
      const pathname = request.nextUrl.pathname
      if (pathname.startsWith('/games') || pathname === '/feature-flags') {
        const url = request.nextUrl.clone()
        url.pathname = '/home'
        return NextResponse.redirect(url)
      }
    }
  }

  // Redirect authenticated users away from sign-in page
  if (request.nextUrl.pathname === '/' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

