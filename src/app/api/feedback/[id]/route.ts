import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// PATCH - Actualizar estado del feedback
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { estado } = body;

    if (!estado || !["pendiente", "revisado"].includes(estado)) {
      return NextResponse.json(
        { error: "Estado inválido" },
        { status: 400 }
      );
    }

    const resolvedAt = estado === "revisado" ? "CURRENT_TIMESTAMP" : "NULL";

    const result = await pool.query(
      `UPDATE session_feedback
       SET estado = $1, resolved_at = ${resolvedAt}
       WHERE id = $2
       RETURNING *`,
      [estado, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Feedback no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, feedback: result.rows[0] });
  } catch (error) {
    console.error("Error updating feedback:", error);
    return NextResponse.json(
      { error: "Error al actualizar feedback" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar feedback (por si acaso)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await pool.query(
      "DELETE FROM session_feedback WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Feedback no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting feedback:", error);
    return NextResponse.json(
      { error: "Error al eliminar feedback" },
      { status: 500 }
    );
  }
}
