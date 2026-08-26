import os
import json

PUBLIC_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "vista-dashboard", "public", "data")
BOUNDARY_FILE = os.path.join(PUBLIC_DATA_DIR, "bandung_boundary.json")
MASK_FILE = os.path.join(PUBLIC_DATA_DIR, "bandung_mask.json")

def create_mask():
    if not os.path.exists(BOUNDARY_FILE):
        print(f"[ERROR] {BOUNDARY_FILE} not found.")
        return

    with open(BOUNDARY_FILE, "r", encoding="utf-8") as f:
        boundary_data = json.load(f)

    features = boundary_data.get("features", [])
    if not features:
        return

    bandung_geom = features[0].get("geometry", {})
    b_type = bandung_geom.get("type")
    b_coords = bandung_geom.get("coordinates", [])

    # World outer ring (clockwise)
    world_ring = [
        [180.0, 90.0],
        [180.0, -90.0],
        [-180.0, -90.0],
        [-180.0, 90.0],
        [180.0, 90.0]
    ]

    mask_coordinates = []

    if b_type == "Polygon":
        # First ring = outer world, second ring = Bandung boundary hole
        inner_ring = b_coords[0]
        mask_coordinates = [world_ring, inner_ring]
        mask_geom = {"type": "Polygon", "coordinates": mask_coordinates}
    elif b_type == "MultiPolygon":
        # For MultiPolygon, construct a polygon with world outer ring and all Bandung rings as holes
        holes = [poly[0] for poly in b_coords]
        mask_coordinates = [world_ring] + holes
        mask_geom = {"type": "Polygon", "coordinates": mask_coordinates}

    mask_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "Bandung Spotlight Mask"},
                "geometry": mask_geom
            }
        ]
    }

    with open(MASK_FILE, "w", encoding="utf-8") as out:
        json.dump(mask_geojson, out)

    print(f"[SUCCESS] Generated Bandung Spotlight Highlight Mask GeoJSON at {MASK_FILE}")

if __name__ == "__main__":
    create_mask()
