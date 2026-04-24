import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// POST - Crear nuevo feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, turno_numero, tipo_problema, comentario, reporter_name } = body;

    if (!session_id || turno_numero === undefined || !tipo_problema || !reporter_name) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO session_feedback (session_id, turno_numero, tipo_problema, comentario, reporter_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [session_id, turno_numero, tipo_problema, comentario || "", reporter_name]
    );

    return NextResponse.json({ success: true, feedback: result.rows[0] });
  } catch (error) {
    console.error("Error creating feedback:", error);
    return NextResponse.json(
      { error: "Error al guardar el feedback" },
      { status: 500 }
    );
  }
}

// GET - Listar feedback (con filtro opcional por estado)
export async function GET(request: NextRequest) {
  try {
    const estado = request.nextUrl.searchParams.get("estado");

    let query = `
      SELECT
        f.*,
        (SELECT content::json->'parts'->0->>'text'
         FROM events
         WHERE session_id = f.session_id AND author = 'user'
         ORDER BY timestamp ASC
         LIMIT 1) as primera_pregunta
      FROM session_feedback f
    `;
    const params: string[] = [];

    if (estado) {
      query += " WHERE estado = $1";
      params.push(estado);
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);

    return NextResponse.json({ feedbacks: result.rows });
  } catch (error) {
    console.error("Error listing feedback:", error);
    return NextResponse.json(
      { error: "Error al obtener feedback" },
      { status: 500 }
    );
  }
}
