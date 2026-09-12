import fs from "fs";
import path from "path";
import Papa from "papaparse";

const rootDir = process.cwd();
const dataDir = path.join(rootDir, "public", "data");
const rawRevPath = path.resolve(rootDir, "..", "ai_pipeline", "data", "google_reviews_raw.csv");

console.log("Loading datasets...");
const accCsv = fs.readFileSync(path.join(dataDir, "accessibility_score.csv"), "utf-8");
const accData = Papa.parse(accCsv, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;

const revCsv = fs.readFileSync(rawRevPath, "utf-8");
const revData = Papa.parse(revCsv, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;

// Haversine distance in meters
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Group reviews by place or unique coordinates
const validReviews = revData.filter((r) => r.place_lat && r.place_lon && r.place_name);

console.log(`Processing ${validReviews.length} reviews for ${accData.length} TAS-Nits...`);

// For quick spatial lookup, bucket reviews by ~0.01 lat/lon (~1km grid)
const grid = new Map();
function getGridKey(lat, lon) {
  const gLat = Math.floor(lat * 100);
  const gLon = Math.floor(lon * 100);
  return `${gLat}_${gLon}`;
}

for (const rev of validReviews) {
  const key = getGridKey(rev.place_lat, rev.place_lon);
  if (!grid.has(key)) grid.set(key, []);
  grid.get(key).push(rev);
}

const tasnitReviewsIndex = {};
let totalAssigned = 0;

for (const tas of accData) {
  if (!tas.tas_nit_id || !tas.center_lat || !tas.center_lon) continue;

  const lat = Number(tas.center_lat);
  const lon = Number(tas.center_lon);
  const gLat = Math.floor(lat * 100);
  const gLon = Math.floor(lon * 100);

  const candidates = [];
  // check 3x3 surrounding grid cells
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLon = -1; dLon <= 1; dLon++) {
      const cell = grid.get(`${gLat + dLat}_${gLon + dLon}`);
      if (cell) {
        for (const rev of cell) {
          const dist = getDistanceMeters(lat, lon, rev.place_lat, rev.place_lon);
          if (dist <= 450) { // within 450m radius (standard walkability buffer)
            candidates.push({ rev, dist });
          }
        }
      }
    }
  }

  if (candidates.length > 0) {
    // Sort: reviews with text first, then closest distance
    candidates.sort((a, b) => {
      const aHasText = a.rev.review_text && String(a.rev.review_text).trim().length > 3 ? 1 : 0;
      const bHasText = b.rev.review_text && String(b.rev.review_text).trim().length > 3 ? 1 : 0;
      if (bHasText !== aHasText) return bHasText - aHasText;
      return a.dist - b.dist;
    });

    // Take top 8 reviews for rich drilldown
    const top = candidates.slice(0, 8).map(({ rev, dist }) => ({
      place_name: String(rev.place_name || "").trim(),
      category: String(rev.place_category || "umum").trim(),
      rating: Number(rev.review_rating) || 5,
      sentiment: String(rev.review_sentiment || "positif").toLowerCase().trim(),
      score: Number(rev.review_text_score) || 0.5,
      time: String(rev.review_time || "").trim(),
      text: String(rev.review_text || "").trim(),
      distance_m: Math.round(dist),
    }));

    tasnitReviewsIndex[tas.tas_nit_id] = top;
    totalAssigned += top.length;
  }
}

const outPath = path.join(dataDir, "tasnit_reviews_index.json");
fs.writeFileSync(outPath, JSON.stringify(tasnitReviewsIndex));

const stats = fs.statSync(outPath);
console.log(`Successfully indexed reviews for ${Object.keys(tasnitReviewsIndex).length} TAS-Nits!`);
console.log(`Total review cards created: ${totalAssigned}`);
console.log(`Index file saved to ${outPath} (${(stats.size / 1024).toFixed(1)} KB)`);
