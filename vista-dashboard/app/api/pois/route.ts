import { NextResponse } from "next/server";
import Papa from "papaparse";
import fs from "fs";
import path from "path";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const csvPath = path.join(process.cwd(), "public", "data", "pois_bandung.csv");
    const csvText = fs.readFileSync(csvPath, "utf-8");
    const parsed = Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true });

    let data = parsed.data as Record<string, unknown>[];
    if (category) {
      data = data.filter((row) => row.category === category);
    }

    const features = data
      .filter((row) => row.lat && row.lon)
      .map((row) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [Number(row.lon), Number(row.lat)],
        },
        properties: {
          category: row.category,
        },
      }));

    return NextResponse.json(
      { type: "FeatureCollection", features },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    );
  } catch (error) {
    console.error("Error reading POIs:", error);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
