import { NextResponse } from "next/server";
import Papa from "papaparse";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), "public", "data");

    // --- 1. Load Accessibility Score (primary — has coordinates) ---
    const accCsv = fs.readFileSync(path.join(dataDir, "accessibility_score.csv"), "utf-8");
    const accParsed = Papa.parse(accCsv, { header: true, dynamicTyping: true, skipEmptyLines: true });

    // --- 2. Load Physical Environment Score (from SegFormer AI) ---
    let physMap: Record<string, Record<string, number>> = {};
    const physPath = path.join(dataDir, "physical_environment_tasnit.csv");
    if (fs.existsSync(physPath)) {
      const physCsv = fs.readFileSync(physPath, "utf-8");
      const physParsed = Papa.parse(physCsv, { header: true, dynamicTyping: true, skipEmptyLines: true });
      physParsed.data.forEach((row: any) => {
        if (row.tas_nit_id) {
          physMap[row.tas_nit_id] = {
            road_width_index: row.road_width_index || 0,
            sidewalk_ratio: row.sidewalk_ratio || 0,
            street_canyon_enclosure: row.street_canyon_enclosure || 0,
            green_view_index: row.green_view_index || 0,
            sky_view_factor: row.sky_view_factor || 0,
            visual_perception_score: row.visual_perception_score || 0,
            n_images: row.n_images || 0,
          };
        }
      });
    }

    // --- 3. Load Sentiment Score (from Google Places scraping) ---
    let sentMap: Record<string, Record<string, number | string>> = {};
    const sentPath = path.join(dataDir, "sentiment_score.csv");
    if (fs.existsSync(sentPath)) {
      const sentCsv = fs.readFileSync(sentPath, "utf-8");
      const sentParsed = Papa.parse(sentCsv, { header: true, dynamicTyping: true, skipEmptyLines: true });
      sentParsed.data.forEach((row: any) => {
        if (row.tas_nit_id) {
          sentMap[row.tas_nit_id] = {
            sentiment_score: row.sentiment_score || 0,
            avg_rating: row.avg_rating || 0,
            n_reviews: row.n_reviews_total || 0,
            n_places: row.n_places || 0,
            positive_ratio: row.positive_ratio || 0,
            negative_ratio: row.negative_ratio || 0,
            sentiment_categories: row.categories || "",
          };
        }
      });
    }

    // --- 4. Merge and build GeoJSON ---
    const features = (accParsed.data as Record<string, any>[])
      .filter((row) => row.center_lat && row.center_lon)
      .map((row) => {
        const id = row.tas_nit_id as string;
        const phys = physMap[id] || {};
        const sent = sentMap[id] || {};

        // Calculate a preliminary UVI (equal weight for now, will be AHP later)
        const accScore = Number(row.accessibility_score) || 0;
        const physScore = Number(phys.visual_perception_score) || 0;
        const sentScore = Number(sent.sentiment_score) || 0;

        // Count how many pillars have data
        const hasPillar = [accScore > 0, physScore > 0, sentScore > 0];
        const pillarCount = hasPillar.filter(Boolean).length;
        
        let uviScore = 0;
        if (pillarCount > 0) {
          // Weighted average: only average across pillars that have data
          uviScore = (accScore + physScore + sentScore) / pillarCount;
        }

        return {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [Number(row.center_lon), Number(row.center_lat)],
          },
          properties: {
            id,
            street_name: row.street_name || phys.street_name || "Jalan Tanpa Nama",
            highway_type: row.highway_type,
            nearest_stop: row.nearest_stop_name,
            walking_class: row.walking_class,
            n_points: row.n_points,
            avg_distance_to_stop: Number(row.avg_distance_to_stop) || 0,

            // Pilar 1: Accessibility
            accessibility_score: accScore,
            transit_accessibility: Number(row.transit_accessibility) || 0,
            service_accessibility: Number(row.service_accessibility) || 0,
            poi_pendidikan: row.poi_count_pendidikan || 0,
            poi_kesehatan: row.poi_count_kesehatan || 0,
            poi_komersial: row.poi_count_komersial || 0,
            poi_katering: row.poi_count_katering || 0,
            poi_finansial: row.poi_count_finansial || 0,
            poi_olahraga: row.poi_count_olahraga || 0,

            // Pilar 2: Physical Environment
            physical_score: physScore,
            road_width: Number(phys.road_width_index) || 0,
            sidewalk: Number(phys.sidewalk_ratio) || 0,
            enclosure: Number(phys.street_canyon_enclosure) || 0,
            gvi: Number(phys.green_view_index) || 0,
            svf: Number(phys.sky_view_factor) || 0,
            n_images: Number(phys.n_images) || 0,

            // Pilar 3: Sentiment
            sentiment_score: Number(sent.sentiment_score) || 0,
            avg_rating: Number(sent.avg_rating) || 0,
            n_reviews: Number(sent.n_reviews) || 0,
            n_places: Number(sent.n_places) || 0,
            positive_ratio: Number(sent.positive_ratio) || 0,

            // UVI (composite)
            uvi_score: Number(uviScore.toFixed(4)),
            pillar_count: pillarCount,
          },
        };
      });

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
