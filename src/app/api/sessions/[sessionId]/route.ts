import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

interface Event {
  id: string;
  session_id: string;
  user_id: string;
  app_name: string;
  author: string;
  timestamp: string;
  content: Record<string, unknown>;
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
    const content = event.content || {};
    const timestamp = event.timestamp;
    const author = event.author;

    if (author === "user") {
      // Mensaje del usuario
      const parts = content.parts as Array<{ text?: string }> | undefined;
      const text = parts?.[0]?.text || JSON.stringify(content);
      messages.push({
        tipo: "usuario",
        contenido: text,
        timestamp,
      });
    } else {
      // Respuesta del agente
      const parts = content.parts as Array<{ text?: string }> | undefined;
      const text = parts?.[0]?.text || JSON.stringify(content);

      // Buscar fuentes en el contenido
      const fuentes: string[] = [];
      if (content.grounding_metadata) {
        fuentes.push("RAG");
      }

      messages.push({
        tipo: "agente",
        contenido: text,
        fuentes: fuentes.length > 0 ? fuentes : undefined,
        timestamp,
      });
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
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId requerido" },
        { status: 400 }
      );
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

    // Obtener eventos de la sesión (misma query que visor.py)
    const result = await pool.query(
      `SELECT id, session_id, user_id, app_name, author, timestamp, content
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
