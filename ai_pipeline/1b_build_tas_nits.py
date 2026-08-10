"""
VISTA Pipeline - Tahap 1B: Pembentukan TAS-Nits (Transit-Access Segment Units)

Sesuai Proposal:
  "Transit-Access Segment Units (TAS-Nits) merupakan unit analisis spasial yang dibentuk
   dengan membagi jaringan jalan berdasarkan lokasi halte transportasi publik dan simpang jalan."
   (Halaman 4, Proposal VISTA)

Script ini melakukan Stop-Point Line Split Analysis:
1. Mengambil data halte bus dan jaringan jalan yang sudah diextract
2. Meng-assign setiap titik sampel ke halte (bus stop) terdekat
3. Setiap kelompok titik yang di-assign ke halte yang sama = 1 TAS-Nit
4. Menghasilkan file tas_nits.csv yang siap digunakan untuk analisis selanjutnya
"""

import pandas as pd
import numpy as np
from scipy.spatial import cKDTree
import os

def build_tas_nits():
    print("=== TAHAP 1B: Pembentukan TAS-Nits (Stop-Point Line Split Analysis) ===\n")
    
    # 1. Muat data
    bus_stops = pd.read_csv('data/bus_stops.csv')
    sample_points = pd.read_csv('data/sample_points_gsv.csv')
    
    print(f"Data dimuat:")
    print(f"  - Halte bus: {len(bus_stops)} titik")
    print(f"  - Titik sampel jalan: {len(sample_points)} titik\n")
    
    # 2. Bersihkan data halte (buang yang tidak punya koordinat valid)
    bus_stops = bus_stops.dropna(subset=['lat', 'lon'])
    bus_stops = bus_stops.reset_index(drop=True)
    bus_stops['stop_id'] = range(len(bus_stops))
    
    # Beri nama default untuk halte tanpa nama
    bus_stops['name'] = bus_stops['name'].fillna('Halte Tanpa Nama')
    
    print(f"Halte bus valid (setelah pembersihan): {len(bus_stops)}\n")
    
    # 3. Stop-Point Line Split Analysis
    # Buat KD-Tree dari koordinat halte untuk pencarian jarak terdekat yang sangat cepat
    print("Menjalankan Stop-Point Line Split Analysis...")
    bus_coords = np.column_stack([bus_stops['lat'].values, bus_stops['lon'].values])
    sample_coords = np.column_stack([sample_points['lat'].values, sample_points['lon'].values])
    
    tree = cKDTree(bus_coords)
    
    # Cari halte terdekat untuk setiap titik sampel
    distances, indices = tree.query(sample_coords)
    
    # Konversi jarak dari derajat ke meter (aproksimasi: 1 derajat ≈ 111.32 km di ekuator)
    distances_meters = distances * 111320
    
    # 4. Assign setiap titik sampel ke TAS-Nit berdasarkan halte terdekatnya
    sample_points['nearest_stop_id'] = indices
    sample_points['nearest_stop_name'] = bus_stops.iloc[indices]['name'].values
    sample_points['distance_to_stop_m'] = np.round(distances_meters, 1)
    
    # TAS-Nit ID = kombinasi edge_id dan nearest_stop_id
    sample_points['tas_nit_id'] = sample_points['edge_id'] + '_STOP' + sample_points['nearest_stop_id'].astype(str)
    
    # 5. Hitung statistik per TAS-Nit
    tas_nit_stats = sample_points.groupby('tas_nit_id').agg(
        n_points=('lat', 'count'),
        avg_distance_to_stop=('distance_to_stop_m', 'mean'),
        min_distance_to_stop=('distance_to_stop_m', 'min'),
        max_distance_to_stop=('distance_to_stop_m', 'max'),
        nearest_stop_name=('nearest_stop_name', 'first'),
        street_name=('name', 'first'),
        highway_type=('highway', 'first'),
        center_lat=('lat', 'mean'),
        center_lon=('lon', 'mean')
    ).reset_index()
    
    print(f"\nHasil Stop-Point Line Split Analysis:")
    print(f"  - Total TAS-Nits terbentuk: {len(tas_nit_stats)} segmen")
    print(f"  - Rata-rata jarak ke halte: {tas_nit_stats['avg_distance_to_stop'].mean():.0f} meter")
    print(f"  - Titik terdekat ke halte: {tas_nit_stats['min_distance_to_stop'].min():.0f} meter")
    print(f"  - Titik terjauh dari halte: {tas_nit_stats['max_distance_to_stop'].max():.0f} meter")
    
    # 6. Klasifikasi Walking Distance (sesuai standar TOD: 400m = 5 menit jalan kaki)
    tas_nit_stats['walking_class'] = pd.cut(
        tas_nit_stats['avg_distance_to_stop'],
        bins=[0, 200, 400, 800, float('inf')],
        labels=['Sangat Dekat (<200m)', 'Dekat (200-400m)', 'Sedang (400-800m)', 'Jauh (>800m)']
    )
    
    print(f"\nDistribusi Walking Distance TAS-Nits:")
    walking_dist = tas_nit_stats['walking_class'].value_counts().sort_index()
    for cls, count in walking_dist.items():
        pct = count / len(tas_nit_stats) * 100
        print(f"  - {cls}: {count} segmen ({pct:.1f}%)")
    
    # 7. Simpan hasil
    sample_points.to_csv('data/sample_points_with_tas_nits.csv', index=False)
    tas_nit_stats.to_csv('data/tas_nits_summary.csv', index=False)
    
    print(f"\nFile output:")
    print(f"  - data/sample_points_with_tas_nits.csv (titik sampel + assignment TAS-Nit)")
    print(f"  - data/tas_nits_summary.csv (ringkasan statistik per TAS-Nit)")
    print("\nTahap 1B Selesai!")
    
    return sample_points, tas_nit_stats

if __name__ == "__main__":
    build_tas_nits()
