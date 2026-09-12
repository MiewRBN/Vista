import os
import json
import csv

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "vista-dashboard", "public", "data")
ACT_CSV = os.path.join(DATA_DIR, "mapid_activities_score.csv")
MIS_CSV = os.path.join(DATA_DIR, "mapid_missions_score.csv")

def main():
    act_samples = []
    if os.path.exists(ACT_CSV):
        with open(ACT_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cnt = int(row.get("mapid_activity_count") or 0)
                if cnt > 0:
                    act_samples.append(row)
                if len(act_samples) >= 3:
                    break

    mis_samples = []
    if os.path.exists(MIS_CSV):
        with open(MIS_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                m_cnt = int(row.get("mapid_menu_count") or 0)
                s_cnt = int(row.get("mapid_struk_count") or 0)
                if m_cnt > 0 or s_cnt > 0:
                    mis_samples.append(row)
                if len(mis_samples) >= 3:
                    break

    res = {
        "act_samples": act_samples,
        "mis_samples": mis_samples
    }
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    main()
