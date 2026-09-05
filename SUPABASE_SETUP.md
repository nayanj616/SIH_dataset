# Sentinel MPLADS Monitoring: Supabase Backend & Database Setup Guide

This guide details the setup, migration, and ingestion process for the **Sentinel** MPLADS database backend powered by PostgreSQL on Supabase.

---

## 1. Architectural Overview

Sentinel uses Supabase PostgreSQL as its central data warehouse and evidence store.

`
RAW EXCEL
    v
STANDARDIZED DATA (prepare_mplads_data.py)
    v
DERIVED FEATURES (work_features.csv)
    v
DETERMINISTIC RISK SCORING (sentinel_scorer.py)
    v
RISK EVIDENCE (work_risk_scores.csv, risk_signals.csv, risk_evidence.json)
    v
SUPABASE POSTGRESQL (scripts/ingest_to_supabase.py)
    v
[Future] DASHBOARD (read-only anon access via views)
    v
[Future] AI EXPLANATION (evidence-grounded narrative generation)
`

### Critical Design Constraints Enforced in the Database:
1. **Monetary Precision**: All financial amounts use NUMERIC(14, 2). Floating point types (FLOAT, DOUBLE PRECISION) are strictly prohibited to eliminate rounding drift.
2. **Missing Value Semantics**: NULL != 0. Unrecorded dates and missing figures remain SQL NULL. No artificial zeroes or dummy dates are inserted.
3. **No Hard FK on expenditure_transactions.work_id**: In the Punjab dataset, 38 expenditure transactions (totaling Rs 76,14,703 under Amritsar MP381) reference work IDs that do not exist in the Works Master. These records are marked with expenditure_without_matching_work = TRUE. A hard foreign key would reject these transactions and destroy forensic auditability.
4. **Duplicate Record Preservation**: Exact duplicate payments are retained in expenditure_transactions with is_exact_duplicate = TRUE and linked via duplicate_group_id.
5. **Idempotent Ingestion**: Every table supports upsert. Anomaly signals in 
isk_signals are assigned a deterministic SHA-256 hash (signal_instance_id = SHA-256(work_id | signal_id | dimension | points)) to guarantee zero duplicate signals upon re-ingestion.
6. **Flexible Evidence Store**: 
isk_evidence stores full JSONB payloads containing individual transaction vouchers and audit trails.

---

## 2. Prerequisites

- Python 3.8+ (no third-party packages required for ingestion; uses standard library urllib.request)
- A Supabase project (Free or Pro tier)
- Supabase Project URL (https://<project-ref>.supabase.co)
- Supabase Service Role Secret Key (from **Project Settings -> API**)

---

## 3. Step-by-Step Setup

### Step 3.1: Apply SQL Schema Migration

1. Open your Supabase project dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Navigate to the **SQL Editor** tab on the left navigation bar.
3. Click **New Query**.
4. Open [supabase/migrations/20260905000000_initial_schema.sql](supabase/migrations/20260905000000_initial_schema.sql), copy its full contents, paste it into the SQL Editor, and click **Run**.
5. Verify that all 7 tables and 2 views were created successfully:
   - dataset_runs
   - works
   - expenditure_transactions
   - work_features
   - 
isk_scores
   - 
isk_signals
   - 
isk_evidence
   - work_risk_overview (View)
   - state_risk_summary (View)

*(Alternative using Supabase CLI)*:
`ash
supabase db push
`

---

### Step 3.2: Configure Environment Variables

Create a .env file in the root directory from the .env.example template:

`ash
cp .env.example .env
`

Edit .env to include your Supabase credentials:
`env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
`

> **Security Note**: Never commit .env to source control. The service-role key bypasses Row Level Security and is strictly for backend ingestion tasks.

---

### Step 3.3: Pre-Ingestion Data Validation & Dry Run

You can run the ingestion script in dry-run mode without any network calls to verify data completeness across all 15 integrity checks:

`ash
python scripts/ingest_to_supabase.py --dry-run
`

Expected output:
`	ext
======================================================================
SENTINEL 15-POINT PRE-INGESTION / DATABASE VALIDATION SUITE
======================================================================
[PASS] 1. Works count = 1,000                         | Actual: 1000 (Unique: 1000)
[PASS] 2. Exactly 5 states                            | Actual: ['Andhra Pradesh', 'Madhya Pradesh', 'Punjab', 'Telangana', 'Uttarakhand']
[PASS] 3. Expenditure transactions = 1,386            | Actual: 1386
[PASS] 4. Risk scores = 1,000                         | Actual: 1000
[PASS] 5. Risk evidence = 1,000                       | Actual: 1000
[PASS] 6. Risk signals = 1,142                        | Actual: 1142
[PASS] 7. Duplicate transaction flags intact          | Actual: 134 duplicate rows
[PASS] 8. Punjab unmatched transactions preserved     | Actual: 38 orphan txs
[PASS] 9. No works deleted due to NULL values         | Actual: 200/200 AP works with NULL rec_date
[PASS] 10. No transactions deleted due to dup status  | Actual: 1386 txs present
[PASS] 11. Every risk_score work_id in works          | Missing: 0
[PASS] 12. Every risk_signal work_id in works         | Missing: 0
[PASS] 13. Every risk_evidence work_id in works       | Missing: 0
[PASS] 14. Exactly 1 risk score per work              | Scores: 1000, Works: 1000
[PASS] 15. Exactly 1 risk_evidence per work           | Evidence: 1000, Works: 1000
======================================================================
ALL 15 INTEGRITY CHECKS PASSED PERFECTLY.
======================================================================
`

---

### Step 3.4: Execute Ingestion

Once .env is configured and the schema is deployed, run the ingestion script:

`ash
python scripts/ingest_to_supabase.py
`

The script will:
1. Parse and validate all 5 states' processed CSVs and scored artifacts.
2. Upsert rows into works, expenditure_transactions, work_features, 
isk_scores, 
isk_signals, and 
isk_evidence in batches.
3. Log run metadata into dataset_runs.

---

## 4. Database Schema Reference

### Core Tables

| Table | Primary Key | Foreign Key | Description |
|---|---|---|---|
| works | work_id | - | Master record of 1,000 MPLADS works across 5 states |
| expenditure_transactions | expenditure_id | - *(intentional)* | 1,386 financial payment records (includes 134 duplicates & 38 orphans) |
| work_features | work_id | works(work_id) | Derived analytical features computed by preprocessing pipeline |
| 
isk_scores | work_id | works(work_id) | Deterministic composite risk scores (0-100) and 4 dimension scores |
| 
isk_signals | signal_instance_id | works(work_id) | 1,142 triggered audit signals with evidence and point allocations |
| 
isk_evidence | work_id | works(work_id) | Complete JSONB evidence blobs with transaction vouchers |
| dataset_runs | 
un_id | - | Ingestion execution audit logs |

### Analytical Views

#### 1. work_risk_overview
Denormalized view joining works, work_features, and 
isk_scores. Used by frontend dashboards to display project lists, filter by risk level, and display risk scores alongside sanction amounts.

#### 2. state_risk_summary
Aggregates risk metrics by state:
- Total works and transactions
- Average risk score
- Work counts by risk level (High Risk, Elevated Risk, Moderate, Low / Normal)
- Count of works requiring human review
- Total sanctioned, disbursed, and expenditure amounts
- Potential duplicate payment amounts per state

---

## 5. Row Level Security (RLS) Policy

- **service_role**: Full read/write access (used by ingest_to_supabase.py and administrative jobs).
- **non / uthenticated**: Read-only (SELECT) access to tables and analytical views. Write operations (INSERT, UPDATE, DELETE) are blocked.

---

## 6. Verification Queries (Run in Supabase SQL Editor)

Verify row counts after ingestion:
`sql
SELECT
    (SELECT count(*) FROM works)                    AS works_count,
    (SELECT count(*) FROM expenditure_transactions) AS tx_count,
    (SELECT count(*) FROM work_features)            AS features_count,
    (SELECT count(*) FROM risk_scores)              AS scores_count,
    (SELECT count(*) FROM risk_signals)             AS signals_count,
    (SELECT count(*) FROM risk_evidence)            AS evidence_count;
-- Expected: 1000 | 1386 | 1000 | 1000 | 1142 | 1000
`

Verify state risk summary view:
`sql
SELECT state, total_works, avg_risk_score, high_risk_works, total_potential_duplicate_amount
FROM state_risk_summary;
`

Verify orphan transactions preservation:
`sql
SELECT count(*) AS orphan_count, sum(fund_disbursed_amount) AS orphan_amount
FROM expenditure_transactions
WHERE expenditure_without_matching_work = TRUE;
-- Expected: 38 rows | Rs 76,14,703.00
`
