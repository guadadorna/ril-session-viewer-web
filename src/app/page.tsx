"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al verificar");
        return;
      }

      // Guardar en sessionStorage y redirigir
      sessionStorage.setItem("userName", data.displayName);
      sessionStorage.setItem("userId", data.userId);
      router.push("/sessions");
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Visor de Sesiones RIL
        </h1>
        <p className="text-gray-600 text-center mb-6">
          Ingresá tu nombre o apellido para ver tus conversaciones con el agente de seguridad.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre o Apellido
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="Tu nombre"
              required
              minLength={2}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Verificando..." : "Ingresar"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <Link
            href="/feedback"
            className="block text-center text-sm text-gray-600 hover:text-blue-600"
          >
            Ver feedback del equipo
          </Link>
        </div>
      </div>
    </div>
  );
}
