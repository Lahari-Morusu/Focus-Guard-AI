"""
Classifies every (user, app) pair into:
  Focus App | Switching Mostly | Try Avoiding | Neutral

NOTE: a raw app_switch flag that's ~1 on almost every session isn't
discriminative alone - this combines it with session duration to catch
FRAGMENTED switching (short, switch-flagged bursts) vs sustained use.
"""
import pandas as pd
from data_loader import load_data, get_all_users


def classify_apps_for_user(df, user_type):
    u = df[df["user_type"] == user_type].copy()
    if u.empty or len(u) < 3:
        return pd.DataFrame()

    median_len = u["duration_minutes"].median()
    u["is_short"] = u["duration_minutes"] < median_len
    u["is_switch_burst"] = u["app_switch"] * u["is_short"].astype(int)

    g = u.groupby(["app_web", "category"]).agg(
        n_sessions=("duration_minutes", "count"),
        total_time_min=("duration_minutes", "sum"),
        avg_session_len=("duration_minutes", "mean"),
        productive_ratio=("is_productive", "mean"),
        switch_burst_rate=("is_switch_burst", "mean"),
    ).reset_index()
    g = g[g["n_sessions"] >= 3].copy()
    if g.empty:
        return g

    burst_high = g["switch_burst_rate"].quantile(0.70)
    burst_low  = g["switch_burst_rate"].quantile(0.40)
    time_med   = g["total_time_min"].median()

    def label(row):
        if row["switch_burst_rate"] >= burst_high and row["switch_burst_rate"] > 0.3:
            return "Switching Mostly"
        if row["productive_ratio"] >= 0.6 and row["switch_burst_rate"] < burst_low:
            return "Focus App"
        if row["productive_ratio"] < 0.4 and row["total_time_min"] > time_med:
            return "Try Avoiding"
        return "Neutral"

    g["classification"] = g.apply(label, axis=1)
    g["user_type"] = user_type
    return g


def run_for_all_users(df):
    all_rows = []
    for user in get_all_users(df):
        res = classify_apps_for_user(df, user)
        if not res.empty:
            all_rows.append(res)
    return pd.concat(all_rows, ignore_index=True)


if __name__ == "__main__":
    df = load_data()
    result = run_for_all_users(df)
    cols = ["user_type", "app_web", "category", "n_sessions",
            "productive_ratio", "switch_burst_rate", "classification"]
    result = result[cols + [c for c in result.columns if c not in cols]]
    result.to_csv("app_classification_all_users.csv", index=False)
    print(f"Saved app_classification_all_users.csv  shape={result.shape}")
    print(result.head(15))