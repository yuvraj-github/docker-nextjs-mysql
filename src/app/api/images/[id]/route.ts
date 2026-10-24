import { unlink } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db";

export const runtime = "nodejs";

interface ImageRow extends RowDataPacket {
  image_url: string;
}

const uploadFilenamePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$/i;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;

  if (!/^[1-9]\d*$/.test(idParam)) {
    return NextResponse.json({ error: "Invalid image ID" }, { status: 400 });
  }

  const id = Number(idParam);
  if (!Number.isSafeInteger(id)) {
    return NextResponse.json({ error: "Invalid image ID" }, { status: 400 });
  }

  try {
    const [rows] = await pool.execute<ImageRow[]>(
      "SELECT image_url FROM images WHERE id = ? LIMIT 1",
      [id]
    );
    const image = rows[0];

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const prefix = "/uploads/";
    const filename = image.image_url.startsWith(prefix)
      ? image.image_url.slice(prefix.length)
      : "";

    if (!uploadFilenamePattern.test(filename)) {
      return NextResponse.json(
        { error: "Image file path is invalid" },
        { status: 500 }
      );
    }

    const uploadDirectory = path.resolve(process.cwd(), "public", "uploads");
    const filePath = path.resolve(uploadDirectory, filename);

    if (path.dirname(filePath) !== uploadDirectory) {
      return NextResponse.json(
        { error: "Image file path is invalid" },
        { status: 500 }
      );
    }

    try {
      await unlink(filePath);
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    }

    await pool.execute("DELETE FROM images WHERE id = ?", [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete image error:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
