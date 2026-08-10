"""
VISTA Pipeline - Tahap 3: Service Facility Accessibility Analysis

Sesuai Proposal (Tabel 4):
  "Aksesibilitas fasilitas pendidikan, kesehatan, olahraga, komersial, finansial, 
   dan katering dihitung menggunakan Network Service Area Analysis berdasarkan 
   jaringan jalan sehingga merepresentasikan akses aktual terhadap pelayanan perkotaan."

Script ini menghitung Accessibility Score untuk setiap TAS-Nit berdasarkan:
1. Jarak ke halte transportasi terdekat (Transit Accessibility)
2. Kepadatan fasilitas publik di sekitar TAS-Nit (Service Accessibility):
   - Pendidikan (sekolah, universitas)
   - Kesehatan (RS, klinik, apotek)
   - Komersial (toko, mall, pasar)
   - Katering (restoran, cafe)
"""

import osmnx as ox
import pandas as pd
import numpy as np
from scipy.spatial import cKDTree
import os

ox.settings.log_console = False
ox.settings.use_cache = True

def fetch_pois(place_name, tags, label):
    """Mengambil Point of Interest dari OSM"""
    print(f"  Mengunduh data {label}...")
    try:
        pois = ox.features_from_place(place_name, tags=tags)
        # Ambil hanya titik (Point), bukan polygon
        pois_points = pois[pois.geometry.type == 'Point'].copy()
        pois_points['lat'] = pois_points.geometry.y
        pois_points['lon'] = pois_points.geometry.x
        pois_points['category'] = label
        print(f"    -> Ditemukan {len(pois_points)} {label}")
        return pois_points[['lat', 'lon', 'category']]
    except Exception as e:
        print(f"    -> Gagal mengunduh {label}: {e}")
        return pd.DataFrame(columns=['lat', 'lon', 'category'])

def calculate_accessibility():
    print("=== TAHAP 3: Service Facility Accessibility Analysis ===\n")
    
    place_name = "Kota Bandung, Indonesia"
    
    # 1. Muat data TAS-Nits
    tas_nits = pd.read_csv('data/tas_nits_summary.csv')
    print(f"TAS-Nits dimuat: {len(tas_nits)} segmen\n")
    
    # 2. Unduh POI fasilitas publik dari OSM (sesuai proposal Tabel 3)
    print("Mengunduh data fasilitas publik dari OpenStreetMap...")
    
    all_pois = []
    
    # Fasilitas Pendidikan (Proposal No. 10)
    edu = fetch_pois(place_name, {'amenity': ['school', 'university', 'college', 'kindergarten']}, 'Pendidikan')
    all_pois.append(edu)
    
    # Fasilitas Kesehatan (Proposal No. 11)
    health = fetch_pois(place_name, {'amenity': ['hospital', 'clinic', 'doctors', 'pharmacy']}, 'Kesehatan')
    all_pois.append(health)
    
    # Fasilitas Komersial (Proposal No. 13)
    commercial = fetch_pois(place_name, {'shop': True}, 'Komersial')
    all_pois.append(commercial)
    
    # Fasilitas Katering/Kuliner (Proposal No. 18)
    food = fetch_pois(place_name, {'amenity': ['restaurant', 'cafe', 'fast_food', 'food_court']}, 'Katering')
    all_pois.append(food)
    
    # Fasilitas Finansial (Proposal No. 17)
    finance = fetch_pois(place_name, {'amenity': ['bank', 'atm']}, 'Finansial')
    all_pois.append(finance)
    
    # Fasilitas Olahraga (Proposal No. 12)
    sport = fetch_pois(place_name, {'leisure': ['sports_centre', 'stadium', 'swimming_pool', 'fitness_centre']}, 'Olahraga')
    all_pois.append(sport)
    
    pois_df = pd.concat(all_pois, ignore_index=True)
    pois_df = pois_df.dropna(subset=['lat', 'lon'])
    
    print(f"\nTotal POI fasilitas publik: {len(pois_df)}")
    print(f"Distribusi per kategori:")
    for cat, count in pois_df['category'].value_counts().items():
        print(f"  - {cat}: {count}")
    
    # Simpan POI untuk referensi
    pois_df.to_csv('data/pois_bandung.csv', index=False)
    
    # 3. Hitung Service Accessibility Score per TAS-Nit
    print("\nMenghitung Service Accessibility Score per TAS-Nit...")
    
    tas_coords = np.column_stack([tas_nits['center_lat'].values, tas_nits['center_lon'].values])
    
    # Untuk setiap kategori fasilitas, hitung jumlah POI dalam radius tertentu
    buffer_radius_deg = 400 / 111320  # 400 meter walking distance (standar TOD)
    
    categories = ['Pendidikan', 'Kesehatan', 'Komersial', 'Katering', 'Finansial', 'Olahraga']
    
    for cat in categories:
        cat_pois = pois_df[pois_df['category'] == cat]
        if len(cat_pois) == 0:
            tas_nits[f'poi_count_{cat.lower()}'] = 0
            tas_nits[f'dist_nearest_{cat.lower()}'] = 9999
            continue
            
        poi_coords = np.column_stack([cat_pois['lat'].values, cat_pois['lon'].values])
        poi_tree = cKDTree(poi_coords)
        
        # Hitung jumlah POI dalam radius 400m
        counts = poi_tree.query_ball_point(tas_coords, buffer_radius_deg)
        tas_nits[f'poi_count_{cat.lower()}'] = [len(c) for c in counts]
        
        # Hitung jarak ke POI terdekat
        distances, _ = poi_tree.query(tas_coords)
        tas_nits[f'dist_nearest_{cat.lower()}'] = np.round(distances * 111320, 1)
    
    # 4. Hitung Composite Accessibility Score (0-1)
    print("Menghitung Composite Accessibility Score...")
    
    # Transit Accessibility (berdasarkan jarak ke halte)
    # Semakin dekat ke halte = skor semakin tinggi
    max_walk = 800  # meter (batas maksimal walking distance)
    tas_nits['transit_accessibility'] = np.clip(
        1 - (tas_nits['avg_distance_to_stop'] / max_walk), 0, 1
    )
    
    # Service Accessibility (berdasarkan jumlah fasilitas dalam radius 400m)
    # Normalisasi setiap kategori ke 0-1
    for cat in categories:
        col = f'poi_count_{cat.lower()}'
        max_val = tas_nits[col].quantile(0.95)  # Pakai percentile 95 agar tidak bias outlier
        if max_val > 0:
            tas_nits[f'norm_{cat.lower()}'] = np.clip(tas_nits[col] / max_val, 0, 1)
        else:
            tas_nits[f'norm_{cat.lower()}'] = 0
    
    # Rata-rata service accessibility dari semua kategori
    norm_cols = [f'norm_{cat.lower()}' for cat in categories]
    tas_nits['service_accessibility'] = tas_nits[norm_cols].mean(axis=1)
    
    # Composite Accessibility = 0.5 * Transit + 0.5 * Service
    tas_nits['accessibility_score'] = np.round(
        0.5 * tas_nits['transit_accessibility'] + 0.5 * tas_nits['service_accessibility'],
        4
    )
    
    # 5. Statistik hasil
    print(f"\n=== HASIL ACCESSIBILITY ANALYSIS ===")
    print(f"Rata-rata Transit Accessibility: {tas_nits['transit_accessibility'].mean():.3f}")
    print(f"Rata-rata Service Accessibility: {tas_nits['service_accessibility'].mean():.3f}")
    print(f"Rata-rata Composite Score: {tas_nits['accessibility_score'].mean():.3f}")
    print(f"\nTop 10 TAS-Nits dengan Accessibility tertinggi:")
    top10 = tas_nits.nlargest(10, 'accessibility_score')[
        ['tas_nit_id', 'street_name', 'nearest_stop_name', 'accessibility_score', 'avg_distance_to_stop']
    ]
    print(top10.to_string(index=False))
    
    print(f"\nBottom 10 TAS-Nits dengan Accessibility terendah:")
    bot10 = tas_nits.nsmallest(10, 'accessibility_score')[
        ['tas_nit_id', 'street_name', 'nearest_stop_name', 'accessibility_score', 'avg_distance_to_stop']
    ]
    print(bot10.to_string(index=False))
    
    # 6. Simpan hasil
    output_file = 'data/accessibility_score.csv'
    tas_nits.to_csv(output_file, index=False)
    print(f"\nHasil disimpan ke: {output_file}")
    print("\nTahap 3 Selesai!")
    
    return tas_nits

if __name__ == "__main__":
    calculate_accessibility()
