// app/api/auth/session/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ authenticated: true });

  response.cookies.set('synusia_facilitator_session', 'active', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dies de sessió
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.delete('synusia_facilitator_session');
  return response;
}