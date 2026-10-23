import { NextResponse } from "next/server";

const AUTH_ROUTES = ["/login", "/signup"];
const PROTECTED_ROUTES = ["/dashboard", "/admin"];

async function verifyTokenWithBackend(token) {
  try {
    const apiUrl = process.env.API_URL || "http://localhost:4000";
    const res = await fetch(`${apiUrl}/api/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      // short timeout so a downed backend doesn't hang every request
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { valid: false, role: null };
    const data = await res.json();
    return { valid: true, role: data?.data?.role || null };
  } catch {
    // If backend is unreachable, allow through to avoid locking everyone out
    return { valid: true, role: null };
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("whatsapp_token")?.value;

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
  const isProtectedRoute = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));

  // No token at all → block protected routes immediately
  if (!token && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Has a token → verify it with the backend
  if (token) {
    const { valid, role } = await verifyTokenWithBackend(token);

    if (!valid) {
      // Token is expired or invalid — clear cookie and redirect to login
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.set("whatsapp_token", "", { path: "/", maxAge: 0 });
      return response;
    }

    const isAdminPath = pathname.startsWith("/admin");
    const isDashboardPath = pathname.startsWith("/dashboard");

    // Enforce role route isolation when role is known.
    if (role === "admin" && isDashboardPath) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    if (role === "user" && isAdminPath) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Token is valid and user visits auth routes → redirect by role.
    if (isAuthRoute) {
      return NextResponse.redirect(new URL(role === "admin" ? "/admin" : "/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/signup", "/dashboard/:path*", "/admin/:path*"],
};
