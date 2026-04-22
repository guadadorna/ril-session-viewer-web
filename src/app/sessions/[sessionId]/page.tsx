"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Message {
  tipo: string;
  contenido: string;
  fuentes?: string[];
  timestamp: string;
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const email = sessionStorage.getItem("userEmail");
    const userId = sessionStorage.getItem("userId");

    if (!email || !userId) {
      router.push("/");
      return;
    }

    fetch(
      `/api/sessions/${sessionId}?email=${encodeURIComponent(email)}&userId=${encodeURIComponent(userId)}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setMessages(data.messages);
        }
      })
      .catch(() => setError("Error al cargar la sesión"))
      .finally(() => setLoading(false));
  }, [sessionId, router]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("es-AR", { timeStyle: "short" });
  };

  const getMessageStyle = (tipo: string) => {
    switch (tipo) {
      case "usuario":
        return "bg-blue-100 text-blue-900 ml-auto";
      case "agente":
        return "bg-green-100 text-green-900";
      case "rag":
        return "bg-yellow-50 text-yellow-800 border border-yellow-200";
      case "herramienta":
        return "bg-purple-50 text-purple-800 border border-purple-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "usuario":
        return "Vos";
      case "agente":
        return "Agente";
      case "rag":
        return "RAG";
      case "herramienta":
        return "Herramienta";
      default:
        return tipo;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600">Cargando conversación...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-3xl mx-auto px-4">
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
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4">
            {error}
          </div>
        )}

        {messages.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <p className="text-gray-600">No hay mensajes en esta sesión.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg max-w-[85%] ${getMessageStyle(message.tipo)}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold uppercase">
                    {getTipoLabel(message.tipo)}
                  </span>
                  <span className="text-xs opacity-70">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{message.contenido}</p>
                {message.fuentes && message.fuentes.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-current/20">
                    <span className="text-xs">
                      Fuentes: {message.fuentes.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
