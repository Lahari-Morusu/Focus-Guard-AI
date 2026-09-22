-- ============================================================
-- FOCUS GUARD AI - ANALYTICS CACHE TABLES
-- ============================================================


-- ============================================================
-- DAILY CACHE
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_analytics_cache (

    id SERIAL PRIMARY KEY,

    user_type VARCHAR(100) NOT NULL,

    period_date DATE NOT NULL,

    total_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,

    productive_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,

    session_count INTEGER NOT NULL DEFAULT 0,

    focus_score_pct NUMERIC(6,2) NOT NULL DEFAULT 0,

    switch_count INTEGER NOT NULL DEFAULT 0,

    from_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,

    to_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,

    pair_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,

    max_switch_pair TEXT,

    max_switch_count INTEGER NOT NULL DEFAULT 0,

    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_type, period_date)
);


-- ============================================================
-- WEEKLY CACHE
-- ============================================================

CREATE TABLE IF NOT EXISTS weekly_analytics_cache (

    id SERIAL PRIMARY KEY,

    user_type VARCHAR(100) NOT NULL,

    period_date DATE NOT NULL,

    total_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,

    productive_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,

    session_count INTEGER NOT NULL DEFAULT 0,

    focus_score_pct NUMERIC(6,2) NOT NULL DEFAULT 0,

    switch_count INTEGER NOT NULL DEFAULT 0,

    from_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,

    to_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,

    pair_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,

    max_switch_pair TEXT,

    max_switch_count INTEGER NOT NULL DEFAULT 0,

    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_type, period_date)
);


-- ============================================================
-- MONTHLY CACHE
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_analytics_cache (

    id SERIAL PRIMARY KEY,

    user_type VARCHAR(100) NOT NULL,

    period_date DATE NOT NULL,

    total_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,

    productive_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,

    session_count INTEGER NOT NULL DEFAULT 0,

    focus_score_pct NUMERIC(6,2) NOT NULL DEFAULT 0,

    switch_count INTEGER NOT NULL DEFAULT 0,

    from_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,

    to_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,

    pair_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,

    max_switch_pair TEXT,

    max_switch_count INTEGER NOT NULL DEFAULT 0,

    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_type, period_date)
);
