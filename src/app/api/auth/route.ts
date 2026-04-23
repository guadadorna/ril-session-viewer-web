import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedName } from "@/lib/auth";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    console.log("Auth attempt for name:", name);

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }

    if (!isAuthorizedName(name)) {
      console.log("Name not authorized");
      return NextResponse.json(
        { error: "No tenés autorización para usar esta aplicación" },
        { status: 403 }
      );
    }

    console.log("Name authorized, querying database...");

    // Buscar el user_id por nombre o apellido en user_states
    const searchPattern = `%${name.trim()}%`;
    const result = await pool.query(
      `SELECT user_id, state->>'first_name' as first_name, state->>'last_name' as last_name
       FROM user_states
       WHERE state->>'first_name' ILIKE $1
          OR state->>'last_name' ILIKE $1
       LIMIT 1`,
      [searchPattern]
    );

    console.log("Query result rows:", result.rows.length);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "No se encontró tu usuario en la base de datos" },
        { status: 404 }
      );
    }

    const user = result.rows[0];
    return NextResponse.json({
      authorized: true,
      userId: user.user_id,
      displayName: `${user.first_name} ${user.last_name}`.trim(),
    });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Error al verificar autorización" },
      { status: 500 }
    );
  }
}
