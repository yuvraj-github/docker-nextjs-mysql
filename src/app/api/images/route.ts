import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [rows] = await pool.query(
      "SELECT id, image_url, created_at FROM images ORDER BY id DESC"
    );

    return NextResponse.json({
      success: true,
      images: rows,
    });
  } catch (error) {
    console.error("Fetch images error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch images",
      },
      { status: 500 }
    );
  }
}