"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

interface Stats {
  totalRag: number;
  totalArbol: number;
  totalMemoriaLeida: number;
  totalMemoriaGuardada: number;
}

function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div className="border border-gray-200 rounded-md mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
      >
        <span>
          {title} ({count})
        </span>
        <span>{isOpen ? "▼" : "▶"}</span>
      </button>
      {isOpen && <div className="p-3 text-sm">{children}</div>}
    </div>
  );
}

function RagDocs({ docs }: { docs: RagDoc[] }) {
  return (
    <div className="space-y-2">
      {docs.map((doc, idx) => (
        <div key={idx} className="bg-blue-50 p-2 rounded border border-blue-200">
          <div className="font-medium text-blue-900">{doc.titulo || "Sin título"}</div>
          {doc.score > 0 && (
            <div className="text-xs text-blue-700">Score: {doc.score.toFixed(2)}</div>
          )}
          {doc.tipo && <div className="text-xs text-blue-600">Tipo: {doc.tipo}</div>}
          {doc.uso && <div className="text-xs text-blue-600">Uso: {doc.uso}</div>}
        </div>
      ))}
    </div>
  );
}

function ArbolPreguntas({ preguntas }: { preguntas: ArbolPregunta[] }) {
  return (
    <div className="space-y-2">
      {preguntas.map((p, idx) => (
        <div key={idx} className="bg-green-50 p-2 rounded border border-green-200">
          <div className="font-medium text-green-900">{p.id}: {p.pregunta}</div>
          {p.dimension && (
            <div className="text-xs text-green-700">Dimensión: {p.dimension}</div>
          )}
          {p.como_ayuda.length > 0 && (
            <div className="text-xs text-green-600 mt-1">
              <strong>Cómo ayuda:</strong> {p.como_ayuda.join(", ")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MemoriaItems({ items, tipo }: { items: MemoriaItem[]; tipo: "leida" | "guardada" }) {
  const bgColor = tipo === "leida" ? "bg-purple-50 border-purple-200" : "bg-orange-50 border-orange-200";
  const textColor = tipo === "leida" ? "text-purple-900" : "text-orange-900";

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className={`p-2 rounded border ${bgColor}`}>
          <div className={`font-medium ${textColor}`}>{item.tipo || "Dato"}</div>
          <pre className="text-xs mt-1 whitespace-pre-wrap overflow-auto max-h-40">
            {JSON.stringify(item.datos, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const userName = sessionStorage.getItem("userName");
    const userId = sessionStorage.getItem("userId");

    if (!userName || !userId) {
      router.push("/");
      return;
    }

    fetch(
      `/api/sessions/${sessionId}?userId=${encodeURIComponent(userId)}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setTurnos(data.turnos || []);
          setStats(data.stats || null);
        }
      })
      .catch(() => setError("Error al cargar la sesión"))
      .finally(() => setLoading(false));
  }, [sessionId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600">Cargando conversación...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <Link
            href="/sessions"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Volver a sesiones
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-2">
            Conversación
          </h1>

          {/* Estadísticas */}
          {stats && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              <div className="bg-blue-100 p-2 rounded text-center">
                <div className="text-lg font-bold text-blue-800">{stats.totalRag}</div>
                <div className="text-xs text-blue-600">RAG</div>
              </div>
              <div className="bg-green-100 p-2 rounded text-center">
                <div className="text-lg font-bold text-green-800">{stats.totalArbol}</div>
                <div className="text-xs text-green-600">Árbol</div>
              </div>
              <div className="bg-purple-100 p-2 rounded text-center">
                <div className="text-lg font-bold text-purple-800">{stats.totalMemoriaLeida}</div>
                <div className="text-xs text-purple-600">Mem. Leída</div>
              </div>
              <div className="bg-orange-100 p-2 rounded text-center">
                <div className="text-lg font-bold text-orange-800">{stats.totalMemoriaGuardada}</div>
                <div className="text-xs text-orange-600">Mem. Guardada</div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
            {error}
          </div>
        )}

        {turnos.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <p className="text-gray-600">No hay mensajes en esta sesión.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {turnos.map((turno, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-gray-700 text-white px-4 py-2 text-sm font-medium">
                  Turno {idx + 1}
                </div>

                {/* Usuario */}
                <div className="p-4 border-b border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">👤 Usuario</div>
                  <p className="text-gray-800 whitespace-pre-wrap">{turno.usuario}</p>
                </div>

                {/* Agente */}
                {turno.agente.trim() && (
                  <div className="p-4 bg-gray-50">
                    <div className="text-xs text-gray-500 mb-1">🤖 Agente</div>
                    <p className="text-gray-800 whitespace-pre-wrap">{turno.agente.trim()}</p>
                  </div>
                )}

                {/* Fuentes */}
                <div className="px-4 pb-4">
                  <CollapsibleSection
                    title="📚 RAG - Documentos"
                    count={turno.fuentes.rag.length}
                  >
                    <RagDocs docs={turno.fuentes.rag} />
                  </CollapsibleSection>

                  <CollapsibleSection
                    title="🌳 Árbol - Preguntas"
                    count={turno.fuentes.arbol.length}
                  >
                    <ArbolPreguntas preguntas={turno.fuentes.arbol} />
                  </CollapsibleSection>

                  <CollapsibleSection
                    title="🧠 Memoria Leída"
                    count={turno.fuentes.memoria_leida.length}
                  >
                    <MemoriaItems items={turno.fuentes.memoria_leida} tipo="leida" />
                  </CollapsibleSection>

                  <CollapsibleSection
                    title="💾 Memoria Guardada"
                    count={turno.fuentes.memoria_guardada.length}
                  >
                    <MemoriaItems items={turno.fuentes.memoria_guardada} tipo="guardada" />
                  </CollapsibleSection>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
