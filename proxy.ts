import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const PROTECTED = ['/dashboard', '/schedule', '/admin'];
const AUTH_PAGES = ['/', '/register'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('token')?.value;
  const session = token ? await verifyToken(token) : null;

  const isProtected = PROTECTED.some(p => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/register', '/dashboard', '/schedule', '/admin'],
};
