"""
Predicts, for EVERY user: tomorrow's focus_score_pct, next-7-day average,
and a trend label. Requires: pip install scikit-learn
"""
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from data_loader import load_data, get_all_users
from focus_score import focus_score_for_user


def build_lag_features(daily_df):
    g = daily_df.sort_values("period").copy()
    for col in ["focus_score_pct", "session_count", "productive_minutes"]:
        g[f"{col}_lag1"]  = g[col].shift(1)
        g[f"{col}_roll3"] = g[col].shift(1).rolling(3).mean()
        g[f"{col}_roll7"] = g[col].shift(1).rolling(7).mean()
    g["target_tomorrow"] = g["focus_score_pct"].shift(-1)
    g["target_next7"]    = g["focus_score_pct"].shift(-1).rolling(7).mean().shift(-6)
    return g


def trend(pred, baseline, thresh=5):
    diff = pred - baseline
    if diff > thresh:
        return "higher than usual (more focused)"
    elif diff < -thresh:
        return "lower than usual (less focused)"
    return "about the same as usual"


def predict_for_user(df, user_type, min_days=14):
    daily = focus_score_for_user(df, user_type, freq="D")
    if len(daily) < min_days:
        return None  # not enough history to train a model for this user

    feat = build_lag_features(daily)
    feature_cols = [c for c in feat.columns if "lag" in c or "roll" in c]

    train_tomorrow = feat.dropna(subset=feature_cols + ["target_tomorrow"])
    train_week     = feat.dropna(subset=feature_cols + ["target_next7"])
    if len(train_tomorrow) < 5 or len(train_week) < 5:
        return None

    model_tomorrow = HistGradientBoostingRegressor(max_depth=4, max_iter=200, random_state=42)
    model_tomorrow.fit(train_tomorrow[feature_cols], train_tomorrow["target_tomorrow"])

    model_week = HistGradientBoostingRegressor(max_depth=4, max_iter=200, random_state=42)
    model_week.fit(train_week[feature_cols], train_week["target_next7"])

    latest = feat.iloc[[-1]][feature_cols].fillna(0)
    pred_tomorrow = float(model_tomorrow.predict(latest)[0])
    pred_next7    = float(model_week.predict(latest)[0])
    baseline = float(feat.iloc[-1]["focus_score_pct"])

    return {
        "user_type": user_type,
        "last_known_date": feat.iloc[-1]["period"],
        "last_known_focus_score_pct": round(baseline, 1),
        "predicted_focus_tomorrow_pct": round(pred_tomorrow, 1),
        "predicted_focus_next_7day_avg_pct": round(pred_next7, 1),
        "trend_tomorrow": trend(pred_tomorrow, baseline),
        "trend_next_week": trend(pred_next7, baseline),
    }


def run_for_all_users(df):
    results = []
    for user in get_all_users(df):
        r = predict_for_user(df, user)
        if r:
            results.append(r)
        else:
            print(f"Skipped {user}: not enough history to forecast.")
    return pd.DataFrame(results)


if __name__ == "__main__":
    df = load_data()
    result = run_for_all_users(df)
    result.to_csv("focus_predictions_all_users.csv", index=False)
    print(f"\nSaved focus_predictions_all_users.csv  shape={result.shape}")
    print(result.to_string(index=False))