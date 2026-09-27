import { NextResponse } from 'next/server';
import { inspections } from '@/lib/data/inspections';

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
