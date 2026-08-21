import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  // path = ["dark", "14", "13089", "8507.png"] etc.
  const tilePath = path.join("/");
  const apiKey = process.env.NEXT_PUBLIC_MAPID_BASEMAP_KEY || "";

  const mapidUrl = `https://geo.mapid.io/api/v2/basemap/${tilePath}?api_key=${apiKey}`;

  try {
    const res = await fetch(mapidUrl);
    if (!res.ok) {
      return new NextResponse("Tile not found", { status: res.status });
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/png";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("MAPID tile proxy error:", err);
    return new NextResponse("Proxy error", { status: 502 });
  }
}
