import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedEmail } from "@/lib/auth";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }

    if (!isAuthorizedEmail(email)) {
      return NextResponse.json(
        { error: "No tenés autorización para usar esta aplicación" },
        { status: 403 }
      );
    }

    // Buscar el user_id en la base de datos
    const result = await pool.query(
      `SELECT DISTINCT user_id FROM events WHERE user_id ILIKE $1 LIMIT 1`,
      [`%${email}%`]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron sesiones asociadas a tu email" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      authorized: true,
      userId: result.rows[0].user_id,
      email,
    });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Error al verificar autorización" },
      { status: 500 }
    );
  }
}
