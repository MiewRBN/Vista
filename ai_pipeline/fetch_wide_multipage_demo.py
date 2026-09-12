import os
import json
import urllib.request
import urllib.error

API_KEY = "6a8ea24453df37905b3a5bc4"
BASE_URL = "https://server.mapid.io/web/competition"

# Wide Bounding Box Polygon (Jawa Barat / National Area)
WIDE_POLYGON = [
    [
        [106.0, -7.5],
        [108.5, -7.5],
        [108.5, -6.0],
        [106.0, -6.0],
        [106.0, -7.5]
    ]
]

def fetch_multipage_wide(endpoint_name):
    url = f"{BASE_URL}/{endpoint_name}"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
    }

    all_features = []
    page_index = 1
    offset = 0

    print(f"\n" + "="*70)
    print(f"   MEMULAI EKSTRAKSI MULTI-HALAMAN UNTUK: /{endpoint_name.upper()}")
    print("="*70)

    while True:
        payload = {
            "feature": {
                "type": "Polygon",
                "coordinates": WIDE_POLYGON
            },
            "offset": offset
        }

        body_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=body_bytes, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                items = data.get("features", [])
                total_server = data.get("total", len(items))
                has_more = data.get("hasMore", False)

                all_features.extend(items)
                print(f"--> Halaman {page_index} (Offset {offset:>4}): Ditarik {len(items):>3} entri | Total Server: {total_server:>4} | HasMore: {has_more} | Akumulasi Total: {len(all_features)}")

                if not has_more or len(items) == 0:
                    print(f"✅ HASIL AKHIR /{endpoint_name.upper()}: Berhasil menarik {len(all_features)} entri dari {page_index} Halaman!")
                    break

                offset += len(items)
                page_index += 1

        except urllib.error.HTTPError as e:
            print(f"[HTTP Error {e.code}]: {e.read().decode('utf-8')}")
            break
        except Exception as e:
            print(f"[Error]: {e}")
            break

    return all_features, page_index

def main():
    endpoints = ["propertigo", "menugo", "struckgo"]
    summary = {}

    for ep in endpoints:
        feats, pages = fetch_multipage_wide(ep)
        summary[ep] = {
            "total_items": len(feats),
            "pages_fetched": pages
        }

    report_file = os.path.join(os.path.dirname(__file__), "multipage_wide_audit.json")
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print("\n" + "="*70)
    print("         RINGKASAN AUDIT PENARIKAN MULTI-HALAMAN SELURUH HALAMAN        ")
    print("="*70)
    for ep, inf in summary.items():
        print(f"• /{ep.upper():<12}: Total {inf['total_items']} Data ditarik dari {inf['pages_fetched']} Halaman Server!")

if __name__ == "__main__":
    main()
