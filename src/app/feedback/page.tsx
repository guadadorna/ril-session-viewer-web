"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const TIPOS_PROBLEMA_LABELS: Record<string, string> = {
  invento_informacion: "Inventó información",
  no_uso_fuentes: "No usó las fuentes",
  respuesta_incompleta: "Respuesta incompleta",
  respuesta_generica: "Respuesta genérica",
  otro: "Otro",
};

interface Feedback {
  id: number;
  session_id: string;
  turno_numero: number;
  tipo_problema: string;
  comentario: string;
  reporter_name: string;
  estado: string;
  created_at: string;
  resolved_at: string | null;
  primera_pregunta: string | null;
}

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | "pendiente" | "revisado">("pendiente");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const params = filter !== "todos" ? `?estado=${filter}` : "";
      const response = await fetch(`/api/feedback${params}`);
      const data = await response.json();
      setFeedbacks(data.feedbacks || []);
    } catch {
      console.error("Error fetching feedbacks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, [filter]);

  const handleToggleEstado = async (feedback: Feedback) => {
    const nuevoEstado = feedback.estado === "pendiente" ? "revisado" : "pendiente";
    setUpdatingId(feedback.id);

    try {
      const response = await fetch(`/api/feedback/${feedback.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      if (response.ok) {
        // Actualizar localmente
        setFeedbacks((prev) =>
          prev.map((f) =>
            f.id === feedback.id ? { ...f, estado: nuevoEstado } : f
          )
        );
      }
    } catch {
      console.error("Error updating feedback");
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const pendingCount = feedbacks.filter((f) => f.estado === "pendiente").length;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Volver al inicio
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-2">
            Feedback de sesiones
          </h1>
          <p className="text-gray-600 mt-1">
            Reportes del equipo sobre respuestas del agente
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("pendiente")}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === "pendiente"
                  ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Pendientes {filter === "pendiente" && `(${feedbacks.length})`}
            </button>
            <button
              onClick={() => setFilter("revisado")}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === "revisado"
                  ? "bg-green-100 text-green-800 border border-green-300"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Revisados {filter === "revisado" && `(${feedbacks.length})`}
            </button>
            <button
              onClick={() => setFilter("todos")}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === "todos"
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Todos {filter === "todos" && `(${feedbacks.length})`}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <p className="text-gray-600">Cargando...</p>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <p className="text-gray-600">
              {filter === "pendiente"
                ? "No hay reportes pendientes"
                : filter === "revisado"
                ? "No hay reportes revisados"
                : "No hay reportes"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {feedbacks.map((feedback) => (
              <div
                key={feedback.id}
                className={`bg-white rounded-lg shadow-md overflow-hidden border-l-4 ${
                  feedback.estado === "pendiente"
                    ? "border-l-yellow-500"
                    : "border-l-green-500"
                }`}
              >
                <div className="p-4">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          feedback.estado === "pendiente"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {feedback.estado === "pendiente" ? "Pendiente" : "Revisado"}
                      </span>
                      <span className="ml-2 inline-block px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                        {TIPOS_PROBLEMA_LABELS[feedback.tipo_problema] || feedback.tipo_problema}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDate(feedback.created_at)}
                    </span>
                  </div>

                  {/* Primera pregunta de la sesión */}
                  {feedback.primera_pregunta && (
                    <div className="mb-3 text-sm text-gray-600">
                      <span className="font-medium">Sesión:</span>{" "}
                      <span className="italic">
                        &ldquo;{feedback.primera_pregunta.substring(0, 100)}
                        {feedback.primera_pregunta.length > 100 ? "..." : ""}&rdquo;
                      </span>
                    </div>
                  )}

                  {/* Comentario */}
                  {feedback.comentario && (
                    <div className="mb-3 bg-gray-50 p-3 rounded text-sm text-gray-800">
                      {feedback.comentario}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      <span>Turno {feedback.turno_numero}</span>
                      <span className="mx-2">•</span>
                      <span>Reportado por {feedback.reporter_name}</span>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/sessions/${feedback.session_id}?internal=true#turno-${feedback.turno_numero}`}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Ver conversación
                      </Link>
                      <button
                        onClick={() => handleToggleEstado(feedback)}
                        disabled={updatingId === feedback.id}
                        className={`text-xs px-3 py-1.5 rounded ${
                          feedback.estado === "pendiente"
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        } disabled:opacity-50`}
                      >
                        {updatingId === feedback.id
                          ? "..."
                          : feedback.estado === "pendiente"
                          ? "Marcar revisado"
                          : "Volver a pendiente"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
