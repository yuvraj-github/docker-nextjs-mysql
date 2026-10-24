import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import pool from "@/lib/db";
import type { ResultSetHeader } from "mysql2";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Image is required" },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png"];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPG and PNG images are allowed" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Maximum image size is 5 MB" },
        { status: 400 }
      );
    }

    const extension = file.type === "image/png" ? ".png" : ".jpg";
    const filename = `${randomUUID()}${extension}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads");

    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await writeFile(path.join(uploadDir, filename), buffer);

    const imageUrl = `/uploads/${filename}`;

    const [result] = await pool.execute<ResultSetHeader>(
        "INSERT INTO images (image_url) VALUES (?)",
        [imageUrl]
    );

    return NextResponse.json(
        {
            success: true,
            message: "Image uploaded and saved in MySQL successfully",
            id: result.insertId,
            imageUrl,
        },
        { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);

    return NextResponse.json(
      { error: "Image upload failed" },
      { status: 500 }
    );
  }
}