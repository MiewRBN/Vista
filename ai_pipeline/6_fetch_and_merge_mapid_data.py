import os
import sys
import json
import math
import csv
import urllib.request

# Bounding Box Polygon Kota Bandung
BANDUNG_POLYGON = {
    "type": "Polygon",
    "coordinates": [
        [
            [107.54, -6.97],
            [107.72, -6.97],
            [107.72, -6.84],
            [107.54, -6.84],
            [107.54, -6.97]
        ]
    ]
}

# Try loading .env.local
env_path = os.path.join(os.path.dirname(__file__), "..", "vista-dashboard", ".env.local")
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

API_KEY = (
    os.environ.get("MAPID_DATA_API_KEY") or 
    os.environ.get("MAPID_MISSION_API_KEY") or 
    os.environ.get("MAPID_ACTIVITIES_API_KEY")
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
PUBLIC_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "vista-dashboard", "public", "data")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)

# Proposal Indicator Criteria Keywords (Tabel 3 & Tabel 4 VISTA)
PROPOSAL_KEYWORDS = {
    "transit": ["halte", "bus", "tmb", "angkot", "terminal", "stasiun", "penyeberangan", "zebra cross", "jpo", "rute"],
    "physical": ["trotoar", "pedestrian", "jalan", "taman", "pohon", "kanopi", "parkir", "sampah", "kotor", "bersih", "lampu", "pencahayaan", "kumuh", "vandalisme"],
    "economic": ["pasar", "toko", "warung", "kuliner", "makan", "umkm", "cafe", "ramai", "sepi", "fasilitas", "layanan", "poi", "restoran", "ruko", "properti"]
}

POSITIVE_WORDS = {
    "bagus", "nyaman", "bersih", "ramah", "mantap", "enak", "luas", "strategis",
    "terjangkau", "murah", "cepat", "lengkap", "indah", "asri", "sejuk", "aman",
    "rapi", "puas", "rekomended", "recommended", "keren", "terbaik", "suka"
}

NEGATIVE_WORDS = {
    "macet", "kumuh", "kotor", "bau", "sempit", "mahal", "lambat", "rusak",
    "bising", "panas", "bahaya", "becek", "gelap", "antri", "kecewa", "buruk", "jelek", "vandalisme", "hambatan"
}

def matches_proposal_criteria(title, description):
    text = f"{title or ''} {description or ''}".lower()
    matched_cats = []
    for cat, kws in PROPOSAL_KEYWORDS.items():
        if any(kw in text for kw in kws):
            matched_cats.append(cat)
    return len(matched_cats) > 0, matched_cats

def analyze_sentiment(text):
    if not text or not isinstance(text, str):
        return 0.5
    words = text.lower().split()
    pos = sum(1 for w in words if w in POSITIVE_WORDS)
    neg = sum(1 for w in words if w in NEGATIVE_WORDS)
    total = pos + neg
    if total == 0:
        return 0.5
    return pos / total

def haversine_dist(lat1, lon1, lat2, lon2):
    R = 6371000 # meters
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def find_nearest_tas(lat, lon, tas_list, max_dist=400):
    best_dist = float('inf')
    best_id = None
    for tas in tas_list:
        d = haversine_dist(lat, lon, tas['lat'], tas['lon'])
        if d < best_dist:
            best_dist = d
            best_id = tas['id']
    if best_dist <= max_dist:
        return best_id, best_dist
    return None, best_dist

def post_json(url, headers, payload):
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data_bytes, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[HTTP Error] {url}: {e}")
    return None

def main():
    print("=" * 70)
    print("  INTEGRASI DATA MAPID BERBASIS INDIKATOR PROPOSAL VISTA (UVI)  ")
    print("=" * 70)

    if not API_KEY:
        print("[WARNING] MAPID_DATA_API_KEY belum diset. Menggunakan mode fallback.")
    else:
        print(f"[INFO] Using API Key: {API_KEY[:6]}***")

    ref_path = os.path.join(DATA_DIR, "tas_nits_summary.csv")
    if not os.path.exists(ref_path):
        ref_path = os.path.join(PUBLIC_DATA_DIR, "accessibility_score.csv")

    tas_list = []
    if os.path.exists(ref_path):
        with open(ref_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                lat = float(row.get("center_lat") or row.get("lat") or 0)
                lon = float(row.get("center_lon") or row.get("lon") or 0)
                tas_id = row.get("tas_nit_id")
                if lat and lon and tas_id:
                    tas_list.append({"id": tas_id, "lat": lat, "lon": lon})

    print(f"[DATA] Total reference TAS-Nits segments: {len(tas_list)}")

    act_results = {t['id']: {'count': 0, 'weighted_scores': [], 'likes': 0, 'comments': 0, 'team_count': 0} for t in tas_list}
    mission_results = {t['id']: {'menu_count': 0, 'prices': [], 'prop_count': 0, 'struk_count': 0} for t in tas_list}

    if API_KEY and len(tas_list) > 0:
        act_url = "https://server.mapid.io/web/competition/activities"
        act_headers = {"Content-Type": "application/json", "x-api-key": API_KEY}
        
        # 1. Fetch Team Specific Activities (#FiveHonk)
        print("[STEP 1] Fetching Team Verified Activities (#FiveHonk)...")
        res_team = post_json(act_url, act_headers, {"feature": BANDUNG_POLYGON, "hashtag": ["FiveHonk"]})
        team_activities = res_team.get("data", {}).get("activities", []) if res_team else []
        print(f"        -> Found {len(team_activities)} team activities.")

        # 2. Fetch General Area Activities
        print("[STEP 2] Fetching Public Area Activities...")
        res_pub = post_json(act_url, act_headers, {"feature": BANDUNG_POLYGON})
        pub_activities = res_pub.get("data", {}).get("activities", []) if res_pub else []
        print(f"        -> Found {len(pub_activities)} total public activities.")

        # Combine all activities and filter by Proposal Criteria
        all_activities = team_activities + pub_activities
        unique_activities = {}
        for a in all_activities:
            unique_activities[a.get("_id")] = a

        valid_counter = 0
        team_counter = 0

        for act_id, act in unique_activities.items():
            geom = act.get("geometry", {})
            coords = geom.get("coordinates", [])
            if len(coords) == 2:
                lon, lat = coords[0], coords[1]
                tas_id, dist = find_nearest_tas(lat, lon, tas_list, max_dist=400)
                if tas_id:
                    title = act.get("title", "")
                    desc = act.get("description", "")
                    is_team_post = "fivehonk" in f"{title} {desc}".lower() or "audyrapsolly" in act.get("user_name", "").lower()
                    
                    is_relevant, cats = matches_proposal_criteria(title, desc)
                    
                    # If it's a team post OR matches UVI proposal criteria, include it!
                    if is_team_post or is_relevant:
                        valid_counter += 1
                        if is_team_post:
                            team_counter += 1

                        score = analyze_sentiment(f"{title} {desc}")
                        # Team posts get 1.5x weight in sentiment average
                        weight = 1.5 if is_team_post else 1.0

                        act_results[tas_id]['count'] += 1
                        if is_team_post:
                            act_results[tas_id]['team_count'] += 1
                        act_results[tas_id]['weighted_scores'].append((score, weight))
                        act_results[tas_id]['likes'] += len(act.get("likes", []))
                        act_results[tas_id]['comments'] += act.get("total_comment", 0)

        print(f"[SUMMARY] Total Relevant Activities Matching Proposal Criteria: {valid_counter} ({team_counter} team posts).")

        # 3. Fetch Missions (MenuGo, PropertiGo, StrukGo)
        print("[STEP 3] Fetching MAPID Missions (MenuGo, PropertiGo, StrukGo)...")
        for m_type in ["menugo", "propertigo", "struckgo"]:
            m_url = f"https://server.mapid.io/web/competition/{m_type}"
            m_headers = {"Content-Type": "application/json", "x-api-key": API_KEY}
            m_res = post_json(m_url, m_headers, {"feature": BANDUNG_POLYGON, "offset": 0})
            if m_res and m_res.get("success"):
                feats = m_res.get("features", [])
                print(f"        -> Retrieved {len(feats)} features for '{m_type}'.")
                for f in feats:
                    coords = f.get("geometry", {}).get("coordinates", [])
                    if len(coords) == 2:
                        lon, lat = coords[0], coords[1]
                        tas_id, _ = find_nearest_tas(lat, lon, tas_list, max_dist=400)
                        if tas_id:
                            props = f.get("properties", {})
                            if m_type == "menugo":
                                mission_results[tas_id]['menu_count'] += 1
                                p = props.get("harga_rata_rata")
                                if isinstance(p, (int, float)) and p > 0:
                                    mission_results[tas_id]['prices'].append(p)
                            elif m_type == "propertigo":
                                mission_results[tas_id]['prop_count'] += 1
                            elif m_type == "struckgo":
                                mission_results[tas_id]['struk_count'] += 1

    # Write CSV Output (Activities)
    act_file = os.path.join(PUBLIC_DATA_DIR, "mapid_activities_score.csv")
    with open(act_file, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["tas_nit_id", "mapid_activity_count", "mapid_activity_sent_score", "mapid_activity_likes", "mapid_activity_comments", "mapid_team_count"])
        for tas_id, inf in act_results.items():
            if inf['weighted_scores']:
                total_w = sum(w for s, w in inf['weighted_scores'])
                weighted_avg = sum(s * w for s, w in inf['weighted_scores']) / total_w
            else:
                weighted_avg = 0.5
            writer.writerow([tas_id, inf['count'], round(weighted_avg, 4), inf['likes'], inf['comments'], inf['team_count']])
    print(f"[EXPORT] Saved {act_file}")

    # Write CSV Output (Missions)
    mis_file = os.path.join(PUBLIC_DATA_DIR, "mapid_missions_score.csv")
    with open(mis_file, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["tas_nit_id", "mapid_menu_count", "mapid_menu_avg_price", "mapid_properti_count", "mapid_struk_count"])
        for tas_id, inf in mission_results.items():
            avg_p = sum(inf['prices']) / len(inf['prices']) if inf['prices'] else 0
            writer.writerow([tas_id, inf['menu_count'], round(avg_p, 2), inf['prop_count'], inf['struk_count']])
    print(f"[EXPORT] Saved {mis_file}")
    print("=" * 70)
    print("  PROSES INTEGRASI & SELEKSI INDIKATOR PROPOSAL SELESAI SUKSES!  ")
    print("=" * 70)

if __name__ == "__main__":
    main()
