"""
Sliding-window cache: buffers up to `window_size` daily results per user.
Once full (default 7 days), aggregates into one weekly result, stores it,
and CLEARS the daily buffer - a brand-new window starts for the next batch.
Same pattern extends to weekly->monthly with a second cache, window_size=4/5.
"""
import pandas as pd
from collections import deque
from data_loader import load_data, get_all_users
from focus_score import focus_score_for_user


class DailyToWeeklyCache:
    def __init__(self, window_size=7):
        self.window_size = window_size
        self.buffer = deque(maxlen=window_size)   # (date, daily_result)
        self.weekly_cache = {}                     # week_start -> aggregated dict

    def add_day(self, date, daily_result: dict):
        self.buffer.append((date, daily_result))
        if len(self.buffer) == self.window_size:
            self._flush_to_weekly()

    def _flush_to_weekly(self):
        dates = [d for d, _ in self.buffer]
        week_start = min(dates)
        total_minutes      = sum(r["total_minutes"] for _, r in self.buffer)
        productive_minutes = sum(r["productive_minutes"] for _, r in self.buffer)
        session_count       = sum(r["session_count"] for _, r in self.buffer)
        focus_score_pct = round(productive_minutes / total_minutes * 100, 2) if total_minutes else None

        self.weekly_cache[week_start] = {
            "total_minutes": total_minutes,
            "productive_minutes": productive_minutes,
            "session_count": session_count,
            "focus_score_pct": focus_score_pct,
        }
        self.buffer.clear()   # evict - old daily entries gone, fresh window starts

    def get_weekly(self, week_start):
        return self.weekly_cache.get(week_start)


def run_for_all_users(df, window_size=7):
    all_rows = []
    for user in get_all_users(df):
        daily = focus_score_for_user(df, user, freq="D")
        if daily.empty:
            continue
        cache = DailyToWeeklyCache(window_size=window_size)
        for _, row in daily.sort_values("period").iterrows():
            cache.add_day(row["period"], {
                "total_minutes": row["total_minutes"],
                "productive_minutes": row["productive_minutes"],
                "session_count": row["session_count"],
            })
        for week_start, agg in cache.weekly_cache.items():
            all_rows.append({"user_type": user, "week_start": week_start, **agg})
    return pd.DataFrame(all_rows)


if __name__ == "__main__":
    df = load_data()
    result = run_for_all_users(df, window_size=7)
    result.to_csv("weekly_from_daily_all_users.csv", index=False)
    print(f"Saved weekly_from_daily_all_users.csv  shape={result.shape}")
    print(result.head(10))