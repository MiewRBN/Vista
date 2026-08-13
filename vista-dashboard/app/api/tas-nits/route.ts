import { NextResponse } from "next/server";
import Papa from "papaparse";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const csvPath = path.join(process.cwd(), "public", "data", "accessibility_score.csv");
    const csvText = fs.readFileSync(csvPath, "utf-8");
    const parsed = Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true });

    // Convert ke GeoJSON FeatureCollection
    const features = parsed.data
      .filter((row: Record<string, unknown>) => row.center_lat && row.center_lon)
      .map((row: Record<string, unknown>) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [Number(row.center_lon), Number(row.center_lat)],
        },
        properties: {
          id: row.tas_nit_id,
          street_name: row.street_name || "Jalan Tanpa Nama",
          highway_type: row.highway_type,
          nearest_stop: row.nearest_stop_name,
          walking_class: row.walking_class,
          n_points: row.n_points,
          avg_distance_to_stop: Number(row.avg_distance_to_stop) || 0,
          accessibility_score: Number(row.accessibility_score) || 0,
          transit_accessibility: Number(row.transit_accessibility) || 0,
          service_accessibility: row.service_accessibility,
          poi_pendidikan: row.poi_count_pendidikan,
          poi_kesehatan: row.poi_count_kesehatan,
          poi_komersial: row.poi_count_komersial,
          poi_katering: row.poi_count_katering,
          poi_finansial: row.poi_count_finansial,
          poi_olahraga: row.poi_count_olahraga,
        },
      }));

    return NextResponse.json(
      { type: "FeatureCollection", features },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("Error reading TAS-Nits data:", error);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
