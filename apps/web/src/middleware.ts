import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'better-auth.session_token';
const SECURE_SESSION_COOKIE = '__Secure-better-auth.session_token';
const PUBLIC_PATHS = ['/login'];

/**
 * Presencia de cookie (la autoridad real es la API: cada página valida sesión
 * vía requireMe()/apiFetch). Aquí solo redirigimos para UX.
 */
export function middleware(request: NextRequest) {
  const token =
    request.cookies.get(SESSION_COOKIE)?.value ?? request.cookies.get(SECURE_SESSION_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    if (token) {
      return NextResponse.redirect(new URL('/products', request.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|icon.svg).*)'],
};
