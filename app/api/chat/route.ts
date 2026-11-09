// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ChatRequestBodySchema } from '@/lib/schemas/chat.schema';
import {
  SimulationEngineService,
  TeamNotFoundError,
  SessionClosedError,
} from '@/lib/services/simulation-engine.service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parseResult = ChatRequestBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Paràmetres invàlids', detalls: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await SimulationEngineService.processTurn(parseResult.data);
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof TeamNotFoundError) {
      return NextResponse.json(
        { content: "❌ L'equip no existeix.", bot_name: 'SYSTEM', unlockedKey: false },
        { status: 404 }
      );
    }

    if (error instanceof SessionClosedError) {
      return NextResponse.json(
        { content: '🔒 Sessió tancada pel facilitador.', bot_name: 'SYSTEM', unlockedKey: false },
        { status: 403 }
      );
    }

    console.error('Crash a api/chat:', error);
    return NextResponse.json(
      {
        content: '❌ ERROR INTERN',
        bot_name: 'SYSTEM',
        credits_restants: 0,
        isVague: false,
        isSecurityViolation: true,
        unlockedKey: false,
      },
      { status: 500 }
    );
  }
}