import { NextResponse } from "next/server";
import { inspections } from "@/lib/data/inspections";
import { MAX_INSPECTION_REQUEST_BYTES, validateInspectionMutation } from "@/lib/security";
import { applyMutation } from "@/lib/sync/api-store";

function acceptsJson(contentType: string | null): boolean {
  if (!contentType) return false;
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  return mediaType === "application/json" || (mediaType.startsWith("application/") && mediaType.endsWith("+json"));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fallar = searchParams.get("fallar");

  // Retardo de red simulado para verificar el estado de carga (métrica de desarrollo)
  await new Promise(resolve => setTimeout(resolve, 800));

  if (fallar === "1") {
    return NextResponse.json(
      { error: 'Error sintético provocado por el parámetro fallar=1' },
      { status: 500 }
    );
  }

  return NextResponse.json(inspections);
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("fallar") === "1") {
    return NextResponse.json({ error: "Error sintético provocado por el parámetro fallar=1" }, { status: 500 });
  }

  if (!acceptsJson(request.headers.get("content-type"))) {
    return NextResponse.json({ error: "El contenido debe enviarse como application/json." }, { status: 415 });
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_INSPECTION_REQUEST_BYTES) {
    return NextResponse.json({ error: "El cuerpo de la solicitud excede el límite permitido." }, { status: 413 });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_INSPECTION_REQUEST_BYTES) {
      return NextResponse.json({ error: "El cuerpo de la solicitud excede el límite permitido." }, { status: 413 });
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const validation = validateInspectionMutation(body);
  if (!validation.success) {
    return NextResponse.json({ error: "La mutación de inspección no es válida." }, { status: 400 });
  }

  const result = applyMutation(validation.data, request.headers.get("Idempotency-Key"));
  return NextResponse.json(result.body, { status: result.status });
}
