// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json().catch(() => ({}));
    const expectedSecret = process.env.FACILITATOR_SECRET;

    if (!expectedSecret || password !== expectedSecret) {
      return NextResponse.json(
        { error: 'Clau d’accés incorrecta' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });

    // Injectar galeta segura de sessió (vàlida durant 24 hores)
    response.cookies.set('synusia_facilitator_session', expectedSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hores
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Error intern d’autenticació' }, { status: 500 });
  }
}