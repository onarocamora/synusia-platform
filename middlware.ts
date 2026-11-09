// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIXES = ['/reports'];
const PROTECTED_API_PREFIXES = ['/api/evaluate-session'];

export async function middleware(request: NextRequest) {

  // Afegeix això just al principi: deixa passar la demo visual i la seva API
  if (
    request.nextUrl.pathname.startsWith('/demo') || 
    request.nextUrl.pathname.startsWith('/api/evaluate-demo')
  ) {
    return NextResponse.next();
  }
  
  const { pathname } = request.nextUrl;

  const isProtectedPage = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isProtectedApi = PROTECTED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('synusia_facilitator_session')?.value;
  const isAuthenticated = sessionCookie === 'active';

  if (!isAuthenticated) {
    if (isProtectedApi) {
      return NextResponse.json(
        { error: 'No autoritzat. Cal sessió activa de facilitador.' },
        { status: 401 }
      );
    }

    const adminUrl = new URL('/admin', request.url);
    return NextResponse.redirect(adminUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/reports/:path*',
    '/api/evaluate-session/:path*',
  ],
};