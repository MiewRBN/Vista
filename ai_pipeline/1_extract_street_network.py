import osmnx as ox
import pandas as pd
import numpy as np
from shapely.geometry import LineString
import os

def extract_vista_network(place_name="Kota Bandung, Indonesia", interval_meters=50):
    print(f"=== EKSTRAKSI DATA VISTA: {place_name} ===")
    
    # Konfigurasi OSMnx
    ox.settings.log_console = True
    ox.settings.use_cache = True
    
    # 1. MENGAMBIL TITIK SIMPUL TRANSPORTASI (HALTE / BUS STOP)
    print("\n1. Mengunduh data Halte Bus / Pemberhentian Transportasi Massal...")
    try:
        # Mengambil POI (Point of Interest) yang bertanda bus_stop atau platform
        bus_stops = ox.features_from_place(place_name, tags={'highway': 'bus_stop', 'public_transport': 'platform'})
        print(f"-> Berhasil menemukan {len(bus_stops)} halte/simpul transportasi di {place_name}.")
        
        # Ekstrak koordinat halte
        bus_stops = bus_stops[bus_stops.geometry.type == 'Point']
        bus_stops_export = pd.DataFrame({
            'name': bus_stops.get('name', 'Unknown Halte'),
            'lat': bus_stops.geometry.y,
            'lon': bus_stops.geometry.x
        })
        
        output_dir = 'data'
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        bus_stops_export.to_csv(os.path.join(output_dir, 'bus_stops.csv'), index=False)
        print("-> Data halte berhasil disimpan ke data/bus_stops.csv")
    except Exception as e:
        print(f"-> Gagal mengunduh halte bus: {e}")

    # 2. MENGAMBIL KORIDOR TRANSPORTASI MASSAL (TAS-Nits)
    print("\n2. Mengunduh Jaringan Jalan Koridor Utama (Primary, Secondary, Tertiary)...")
    try:
        # VISTA PROPOSAL: Fokus pada Koridor Transportasi Massal
        # Hanya mengambil koridor utama tempat rute bus/angkot beroperasi, filter jalan perumahan
        custom_filter = '["highway"~"primary|secondary|tertiary|trunk"]'
        G = ox.graph_from_place(place_name, custom_filter=custom_filter)
    except Exception as e:
        print(f"Error saat mengunduh data jaringan jalan: {e}")
        return
        
    print(f"-> Berhasil mengunduh graf jaringan jalan: {len(G.nodes)} persimpangan dan {len(G.edges)} segmen jalan.")
    
    # Konversi graf ke GeoDataFrame
    nodes, edges = ox.graph_to_gdfs(G)
    
    # Proyeksikan ke UTM agar jarak dalam meter akurat
    edges_proj = edges.to_crs(edges.estimate_utm_crs())
    
    sampled_points = []
    
    print(f"\n3. Membuat Titik Sampel (TAS-Nits) setiap {interval_meters} meter...")
    for idx, row in edges_proj.iterrows():
        geometry = row['geometry']
        
        if not isinstance(geometry, LineString):
            continue
            
        length = geometry.length
        distances = np.arange(0, length, interval_meters)
        
        for dist in distances:
            point = geometry.interpolate(dist)
            sampled_points.append({
                'edge_id': f"{idx[0]}_{idx[1]}",
                'name': row.get('name', 'Unknown'),
                'highway': row.get('highway', 'Unknown'),
                'geometry': point
            })
            
    # Kembalikan ke format Latitude Longitude
    import geopandas as gpd
    gdf_points = gpd.GeoDataFrame(sampled_points, geometry='geometry', crs=edges_proj.crs)
    gdf_points_wgs84 = gdf_points.to_crs("EPSG:4326")
    
    gdf_points_wgs84['lat'] = gdf_points_wgs84.geometry.y
    gdf_points_wgs84['lon'] = gdf_points_wgs84.geometry.x
    
    print(f"-> Berhasil membuat total {len(gdf_points_wgs84)} titik sampel GSV di seluruh Kota Bandung!")
    
    # Simpan ke CSV
    output_file = os.path.join(output_dir, 'sample_points_gsv.csv')
    df_export = pd.DataFrame(gdf_points_wgs84.drop(columns='geometry'))
    df_export.to_csv(output_file, index=False)
    
    print(f"-> Data titik sampel (TAS-Nits) berhasil disimpan ke: {output_file}")
    print("\nEkstraksi VISTA Selesai!")
    return df_export

if __name__ == "__main__":
    # KITA GUNAKAN SELURUH KOTA BANDUNG SESUAI ARAHAN
    extract_vista_network(place_name="Kota Bandung, Indonesia", interval_meters=50)
