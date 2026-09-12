import fs from "fs";
import path from "path";
import Papa from "papaparse";

const dataDir = path.join(process.cwd(), "public", "data");

console.log("Loading accessibility_score.csv and tasnit_reviews_index.json...");
const accCsv = fs.readFileSync(path.join(dataDir, "accessibility_score.csv"), "utf8");
const acc = Papa.parse(accCsv, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;

const index = JSON.parse(fs.readFileSync(path.join(dataDir, "tasnit_reviews_index.json"), "utf8"));

// Backup original sentiment_score.csv
const originalSentPath = path.join(dataDir, "sentiment_score.csv");
const backupSentPath = path.join(dataDir, "sentiment_score_original.csv");
if (fs.existsSync(originalSentPath) && !fs.existsSync(backupSentPath)) {
  fs.copyFileSync(originalSentPath, backupSentPath);
  console.log("Created backup at sentiment_score_original.csv");
}

let matched = 0;
const rows = [];

acc.forEach((r) => {
  const id = r.tas_nit_id;
  if (!id) return;
  const revs = index[id];
  if (revs && revs.length > 0) {
    matched++;
    const nReviews = revs.length;
    const places = new Set(revs.map((x) => x.place_name).filter(Boolean));
    const avgRating = Number((revs.reduce((a, b) => a + Number(b.rating || 5), 0) / nReviews).toFixed(2));
    const avgScore = Number((revs.reduce((a, b) => a + Number(b.score || 0.5), 0) / nReviews).toFixed(4));
    const posCount = revs.filter((x) => x.sentiment === "positif").length;
    const negCount = revs.filter((x) => x.sentiment === "negatif").length;
    const posRatio = Number((posCount / nReviews).toFixed(4));
    const negRatio = Number((negCount / nReviews).toFixed(4));
    const cats = Array.from(new Set(revs.map((x) => x.category).filter(Boolean))).join(";");

    rows.push({
      tas_nit_id: id,
      sentiment_score: avgScore,
      avg_rating: avgRating,
      n_reviews_total: nReviews,
      n_places: places.size,
      positive_ratio: posRatio,
      negative_ratio: negRatio,
      categories: cats,
      street_name: r.street_name || "Jalan Tanpa Nama",
    });
  }
});

const unparseCsv = Papa.unparse(rows);
fs.writeFileSync(originalSentPath, unparseCsv);

console.log(`Updated sentiment_score.csv with ${matched} TAS-Nits (${(matched / acc.length * 100).toFixed(1)}% coverage)!`);
