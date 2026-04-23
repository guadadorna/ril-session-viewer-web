import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Tipos
interface FunctionResponse {
  name?: string;
  response?: {
    result?: unknown;
    [key: string]: unknown;
  };
}

interface Part {
  text?: string;
  functionCall?: unknown;
  functionResponse?: FunctionResponse;
}

interface Content {
  parts?: Part[];
  role?: string;
}

interface Event {
  id: string;
  session_id: string;
  user_id: string;
  app_name: string;
  author: string;
  timestamp: string;
  content: Content | string;
}

interface RagDoc {
  titulo: string;
  uri: string;
  score: number;
  tipo: string;
  uso: string;
}

interface ArbolPregunta {
  id: string;
  pregunta: string;
  dimension: string;
  como_ayuda: string[];
  que_hace_bueno: string[];
  senales_alerta: string[];
}

interface MemoriaItem {
  tipo: string;
  datos: Record<string, unknown>;
}

interface Fuentes {
  rag: RagDoc[];
  arbol: ArbolPregunta[];
  memoria_leida: MemoriaItem[];
  memoria_guardada: MemoriaItem[];
}

interface Turno {
  usuario: string;
  agente: string;
  fuentes: Fuentes;
  timestamp: string;
}

// Helpers
function decodeBase64(text: string): string {
  if (!text) return text;
  try {
    const decoded = Buffer.from(text, "base64").toString("utf-8");
    // Verificar si es texto legible
    if (/^[\x20-\x7E\n\r\t]*$/.test(decoded) || decoded.includes("{")) {
      return decoded;
    }
  } catch {
    // Ignore
  }
  return text;
}

function tryParseJson(text: unknown): unknown {
  if (!text || typeof text !== "string") return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function createEmptyFuentes(): Fuentes {
  return { rag: [], arbol: [], memoria_leida: [], memoria_guardada: [] };
}

function parseEventsDetailed(events: Event[]): Turno[] {
  const turnos: Turno[] = [];
  let currentTurno: Turno | null = null;
  let pendingFuentes: Fuentes = createEmptyFuentes();

  for (const event of events) {
    const author = event.author || "";
    let content = event.content;

    if (!content) continue;

    // content puede venir como string JSON
    if (typeof content === "string") {
      try {
        content = JSON.parse(content);
      } catch {
        continue;
      }
    }

    if (typeof content !== "object") continue;

    // A veces el content tiene structure {role, parts} directamente
    // otras veces parts[0].text contiene JSON serializado
    const parts = (content as Content).parts || [];

    // Si no hay parts, puede ser que content sea {parts: [...]} directamente
    if (parts.length === 0 && Array.isArray((content as {parts?: unknown[]}).parts)) {
      continue;
    }

    for (const part of parts) {
      // Mensaje de usuario = nuevo turno
      if (part.text && author === "user") {
        if (currentTurno) {
          if (!currentTurno.agente.trim()) {
            // Pasar fuentes pendientes al siguiente turno
            pendingFuentes.rag.push(...currentTurno.fuentes.rag);
            pendingFuentes.arbol.push(...currentTurno.fuentes.arbol);
            pendingFuentes.memoria_leida.push(...currentTurno.fuentes.memoria_leida);
            pendingFuentes.memoria_guardada.push(...currentTurno.fuentes.memoria_guardada);
          }
          turnos.push(currentTurno);
        }
        currentTurno = {
          usuario: part.text,
          agente: "",
          fuentes: createEmptyFuentes(),
          timestamp: event.timestamp,
        };
        // Agregar fuentes pendientes
        currentTurno.fuentes.rag.push(...pendingFuentes.rag);
        currentTurno.fuentes.arbol.push(...pendingFuentes.arbol);
        currentTurno.fuentes.memoria_leida.push(...pendingFuentes.memoria_leida);
        currentTurno.fuentes.memoria_guardada.push(...pendingFuentes.memoria_guardada);
        pendingFuentes = createEmptyFuentes();
      }

      // Respuesta del agente
      else if (part.text && author !== "user" && currentTurno) {
        currentTurno.agente += part.text + "\n";
      }

      // Tool response - extraer fuentes
      if (part.functionResponse && currentTurno) {
        const fr = part.functionResponse;
        const name = (fr.name || "").toLowerCase();
        let result: unknown = fr.response?.result ?? fr.response;

        if (typeof result === "string") {
          result = tryParseJson(decodeBase64(result));
        }

        // RAG
        if (name.includes("rag") && typeof result === "object" && result !== null) {
          const docs = (result as { documentos?: unknown[] }).documentos;
          if (Array.isArray(docs)) {
            for (const doc of docs) {
              if (typeof doc === "object" && doc !== null) {
                const d = doc as Record<string, unknown>;
                currentTurno.fuentes.rag.push({
                  titulo: String(d.titulo || ""),
                  uri: String(d.uri || ""),
                  score: Number(d.score_similitud || 0),
                  tipo: Array.isArray(d.tipo_contenido) ? d.tipo_contenido.join(", ") : "",
                  uso: Array.isArray(d.uso_agente) ? d.uso_agente.join(", ") : "",
                });
              }
            }
          }
        }

        // Árbol
        else if (name.includes("arbol") || name.includes("lookup")) {
          if (typeof result === "string") {
            result = tryParseJson(result);
          }
          if (typeof result === "object" && result !== null) {
            const r = result as Record<string, unknown>;
            let preguntas = r.preguntas as unknown[];

            // A veces viene en Content
            if (typeof r.Content === "string") {
              const contentParsed = tryParseJson(r.Content);
              if (typeof contentParsed === "object" && contentParsed !== null) {
                preguntas = (contentParsed as Record<string, unknown>).preguntas as unknown[] || preguntas;
              }
            }

            if (Array.isArray(preguntas)) {
              for (const p of preguntas) {
                if (typeof p === "object" && p !== null) {
                  const preg = p as Record<string, unknown>;
                  currentTurno.fuentes.arbol.push({
                    id: String(preg.id || ""),
                    pregunta: String(preg.pregunta || preg.PreguntaTexto || ""),
                    dimension: String(preg.dimension || ""),
                    como_ayuda: Array.isArray(preg.como_ayuda_agente) ? preg.como_ayuda_agente.map(String) : [],
                    que_hace_bueno: Array.isArray(preg.que_hace_bueno) ? preg.que_hace_bueno.map(String) : [],
                    senales_alerta: Array.isArray(preg.senales_alerta) ? preg.senales_alerta.map(String) : [],
                  });
                }
              }
            }
          }
        }

        // Memoria leída
        else if (name.includes("get_user_memory") || name.includes("get_memory")) {
          if (typeof result === "object" && result !== null) {
            const memories = (result as { memories?: unknown[] }).memories;
            if (Array.isArray(memories)) {
              for (const mem of memories) {
                if (typeof mem === "object" && mem !== null) {
                  const m = mem as Record<string, unknown>;
                  const payload = String(m.payload || "");
                  let decoded = tryParseJson(decodeBase64(payload));
                  if (typeof decoded === "object" && decoded !== null) {
                    currentTurno.fuentes.memoria_leida.push({
                      tipo: String(m.record_type || ""),
                      datos: decoded as Record<string, unknown>,
                    });
                  }
                }
              }
            }
          }
        }

        // Memoria guardada
        else if (name.includes("save_user_memory") || name.includes("save_memory")) {
          if (typeof result === "object" && result !== null) {
            const r = result as Record<string, unknown>;
            currentTurno.fuentes.memoria_guardada.push({
              tipo: String(r.record_type || "dato"),
              datos: r,
            });
          }
        }
      }
    }
  }

  if (currentTurno) {
    turnos.push(currentTurno);
  }

  return turnos;
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

    const turnos = parseEventsDetailed(result.rows);

    // Debug info
    const debug = {
      totalEvents: result.rows.length,
      totalTurnos: turnos.length,
      firstEventSample: result.rows.length > 0 ? {
        author: result.rows[0].author,
        contentType: typeof result.rows[0].content,
        contentSample: JSON.stringify(result.rows[0].content).substring(0, 300),
      } : null,
    };

    // Calcular estadísticas
    const stats = {
      totalRag: turnos.reduce((sum, t) => sum + t.fuentes.rag.length, 0),
      totalArbol: turnos.reduce((sum, t) => sum + t.fuentes.arbol.length, 0),
      totalMemoriaLeida: turnos.reduce((sum, t) => sum + t.fuentes.memoria_leida.length, 0),
      totalMemoriaGuardada: turnos.reduce((sum, t) => sum + t.fuentes.memoria_guardada.length, 0),
    };

    return NextResponse.json({ sessionId, turnos, stats, debug });
  } catch (error) {
    console.error("Session detail error:", error);
    return NextResponse.json(
      { error: "Error al obtener la sesión" },
      { status: 500 }
    );
  }
}
