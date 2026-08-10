"""
VISTA Pipeline - Tahap 2: Scraping Google Street View

Sesuai Proposal (Tabel 3, No. 9):
  "Google Street View Image Scrapping - JPEG - Google Maps, 2026"

Script ini mendownload citra Google Street View berdasarkan titik sampel TAS-Nits.
Gambar-gambar ini akan diproses oleh AI Semantic Segmentation di Google Colab
untuk menghasilkan Physical Environment Score (Sky View, Green View, Road Width).

CARA PAKAI:
  # Tanpa API Key (dummy untuk testing pipeline)
  python 2_scrape_gsv.py

  # Dengan API Key (download gambar ASLI)
  python 2_scrape_gsv.py --api-key YOUR_API_KEY_HERE

  # Download lebih banyak gambar
  python 2_scrape_gsv.py --api-key YOUR_KEY --max-images 100
  
  # Download 4 arah (heading 0, 90, 180, 270) per titik
  python 2_scrape_gsv.py --api-key YOUR_KEY --max-images 50 --four-directions
"""

import os
import argparse
import pandas as pd
import requests
import time
import random

def download_gsv_official(lat, lon, output_path, api_key, heading=0, fov=90, pitch=0):
    """Download gambar menggunakan Google Street View Static API (resmi)"""
    url = (
        f"https://maps.googleapis.com/maps/api/streetview"
        f"?size=640x480"
        f"&location={lat},{lon}"
        f"&fov={fov}&heading={heading}&pitch={pitch}"
        f"&key={api_key}"
    )
    try:
        response = requests.get(url, timeout=15)
        if response.status_code == 200:
            # Cek apakah gambar valid (bukan "no image available" placeholder)
            if len(response.content) > 5000:  # Gambar asli biasanya > 5KB
                with open(output_path, 'wb') as f:
                    f.write(response.content)
                return True
            else:
                return False
        else:
            return False
    except Exception as e:
        print(f"    Error: {e}")
        return False

def download_gsv_dummy(lat, lon, output_path):
    """Dummy placeholder untuk testing pipeline tanpa API key"""
    # Buat gambar PNG kecil sebagai placeholder
    with open(output_path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82')
    return True

def scrape_gsv(api_key=None, max_images=10, four_directions=False):
    # Gunakan file TAS-Nits jika tersedia, fallback ke sample_points
    if os.path.exists('data/sample_points_with_tas_nits.csv'):
        csv_path = 'data/sample_points_with_tas_nits.csv'
    else:
        csv_path = 'data/sample_points_gsv.csv'
    
    if not os.path.exists(csv_path):
        print(f"Error: File {csv_path} tidak ditemukan. Jalankan Tahap 1 terlebih dahulu.")
        return
        
    df = pd.read_csv(csv_path)
    
    mode = "OFFICIAL API" if api_key else "DUMMY (testing)"
    print(f"=== TAHAP 2: Scraping Google Street View ({mode}) ===\n")
    print(f"Sumber data: {csv_path}")
    print(f"Total titik tersedia: {len(df)}")
    print(f"Akan memproses: {min(max_images, len(df))} titik")
    if four_directions:
        print(f"Mode: 4 arah (heading 0°, 90°, 180°, 270°) per titik")
    print()
    
    output_dir = 'data/images'
    os.makedirs(output_dir, exist_ok=True)
    
    headings = [0, 90, 180, 270] if four_directions else [0]
    
    success_count = 0
    fail_count = 0
    
    for idx, row in df.head(max_images).iterrows():
        lat = row['lat']
        lon = row['lon']
        edge_id = str(row['edge_id']).replace('/', '_')
        
        for heading in headings:
            suffix = f"_h{heading}" if four_directions else ""
            filename = f"gsv_{edge_id}_{idx}{suffix}.jpg"
            output_path = os.path.join(output_dir, filename)
            
            # Skip jika sudah pernah didownload
            if os.path.exists(output_path) and os.path.getsize(output_path) > 5000:
                success_count += 1
                continue
            
            if api_key:
                ok = download_gsv_official(lat, lon, output_path, api_key, heading=heading)
            else:
                ok = download_gsv_dummy(lat, lon, output_path)
            
            if ok:
                success_count += 1
                street_name = row.get('name', 'Unknown')
                print(f"  [{success_count}] [OK] {street_name} ({lat:.5f}, {lon:.5f}) -> {filename}")
            else:
                fail_count += 1
            
            # Rate limiting: Google API punya limit 1000 req/menit
            if api_key:
                time.sleep(0.1)
    
    total = success_count + fail_count
    print(f"\n=== Selesai ===")
    print(f"Berhasil: {success_count}/{total}")
    if fail_count > 0:
        print(f"Gagal: {fail_count}/{total}")
    print(f"Gambar tersimpan di: {os.path.abspath(output_dir)}")
    
    if not api_key:
        print(f"\n⚠️  PERHATIAN: Gambar yang didownload adalah DUMMY (placeholder).")
        print(f"   Untuk gambar ASLI, jalankan:")
        print(f"   python 2_scrape_gsv.py --api-key YOUR_KEY --max-images {max_images}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='VISTA - Google Street View Scraper')
    parser.add_argument('--api-key', type=str, default=None, 
                        help='Google Maps API Key untuk download gambar asli')
    parser.add_argument('--max-images', type=int, default=10,
                        help='Jumlah titik yang akan didownload (default: 10)')
    parser.add_argument('--four-directions', action='store_true',
                        help='Download 4 arah (0°, 90°, 180°, 270°) per titik')
    
    args = parser.parse_args()
    scrape_gsv(api_key=args.api_key, max_images=args.max_images, four_directions=args.four_directions)
