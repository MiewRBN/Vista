import os
import json
import urllib.request

PUBLIC_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "vista-dashboard", "public", "data")
os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)

OUT_FILE = os.path.join(PUBLIC_DATA_DIR, "bandung_boundary.json")

def fetch_boundary():
    # Query Nominatim OpenStreetMap for Kota Bandung official boundary polygon
    url = "https://nominatim.openstreetmap.org/search?city=Bandung&state=Jawa+Barat&country=Indonesia&polygon_geojson=1&format=geojson"
    headers = {"User-Agent": "VISTA-WebGIS/1.0 (audyamariztha23@gmail.com)"}

    print(f"[FETCH] Querying Kota Bandung administrative boundary from OSM Nominatim...")
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                features = data.get("features", [])
                if features:
                    # Filter for Polygon / MultiPolygon
                    poly_feat = None
                    for f in features:
                        g_type = f.get("geometry", {}).get("type")
                        if g_type in ["Polygon", "MultiPolygon"]:
                            poly_feat = f
                            break
                    if poly_feat:
                        geojson_out = {
                            "type": "FeatureCollection",
                            "features": [poly_feat]
                        }
                        with open(OUT_FILE, "w", encoding="utf-8") as out:
                            json.dump(geojson_out, out)
                        print(f"[SUCCESS] Saved official Kota Bandung boundary GeoJSON to {OUT_FILE}")
                        return True
    except Exception as e:
        print(f"[ERROR] Failed to fetch from Nominatim: {e}")

    # Fallback Bounding Box Convex Hull if Nominatim API is blocked/slow
    print("[FALLBACK] Creating fallback boundary polygon for Bandung City...")
    fallback_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "Batas Administrasi Kota Bandung"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [107.545, -6.885],
                            [107.575, -6.865],
                            [107.635, -6.835],
                            [107.675, -6.875],
                            [107.725, -6.915],
                            [107.745, -6.955],
                            [107.705, -6.975],
                            [107.645, -6.985],
                            [107.575, -6.965],
                            [107.535, -6.925],
                            [107.545, -6.885]
                        ]
                    ]
                }
            }
        ]
    }
    with open(OUT_FILE, "w", encoding="utf-8") as out:
        json.dump(fallback_geojson, out)
    print(f"[SUCCESS] Created fallback boundary at {OUT_FILE}")
    return True

if __name__ == "__main__":
    fetch_boundary()
