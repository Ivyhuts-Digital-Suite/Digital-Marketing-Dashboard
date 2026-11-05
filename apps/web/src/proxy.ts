import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIES } from '@mp/shared';

const AUTH_PAGES = new Set(['/login', '/register']);

/**
 * Optimistic routing only: sends visitors without a session hint to /login, and signed-in
 * visitors away from the auth pages. It is NOT an authorization layer — the API verifies
 * the session and organization membership on every request.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(AUTH_COOKIES.SESSION_HINT);

  if (AUTH_PAGES.has(pathname)) {
    return hasSession ? NextResponse.redirect(new URL('/dashboard', request.url)) : NextResponse.next();
  }

  if (!hasSession) {
    const login = new URL('/login', request.url);
    if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the API proxy, Next internals and static files.
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)'],
};
