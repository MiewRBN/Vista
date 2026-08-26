import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const boundaryPath = path.join(process.cwd(), "public", "data", "bandung_boundary.json");
    const maskPath = path.join(process.cwd(), "public", "data", "bandung_mask.json");
    
    let boundary = null;
    let mask = null;

    if (fs.existsSync(boundaryPath)) {
      boundary = JSON.parse(fs.readFileSync(boundaryPath, "utf-8"));
    }
    if (fs.existsSync(maskPath)) {
      mask = JSON.parse(fs.readFileSync(maskPath, "utf-8"));
    }

    return NextResponse.json(
      { boundary, mask },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch (error) {
    console.error("Error reading boundary data:", error);
    return NextResponse.json({ error: "Failed to load boundary" }, { status: 500 });
  }
}
