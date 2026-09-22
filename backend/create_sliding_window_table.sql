CREATE TABLE IF NOT EXISTS sliding_window_cache (
    id SERIAL PRIMARY KEY,

    user_type VARCHAR(100) NOT NULL,

    window_size INTEGER NOT NULL,

    window_start DATE NOT NULL,

    window_end DATE NOT NULL,

    total_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,

    productive_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,

    session_count INTEGER NOT NULL DEFAULT 0,

    focus_score_pct NUMERIC(6,2) NOT NULL DEFAULT 0,

    switch_count INTEGER NOT NULL DEFAULT 0,

    max_switch_pair VARCHAR(255),

    max_switch_count INTEGER NOT NULL DEFAULT 0,

    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        user_type,
        window_size,
        window_start,
        window_end
    )
);
