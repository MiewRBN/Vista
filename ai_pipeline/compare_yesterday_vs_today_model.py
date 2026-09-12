import os
import csv
import json

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "vista-dashboard", "public", "data")

def main():
    act_file = os.path.join(DATA_DIR, "mapid_activities_score.csv")
    mis_file = os.path.join(DATA_DIR, "mapid_missions_score.csv")
    sent_file = os.path.join(DATA_DIR, "sentiment_score.csv")
    acc_file = os.path.join(DATA_DIR, "accessibility_score.csv")

    act_count = 0
    sent_scores = []
    
    if os.path.exists(act_file):
        with open(act_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                sc = float(r.get("mapid_activity_sent_score") or 0)
                cnt = int(r.get("mapid_activity_count") or 0)
                if cnt > 0:
                    act_count += cnt
                    sent_scores.append(sc)

    avg_sent = sum(sent_scores) / len(sent_scores) if sent_scores else 0.5

    report = {
        "total_activities_matched": act_count,
        "avg_sentiment_indobert": round(avg_sent, 4),
        "total_tas_nits": 5876,
    }

    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
