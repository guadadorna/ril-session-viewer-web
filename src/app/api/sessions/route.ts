import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedEmail } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
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

    // Buscar sesiones del usuario
    const result = await pool.query(
      `SELECT
        session_id,
        MIN(timestamp) as start_time,
        MAX(timestamp) as end_time,
        COUNT(*) as event_count
      FROM events
      WHERE user_id = $1
      GROUP BY session_id
      ORDER BY MIN(timestamp) DESC`,
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
