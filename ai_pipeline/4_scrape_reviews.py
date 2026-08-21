"""
VISTA Pipeline - Tahap 4: Scraping Google Reviews (Sentimen Warga)

Sesuai Proposal (Tabel 4, Community Perception):
  "Persepsi masyarakat dievaluasi melalui Sentiment Analysis terhadap data ulasan."

Script ini men-scrape review/ulasan dari Google Places API di sekitar 844 halte 
transportasi massal Kota Bandung. Data review ini akan dianalisis sentimennya 
untuk menghasilkan Resident Perception Score per TAS-Nit.

SUMBER DATA:
  - [PRIMER]   Data MAPID Apps (jika tersedia dari panitia)
  - [SEKUNDER] Google Places Reviews (script ini) — sebagai penguat/supplementary

CARA PAKAI:
  # Scrape review di sekitar 50 halte pertama (testing)
  python 4_scrape_reviews.py --api-key YOUR_KEY --max-stops 50

  # Scrape semua 844 halte
  python 4_scrape_reviews.py --api-key YOUR_KEY --max-stops 844

  # Custom radius pencarian (default 300m)
  python 4_scrape_reviews.py --api-key YOUR_KEY --max-stops 100 --radius 400

ESTIMASI BIAYA:
  - 844 halte × Nearby Search = ~$27  (gratis dari $200 credit)
  - ~4.000 Place Details        = ~$68  (gratis dari $200 credit)
  - TOTAL ESTIMASI: ~$95 (masih dalam free tier $200/bulan)
"""

import os
import argparse
import pandas as pd
import numpy as np
import requests
import json
import time
from collections import defaultdict

# Kategori tempat yang relevan untuk urban vitality
# Mapping ke proposal: katering, komersial, kesehatan, pendidikan, olahraga, finansial
PLACE_TYPES_SEARCH = [
    'restaurant', 'cafe', 'shopping_mall', 'store', 
    'hospital', 'school', 'bank', 'park',
    'transit_station', 'bus_station',
]

# Label kategori untuk analisis
CATEGORY_MAP = {
    'restaurant': 'katering', 'cafe': 'katering', 'bakery': 'katering',
    'food': 'katering', 'meal_takeaway': 'katering', 'meal_delivery': 'katering',
    'shopping_mall': 'komersial', 'store': 'komersial', 'supermarket': 'komersial',
    'clothing_store': 'komersial', 'convenience_store': 'komersial',
    'department_store': 'komersial', 'shoe_store': 'komersial',
    'hospital': 'kesehatan', 'pharmacy': 'kesehatan', 'doctor': 'kesehatan',
    'dentist': 'kesehatan', 'health': 'kesehatan',
    'school': 'pendidikan', 'university': 'pendidikan', 'library': 'pendidikan',
    'bank': 'finansial', 'atm': 'finansial', 'finance': 'finansial',
    'gym': 'olahraga', 'stadium': 'olahraga', 'park': 'rekreasi',
    'transit_station': 'transportasi', 'bus_station': 'transportasi',
    'train_station': 'transportasi', 'subway_station': 'transportasi',
}


def nearby_search(lat, lon, api_key, radius=300, place_type=None):
    """Cari tempat-tempat di sekitar koordinat menggunakan Google Places API."""
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        'location': f'{lat},{lon}',
        'radius': radius,
        'key': api_key,
        'language': 'id',  # Bahasa Indonesia untuk review lokal
    }
    if place_type:
        params['type'] = place_type
    
    try:
        response = requests.get(url, params=params, timeout=15)
        data = response.json()
        if data.get('status') == 'OK':
            return data.get('results', [])
        elif data.get('status') == 'ZERO_RESULTS':
            return []
        else:
            if data.get('status') == 'REQUEST_DENIED':
                print(f"    ⚠️ API Error: {data.get('error_message', 'REQUEST_DENIED')}")
                print(f"    Pastikan Places API sudah diaktifkan di Google Cloud Console!")
            return []
    except Exception as e:
        print(f"    Error nearby search: {e}")
        return []


def get_place_details(place_id, api_key):
    """Ambil detail tempat termasuk reviews menggunakan Place Details API."""
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        'place_id': place_id,
        'fields': 'name,rating,user_ratings_total,reviews,types,geometry',
        'key': api_key,
        'language': 'id',
        'reviews_sort': 'newest',  # Ambil review terbaru
    }
    
    try:
        response = requests.get(url, params=params, timeout=15)
        data = response.json()
        if data.get('status') == 'OK':
            return data.get('result', {})
        return None
    except Exception as e:
        print(f"    Error place details: {e}")
        return None


def classify_category(types):
    """Klasifikasi kategori tempat berdasarkan Google Place types."""
    if not types:
        return 'lainnya'
    for t in types:
        if t in CATEGORY_MAP:
            return CATEGORY_MAP[t]
    return 'lainnya'


def rating_to_sentiment(rating):
    """Konversi rating bintang ke label sentimen."""
    if rating >= 4.0:
        return 'positif'
    elif rating >= 3.0:
        return 'netral'
    else:
        return 'negatif'


def analyze_review_text(text):
    """
    Analisis sentimen sederhana berbasis kata kunci Bahasa Indonesia.
    Untuk analisis lebih mendalam, gunakan model NLP di Colab (Tahap 4B).
    """
    if not text:
        return 0.5  # netral
    
    text_lower = text.lower()
    
    positive_words = [
        'bagus', 'baik', 'enak', 'nyaman', 'bersih', 'ramah', 'mantap', 'oke',
        'recommended', 'rekomen', 'suka', 'senang', 'puas', 'lezat', 'murah',
        'cepat', 'rapi', 'indah', 'cantik', 'luas', 'strategis', 'top',
        'worth', 'amazing', 'great', 'good', 'nice', 'excellent', 'best',
        'favorit', 'favorite', 'keren', 'asik', 'asyik', 'sejuk', 'teduh',
        'modern', 'lengkap', 'mewah', 'premium', 'terjangkau', 'adem',
    ]
    
    negative_words = [
        'jelek', 'buruk', 'kotor', 'mahal', 'lambat', 'lama', 'sempit',
        'bau', 'rusak', 'kecewa', 'mengecewakan', 'parah', 'ancur', 'hancur',
        'panas', 'gerah', 'macet', 'kumuh', 'sepi', 'gelap', 'berbahaya',
        'bad', 'worst', 'terrible', 'dirty', 'expensive', 'slow', 'poor',
        'sampah', 'berantakan', 'crowded', 'noisy', 'berisik', 'bising',
        'tidak nyaman', 'kurang', 'biasa', 'jauh', 'susah', 'sulit',
    ]
    
    pos_count = sum(1 for w in positive_words if w in text_lower)
    neg_count = sum(1 for w in negative_words if w in text_lower)
    
    total = pos_count + neg_count
    if total == 0:
        return 0.5  # netral
    
    return round(pos_count / total, 4)


def scrape_reviews(api_key, max_stops=50, radius=300, top_n_places=5):
    """Main function: Scrape Google Reviews di sekitar halte-halte transportasi."""
    
    # Load data halte
    bus_stops_path = 'data/bus_stops.csv'
    if not os.path.exists(bus_stops_path):
        print(f"Error: {bus_stops_path} tidak ditemukan. Jalankan Tahap 1 terlebih dahulu.")
        return
    
    df_stops = pd.read_csv(bus_stops_path)
    df_stops = df_stops.dropna(subset=['lat', 'lon'])
    
    # Load TAS-Nits mapping untuk agregasi nanti
    tasnit_path = 'data/sample_points_with_tas_nits.csv'
    has_tasnit = os.path.exists(tasnit_path)
    
    print("=" * 60)
    print("TAHAP 4: Scraping Google Reviews — Sentimen Warga")
    print("Sesuai Proposal: Community Perception (Residential)")
    print("=" * 60)
    print(f"\nTotal halte tersedia: {len(df_stops)}")
    print(f"Halte yang akan di-scrape: {min(max_stops, len(df_stops))}")
    print(f"Radius pencarian: {radius}m dari setiap halte")
    print(f"Maks tempat per halte: {top_n_places}")
    print(f"TAS-Nits mapping: {'Tersedia' if has_tasnit else 'Tidak tersedia'}")
    print()
    
    # Resume support
    output_dir = 'data'
    partial_path = os.path.join(output_dir, 'reviews_raw_partial.json')
    all_places = {}  # place_id -> data (deduplicated)
    all_reviews = []
    
    if os.path.exists(partial_path):
        with open(partial_path, 'r', encoding='utf-8') as f:
            saved = json.load(f)
            all_places = saved.get('places', {})
            all_reviews = saved.get('reviews', [])
            processed_stops = saved.get('processed_stops', [])
        print(f"🔄 Melanjutkan dari checkpoint: {len(processed_stops)} halte sudah diproses")
        print(f"   {len(all_places)} tempat unik, {len(all_reviews)} review terkumpul\n")
    else:
        processed_stops = []
    
    stops_to_process = df_stops.head(max_stops)
    new_places_count = 0
    new_reviews_count = 0
    api_error_count = 0
    
    for idx, stop in stops_to_process.iterrows():
        stop_name = stop.get('name', f'Stop_{idx}')
        
        # Skip jika sudah diproses
        stop_key = f"{stop['lat']:.5f}_{stop['lon']:.5f}"
        if stop_key in processed_stops:
            continue
        
        progress = len(processed_stops) + 1
        total = min(max_stops, len(df_stops))
        print(f"[{progress}/{total}] 🚏 {stop_name} ({stop['lat']:.5f}, {stop['lon']:.5f})")
        
        # Nearby Search
        nearby_results = nearby_search(stop['lat'], stop['lon'], api_key, radius=radius)
        
        if not nearby_results:
            processed_stops.append(stop_key)
            continue
        
        # Filter: ambil tempat dengan rating/review terbanyak
        rated_places = [p for p in nearby_results if p.get('user_ratings_total', 0) > 0]
        rated_places.sort(key=lambda x: x.get('user_ratings_total', 0), reverse=True)
        top_places = rated_places[:top_n_places]
        
        for place in top_places:
            place_id = place['place_id']
            
            # Deduplikasi: skip jika sudah pernah diambil
            if place_id in all_places:
                continue
            
            # Rate limiting
            time.sleep(0.15)
            
            # Get Place Details (termasuk reviews)
            details = get_place_details(place_id, api_key)
            
            if not details:
                api_error_count += 1
                if api_error_count >= 5:
                    print("\n⚠️ Terlalu banyak error API. Kemungkinan:")
                    print("   1. Places API belum diaktifkan di Google Cloud Console")
                    print("   2. API Key tidak valid")
                    print("   3. Kuota habis")
                    # Save progress sebelum keluar
                    with open(partial_path, 'w', encoding='utf-8') as f:
                        json.dump({'places': all_places, 'reviews': all_reviews, 
                                   'processed_stops': processed_stops}, f, ensure_ascii=False)
                    return
                continue
            
            api_error_count = 0  # Reset error counter
            
            place_name = details.get('name', 'Unknown')
            place_rating = details.get('rating', 0)
            place_total_reviews = details.get('user_ratings_total', 0)
            place_types = details.get('types', [])
            place_category = classify_category(place_types)
            place_geo = details.get('geometry', {}).get('location', {})
            
            # Simpan data tempat
            all_places[place_id] = {
                'place_id': place_id,
                'name': place_name,
                'lat': place_geo.get('lat', stop['lat']),
                'lon': place_geo.get('lng', stop['lon']),
                'rating': place_rating,
                'total_reviews': place_total_reviews,
                'category': place_category,
                'types': ','.join(place_types[:5]),
                'nearest_stop': stop_name,
                'stop_lat': stop['lat'],
                'stop_lon': stop['lon'],
            }
            new_places_count += 1
            
            # Simpan individual reviews
            reviews = details.get('reviews', [])
            for review in reviews:
                review_text = review.get('text', '')
                review_rating = review.get('rating', 3)
                review_time = review.get('relative_time_description', '')
                
                text_sentiment = analyze_review_text(review_text)
                
                all_reviews.append({
                    'place_id': place_id,
                    'place_name': place_name,
                    'place_category': place_category,
                    'place_lat': place_geo.get('lat', stop['lat']),
                    'place_lon': place_geo.get('lng', stop['lon']),
                    'review_rating': review_rating,
                    'review_sentiment': rating_to_sentiment(review_rating),
                    'review_text_score': text_sentiment,
                    'review_time': review_time,
                    'review_text': review_text[:500],  # Potong teks panjang
                    'nearest_stop': stop_name,
                })
                new_reviews_count += 1
            
            print(f"    ✓ {place_name} | ⭐{place_rating} | 📝{len(reviews)} reviews | [{place_category}]")
        
        processed_stops.append(stop_key)
        
        # Checkpoint setiap 20 halte
        if progress % 20 == 0:
            with open(partial_path, 'w', encoding='utf-8') as f:
                json.dump({'places': all_places, 'reviews': all_reviews,
                           'processed_stops': processed_stops}, f, ensure_ascii=False)
            print(f"\n💾 Checkpoint: {len(all_places)} tempat, {len(all_reviews)} reviews\n")
    
    # ========================================
    # AGREGASI HASIL
    # ========================================
    print(f"\n{'='*60}")
    print(f"📊 HASIL SCRAPING")
    print(f"{'='*60}")
    print(f"Halte diproses: {len(processed_stops)}")
    print(f"Tempat unik ditemukan: {len(all_places)}")
    print(f"Total reviews terkumpul: {len(all_reviews)}")
    print(f"  - Baru di sesi ini: +{new_places_count} tempat, +{new_reviews_count} reviews")
    
    if len(all_reviews) == 0:
        print("\n⚠️ Tidak ada review yang terkumpul. Pastikan API Key dan Places API sudah benar.")
        return
    
    # Simpan data mentah
    df_places = pd.DataFrame(list(all_places.values()))
    df_reviews = pd.DataFrame(all_reviews)
    
    places_csv = os.path.join(output_dir, 'google_places_bandung.csv')
    reviews_csv = os.path.join(output_dir, 'google_reviews_raw.csv')
    df_places.to_csv(places_csv, index=False)
    df_reviews.to_csv(reviews_csv, index=False, encoding='utf-8-sig')
    
    print(f"\n📁 Data mentah disimpan:")
    print(f"   {places_csv} ({len(df_places)} tempat)")
    print(f"   {reviews_csv} ({len(df_reviews)} reviews)")
    
    # ========================================
    # HITUNG SENTIMENT SCORE PER TEMPAT
    # ========================================
    place_sentiment = df_reviews.groupby('place_id').agg(
        avg_rating=('review_rating', 'mean'),
        n_reviews=('review_rating', 'count'),
        positive_ratio=('review_sentiment', lambda x: (x == 'positif').mean()),
        negative_ratio=('review_sentiment', lambda x: (x == 'negatif').mean()),
        avg_text_score=('review_text_score', 'mean'),
    ).round(4).reset_index()
    
    # Composite sentiment score (0-1)
    # Rating dinormalisasi dari skala 1-5 ke 0-1
    place_sentiment['sentiment_score'] = (
        (place_sentiment['avg_rating'] - 1) / 4 * 0.5 +    # 50% dari rating
        place_sentiment['positive_ratio'] * 0.3 +             # 30% dari rasio positif
        place_sentiment['avg_text_score'] * 0.2               # 20% dari analisis teks
    ).round(4)
    
    # ========================================
    # AGREGASI PER TAS-NIT (jika data tersedia)
    # ========================================
    if has_tasnit:
        from scipy.spatial import cKDTree
        
        df_tas = pd.read_csv(tasnit_path)
        
        # Buat lookup: ambil pusat koordinat setiap TAS-Nit
        tas_centers = df_tas.groupby('tas_nit_id').agg(
            center_lat=('lat', 'mean'),
            center_lon=('lon', 'mean'),
            street_name=('name', 'first'),
        ).reset_index()
        
        # Bangun KD-Tree dari pusat TAS-Nit
        tas_coords = np.column_stack([tas_centers['center_lat'], tas_centers['center_lon']])
        tas_tree = cKDTree(tas_coords)
        
        # Assign setiap tempat ke TAS-Nit terdekat
        place_coords = np.column_stack([df_places['lat'], df_places['lon']])
        distances, indices = tas_tree.query(place_coords)
        distances_m = distances * 111320
        
        df_places['tas_nit_id'] = tas_centers.iloc[indices]['tas_nit_id'].values
        df_places['distance_to_tasnit_m'] = distances_m.round(1)
        
        # Filter: hanya tempat dalam radius 500m dari TAS-Nit
        df_places_nearby = df_places[df_places['distance_to_tasnit_m'] <= 500]
        
        # Merge dengan sentiment score
        df_places_with_sent = df_places_nearby.merge(
            place_sentiment[['place_id', 'sentiment_score', 'avg_rating', 
                            'n_reviews', 'positive_ratio', 'negative_ratio']],
            on='place_id', how='left'
        )
        
        # Agregasi per TAS-Nit (rata-rata tertimbang berdasarkan jumlah review)
        def weighted_avg(group):
            weights = group['n_reviews'].fillna(1)
            total_w = weights.sum()
            if total_w == 0:
                return pd.Series({
                    'sentiment_score': 0.5,
                    'avg_rating': 3.0,
                    'n_reviews_total': 0,
                    'n_places': 0,
                    'positive_ratio': 0.5,
                    'negative_ratio': 0.0,
                    'categories': '',
                })
            return pd.Series({
                'sentiment_score': round(np.average(group['sentiment_score'], weights=weights), 4),
                'avg_rating': round(np.average(group['avg_rating'], weights=weights), 2),
                'n_reviews_total': int(weights.sum()),
                'n_places': len(group),
                'positive_ratio': round(np.average(group['positive_ratio'], weights=weights), 4),
                'negative_ratio': round(np.average(group['negative_ratio'], weights=weights), 4),
                'categories': ','.join(group['category'].unique()),
            })
        
        df_tasnit_sentiment = df_places_with_sent.groupby('tas_nit_id').apply(
            weighted_avg, include_groups=False
        ).reset_index()
        
        # Merge dengan info jalan
        df_tasnit_sentiment = df_tasnit_sentiment.merge(
            tas_centers[['tas_nit_id', 'street_name']], on='tas_nit_id', how='left'
        )
        
        # Simpan hasil
        sentiment_csv = os.path.join(output_dir, 'sentiment_score.csv')
        df_tasnit_sentiment.to_csv(sentiment_csv, index=False)
        
        print(f"\n📊 Sentiment Score per TAS-Nit:")
        print(f"   {sentiment_csv} ({len(df_tasnit_sentiment)} TAS-Nits tercakup)")
        print(f"\n   Rata-rata Sentiment Score: {df_tasnit_sentiment['sentiment_score'].mean():.4f}")
        print(f"   Rata-rata Rating: {df_tasnit_sentiment['avg_rating'].mean():.2f}/5.0")
        print(f"   Total Reviews: {df_tasnit_sentiment['n_reviews_total'].sum()}")
        
        print(f"\n   Top 5 TAS-Nits (Sentimen Terbaik):")
        top5 = df_tasnit_sentiment.nlargest(5, 'sentiment_score')
        for _, row in top5.iterrows():
            print(f"     ⭐ {row['street_name'][:35]:35s} | Score: {row['sentiment_score']:.4f} | "
                  f"Rating: {row['avg_rating']:.1f} | Reviews: {int(row['n_reviews_total'])}")
        
        print(f"\n   Bottom 5 TAS-Nits (Sentimen Terendah):")
        bot5 = df_tasnit_sentiment.nsmallest(5, 'sentiment_score')
        for _, row in bot5.iterrows():
            print(f"     ⚠️ {row['street_name'][:35]:35s} | Score: {row['sentiment_score']:.4f} | "
                  f"Rating: {row['avg_rating']:.1f} | Reviews: {int(row['n_reviews_total'])}")
    
    # Bersihkan file checkpoint
    if os.path.exists(partial_path):
        os.remove(partial_path)
    
    # ========================================
    # RINGKASAN KATEGORI
    # ========================================
    print(f"\n📊 Distribusi Kategori Tempat:")
    cat_counts = df_places['category'].value_counts()
    for cat, count in cat_counts.items():
        print(f"   {cat:15s}: {count} tempat")
    
    print(f"\n{'='*60}")
    print(f"✅ SELESAI! Data sentimen siap untuk Tahap 5 (UVI Calculation)")
    print(f"{'='*60}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='VISTA - Google Reviews Scraper (Sentimen Warga)')
    parser.add_argument('--api-key', type=str, required=True,
                        help='Google Maps API Key (harus mengaktifkan Places API)')
    parser.add_argument('--max-stops', type=int, default=50,
                        help='Jumlah halte yang akan di-scrape (default: 50)')
    parser.add_argument('--radius', type=int, default=300,
                        help='Radius pencarian dari halte dalam meter (default: 300)')
    parser.add_argument('--top-n', type=int, default=5,
                        help='Maks tempat per halte yang diambil reviewnya (default: 5)')
    
    args = parser.parse_args()
    scrape_reviews(
        api_key=args.api_key,
        max_stops=args.max_stops,
        radius=args.radius,
        top_n_places=args.top_n,
    )
