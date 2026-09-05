-- =============================================================================
-- Sentinel MPLADS Monitoring — Initial Schema
-- Migration: 20260905000000_initial_schema.sql
--
-- Design rules enforced here:
--   * NUMERIC (not FLOAT/DOUBLE) for all monetary columns
--   * Dates stored as DATE; timestamps as TIMESTAMPTZ
--   * NULL != 0 — missing values remain NULL; no default 0 coercion
--   * expenditure_transactions.work_id has NO hard FK to works:
--       Punjab dataset contains 38 orphan transactions (MP381 constituency)
--       that have no matching works row; a hard FK would reject them.
--   * Duplicate transaction rows are preserved exactly as-is for auditability
--   * risk_signals uses a stable signal_instance_id (SHA-256 hash) so that
--     re-ingestion is idempotent and does not create phantom duplicates
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), digest()


-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------
CREATE TYPE risk_level_enum AS ENUM (
    'Low / Normal',
    'Moderate',
    'Elevated Risk',
    'High Risk'
);

CREATE TYPE signal_dimension_enum AS ENUM (
    'financial_integrity',
    'transaction_pattern',
    'lifecycle_execution',
    'data_quality'
);

CREATE TYPE signal_severity_enum AS ENUM (
    'Low',
    'Moderate',
    'High',
    'Critical'
);


-- =============================================================================
-- TABLE: dataset_runs
-- Tracks each ingestion run for reproducibility and audit.
-- =============================================================================
CREATE TABLE IF NOT EXISTS dataset_runs (
    run_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
    states_loaded   TEXT[]      NOT NULL,
    total_works     INTEGER,
    total_tx        INTEGER,
    total_signals   INTEGER,
    scorer_version  TEXT,
    notes           TEXT
);


-- =============================================================================
-- TABLE: works
-- One row per MPLADS project (sanctioned work).
-- Source: processed/<state>/works.csv
-- =============================================================================
CREATE TABLE IF NOT EXISTS works (
    -- Identity
    work_id             TEXT        PRIMARY KEY,
    state               TEXT        NOT NULL,
    constituency        TEXT,
    lok_sabha           TEXT,
    mp_name             TEXT,

    -- Classification
    work_category       TEXT,
    work               TEXT,
    work_description    TEXT,
    ida                 TEXT,

    -- Recommendation (NULL for all 200 AP works -- workbook series mismatch)
    recommended_date    DATE,
    recommended_amount  NUMERIC(14, 2),

    -- Sanction
    sanction_date       DATE,
    sanction_amount     NUMERIC(14, 2),

    -- Status and completion
    work_status         TEXT,
    completion_date     DATE,
    amount_disbursed    NUMERIC(14, 2),

    -- Pipeline notes (e.g. AP cross-series explanation)
    data_notes          TEXT,

    -- Audit
    inserted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_works_state         ON works (state);
CREATE INDEX IF NOT EXISTS idx_works_constituency  ON works (constituency);
CREATE INDEX IF NOT EXISTS idx_works_work_status   ON works (work_status);
CREATE INDEX IF NOT EXISTS idx_works_sanction_date ON works (sanction_date);


-- =============================================================================
-- TABLE: expenditure_transactions
-- One row per payment record, exactly as sourced.
-- IMPORTANT: No FK to works -- 38 orphan Punjab transactions must be preserved.
-- IMPORTANT: Duplicate rows are kept; is_exact_duplicate flags them.
-- Source: processed/<state>/expenditure_transactions.csv
-- =============================================================================
CREATE TABLE IF NOT EXISTS expenditure_transactions (
    expenditure_id                    TEXT        PRIMARY KEY,

    -- References (intentionally NOT a hard FK -- see header note)
    work_id                           TEXT        NOT NULL,
    state                             TEXT        NOT NULL,
    mp_name                           TEXT,
    constituency                      TEXT,

    -- Transaction details
    expenditure_date                  DATE,
    vendor_name                       TEXT,
    payment_status                    TEXT,
    fund_disbursed_amount             NUMERIC(14, 2),

    -- Pipeline annotations
    data_notes                        TEXT,

    -- Duplicate detection fields (set by prepare_mplads_data.py)
    is_exact_duplicate                BOOLEAN     NOT NULL DEFAULT FALSE,
    duplicate_group_id                TEXT,
    duplicate_group_size              INTEGER,
    potential_duplicate_amount        NUMERIC(14, 2) NOT NULL DEFAULT 0,

    -- Orphan flag: TRUE when work_id has no matching row in works
    expenditure_without_matching_work BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Audit
    inserted_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exptx_work_id           ON expenditure_transactions (work_id);
CREATE INDEX IF NOT EXISTS idx_exptx_state             ON expenditure_transactions (state);
CREATE INDEX IF NOT EXISTS idx_exptx_expenditure_date  ON expenditure_transactions (expenditure_date);
CREATE INDEX IF NOT EXISTS idx_exptx_duplicate_group   ON expenditure_transactions (duplicate_group_id) WHERE duplicate_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exptx_orphan            ON expenditure_transactions (expenditure_without_matching_work) WHERE expenditure_without_matching_work = TRUE;


-- =============================================================================
-- TABLE: work_features
-- Pre-computed derived features from the ingestion pipeline.
-- These are NOT recalculated in SQL -- loaded verbatim from CSV.
-- Source: processed/<state>/work_features.csv
-- =============================================================================
CREATE TABLE IF NOT EXISTS work_features (
    work_id                             TEXT    PRIMARY KEY
                                                REFERENCES works (work_id) ON DELETE CASCADE,

    -- Expenditure aggregates
    total_expenditure                   NUMERIC(14, 2),
    expenditure_transaction_count       INTEGER,
    unique_vendor_count                 INTEGER,

    -- Duplicate analysis
    duplicate_transaction_count         INTEGER,
    duplicate_group_count               INTEGER,
    potential_duplicate_amount_total    NUMERIC(14, 2),

    -- Timeline
    days_to_sanction                    INTEGER,
    days_to_completion                  INTEGER,
    last_expenditure_date               DATE,
    days_since_last_expenditure         INTEGER,

    -- Ratio features
    expenditure_vs_sanction_ratio       NUMERIC(8, 4),
    disbursement_vs_sanction_ratio      NUMERIC(8, 4),

    -- Boolean flags
    expenditure_exceeds_sanction        BOOLEAN,
    disbursement_exceeds_sanction       BOOLEAN,
    completed_without_completion_date   BOOLEAN,
    completed_without_disbursement      BOOLEAN,
    expenditure_without_matching_work   BOOLEAN,
    high_transaction_count              BOOLEAN,
    multiple_vendors                    BOOLEAN,
    has_potential_duplicate_transaction BOOLEAN,
    potential_duplicate_transaction     BOOLEAN,

    -- Audit
    inserted_at                         TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- TABLE: risk_scores
-- Output from sentinel_scorer.py -- one row per work.
-- Scores are deterministic; this table must NOT recalculate them.
-- Source: scored/work_risk_scores.csv
-- =============================================================================
CREATE TABLE IF NOT EXISTS risk_scores (
    work_id                     TEXT        PRIMARY KEY
                                            REFERENCES works (work_id) ON DELETE CASCADE,
    state                       TEXT        NOT NULL,

    -- Composite score
    risk_score                  INTEGER     NOT NULL
                                            CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level                  risk_level_enum NOT NULL,

    -- Dimension subscores
    financial_integrity_score   INTEGER     NOT NULL
                                            CHECK (financial_integrity_score >= 0 AND financial_integrity_score <= 100),
    transaction_pattern_score   INTEGER     NOT NULL
                                            CHECK (transaction_pattern_score >= 0 AND transaction_pattern_score <= 100),
    lifecycle_execution_score   INTEGER     NOT NULL
                                            CHECK (lifecycle_execution_score >= 0 AND lifecycle_execution_score <= 100),
    data_quality_score          INTEGER     NOT NULL
                                            CHECK (data_quality_score >= 0 AND data_quality_score <= 100),

    requires_human_review       BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Audit
    inserted_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_riskscores_state        ON risk_scores (state);
CREATE INDEX IF NOT EXISTS idx_riskscores_risk_level   ON risk_scores (risk_level);
CREATE INDEX IF NOT EXISTS idx_riskscores_score        ON risk_scores (risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_riskscores_human_review ON risk_scores (requires_human_review) WHERE requires_human_review = TRUE;


-- =============================================================================
-- TABLE: risk_signals
-- One row per triggered anomaly signal.
-- Do NOT collapse -- multiple signals per work are intentional.
-- signal_instance_id: SHA-256(work_id || '|' || signal_id || '|' || dimension || '|' || points::text)
-- Generated by ingest_to_supabase.py; prevents duplicate rows on re-run.
-- Source: scored/risk_signals.csv
-- =============================================================================
CREATE TABLE IF NOT EXISTS risk_signals (
    signal_instance_id  TEXT        PRIMARY KEY,

    work_id             TEXT        NOT NULL
                                    REFERENCES works (work_id) ON DELETE CASCADE,
    signal_id           TEXT        NOT NULL,
    dimension           signal_dimension_enum NOT NULL,
    severity            signal_severity_enum  NOT NULL,
    points              INTEGER     NOT NULL CHECK (points >= 0),

    -- Human-readable evidence (stored as TEXT -- values like "63.1%" or "29 txs")
    observed_value      TEXT,
    threshold           TEXT,
    evidence_summary    TEXT,

    -- Audit
    inserted_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signals_work_id    ON risk_signals (work_id);
CREATE INDEX IF NOT EXISTS idx_signals_signal_id  ON risk_signals (signal_id);
CREATE INDEX IF NOT EXISTS idx_signals_dimension  ON risk_signals (dimension);
CREATE INDEX IF NOT EXISTS idx_signals_severity   ON risk_signals (severity);


-- =============================================================================
-- TABLE: risk_evidence
-- JSONB blob from risk_evidence.json -- one row per work.
-- Full evidence payload (including transaction vouchers) preserved as-is.
-- Do NOT flatten into columns -- evidence payload schema varies by signal.
-- Source: scored/risk_evidence.json
-- =============================================================================
CREATE TABLE IF NOT EXISTS risk_evidence (
    work_id         TEXT        PRIMARY KEY
                                REFERENCES works (work_id) ON DELETE CASCADE,
    evidence        JSONB       NOT NULL,
    inserted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_gin ON risk_evidence USING GIN (evidence);


-- =============================================================================
-- VIEW: work_risk_overview
-- Joins works + work_features + risk_scores for dashboard consumption.
-- =============================================================================
CREATE OR REPLACE VIEW work_risk_overview AS
SELECT
    w.work_id,
    w.state,
    w.constituency,
    w.lok_sabha,
    w.mp_name,
    w.work_category,
    w.work,
    w.work_description,
    w.ida,
    w.recommended_date,
    w.recommended_amount,
    w.sanction_date,
    w.sanction_amount,
    w.work_status,
    w.completion_date,
    w.amount_disbursed,
    w.data_notes,
    wf.total_expenditure,
    wf.expenditure_transaction_count,
    wf.unique_vendor_count,
    wf.duplicate_transaction_count,
    wf.duplicate_group_count,
    wf.potential_duplicate_amount_total,
    wf.days_to_sanction,
    wf.days_to_completion,
    wf.days_since_last_expenditure,
    wf.expenditure_vs_sanction_ratio,
    wf.disbursement_vs_sanction_ratio,
    wf.expenditure_exceeds_sanction,
    wf.disbursement_exceeds_sanction,
    wf.has_potential_duplicate_transaction,
    wf.high_transaction_count,
    wf.multiple_vendors,
    rs.risk_score,
    rs.risk_level,
    rs.financial_integrity_score,
    rs.transaction_pattern_score,
    rs.lifecycle_execution_score,
    rs.data_quality_score,
    rs.requires_human_review
FROM
    works w
    LEFT JOIN work_features wf ON w.work_id = wf.work_id
    LEFT JOIN risk_scores   rs ON w.work_id = rs.work_id;


-- =============================================================================
-- VIEW: state_risk_summary
-- =============================================================================
CREATE OR REPLACE VIEW state_risk_summary AS
SELECT
    w.state,
    COUNT(DISTINCT w.work_id)                                               AS total_works,
    COUNT(DISTINCT et.expenditure_id)                                       AS total_transactions,
    ROUND(AVG(rs.risk_score), 2)                                           AS avg_risk_score,
    COUNT(*) FILTER (WHERE rs.risk_level = 'High Risk')                    AS high_risk_works,
    COUNT(*) FILTER (WHERE rs.risk_level = 'Elevated Risk')                AS elevated_risk_works,
    COUNT(*) FILTER (WHERE rs.risk_level = 'Moderate')                     AS moderate_risk_works,
    COUNT(*) FILTER (WHERE rs.risk_level = 'Low / Normal')                 AS low_risk_works,
    COUNT(*) FILTER (WHERE rs.requires_human_review = TRUE)                AS human_review_required,
    SUM(w.sanction_amount)                                                  AS total_sanction_amount,
    SUM(w.amount_disbursed)                                                 AS total_disbursed,
    SUM(wf.total_expenditure)                                               AS total_expenditure,
    SUM(wf.potential_duplicate_amount_total)                                AS total_potential_duplicate_amount,
    COUNT(*) FILTER (WHERE wf.expenditure_exceeds_sanction = TRUE)         AS works_with_overrun,
    COUNT(*) FILTER (WHERE wf.has_potential_duplicate_transaction = TRUE)  AS works_with_duplicates
FROM
    works w
    LEFT JOIN work_features wf ON w.work_id = wf.work_id
    LEFT JOIN risk_scores   rs ON w.work_id = rs.work_id
    LEFT JOIN expenditure_transactions et ON w.work_id = et.work_id
GROUP BY
    w.state
ORDER BY
    avg_risk_score DESC NULLS LAST;


-- =============================================================================
-- ROW LEVEL SECURITY (RLS) -- Prototype Grade
-- service_role bypasses RLS automatically (used by ingest script)
-- anon/authenticated: read-only access to all tables and views
-- =============================================================================

ALTER TABLE works                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenditure_transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_features               ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_signals                ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_evidence               ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_runs                ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_works"
    ON works FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "anon_read_expenditure_transactions"
    ON expenditure_transactions FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "anon_read_work_features"
    ON work_features FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "anon_read_risk_scores"
    ON risk_scores FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "anon_read_risk_signals"
    ON risk_signals FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "anon_read_risk_evidence"
    ON risk_evidence FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY "anon_read_dataset_runs"
    ON dataset_runs FOR SELECT TO anon, authenticated USING (TRUE);

GRANT SELECT ON work_risk_overview  TO anon, authenticated;
GRANT SELECT ON state_risk_summary  TO anon, authenticated;
