"""
Turns each period's ordered app sequence (AppA, AppB, AppC, AppB) into
consecutive pairs (AppA->AppB), (AppB->AppC), (AppC->AppB), then counts
them with collections.Counter, plus a duration-weighted version. All users.
"""
import pandas as pd
from collections import Counter
from data_loader import load_data, get_all_users


def switch_pairs_for_user(df, user_type, freq="D"):
    u = df[df["user_type"] == user_type].sort_values("opened_date").copy()
    if u.empty:
        return pd.DataFrame()
    u["period"] = u["opened_date"].dt.to_period(freq)

    pair_counter = Counter()
    pair_duration = Counter()

    for period, g in u.groupby("period"):
        apps = g["app_web"].tolist()
        durations = g["duration_minutes"].tolist()
        for i in range(len(apps) - 1):
            frm, to = apps[i], apps[i + 1]
            pair_counter[(period, frm, to)] += 1
            pair_duration[(period, frm, to)] += durations[i + 1]

    rows = [
        {
            "user_type": user_type,
            "period": p,
            "from_app": f,
            "to_app": t,
            "switch_count": c,
            "duration_weighted_minutes": round(pair_duration[(p, f, t)], 2),
        }
        for (p, f, t), c in pair_counter.items()
    ]
    return pd.DataFrame(rows)


def max_switch_per_period(switch_df):
    if switch_df.empty:
        return switch_df
    return (
        switch_df.sort_values("switch_count", ascending=False)
        .groupby(["user_type", "period"]).first()
        .reset_index()[["user_type", "period", "from_app", "to_app", "switch_count"]]
    )


def run_for_all_users(df, freq="D"):
    all_pairs = []
    for user in get_all_users(df):
        res = switch_pairs_for_user(df, user, freq=freq)
        if not res.empty:
            all_pairs.append(res)
    return pd.concat(all_pairs, ignore_index=True)


if __name__ == "__main__":
    df = load_data()

    switch_daily = run_for_all_users(df, freq="D")
    switch_daily.to_csv("switch_pairs_all_users.csv", index=False)
    print(f"Saved switch_pairs_all_users.csv  shape={switch_daily.shape}")

    max_daily = max_switch_per_period(switch_daily)
    max_daily.to_csv("max_switch_per_period_all_users.csv", index=False)
    print(f"Saved max_switch_per_period_all_users.csv  shape={max_daily.shape}")
    print(max_daily.head(10))