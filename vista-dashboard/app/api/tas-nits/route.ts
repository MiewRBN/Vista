import { NextResponse } from "next/server";
import Papa from "papaparse";
import fs from "fs";
import path from "path";

// Vercel ISR (Incremental Static Regeneration) - Auto revalidate every 1 hour
export const revalidate = 3600;

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

    // --- 4. Load MAPID Activities Data (if present) ---
    let mapidActMap: Record<string, Record<string, number>> = {};
    const mapidActPath = path.join(dataDir, "mapid_activities_score.csv");
    if (fs.existsSync(mapidActPath)) {
      const actCsv = fs.readFileSync(mapidActPath, "utf-8");
      const actParsed = Papa.parse(actCsv, { header: true, dynamicTyping: true, skipEmptyLines: true });
      actParsed.data.forEach((row: any) => {
        if (row.tas_nit_id) {
          mapidActMap[row.tas_nit_id] = {
            mapid_activity_count: row.mapid_activity_count || 0,
            mapid_activity_sent_score: row.mapid_activity_sent_score || 0,
            mapid_activity_likes: row.mapid_activity_likes || 0,
            mapid_activity_comments: row.mapid_activity_comments || 0,
          };
        }
      });
    }

    // --- 5. Load MAPID Missions Data (PropertiGo, MenuGo, StrukGo) (if present) ---
    let mapidMissionMap: Record<string, Record<string, number>> = {};
    const mapidMissionPath = path.join(dataDir, "mapid_missions_score.csv");
    if (fs.existsSync(mapidMissionPath)) {
      const missionCsv = fs.readFileSync(mapidMissionPath, "utf-8");
      const missionParsed = Papa.parse(missionCsv, { header: true, dynamicTyping: true, skipEmptyLines: true });
      missionParsed.data.forEach((row: any) => {
        if (row.tas_nit_id) {
          mapidMissionMap[row.tas_nit_id] = {
            mapid_menu_count: row.mapid_menu_count || 0,
            mapid_menu_avg_price: row.mapid_menu_avg_price || 0,
            mapid_properti_count: row.mapid_properti_count || 0,
            mapid_struk_count: row.mapid_struk_count || 0,
          };
        }
      });
    }

    // --- 6. Merge and build GeoJSON ---
    const features = (accParsed.data as Record<string, any>[])
      .filter((row) => row.center_lat && row.center_lon)
      .map((row, idx) => {
        const id = row.tas_nit_id as string;
        const tasNitCode = `TASnit ${String(idx + 1).padStart(4, "0")}`;
        const phys = physMap[id] || {};
        const sent = sentMap[id] || {};
        const mapidAct = mapidActMap[id] || {};
        const mapidMis = mapidMissionMap[id] || {};

        // Pillar Scores
        const accScore = Number(row.accessibility_score) || 0;
        const physScore = Number(phys.visual_perception_score) || 0;
        
        // Equal Weighting (50% Data Tim internal FiveHonk + 50% Data Tim Lain / Ekosistem MAPID)
        let baseSentScore = Number(sent.sentiment_score) || 0;
        const mapidSentScore = Number(mapidAct.mapid_activity_sent_score) || 0;
        const mapidActCnt = Number(mapidAct.mapid_activity_count) || 0;

        let finalSentScore = baseSentScore;
        if (mapidActCnt > 0 && mapidSentScore > 0) {
          // Bobot Setara 50:50 (Equal Weighting)
          finalSentScore = baseSentScore > 0 ? (baseSentScore * 0.5 + mapidSentScore * 0.5) : mapidSentScore;
        }

        // Integrated Activity & Function with Equal Weighting for MAPID Missions (MenuGo, StrukGo)
        const missionCount = (Number(mapidMis.mapid_menu_count) || 0) + (Number(mapidMis.mapid_struk_count) || 0);
        let finalAccScore = accScore;
        if (missionCount > 0) {
          const missionBonus = Math.min(missionCount / 10.0, 0.2); // Equal bonus scaling
          finalAccScore = Math.min(accScore + missionBonus, 1.0);
        }

        // Count how many pillars have data
        const hasPillar = [finalAccScore > 0, physScore > 0, finalSentScore > 0];
        const pillarCount = hasPillar.filter(Boolean).length;

        // Composite UVI Index (0.0 - 1.0)
        let uviScore = 0;
        if (pillarCount > 0) {
          uviScore = (finalAccScore + physScore + finalSentScore) / pillarCount;
        }

        return {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [Number(row.center_lon), Number(row.center_lat)],
          },
          properties: {
            id,
            tas_nit_code: tasNitCode,
            street_name: row.street_name || phys.street_name || "Jalan Tanpa Nama",
            highway_type: row.highway_type,
            nearest_stop: row.nearest_stop_name,
            walking_class: row.walking_class,
            n_points: row.n_points,
            avg_distance_to_stop: Number(row.avg_distance_to_stop) || 0,

            // Pilar 1: Accessibility & Service
            accessibility_score: accScore,
            transit_accessibility: Number(row.transit_accessibility) || 0,
            service_accessibility: Number(row.service_accessibility) || 0,
            poi_pendidikan: row.poi_count_pendidikan || 0,
            poi_kesehatan: row.poi_count_kesehatan || 0,
            poi_komersial: row.poi_count_komersial || 0,
            poi_katering: row.poi_count_katering || 0,
            poi_finansial: row.poi_count_finansial || 0,
            poi_olahraga: row.poi_count_olahraga || 0,

            // Pilar 2: Physical Environment (AI SegFormer)
            physical_score: physScore,
            road_width: Number(phys.road_width_index) || 0,
            sidewalk: Number(phys.sidewalk_ratio) || 0,
            enclosure: Number(phys.street_canyon_enclosure) || 0,
            gvi: Number(phys.green_view_index) || 0,
            svf: Number(phys.sky_view_factor) || 0,
            n_images: Number(phys.n_images) || 0,

            // Pilar 3: Sentiment & Resident Perception
            sentiment_score: Number(finalSentScore.toFixed(4)),
            avg_rating: Number(sent.avg_rating) || 0,
            n_reviews: Number(sent.n_reviews) || 0,
            n_places: Number(sent.n_places) || 0,
            positive_ratio: Number(sent.positive_ratio) || 0,

            // Data Crowdsourced MAPID Apps
            mapid_activity_count: mapidActCnt,
            mapid_activity_sent_score: mapidSentScore,
            mapid_activity_likes: Number(mapidAct.mapid_activity_likes) || 0,
            mapid_activity_comments: Number(mapidAct.mapid_activity_comments) || 0,

            mapid_menu_count: Number(mapidMis.mapid_menu_count) || 0,
            mapid_menu_avg_price: Number(mapidMis.mapid_menu_avg_price) || 0,
            mapid_properti_count: Number(mapidMis.mapid_properti_count) || 0,
            mapid_struk_count: Number(mapidMis.mapid_struk_count) || 0,

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
