import pandas as pd
from config import DATA_PATH, COLUMN_MAP


def load_data():
    if DATA_PATH.endswith(".xlsx") or DATA_PATH.endswith(".xls"):
        df = pd.read_excel(DATA_PATH)
    else:
        df = pd.read_csv(DATA_PATH)

    # rename your columns -> standard names
    rename_map = {v: k for k, v in COLUMN_MAP.items() if v in df.columns}
    df = df.rename(columns=rename_map)

    required = ["user_type", "app_web", "category", "opened_date",
                "closed_date", "productivity", "app_switch"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(
            f"Missing required columns after mapping: {missing}. "
            f"Fix COLUMN_MAP in config.py."
        )

    df["opened_date"] = pd.to_datetime(df["opened_date"])
    df["closed_date"] = pd.to_datetime(df["closed_date"])
    df["duration_minutes"] = (df["closed_date"] - df["opened_date"]).dt.total_seconds() / 60
    df["duration_minutes"] = df["duration_minutes"].clip(lower=0)
    df["is_productive"] = df["productivity"].astype(str).str.strip().eq("Productive")
    df["app_switch"] = pd.to_numeric(df["app_switch"], errors="coerce").fillna(0).astype(int)

    return df


def get_all_users(df):
    """Every distinct user in the dataset - the loop everything else runs over."""
    return sorted(df["user_type"].dropna().unique().tolist())