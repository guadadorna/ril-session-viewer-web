import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Tipos
interface FunctionResponse {
  id?: string;
  name?: string;
  response?: {
    result?: unknown;
    [key: string]: unknown;
  };
}

interface FunctionCall {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
}

interface Part {
  text?: string;
  functionCall?: FunctionCall;
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
  // Para capturar los args de functionCall y asociarlos con el functionResponse
  const pendingFunctionCalls: Map<string, Record<string, unknown>> = new Map();

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

      // Capturar functionCall para save_memory (guardar args para después)
      if (part.functionCall && currentTurno) {
        const fc = part.functionCall;
        const fcName = (fc.name || "").toLowerCase();
        if ((fcName.includes("save_user_memory") || fcName.includes("save_memory")) && fc.id && fc.args) {
          pendingFunctionCalls.set(fc.id, fc.args);
        }
      }

      // Tool response - extraer fuentes
      if (part.functionResponse && currentTurno) {
        const fr = part.functionResponse;
        const name = (fr.name || "").toLowerCase();
        let result: unknown = fr.response?.result ?? fr.response;

        if (typeof result === "string") {
          result = tryParseJson(decodeBase64(result));
        }

        // RAG - soporta tanto formato estructurado (con documentos) como crudo de Vertex AI (con results)
        if (name.includes("rag") && typeof result === "object" && result !== null) {
          const r = result as Record<string, unknown>;

          // Formato estructurado (después del cambio de la tool)
          if (Array.isArray(r.documentos)) {
            for (const doc of r.documentos) {
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
          // Formato crudo de Vertex AI (antes del cambio de la tool)
          // Limitamos a los top 5 por score de similitud
          else if (Array.isArray(r.results)) {
            const docsToAdd: RagDoc[] = [];

            for (const item of r.results) {
              if (typeof item !== "object" || item === null) continue;
              const resultItem = item as Record<string, unknown>;
              const document = resultItem.document as Record<string, unknown> | undefined;
              if (!document) continue;

              const structData = document.structData as Record<string, unknown> | undefined;
              const derivedData = document.derivedStructData as Record<string, unknown> | undefined;
              const rankSignals = resultItem.rankSignals as Record<string, unknown> | undefined;

              // Extraer título y URI (puede estar en structData o derivedStructData)
              let titulo = "";
              let uri = "";

              if (structData) {
                titulo = String(structData.title || "");
                uri = String(structData.uri || "");
              }
              if (derivedData) {
                if (!titulo) titulo = String(derivedData.title || "");
                if (!uri) uri = String(derivedData.link || derivedData.url || "");
              }

              // Extraer metadata
              const tipoContenido = structData?.tipo_de_contenido;
              const usoAgente = structData?.uso_agente;

              // Extraer score
              let score = 0;
              if (rankSignals) {
                score = Number(rankSignals.semanticSimilarityScore || 0);
              }

              docsToAdd.push({
                titulo,
                uri,
                score,
                tipo: Array.isArray(tipoContenido) ? tipoContenido.join(", ") : String(tipoContenido || ""),
                uso: Array.isArray(usoAgente) ? usoAgente.join(", ") : String(usoAgente || ""),
              });
            }

            // Filtrar solo documentos con score >= 0.65 (65% de similitud)
            const relevantDocs = docsToAdd.filter(d => d.score >= 0.65);
            // Ordenar por score descendente
            relevantDocs.sort((a, b) => b.score - a.score);
            currentTurno.fuentes.rag.push(...relevantDocs);
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

        // Memoria guardada - usar los args del functionCall que capturamos antes
        else if (name.includes("save_user_memory") || name.includes("save_memory")) {
          // Buscar los args del functionCall correspondiente por ID
          const fcId = fr.id;
          const savedArgs = fcId ? pendingFunctionCalls.get(fcId) : null;

          if (savedArgs) {
            // Los args contienen lo que realmente se guardó
            currentTurno.fuentes.memoria_guardada.push({
              tipo: String(savedArgs.record_type || savedArgs.tipo || "dato"),
              datos: savedArgs,
            });
            pendingFunctionCalls.delete(fcId!);
          } else if (typeof result === "object" && result !== null) {
            // Fallback al resultado si no encontramos los args
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
    const internal = request.nextUrl.searchParams.get("internal") === "true";

    // Para acceso interno (desde /feedback), no requerimos userId
    if (!internal) {
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
