CREATE TABLE IF NOT EXISTS user_focus_summary_cache (

    id SERIAL PRIMARY KEY,

    user_type VARCHAR(100) NOT NULL UNIQUE,

    latest_window_start DATE,

    latest_window_end DATE,

    latest_focus_score_pct NUMERIC(6,2) DEFAULT 0,

    average_focus_score_pct NUMERIC(6,2) DEFAULT 0,

    best_focus_score_pct NUMERIC(6,2) DEFAULT 0,

    worst_focus_score_pct NUMERIC(6,2) DEFAULT 0,

    total_minutes NUMERIC(12,2) DEFAULT 0,

    productive_minutes NUMERIC(12,2) DEFAULT 0,

    session_count INTEGER DEFAULT 0,

    switch_count INTEGER DEFAULT 0,

    most_switched_from VARCHAR(255),

    most_switched_from_count INTEGER DEFAULT 0,

    most_switched_to VARCHAR(255),

    most_switched_to_count INTEGER DEFAULT 0,

    most_frequent_switch_pair VARCHAR(255),

    most_frequent_switch_pair_count INTEGER DEFAULT 0,

    focus_trend VARCHAR(50),

    focus_category VARCHAR(50),

    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
