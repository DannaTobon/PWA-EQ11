import { NextResponse } from 'next/server';
import { inspections } from '@/lib/data/inspections';
import { applyMutation } from '@/lib/sync/api-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fallar = searchParams.get('fallar');

  // Retardo de red simulado para verificar el estado de carga (métrica de desarrollo)
  await new Promise(resolve => setTimeout(resolve, 800));

  if (fallar === '1') {
    return NextResponse.json(
      { error: 'Error sintético provocado por el parámetro fallar=1' },
      { status: 500 }
    );
  }

  return NextResponse.json(inspections);
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('fallar') === '1') {
    return NextResponse.json({ error: 'Error sintético provocado por el parámetro fallar=1' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const result = applyMutation(body, request.headers.get('Idempotency-Key'));
  return NextResponse.json(result.body, { status: result.status });
}
