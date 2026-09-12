import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// In-memory cache on the server
let reviewsCache: Record<string, any[]> | null = null;

function loadReviewsIndex(): Record<string, any[]> {
  if (reviewsCache) return reviewsCache;
  try {
    const filePath = path.join(process.cwd(), "public", "data", "tasnit_reviews_index.json");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      reviewsCache = JSON.parse(content);
      return reviewsCache || {};
    }
  } catch (err) {
    console.error("Failed to load reviews index:", err);
  }
  return {};
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing tas_nit_id" }, { status: 400 });
  }

  const index = loadReviewsIndex();
  const reviews = index[id] || [];

  return NextResponse.json(
    { id, count: reviews.length, reviews },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  );
}
