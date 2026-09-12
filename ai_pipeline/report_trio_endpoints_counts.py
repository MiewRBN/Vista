import os
import json
import urllib.request
import urllib.error

API_KEY = "6a8ea24453df37905b3a5bc4"
BASE_URL = "https://server.mapid.io/web/competition"

BANDUNG_POLYGON = [
    [
        [107.54, -6.97],
        [107.72, -6.97],
        [107.72, -6.84],
        [107.54, -6.84],
        [107.54, -6.97]
    ]
]

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
    headers = {"Content-Type": "application/json", "x-api-key": API_KEY}
    
    # 1. Activities API
    act_url = f"{BASE_URL}/activities"
    res_team = post_json(act_url, headers, {"feature": {"type": "Polygon", "coordinates": BANDUNG_POLYGON}, "hashtag": ["FiveHonk"]})
    team_acts = res_team.get("data", {}).get("activities", []) if res_team else []
    
    res_pub = post_json(act_url, headers, {"feature": {"type": "Polygon", "coordinates": BANDUNG_POLYGON}})
    pub_acts = res_pub.get("data", {}).get("activities", []) if res_pub else []
    
    unique_acts = {}
    for a in team_acts + pub_acts:
        unique_acts[a.get("_id")] = a

    # 2. MenuGo API (All Pages)
    menugo_items = []
    off = 0
    while True:
        res = post_json(f"{BASE_URL}/menugo", headers, {"feature": {"type": "Polygon", "coordinates": BANDUNG_POLYGON}, "offset": off})
        if res and res.get("success"):
            feats = res.get("features", [])
            menugo_items.extend(feats)
            if len(feats) < 100:
                break
            off += len(feats)
        else:
            break

    # 3. StruckGo API (All Pages)
    struckgo_items = []
    off = 0
    while True:
        res = post_json(f"{BASE_URL}/struckgo", headers, {"feature": {"type": "Polygon", "coordinates": BANDUNG_POLYGON}, "offset": off})
        if res and res.get("success"):
            feats = res.get("features", [])
            struckgo_items.extend(feats)
            if len(feats) < 100:
                break
            off += len(feats)
        else:
            break

    summary = {
        "activities_api": {
            "team_hashtag_fivehonk": len(team_acts),
            "public_activities": len(pub_acts),
            "total_unique_activities": len(unique_acts)
        },
        "menugo_api": {
            "total_features_fetched": len(menugo_items),
            "total_pages": 1
        },
        "struckgo_api": {
            "total_features_fetched": len(struckgo_items),
            "total_pages": 3
        },
        "total_combined_trio_data": len(unique_acts) + len(menugo_items) + len(struckgo_items)
    }

    print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    main()
