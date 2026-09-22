import pandas as pd
import psycopg2
import json

from collections import Counter


# ============================================================
# DATABASE CONFIGURATION
# ============================================================

DB_CONFIG = {
    "host": "localhost",
    "database": "focus_guard_ai",
    "user": "postgres",
    "password": "focusgaurd123",
    "port": 5432
}


# ============================================================
# CACHE TABLE NAMES
# ============================================================

DAILY_CACHE_TABLE = "daily_analytics_cache"
WEEKLY_CACHE_TABLE = "weekly_analytics_cache"
MONTHLY_CACHE_TABLE = "monthly_analytics_cache"


# ============================================================
# GET DATA FROM POSTGRESQL
# ============================================================

def get_activity_data():

    conn = psycopg2.connect(**DB_CONFIG)

    query = """
        SELECT
            pid,
            user_type,
            app_web,
            opened_date,
            closed_date,
            productivity
        FROM synthetic_activity
        WHERE opened_date IS NOT NULL
          AND closed_date IS NOT NULL
          AND app_web IS NOT NULL
        ORDER BY user_type, opened_date;
    """

    df = pd.read_sql_query(query, conn)

    conn.close()

    return df


# ============================================================
# PREPARE SESSION DATA
# ============================================================

def prepare_session_data(df):

    df = df.copy()

    # --------------------------------------------------------
    # Convert timestamps
    # --------------------------------------------------------

    df["opened_date"] = pd.to_datetime(
        df["opened_date"]
    )

    df["closed_date"] = pd.to_datetime(
        df["closed_date"]
    )

    # --------------------------------------------------------
    # Calculate duration from timestamps
    # --------------------------------------------------------

    df["duration_minutes"] = (
        df["closed_date"] -
        df["opened_date"]
    ).dt.total_seconds() / 60

    # --------------------------------------------------------
    # Remove invalid sessions
    # --------------------------------------------------------

    df = df[
        df["duration_minutes"] > 0
    ].copy()

    # --------------------------------------------------------
    # Create date
    # --------------------------------------------------------

    df["date"] = (
        df["opened_date"].dt.date
    )

    # --------------------------------------------------------
    # Datetime used for grouping/resampling
    # --------------------------------------------------------

    df["activity_date"] = pd.to_datetime(
        df["date"]
    )

    # --------------------------------------------------------
    # Clean application names
    # --------------------------------------------------------

    df["app_web"] = (
        df["app_web"]
        .astype(str)
        .str.strip()
    )

    # --------------------------------------------------------
    # Clean productivity values
    # --------------------------------------------------------

    df["productivity"] = (
        df["productivity"]
        .astype(str)
        .str.strip()
    )

    # --------------------------------------------------------
    # Sort sessions chronologically
    #
    # IMPORTANT for switching calculation
    # --------------------------------------------------------

    df = df.sort_values(
        [
            "user_type",
            "opened_date"
        ]
    ).reset_index(drop=True)

    return df


# ============================================================
# FOCUS ANALYTICS
# ============================================================

def calculate_analytics(df, period):

    """
    Calculate:

        total_minutes
        productive_minutes
        session_count
        focus_score_pct

    for Daily / Weekly / Monthly.
    """

    data = df.copy()

    # --------------------------------------------------------
    # Productive duration
    # --------------------------------------------------------

    data["productive_minutes"] = data[
        "duration_minutes"
    ].where(
        data["productivity"] == "Productive",
        0
    )

    # --------------------------------------------------------
    # Set date index
    # --------------------------------------------------------

    data = data.set_index(
        "activity_date"
    )

    # --------------------------------------------------------
    # Group by user + period
    # --------------------------------------------------------

    result = (
        data
        .groupby("user_type")
        .resample(period)
        .agg(
            total_minutes=(
                "duration_minutes",
                "sum"
            ),

            productive_minutes=(
                "productive_minutes",
                "sum"
            ),

            session_count=(
                "pid",
                "count"
            )
        )
        .reset_index()
    )

    # --------------------------------------------------------
    # Rename columns
    # --------------------------------------------------------

    result = result.rename(
        columns={
            "user_type": "user",
            "activity_date": "period"
        }
    )

    # --------------------------------------------------------
    # Remove empty periods
    # --------------------------------------------------------

    result = result[
        result["session_count"] > 0
    ].copy()

    # --------------------------------------------------------
    # Focus score
    #
    # focus_score_pct =
    # productive_minutes / total_minutes * 100
    # --------------------------------------------------------

    result["focus_score_pct"] = (
        result["productive_minutes"] /
        result["total_minutes"]
    ) * 100

    # --------------------------------------------------------
    # Protect against invalid values
    # --------------------------------------------------------

    result["focus_score_pct"] = (
        result["focus_score_pct"]
        .replace(
            [float("inf"), -float("inf")],
            0
        )
        .fillna(0)
    )

    # --------------------------------------------------------
    # Round values
    # --------------------------------------------------------

    result["total_minutes"] = (
        result["total_minutes"]
        .round(2)
    )

    result["productive_minutes"] = (
        result["productive_minutes"]
        .round(2)
    )

    result["focus_score_pct"] = (
        result["focus_score_pct"]
        .round(2)
    )

    # --------------------------------------------------------
    # Sort
    # --------------------------------------------------------

    result = result.sort_values(
        [
            "user",
            "period"
        ]
    ).reset_index(drop=True)

    return result


# ============================================================
# DAILY FOCUS
# ============================================================

def calculate_daily(df):

    return calculate_analytics(
        df,
        "D"
    )


# ============================================================
# WEEKLY FOCUS
# ============================================================

def calculate_weekly(df):

    return calculate_analytics(
        df,
        "W"
    )


# ============================================================
# MONTHLY FOCUS
# ============================================================

def calculate_monthly(df):

    return calculate_analytics(
        df,
        "ME"
    )


# ============================================================
# CREATE SWITCH PAIRS
# ============================================================

def create_switch_pairs(user_df):

    """
    Example:

        AppA
        AppB
        AppC
        AppB

    becomes:

        AppA -> AppB
        AppB -> AppC
        AppC -> AppB
    """

    # --------------------------------------------------------
    # Sort chronologically
    # --------------------------------------------------------

    user_df = user_df.sort_values(
        "opened_date"
    ).copy()

    apps = (
        user_df["app_web"]
        .astype(str)
        .str.strip()
        .tolist()
    )

    pairs = []

    for i in range(
        len(apps) - 1
    ):

        from_app = apps[i]
        to_app = apps[i + 1]

        # ----------------------------------------------------
        # Ignore same-app consecutive sessions
        # ----------------------------------------------------

        if from_app == to_app:
            continue

        pairs.append(
            (
                from_app,
                to_app
            )
        )

    return pairs


# ============================================================
# SWITCH ANALYTICS FOR ONE PERIOD
# ============================================================

def calculate_switch_statistics(period_df):

    """
    Calculate:

        from frequency
        to frequency
        pair frequency
        maximum switch count
        maximum switch pair
    """

    # --------------------------------------------------------
    # No switching possible
    # --------------------------------------------------------

    if len(period_df) < 2:

        return {
            "switch_count": 0,
            "from_frequency": {},
            "to_frequency": {},
            "pair_frequency": {},
            "max_switch_pair": None,
            "max_switch_count": 0
        }

    # --------------------------------------------------------
    # Create consecutive pairs
    # --------------------------------------------------------

    pairs = create_switch_pairs(
        period_df
    )

    # --------------------------------------------------------
    # No valid switches
    # --------------------------------------------------------

    if not pairs:

        return {
            "switch_count": 0,
            "from_frequency": {},
            "to_frequency": {},
            "pair_frequency": {},
            "max_switch_pair": None,
            "max_switch_count": 0
        }

    # --------------------------------------------------------
    # FROM frequency
    # --------------------------------------------------------

    from_counter = Counter(
        from_app
        for from_app, to_app in pairs
    )

    # --------------------------------------------------------
    # TO frequency
    # --------------------------------------------------------

    to_counter = Counter(
        to_app
        for from_app, to_app in pairs
    )

    # --------------------------------------------------------
    # Exact pair frequency
    # --------------------------------------------------------

    pair_counter = Counter(
        pairs
    )

    # --------------------------------------------------------
    # Maximum switch pair
    # --------------------------------------------------------

    max_pair, max_count = (
        pair_counter.most_common(1)[0]
    )

    # --------------------------------------------------------
    # Return statistics
    # --------------------------------------------------------

    return {
        "switch_count": len(pairs),

        "from_frequency": dict(
            from_counter
        ),

        "to_frequency": dict(
            to_counter
        ),

        "pair_frequency": {
            f"{from_app} -> {to_app}": count
            for (
                from_app,
                to_app
            ), count in pair_counter.items()
        },

        "max_switch_pair": (
            f"{max_pair[0]} -> {max_pair[1]}"
        ),

        "max_switch_count": max_count
    }


# ============================================================
# SWITCH ANALYTICS FOR DAILY / WEEKLY / MONTHLY
# ============================================================

def calculate_switch_analytics(
    df,
    period
):

    """
    Calculate switching analytics per:

        User + Daily
        User + Weekly
        User + Monthly
    """

    data = df.copy()

    # --------------------------------------------------------
    # Create period bucket
    # --------------------------------------------------------

    if period == "D":

        data["period"] = (
            data["opened_date"]
            .dt.floor("D")
        )

    elif period == "W":

        data["period"] = (
            data["opened_date"]
            .dt.to_period("W")
            .dt.end_time
            .dt.normalize()
        )

    elif period == "ME":

        data["period"] = (
            data["opened_date"]
            .dt.to_period("M")
            .dt.end_time
            .dt.normalize()
        )

    else:

        raise ValueError(
            "Unsupported period"
        )

    # --------------------------------------------------------
    # Make sure sessions are chronological
    # --------------------------------------------------------

    data = data.sort_values(
        [
            "user_type",
            "opened_date"
        ]
    )

    results = []

    # --------------------------------------------------------
    # Process every user + period
    # --------------------------------------------------------

    grouped = data.groupby(
        [
            "user_type",
            "period"
        ]
    )

    for (
        user,
        period_value
    ), group in grouped:

        stats = calculate_switch_statistics(
            group
        )

        results.append(
            {
                "user": user,

                "period": period_value,

                "switch_count": (
                    stats["switch_count"]
                ),

                "from_frequency": (
                    stats["from_frequency"]
                ),

                "to_frequency": (
                    stats["to_frequency"]
                ),

                "pair_frequency": (
                    stats["pair_frequency"]
                ),

                "max_switch_pair": (
                    stats["max_switch_pair"]
                ),

                "max_switch_count": (
                    stats["max_switch_count"]
                )
            }
        )

    # --------------------------------------------------------
    # Convert to DataFrame
    # --------------------------------------------------------

    result = pd.DataFrame(
        results
    )

    if result.empty:

        return result

    # --------------------------------------------------------
    # Sort
    # --------------------------------------------------------

    result = result.sort_values(
        [
            "user",
            "period"
        ]
    ).reset_index(drop=True)

    return result


# ============================================================
# DAILY SWITCHING
# ============================================================

def calculate_daily_switches(df):

    return calculate_switch_analytics(
        df,
        "D"
    )


# ============================================================
# WEEKLY SWITCHING
# ============================================================

def calculate_weekly_switches(df):

    return calculate_switch_analytics(
        df,
        "W"
    )


# ============================================================
# MONTHLY SWITCHING
# ============================================================

def calculate_monthly_switches(df):

    return calculate_switch_analytics(
        df,
        "ME"
    )


# ============================================================
# STEP 4
# CLEAR OLD ANALYTICS CACHE
# ============================================================

def clear_analytics_cache():

    """
    Clear only the derived analytics cache.

    IMPORTANT:
    synthetic_activity is NOT touched.
    """

    conn = psycopg2.connect(
        **DB_CONFIG
    )

    cursor = conn.cursor()

    print("\n")
    print("=" * 100)
    print("CLEARING OLD ANALYTICS CACHE")
    print("=" * 100)

    # --------------------------------------------------------
    # Clear daily cache
    # --------------------------------------------------------

    cursor.execute(
        f"""
        TRUNCATE TABLE
        {DAILY_CACHE_TABLE}
        RESTART IDENTITY;
        """
    )

    print(
        "Cleared daily analytics cache."
    )

    # --------------------------------------------------------
    # Clear weekly cache
    # --------------------------------------------------------

    cursor.execute(
        f"""
        TRUNCATE TABLE
        {WEEKLY_CACHE_TABLE}
        RESTART IDENTITY;
        """
    )

    print(
        "Cleared weekly analytics cache."
    )

    # --------------------------------------------------------
    # Clear monthly cache
    # --------------------------------------------------------

    cursor.execute(
        f"""
        TRUNCATE TABLE
        {MONTHLY_CACHE_TABLE}
        RESTART IDENTITY;
        """
    )

    print(
        "Cleared monthly analytics cache."
    )

    conn.commit()

    cursor.close()
    conn.close()

    print(
        "Old cache cleared successfully."
    )


# ============================================================
# STEP 4
# SAVE ANALYTICS TO CACHE
# ============================================================

def save_analytics_to_cache(
    focus_df,
    switch_df,
    table_name
):
    """
    Combine focus analytics and switch analytics
    and save them into the requested cache table.
    """

    if focus_df.empty:

        print(
            f"No focus data to save to "
            f"{table_name}."
        )

        return

    # --------------------------------------------------------
    # If switch DataFrame is empty
    # --------------------------------------------------------

    if switch_df.empty:

        merged = focus_df.copy()

        merged["switch_count"] = 0
        merged["from_frequency"] = (
            [{}] * len(merged)
        )
        merged["to_frequency"] = (
            [{}] * len(merged)
        )
        merged["pair_frequency"] = (
            [{}] * len(merged)
        )
        merged["max_switch_pair"] = None
        merged["max_switch_count"] = 0

    else:

        # ----------------------------------------------------
        # Combine focus + switching analytics
        # ----------------------------------------------------

        merged = pd.merge(
            focus_df,
            switch_df,
            on=[
                "user",
                "period"
            ],
            how="left"
        )

    # --------------------------------------------------------
    # Fill missing switching values
    # --------------------------------------------------------

    merged["switch_count"] = (
        merged["switch_count"]
        .fillna(0)
        .astype(int)
    )

    # --------------------------------------------------------
    # Clean JSON columns
    # --------------------------------------------------------

    for column in [
        "from_frequency",
        "to_frequency",
        "pair_frequency"
    ]:

        merged[column] = (
            merged[column]
            .apply(
                lambda x:
                    x
                    if isinstance(x, dict)
                    else {}
            )
        )

    # --------------------------------------------------------
    # Maximum switch count
    # --------------------------------------------------------

    merged["max_switch_count"] = (
        merged["max_switch_count"]
        .fillna(0)
        .astype(int)
    )

    # --------------------------------------------------------
    # Connect to PostgreSQL
    # --------------------------------------------------------

    conn = psycopg2.connect(
        **DB_CONFIG
    )

    cursor = conn.cursor()

    # --------------------------------------------------------
    # Save each row
    # --------------------------------------------------------

    for _, row in merged.iterrows():

        period_date = pd.to_datetime(
            row["period"]
        ).date()

        # ----------------------------------------------------
        # Maximum switch pair
        # ----------------------------------------------------

        max_switch_pair = (
            row["max_switch_pair"]
        )

        if pd.isna(
            max_switch_pair
        ):

            max_switch_pair = None

        # ----------------------------------------------------
        # Insert / Update
        # ----------------------------------------------------

        query = f"""
            INSERT INTO {table_name}
            (
                user_type,
                period_date,
                total_minutes,
                productive_minutes,
                session_count,
                focus_score_pct,
                switch_count,
                from_frequency,
                to_frequency,
                pair_frequency,
                max_switch_pair,
                max_switch_count
            )
            VALUES
            (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s::jsonb,
                %s::jsonb,
                %s::jsonb,
                %s,
                %s
            )

            ON CONFLICT (
                user_type,
                period_date
            )

            DO UPDATE SET

                total_minutes =
                    EXCLUDED.total_minutes,

                productive_minutes =
                    EXCLUDED.productive_minutes,

                session_count =
                    EXCLUDED.session_count,

                focus_score_pct =
                    EXCLUDED.focus_score_pct,

                switch_count =
                    EXCLUDED.switch_count,

                from_frequency =
                    EXCLUDED.from_frequency,

                to_frequency =
                    EXCLUDED.to_frequency,

                pair_frequency =
                    EXCLUDED.pair_frequency,

                max_switch_pair =
                    EXCLUDED.max_switch_pair,

                max_switch_count =
                    EXCLUDED.max_switch_count,

                calculated_at =
                    CURRENT_TIMESTAMP;
        """

        cursor.execute(
            query,
            (
                row["user"],

                period_date,

                float(
                    row["total_minutes"]
                ),

                float(
                    row["productive_minutes"]
                ),

                int(
                    row["session_count"]
                ),

                float(
                    row["focus_score_pct"]
                ),

                int(
                    row["switch_count"]
                ),

                json.dumps(
                    row["from_frequency"]
                ),

                json.dumps(
                    row["to_frequency"]
                ),

                json.dumps(
                    row["pair_frequency"]
                ),

                max_switch_pair,

                int(
                    row["max_switch_count"]
                )
            )
        )

    # --------------------------------------------------------
    # Commit
    # --------------------------------------------------------

    conn.commit()

    cursor.close()
    conn.close()

    print(
        f"Saved {len(merged)} rows "
        f"to {table_name}."
    )


# ============================================================
# DISPLAY FOCUS ANALYTICS
# ============================================================

def display_focus(
    title,
    result,
    user=None
):

    print("\n")
    print("=" * 100)
    print(title)
    print("=" * 100)

    if result.empty:

        print(
            "No data available."
        )

        return

    display_result = result.copy()

    if user is not None:

        display_result = (
            display_result[
                display_result["user"] == user
            ]
        )

    if display_result.empty:

        print(
            f"No data available for {user}"
        )

        return

    print(
        display_result.to_string(
            index=False
        )
    )


# ============================================================
# DISPLAY SWITCH ANALYTICS
# ============================================================

def display_switches(
    title,
    result,
    user=None
):

    print("\n")
    print("=" * 100)
    print(title)
    print("=" * 100)

    if result.empty:

        print(
            "No switching data available."
        )

        return

    display_result = result.copy()

    if user is not None:

        display_result = (
            display_result[
                display_result["user"] == user
            ]
        )

    if display_result.empty:

        print(
            f"No switching data available "
            f"for {user}"
        )

        return

    print(
        display_result.to_string(
            index=False
        )
    )


# ============================================================
# DISPLAY CACHE SUMMARY
# ============================================================

def display_cache_summary():

    """
    Show how many rows currently exist
    in each analytics cache table.
    """

    conn = psycopg2.connect(
        **DB_CONFIG
    )

    cursor = conn.cursor()

    print("\n")
    print("=" * 100)
    print("ANALYTICS CACHE SUMMARY")
    print("=" * 100)

    tables = [
        DAILY_CACHE_TABLE,
        WEEKLY_CACHE_TABLE,
        MONTHLY_CACHE_TABLE
    ]

    for table in tables:

        cursor.execute(
            f"""
            SELECT COUNT(*)
            FROM {table};
            """
        )

        count = cursor.fetchone()[0]

        print(
            f"{table}: {count} rows"
        )

    cursor.close()
    conn.close()


# ============================================================
# DISPLAY CACHE FOR SELECTED USER
# ============================================================

def display_user_cache(user):

    """
    Display the cached analytics for one user.
    """

    conn = psycopg2.connect(
        **DB_CONFIG
    )

    cursor = conn.cursor()

    print("\n")
    print("=" * 100)
    print(
        f"CACHED ANALYTICS FOR {user}"
    )
    print("=" * 100)

    # --------------------------------------------------------
    # Daily cache
    # --------------------------------------------------------

    print("\nDAILY CACHE")
    print("-" * 100)

    cursor.execute(
        f"""
        SELECT
            user_type,
            period_date,
            total_minutes,
            productive_minutes,
            session_count,
            focus_score_pct,
            switch_count,
            max_switch_pair,
            max_switch_count
        FROM {DAILY_CACHE_TABLE}
        WHERE user_type = %s
        ORDER BY period_date;
        """,
        (user,)
    )

    rows = cursor.fetchall()

    for row in rows:

        print(row)

    # --------------------------------------------------------
    # Weekly cache
    # --------------------------------------------------------

    print("\nWEEKLY CACHE")
    print("-" * 100)

    cursor.execute(
        f"""
        SELECT
            user_type,
            period_date,
            total_minutes,
            productive_minutes,
            session_count,
            focus_score_pct,
            switch_count,
            max_switch_pair,
            max_switch_count
        FROM {WEEKLY_CACHE_TABLE}
        WHERE user_type = %s
        ORDER BY period_date;
        """,
        (user,)
    )

    rows = cursor.fetchall()

    for row in rows:

        print(row)

    # --------------------------------------------------------
    # Monthly cache
    # --------------------------------------------------------

    print("\nMONTHLY CACHE")
    print("-" * 100)

    cursor.execute(
        f"""
        SELECT
            user_type,
            period_date,
            total_minutes,
            productive_minutes,
            session_count,
            focus_score_pct,
            switch_count,
            max_switch_pair,
            max_switch_count
        FROM {MONTHLY_CACHE_TABLE}
        WHERE user_type = %s
        ORDER BY period_date;
        """,
        (user,)
    )

    rows = cursor.fetchall()

    for row in rows:

        print(row)

    cursor.close()
    conn.close()


# ============================================================
# STEP 5 - SLIDING WINDOW ANALYTICS
# ============================================================

WINDOW_SIZE = 5


# ============================================================
# STEP 5 - CALCULATE SLIDING WINDOW
# ============================================================


def convert_to_dict(value):

    """
    Convert PostgreSQL JSONB / string / dictionary
    into a normal Python dictionary.
    """

    if value is None:
        return {}

    if isinstance(value, dict):
        return value

    if isinstance(value, str):

        try:
            return json.loads(value)

        except Exception:
            return {}

    return {}


def calculate_sliding_window(
    daily_df,
    window_size=5
):

    if daily_df.empty:
        return pd.DataFrame()

    df = daily_df.copy()

    # --------------------------------------------------------
    # Convert date
    # --------------------------------------------------------

    df["period"] = pd.to_datetime(
        df["period"]
    )

    # --------------------------------------------------------
    # Sort
    # --------------------------------------------------------

    df = df.sort_values(
        ["user", "period"]
    ).reset_index(drop=True)

    results = []

    # --------------------------------------------------------
    # Process each user separately
    # --------------------------------------------------------

    for user, user_df in df.groupby("user"):

        user_df = (
            user_df
            .sort_values("period")
            .reset_index(drop=True)
        )

        # ----------------------------------------------------
        # Sliding window
        # ----------------------------------------------------

        for i in range(
            window_size - 1,
            len(user_df)
        ):

            window = user_df.iloc[
                i - window_size + 1 :
                i + 1
            ].copy()

            # ------------------------------------------------
            # Window dates
            # ------------------------------------------------

            window_start = (
                window["period"]
                .min()
                .date()
            )

            window_end = (
                window["period"]
                .max()
                .date()
            )

            # ------------------------------------------------
            # Total minutes
            # ------------------------------------------------

            total_minutes = (
                window["total_minutes"]
                .sum()
            )

            # ------------------------------------------------
            # Productive minutes
            # ------------------------------------------------

            productive_minutes = (
                window["productive_minutes"]
                .sum()
            )

            # ------------------------------------------------
            # Session count
            # ------------------------------------------------

            session_count = int(
                window["session_count"].sum()
            )

            # ------------------------------------------------
            # Focus score
            #
            # DO NOT average percentages.
            # Calculate from summed minutes.
            # ------------------------------------------------

            if total_minutes > 0:

                focus_score_pct = (
                    productive_minutes /
                    total_minutes
                ) * 100

            else:

                focus_score_pct = 0

            # ------------------------------------------------
            # SWITCH COUNT
            # ------------------------------------------------

            switch_count = int(
                window["switch_count"].sum()
            )

            # ------------------------------------------------
            # MERGE SWITCH FREQUENCIES
            # ------------------------------------------------

            from_counter = Counter()
            to_counter = Counter()
            pair_counter = Counter()

            for _, row in window.iterrows():

                # --------------------------------------------
                # FROM
                # --------------------------------------------

                from_data = convert_to_dict(
                    row["from_frequency"]
                )

                for app, count in from_data.items():

                    from_counter[app] += int(count)

                # --------------------------------------------
                # TO
                # --------------------------------------------

                to_data = convert_to_dict(
                    row["to_frequency"]
                )

                for app, count in to_data.items():

                    to_counter[app] += int(count)

                # --------------------------------------------
                # PAIRS
                # --------------------------------------------

                pair_data = convert_to_dict(
                    row["pair_frequency"]
                )

                for pair, count in pair_data.items():

                    pair_counter[pair] += int(count)

            # ------------------------------------------------
            # MOST FREQUENT FROM APP
            # ------------------------------------------------

            if from_counter:

                most_switched_from = (
                    from_counter
                    .most_common(1)[0]
                )

                most_from_app = (
                    most_switched_from[0]
                )

                most_from_count = int(
                    most_switched_from[1]
                )

            else:

                most_from_app = None
                most_from_count = 0

            # ------------------------------------------------
            # MOST FREQUENT TO APP
            # ------------------------------------------------

            if to_counter:

                most_switched_to = (
                    to_counter
                    .most_common(1)[0]
                )

                most_to_app = (
                    most_switched_to[0]
                )

                most_to_count = int(
                    most_switched_to[1]
                )

            else:

                most_to_app = None
                most_to_count = 0

            # ------------------------------------------------
            # MOST FREQUENT APP PAIR
            # ------------------------------------------------

            if pair_counter:

                most_pair = (
                    pair_counter
                    .most_common(1)[0]
                )

                max_switch_pair = (
                    most_pair[0]
                )

                max_switch_count = int(
                    most_pair[1]
                )

            else:

                max_switch_pair = None
                max_switch_count = 0

            # ------------------------------------------------
            # SAVE RESULT
            # ------------------------------------------------

            results.append({

                "user": user,

                "window_size": window_size,

                "window_start": window_start,

                "window_end": window_end,

                "total_minutes": round(
                    float(total_minutes),
                    2
                ),

                "productive_minutes": round(
                    float(productive_minutes),
                    2
                ),

                "session_count": session_count,

                "focus_score_pct": round(
                    float(focus_score_pct),
                    2
                ),

                "switch_count": switch_count,

                "most_switched_from":
                    most_from_app,

                "most_switched_from_count":
                    most_from_count,

                "most_switched_to":
                    most_to_app,

                "most_switched_to_count":
                    most_to_count,

                "max_switch_pair":
                    max_switch_pair,

                "max_switch_count":
                    max_switch_count
            })

    return pd.DataFrame(results)
    # ============================================================
# STEP 6 - USER FOCUS SUMMARY
# ============================================================

def classify_focus_score(score):

    if score >= 80:
        return "Excellent Focus"

    elif score >= 60:
        return "Good Focus"

    elif score >= 40:
        return "Moderate Focus"

    elif score >= 20:
        return "Low Focus"

    else:
        return "Very Low Focus"


# ============================================================
# DETERMINE FOCUS TREND
# ============================================================

def determine_focus_trend(user_df):

    if len(user_df) < 2:
        return "Stable"

    user_df = user_df.sort_values(
        "window_end"
    ).reset_index(drop=True)

    # --------------------------------------------------------
    # Compare the latest window with previous window
    # --------------------------------------------------------

    previous_score = float(
        user_df.iloc[-2]["focus_score_pct"]
    )

    latest_score = float(
        user_df.iloc[-1]["focus_score_pct"]
    )

    difference = latest_score - previous_score

    # --------------------------------------------------------
    # Small changes are treated as stable
    # --------------------------------------------------------

    if difference >= 5:
        return "Improving"

    elif difference <= -5:
        return "Declining"

    else:
        return "Stable"


# ============================================================
# CALCULATE USER SUMMARY
# ============================================================

def calculate_user_focus_summary(
    sliding_df,
    daily_df
):

    if sliding_df.empty:
        return pd.DataFrame()

    results = []

    # --------------------------------------------------------
    # Process each user
    # --------------------------------------------------------

    for user, user_windows in sliding_df.groupby("user"):

        user_windows = (
            user_windows
            .sort_values("window_end")
            .reset_index(drop=True)
        )

        # ----------------------------------------------------
        # Latest sliding window
        # ----------------------------------------------------

        latest = user_windows.iloc[-1]

        latest_focus = float(
            latest["focus_score_pct"]
        )

        # ----------------------------------------------------
        # Focus statistics
        # ----------------------------------------------------

        average_focus = (
            user_windows["focus_score_pct"]
            .mean()
        )

        best_focus = (
            user_windows["focus_score_pct"]
            .max()
        )

        worst_focus = (
            user_windows["focus_score_pct"]
            .min()
        )

        # ----------------------------------------------------
        # Overall screen time
        #
        # Use daily data so each session/day is represented
        # correctly rather than adding overlapping windows.
        # ----------------------------------------------------

        user_daily = daily_df[
            daily_df["user"] == user
        ].copy()

        total_minutes = (
            user_daily["total_minutes"]
            .sum()
        )

        productive_minutes = (
            user_daily["productive_minutes"]
            .sum()
        )

        session_count = int(
            user_daily["session_count"].sum()
        )

        switch_count = int(
            user_daily["switch_count"].sum()
        )

        # ----------------------------------------------------
        # Most switched FROM
        # ----------------------------------------------------

        from_counter = Counter()

        for value in user_daily[
            "from_frequency"
        ]:

            data = convert_to_dict(value)

            for app, count in data.items():

                from_counter[app] += int(count)

        if from_counter:

            most_from = from_counter.most_common(1)[0]

            most_switched_from = most_from[0]

            most_switched_from_count = int(
                most_from[1]
            )

        else:

            most_switched_from = None
            most_switched_from_count = 0

        # ----------------------------------------------------
        # Most switched TO
        # ----------------------------------------------------

        to_counter = Counter()

        for value in user_daily[
            "to_frequency"
        ]:

            data = convert_to_dict(value)

            for app, count in data.items():

                to_counter[app] += int(count)

        if to_counter:

            most_to = to_counter.most_common(1)[0]

            most_switched_to = most_to[0]

            most_switched_to_count = int(
                most_to[1]
            )

        else:

            most_switched_to = None
            most_switched_to_count = 0

        # ----------------------------------------------------
        # Most frequent switch pair
        # ----------------------------------------------------

        pair_counter = Counter()

        for value in user_daily[
            "pair_frequency"
        ]:

            data = convert_to_dict(value)

            for pair, count in data.items():

                pair_counter[pair] += int(count)

        if pair_counter:

            most_pair = (
                pair_counter
                .most_common(1)[0]
            )

            most_frequent_switch_pair = (
                most_pair[0]
            )

            most_frequent_switch_pair_count = int(
                most_pair[1]
            )

        else:

            most_frequent_switch_pair = None

            most_frequent_switch_pair_count = 0

        # ----------------------------------------------------
        # Focus trend
        # ----------------------------------------------------

        focus_trend = determine_focus_trend(
            user_windows
        )

        # ----------------------------------------------------
        # Focus category
        # ----------------------------------------------------

        focus_category = classify_focus_score(
            latest_focus
        )

        # ----------------------------------------------------
        # Create summary
        # ----------------------------------------------------

        results.append({

            "user_type": user,

            "latest_window_start":
                latest["window_start"],

            "latest_window_end":
                latest["window_end"],

            "latest_focus_score_pct":
                round(latest_focus, 2),

            "average_focus_score_pct":
                round(
                    float(average_focus),
                    2
                ),

            "best_focus_score_pct":
                round(
                    float(best_focus),
                    2
                ),

            "worst_focus_score_pct":
                round(
                    float(worst_focus),
                    2
                ),

            "total_minutes":
                round(
                    float(total_minutes),
                    2
                ),

            "productive_minutes":
                round(
                    float(productive_minutes),
                    2
                ),

            "session_count":
                session_count,

            "switch_count":
                switch_count,

            "most_switched_from":
                most_switched_from,

            "most_switched_from_count":
                most_switched_from_count,

            "most_switched_to":
                most_switched_to,

            "most_switched_to_count":
                most_switched_to_count,

            "most_frequent_switch_pair":
                most_frequent_switch_pair,

            "most_frequent_switch_pair_count":
                most_frequent_switch_pair_count,

            "focus_trend":
                focus_trend,

            "focus_category":
                focus_category
        })

    return pd.DataFrame(results)
    # ============================================================
# SAVE USER SUMMARY CACHE
# ============================================================

def save_user_focus_summary(summary_df):

    if summary_df.empty:

        print(
            "\nNo user focus summary data to save."
        )

        return

    conn = psycopg2.connect(**DB_CONFIG)

    cursor = conn.cursor()

    # --------------------------------------------------------
    # Clear previous cache
    # --------------------------------------------------------

    cursor.execute(
        "TRUNCATE TABLE user_focus_summary_cache;"
    )

    # --------------------------------------------------------
    # Insert fresh results
    # --------------------------------------------------------

    insert_query = """
        INSERT INTO user_focus_summary_cache (

            user_type,

            latest_window_start,
            latest_window_end,

            latest_focus_score_pct,
            average_focus_score_pct,

            best_focus_score_pct,
            worst_focus_score_pct,

            total_minutes,
            productive_minutes,

            session_count,
            switch_count,

            most_switched_from,
            most_switched_from_count,

            most_switched_to,
            most_switched_to_count,

            most_frequent_switch_pair,
            most_frequent_switch_pair_count,

            focus_trend,
            focus_category
        )

        VALUES (

            %s, %s, %s,

            %s, %s,

            %s, %s,

            %s, %s,

            %s, %s,

            %s, %s,

            %s, %s,

            %s, %s,

            %s, %s
        );
    """

    for _, row in summary_df.iterrows():

        cursor.execute(
            insert_query,
            (

                row["user_type"],

                row["latest_window_start"],
                row["latest_window_end"],

                float(
                    row["latest_focus_score_pct"]
                ),

                float(
                    row["average_focus_score_pct"]
                ),

                float(
                    row["best_focus_score_pct"]
                ),

                float(
                    row["worst_focus_score_pct"]
                ),

                float(
                    row["total_minutes"]
                ),

                float(
                    row["productive_minutes"]
                ),

                int(
                    row["session_count"]
                ),

                int(
                    row["switch_count"]
                ),

                row["most_switched_from"],

                int(
                    row["most_switched_from_count"]
                ),

                row["most_switched_to"],

                int(
                    row["most_switched_to_count"]
                ),

                row["most_frequent_switch_pair"],

                int(
                    row["most_frequent_switch_pair_count"]
                ),

                row["focus_trend"],

                row["focus_category"]
            )
        )

    conn.commit()

    cursor.close()

    conn.close()

    print(
        "\nUser focus summary cache updated: "
        f"{len(summary_df)} users"
    )
    # ============================================================
# DISPLAY USER FOCUS SUMMARY
# ============================================================

def display_user_focus_summary(summary_df):

    print("\n")
    print("=" * 110)
    print("STEP 6 - USER FOCUS SUMMARY")
    print("=" * 110)

    if summary_df.empty:

        print(
            "\nNo user summary available."
        )

        return

    display_columns = [

        "user_type",

        "latest_window_start",
        "latest_window_end",

        "latest_focus_score_pct",

        "average_focus_score_pct",

        "best_focus_score_pct",
        "worst_focus_score_pct",

        "total_minutes",
        "productive_minutes",

        "session_count",
        "switch_count",

        "most_switched_from",
        "most_switched_to",

        "most_frequent_switch_pair",

        "focus_trend",
        "focus_category"
    ]

    print(
        summary_df[
            display_columns
        ].to_string(index=False)
    )
    # ============================================================
# READ USER SUMMARY CACHE
# ============================================================

def read_user_focus_summary():

    conn = psycopg2.connect(**DB_CONFIG)

    query = """

        SELECT

            user_type,

            latest_window_start,
            latest_window_end,

            latest_focus_score_pct,

            average_focus_score_pct,

            best_focus_score_pct,
            worst_focus_score_pct,

            total_minutes,
            productive_minutes,

            session_count,
            switch_count,

            most_switched_from,
            most_switched_from_count,

            most_switched_to,
            most_switched_to_count,

            most_frequent_switch_pair,
            most_frequent_switch_pair_count,

            focus_trend,
            focus_category

        FROM user_focus_summary_cache

        ORDER BY user_type;

    """

    df = pd.read_sql_query(
        query,
        conn
    )

    conn.close()

    return df

# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    print("=" * 100)
    print(
        "FOCUS GUARD AI - "
        "USER FOCUS + APP SWITCH ANALYTICS"
    )
    print("=" * 100)

    # ========================================================
    # STEP 4.1 - CLEAR OLD CACHE
    # ========================================================

    clear_analytics_cache()

    # ========================================================
    # STEP 4.2 - LOAD RAW DATABASE DATA
    # ========================================================

    df = get_activity_data()

    print(f"\nTotal records loaded: {len(df)}")

    # ========================================================
    # STEP 4.3 - PREPARE SESSION DATA
    # ========================================================

    df = prepare_session_data(df)

    print(
        f"Valid sessions after duration check: {len(df)}"
    )

    if df.empty:
        print("No valid activity records found. Exiting.")
        raise SystemExit(0)

    # ========================================================
    # STEP 4.4 - CALCULATE DAILY FOCUS
    # ========================================================

    daily_focus = calculate_daily(df)

    # ========================================================
    # STEP 4.5 - CALCULATE WEEKLY FOCUS
    # ========================================================

    weekly_focus = calculate_weekly(df)

    # ========================================================
    # STEP 4.6 - CALCULATE MONTHLY FOCUS
    # ========================================================

    monthly_focus = calculate_monthly(df)

    # ========================================================
    # STEP 4.7 - CALCULATE DAILY SWITCHES
    # ========================================================

    daily_switches = calculate_daily_switches(df)

    # ========================================================
    # STEP 4.8 - CALCULATE WEEKLY SWITCHES
    # ========================================================

    weekly_switches = calculate_weekly_switches(df)

    # ========================================================
    # STEP 4.9 - CALCULATE MONTHLY SWITCHES
    # ========================================================

    monthly_switches = calculate_monthly_switches(df)

    # ========================================================
    # STEP 4.10 - BUILD MERGED DAILY DATA
    # This is used by sliding-window and user-summary analytics.
    # ========================================================

    if daily_switches.empty:

        daily_cache_df = daily_focus.copy()
        daily_cache_df["switch_count"] = 0
        daily_cache_df["from_frequency"] = [
            {} for _ in range(len(daily_cache_df))
        ]
        daily_cache_df["to_frequency"] = [
            {} for _ in range(len(daily_cache_df))
        ]
        daily_cache_df["pair_frequency"] = [
            {} for _ in range(len(daily_cache_df))
        ]
        daily_cache_df["max_switch_pair"] = None
        daily_cache_df["max_switch_count"] = 0

    else:

        daily_cache_df = pd.merge(
            daily_focus,
            daily_switches,
            on=["user", "period"],
            how="left"
        )

        daily_cache_df["switch_count"] = (
            daily_cache_df["switch_count"]
            .fillna(0)
            .astype(int)
        )

        for column in [
            "from_frequency",
            "to_frequency",
            "pair_frequency"
        ]:
            daily_cache_df[column] = daily_cache_df[column].apply(
                lambda x: x if isinstance(x, dict) else {}
            )

        daily_cache_df["max_switch_count"] = (
            daily_cache_df["max_switch_count"]
            .fillna(0)
            .astype(int)
        )

        daily_cache_df["max_switch_pair"] = (
            daily_cache_df["max_switch_pair"].where(
                daily_cache_df["max_switch_pair"].notna(),
                None
            )
        )

    # ========================================================
    # STEP 4.11 - SAVE DAILY CACHE
    # ========================================================

    save_analytics_to_cache(
        daily_focus,
        daily_switches,
        DAILY_CACHE_TABLE
    )

    # ========================================================
    # STEP 4.12 - SAVE WEEKLY CACHE
    # ========================================================

    save_analytics_to_cache(
        weekly_focus,
        weekly_switches,
        WEEKLY_CACHE_TABLE
    )

    # ========================================================
    # STEP 4.13 - SAVE MONTHLY CACHE
    # ========================================================

    save_analytics_to_cache(
        monthly_focus,
        monthly_switches,
        MONTHLY_CACHE_TABLE
    )

    # ========================================================
    # SELECT USER FOR TERMINAL DISPLAY
    # ========================================================

    selected_user = "User1"

    display_focus(
        "DAILY FOCUS ANALYTICS",
        daily_focus,
        selected_user
    )

    display_focus(
        "WEEKLY FOCUS ANALYTICS",
        weekly_focus,
        selected_user
    )

    display_focus(
        "MONTHLY FOCUS ANALYTICS",
        monthly_focus,
        selected_user
    )

    display_switches(
        "DAILY APP SWITCH ANALYTICS",
        daily_switches,
        selected_user
    )

    display_switches(
        "WEEKLY APP SWITCH ANALYTICS",
        weekly_switches,
        selected_user
    )

    display_switches(
        "MONTHLY APP SWITCH ANALYTICS",
        monthly_switches,
        selected_user
    )

    display_cache_summary()
    display_user_cache(selected_user)

    print("\n")
    print("=" * 100)
    print("FOCUS + SWITCH ANALYTICS COMPLETED")
    print("=" * 100)

    # ========================================================
    # STEP 5 - SLIDING WINDOW ANALYTICS
    # ========================================================

    WINDOW_SIZE = 5

    print("\n")
    print("=" * 110)
    print("STEP 5 - BUILDING SLIDING WINDOW ANALYTICS")
    print("=" * 110)

    sliding_df = calculate_sliding_window(
        daily_cache_df,
        WINDOW_SIZE
    )

    print("\nSLIDING WINDOW ANALYTICS")
    print("-" * 110)

    if sliding_df.empty:
        print("No sliding window records found.")
    else:
        print(
            sliding_df.to_string(
                index=False
            )
        )

    # ========================================================
    # STEP 6 - USER FOCUS SUMMARY
    # ========================================================

    print("\n")
    print("=" * 110)
    print("STEP 6 - BUILDING USER FOCUS SUMMARY")
    print("=" * 110)

    user_summary_df = calculate_user_focus_summary(
        sliding_df,
        daily_cache_df
    )

    display_user_focus_summary(user_summary_df)
    save_user_focus_summary(user_summary_df)

    stored_summary_df = read_user_focus_summary()

    print("\n")
    print("=" * 110)
    print("USER FOCUS SUMMARY CACHE")
    print("=" * 110)

    if stored_summary_df.empty:
        print("No user focus summary records found.")
    else:
        print(
            stored_summary_df.to_string(
                index=False
            )
        )

    print("\n")
    print("=" * 100)
    print(
        "FOCUS + SWITCH + CACHE + "
        "SLIDING WINDOW + USER SUMMARY COMPLETED"
    )
    print("=" * 100)
