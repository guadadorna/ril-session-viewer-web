import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId requerido" },
        { status: 400 }
      );
    }

    // Buscar sesiones del usuario usando la query del visor.py
    const result = await pool.query(
      `WITH session_stats AS (
        SELECT
          e.session_id,
          e.user_id,
          COUNT(*) AS total_events,
          COUNT(*) FILTER (WHERE e.author = 'user') AS user_messages,
          COUNT(*) FILTER (WHERE e.author != 'user') AS agent_messages,
          MIN(e.timestamp) AS first_interaction,
          MAX(e.timestamp) AS last_interaction
        FROM events e
        WHERE e.user_id = $1
        GROUP BY e.session_id, e.user_id
      )
      SELECT
        ss.session_id,
        ss.total_events,
        ss.user_messages,
        ss.agent_messages,
        ss.first_interaction as start_time,
        ss.last_interaction as end_time,
        ROUND(EXTRACT(EPOCH FROM (ss.last_interaction - ss.first_interaction))/60, 2) as duracion_minutos,
        s.state->>'title' as session_title
      FROM session_stats ss
      LEFT JOIN sessions s ON ss.session_id = s.id
      ORDER BY ss.first_interaction DESC
      LIMIT 50`,
      [userId]
    );

    return NextResponse.json({ sessions: result.rows });
  } catch (error) {
    console.error("Sessions error:", error);
    return NextResponse.json(
      { error: "Error al obtener sesiones" },
      { status: 500 }
    );
  }
}
