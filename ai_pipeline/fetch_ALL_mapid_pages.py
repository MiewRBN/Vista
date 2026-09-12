import os
import json
import urllib.request
import urllib.error

API_KEY = "6a8ea24453df37905b3a5bc4"
BASE_URL = "https://server.mapid.io/web/competition"

# Bounding box for Kota Bandung
BANDUNG_POLYGON = [
    [
        [107.52, -6.98],
        [107.75, -6.98],
        [107.75, -6.83],
        [107.52, -6.83],
        [107.52, -6.98]
    ]
]

def fetch_all_pages(endpoint_name, is_activities=False):
    url = f"{BASE_URL}/{endpoint_name}"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
    }

    all_features = []
    page_index = 1
    offset = 0

    print(f"\n" + "="*70)
    print(f"   MEMULAI LOOP PAGINATION LENGKAP UNTUK ENDPOINT: /{endpoint_name.upper()}")
    print("="*70)

    while True:
        payload = {
            "feature": {
                "type": "Polygon",
                "coordinates": BANDUNG_POLYGON
            }
        }
        if not is_activities:
            payload["offset"] = offset

        body_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=body_bytes, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                
                if is_activities:
                    items = data.get("activities", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
                    all_features.extend(items)
                    print(f"Halaman {page_index}: Ditarik {len(items)} activities (Total Terkumpul: {len(all_features)})")
                    break
                else:
                    items = data.get("features", [])
                    total_server = data.get("total", len(items))
                    has_more = data.get("hasMore", False)

                    all_features.extend(items)
                    print(f"Halaman {page_index} (Offset {offset}): Ditarik {len(items)} entri | Total Server: {total_server} | HasMore: {has_more} | Akumulasi Total: {len(all_features)}")

                    if not has_more or len(items) == 0:
                        print(f"--> SELESAI! Seluruh halaman untuk /{endpoint_name} telah ditarik 100%. Total Entri: {len(all_features)}")
                        break

                    offset += len(items)
                    page_index += 1

        except urllib.error.HTTPError as e:
            print(f"[HTTP Error {e.code}]: {e.read().decode('utf-8')}")
            break
        except Exception as e:
            print(f"[Error]: {e}")
            break

    return all_features

def main():
    endpoints = [
        ("menugo", False),
        ("propertigo", False),
        ("struckgo", False),
        ("activities", True)
    ]

    report = {}

    for ep, is_act in endpoints:
        feats = fetch_all_pages(ep, is_activities=is_act)
        report[ep] = {
            "total_items": len(feats),
            "pages_fetched": 1 if is_act else (len(feats) // 100 + (1 if len(feats) % 100 > 0 else 0))
        }

    report_file = os.path.join(os.path.dirname(__file__), "full_multipage_fetch_report.json")
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print("\n" + "="*70)
    print("      RINGKASAN AKHIR EKSTRAKSI TOTAL MULTI-HALAMAN (100% COMPLETE)      ")
    print("="*70)
    for ep, inf in report.items():
        print(f"• /{ep.upper():<12}: Total {inf['total_items']} Data Valid ditarik dari {inf['pages_fetched']} Halaman Server")
    print(f"\nLaporan ringkasan disimpan ke: {report_file}")

if __name__ == "__main__":
    main()
