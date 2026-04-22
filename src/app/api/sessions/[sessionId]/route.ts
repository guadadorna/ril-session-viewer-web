import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedEmail } from "@/lib/auth";
import pool from "@/lib/db";

interface Event {
  timestamp: string;
  event_type: string;
  event_data: Record<string, unknown>;
}

interface ParsedMessage {
  tipo: string;
  contenido: string;
  fuentes?: string[];
  timestamp: string;
}

function parseEvents(events: Event[]): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  for (const event of events) {
    const data = event.event_data;
    const timestamp = event.timestamp;

    if (event.event_type === "user_message") {
      messages.push({
        tipo: "usuario",
        contenido: (data.content as string) || (data.message as string) || "",
        timestamp,
      });
    } else if (event.event_type === "agent_response") {
      const contenido =
        (data.response as string) || (data.content as string) || "";
      const fuentes: string[] = [];

      // Extraer fuentes si las hay
      if (data.sources) {
        const sources = data.sources as Array<{ type?: string; title?: string }>;
        for (const source of sources) {
          fuentes.push(source.type || source.title || "fuente");
        }
      }

      messages.push({
        tipo: "agente",
        contenido,
        fuentes: fuentes.length > 0 ? fuentes : undefined,
        timestamp,
      });
    } else if (event.event_type === "rag_query") {
      messages.push({
        tipo: "rag",
        contenido: `Consulta RAG: ${(data.query as string) || ""}`,
        timestamp,
      });
    } else if (event.event_type === "tool_call") {
      const toolName = (data.tool_name as string) || (data.name as string) || "";
      if (toolName.includes("rag") || toolName.includes("arbol")) {
        messages.push({
          tipo: "herramienta",
          contenido: `Herramienta: ${toolName}`,
          timestamp,
        });
      }
    }
  }

  return messages;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const email = request.nextUrl.searchParams.get("email");
    const userId = request.nextUrl.searchParams.get("userId");

    if (!email || !userId) {
      return NextResponse.json(
        { error: "Email y userId requeridos" },
        { status: 400 }
      );
    }

    if (!isAuthorizedEmail(email)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Verificar que la sesión pertenece al usuario
    const verifyResult = await pool.query(
      `SELECT session_id FROM events WHERE session_id = $1 AND user_id = $2 LIMIT 1`,
      [sessionId, userId]
    );

    if (verifyResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Sesión no encontrada o no autorizada" },
        { status: 404 }
      );
    }

    // Obtener eventos de la sesión
    const result = await pool.query(
      `SELECT timestamp, event_type, event_data
       FROM events
       WHERE session_id = $1
       ORDER BY timestamp ASC`,
      [sessionId]
    );

    const messages = parseEvents(result.rows);

    return NextResponse.json({ sessionId, messages });
  } catch (error) {
    console.error("Session detail error:", error);
    return NextResponse.json(
      { error: "Error al obtener la sesión" },
      { status: 500 }
    );
  }
}
