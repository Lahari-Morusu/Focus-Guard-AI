"""
focus_score_pct = (productive_minutes / total_minutes) * 100
Computed per user, per day/week/month, with session_count reported alongside
so a 100% score from 1 session is distinguishable from one over 20 sessions.
"""
import pandas as pd
import numpy as np
from data_loader import load_data, get_all_users


def focus_score_for_user(df, user_type, freq="D"):
    """freq: 'D' daily, 'W' weekly, 'ME' month-end (monthly)"""
    u = df[df["user_type"] == user_type].copy()
    if u.empty:
        return pd.DataFrame()
    u = u.set_index("opened_date").sort_index()

    total      = u["duration_minutes"].resample(freq).sum()
    productive = u.loc[u["is_productive"], "duration_minutes"].resample(freq).sum()
    sessions   = u["duration_minutes"].resample(freq).count()

    out = pd.DataFrame({
        "total_minutes": total,
        "productive_minutes": productive.reindex(total.index).fillna(0),
        "session_count": sessions,
    })
    out["focus_score_pct"] = np.where(
        out["total_minutes"] > 0,
        out["productive_minutes"] / out["total_minutes"] * 100,
        np.nan,
    ).round(2)
    out["user_type"] = user_type
    out["freq"] = freq
    return out.reset_index().rename(columns={"opened_date": "period"})


def run_for_all_users(df):
    all_rows = []
    for user in get_all_users(df):
        for freq in ["D", "W", "ME"]:  # 'ME' = month-end (pandas 2.2+ alias for 'M')
            res = focus_score_for_user(df, user, freq=freq)
            if not res.empty:
                all_rows.append(res)
    return pd.concat(all_rows, ignore_index=True)


if __name__ == "__main__":
    df = load_data()
    result = run_for_all_users(df)
    result.to_csv("focus_scores_all_users.csv", index=False)
    print(f"Saved focus_scores_all_users.csv  shape={result.shape}")
    print(result[result["freq"] == "D"].head(10))