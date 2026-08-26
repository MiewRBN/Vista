import { NextResponse } from "next/server";
import Papa from "papaparse";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const csvPath = path.join(process.cwd(), "public", "data", "bus_stops.csv");
    const csvText = fs.readFileSync(csvPath, "utf-8");
    const parsed = Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true });

    const features = (parsed.data as Record<string, any>[])
      .filter((row) => row.lat && row.lon)
      .map((row) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [Number(row.lon), Number(row.lat)],
        },
        properties: {
          name: row.name || "Halte Tanpa Nama",
        },
      }));

    return NextResponse.json(
      { type: "FeatureCollection", features },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    );
  } catch (error) {
    console.error("Error reading bus stops:", error);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
