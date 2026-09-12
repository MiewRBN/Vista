import os
import json
import urllib.request
import urllib.error

# 1. Read config from vista-dashboard/.env.local
env_local_path = os.path.join(os.path.dirname(__file__), "..", "vista-dashboard", ".env.local")

token = ""
model_repo = "latief17/vista-indobert-sentiment"

if os.path.exists(env_local_path):
    with open(env_local_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("HF_TOKEN="):
                token = line.split("=", 1)[1].strip()
            elif line.startswith("HF_MODEL_REPO="):
                model_repo = line.split("=", 1)[1].strip()

TEST_REVIEWS = [
    "Jalanan di koridor ini sangat nyaman, trotoarnya luas dan bersih!",
    "Macet parah, banyak jalan berlubang dan trotoar terhalang parkir liar.",
    "Kawasan ini cukup bagus dan berada di pusat kota."
]

def query_hf_inference(text, token, repo_id):
    url = f"https://api-inference.huggingface.co/models/{repo_id}"
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (VISTA-WebGIS)"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    payload = {"inputs": text}
    body_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body_bytes, headers=headers, method="POST")
    
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        print(f"[HTTP Error {e.code}]: {err_msg}")
        return None
    except Exception as e:
        print(f"[Error]: {e}")
        return None

def main():
    print("=" * 70)
    print("      UJI COBA LOKAL HUGGING FACE SERVERLESS INFERENCE API      ")
    print("=" * 70)
    
    print(f"HF Token      : {'Terpasang (' + token[:6] + '...)' if token else 'Kosong'}")
    print(f"Target Model  : {model_repo}\n")

    for idx, rev in enumerate(TEST_REVIEWS):
        print(f"--- Pengujian #{idx+1} ---")
        print(f"Input Teks : '{rev}'")
        res = query_hf_inference(rev, token, model_repo)
        
        if res:
            print(f"Respon Raw HF: {json.dumps(res, indent=2)}")
        else:
            print("Gagal mengambil respon HF Inference API (Cek koneksi internet / model warm up).")
        print("-" * 50)

if __name__ == "__main__":
    main()
