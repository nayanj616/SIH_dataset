# Sentinel MPLADS Monitoring: Supabase Backend & Database Setup Guide

This guide details the setup, migration, and ingestion process for the **Sentinel** MPLADS database backend powered by PostgreSQL on Supabase.

---

## 1. Architectural Overview

Sentinel uses Supabase PostgreSQL as its central data warehouse and evidence store.

```
RAW EXCEL (data/raw/)
    ↓
STANDARDIZED DATA (scripts/prepare_mplads_data.py → data/processed/)
    ↓
DERIVED FEATURES (data/processed/<state>/work_features.csv)
    ↓
DETERMINISTIC RISK SCORING (scripts/sentinel_scorer.py)
    ↓
RISK EVIDENCE (data/scored/)
    ↓
SUPABASE POSTGRESQL (scripts/ingest_to_supabase.py)
    ↓
[Future] DASHBOARD (read-only anon access via views)
    ↓
[Future] AI EXPLANATION (evidence-grounded narrative generation)
```

### Critical Design Constraints Enforced in the Database:
1. **Monetary Precision**: All financial amounts use `NUMERIC(14, 2)`. Floating point types (`FLOAT`, `DOUBLE PRECISION`) are strictly prohibited to eliminate rounding drift.
2. **Missing Value Semantics**: `NULL ≠ 0`. Unrecorded dates and missing figures remain SQL `NULL`. No artificial zeroes or dummy dates are inserted.
3. **No Hard FK on `expenditure_transactions.work_id`**: In the Punjab dataset, 38 expenditure transactions (totaling ₹76,14,703 under Amritsar MP381) reference work IDs that do not exist in the Works Master. These records are marked with `expenditure_without_matching_work = TRUE`. A hard foreign key would reject these transactions and destroy forensic auditability.
4. **Duplicate Record Preservation**: Exact duplicate payments are retained in `expenditure_transactions` with `is_exact_duplicate = TRUE` and linked via `duplicate_group_id`.
5. **Idempotent Ingestion**: Every table supports upsert. Anomaly signals in `risk_signals` are assigned a deterministic SHA-256 hash (`signal_instance_id = SHA-256(work_id | signal_id | dimension | points)`) to guarantee zero duplicate signals upon re-ingestion.
6. **Flexible Evidence Store**: `risk_evidence` stores full JSONB payloads containing individual transaction vouchers and audit trails.
7. **Clean Analytical View Aggregations**: `state_risk_summary` uses Common Table Expressions (CTEs) to aggregate works and expenditure transactions independently before joining on state. This prevents 1-to-N join multiplication of work-level financial aggregates (`sanction_amount`, `amount_disbursed`, `total_expenditure`) while preserving exact transaction and orphan counts.

---

## 2. Prerequisites

- Python 3.8+ (no third-party packages required for ingestion; uses standard library `urllib.request`)
- A Supabase project (Free or Pro tier)
- Supabase Project URL (`https://<project-ref>.supabase.co`)
- Supabase Service Role Secret Key (from **Project Settings -> API**)

---

## 3. Step-by-Step Setup

### Step 3.1: Apply SQL Schema Migration

1. Open your Supabase project dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Navigate to the **SQL Editor** tab on the left navigation bar.
3. Click **New Query**.
4. Open [supabase/migrations/20260905000000_initial_schema.sql](../supabase/migrations/20260905000000_initial_schema.sql), copy its full contents, paste it into the SQL Editor, and click **Run**.
5. Verify that all 7 tables and 2 views were created successfully:
   - `dataset_runs`
   - `works`
   - `expenditure_transactions`
   - `work_features`
   - `risk_scores`
   - `risk_signals`
   - `risk_evidence`
   - `work_risk_overview` (View)
   - `state_risk_summary` (View)

---

### Step 3.2: Configure Environment Variables

Create a `.env` file in the root directory from the `.env.example` template:

```bash
cp .env.example .env
```

Edit `.env` to include your Supabase credentials:
```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
```

> **Security Note**: Never commit `.env` to source control. The service-role key bypasses Row Level Security and is strictly for backend ingestion tasks.

---

### Step 3.3: Pre-Ingestion Data Validation & Dry Run

Run the ingestion script in dry-run mode without any network calls to verify data completeness across all 15 integrity checks:

```bash
python scripts/ingest_to_supabase.py --dry-run
```

Expected output:
```text
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
```

---

### Step 3.4: Execute Ingestion

Once `.env` is configured and the schema is deployed, run the ingestion script:

```bash
python scripts/ingest_to_supabase.py
```

---

## 4. Database Schema Reference

### Core Tables

| Table | Primary Key | Foreign Key | Description |
|---|---|---|---|
| `works` | `work_id` | - | Master record of 1,000 MPLADS works across 5 states |
| `expenditure_transactions` | `expenditure_id` | - *(intentional)* | 1,386 financial payment records (includes 134 duplicates & 38 orphans) |
| `work_features` | `work_id` | `works(work_id)` | Derived analytical features computed by preprocessing pipeline |
| `risk_scores` | `work_id` | `works(work_id)` | Deterministic composite risk scores (0-100) and 4 dimension scores |
| `risk_signals` | `signal_instance_id` | `works(work_id)` | 1,142 triggered audit signals with evidence and point allocations |
| `risk_evidence` | `work_id` | `works(work_id)` | Complete JSONB evidence blobs with transaction vouchers |
| `dataset_runs` | `run_id` | - | Ingestion execution audit logs |

### Analytical Views

#### 1. `work_risk_overview`
Denormalized view joining `works`, `work_features`, and `risk_scores`. Used by frontend dashboards to display project lists, filter by risk level, and display risk scores alongside sanction amounts.

#### 2. `state_risk_summary`
Aggregates risk metrics by state cleanly via CTEs (work-level and transaction-level aggregated separately before joining):
- Total works and transactions
- Average risk score
- Work counts by risk level (`High Risk`, `Elevated Risk`, `Moderate`, `Low / Normal`)
- Count of works requiring human review
- Total sanctioned, disbursed, and recorded expenditure amounts
- Potential duplicate payment amounts per state
- Orphan transaction count and amount per state

---

## 5. Row Level Security (RLS) Policy

- **`service_role`**: Full read/write access (used by `ingest_to_supabase.py` and administrative jobs).
- **`anon` / `authenticated`**: Read-only (`SELECT`) access to tables and analytical views. Write operations (`INSERT`, `UPDATE`, `DELETE`) are blocked.

---

## 6. Verification Queries (Run in Supabase SQL Editor)

Verify row counts after ingestion:
```sql
SELECT
    (SELECT count(*) FROM works)                    AS works_count,
    (SELECT count(*) FROM expenditure_transactions) AS tx_count,
    (SELECT count(*) FROM work_features)            AS features_count,
    (SELECT count(*) FROM risk_scores)              AS scores_count,
    (SELECT count(*) FROM risk_signals)             AS signals_count,
    (SELECT count(*) FROM risk_evidence)            AS evidence_count;
-- Expected: 1000 | 1386 | 1000 | 1000 | 1142 | 1000
```

Verify state risk summary view:
```sql
SELECT
    state,
    total_works,
    total_transactions,
    avg_risk_score,
    total_sanction_amount,
    total_expenditure,
    total_potential_duplicate_amount,
    orphan_transaction_count,
    orphan_transaction_amount
FROM state_risk_summary;
```

Verify national totals from view:
```sql
SELECT
    sum(total_works)                        AS national_works,
    sum(total_transactions)                 AS national_transactions,
    sum(total_sanction_amount)              AS national_sanction_amount,
    sum(total_expenditure)                  AS national_recorded_expenditure,
    sum(total_potential_duplicate_amount)   AS national_potential_duplicate_amount,
    sum(orphan_transaction_count)           AS national_orphan_transactions,
    sum(orphan_transaction_amount)          AS national_orphan_amount
FROM state_risk_summary;
-- Expected:
-- national_works: 1000
-- national_transactions: 1386
-- national_sanction_amount: 693405258.00 (₹69,34,05,258)
-- national_recorded_expenditure: 386222858.00 (₹38,62,22,858)
-- national_potential_duplicate_amount: 4404754.00 (₹44,04,754)
-- national_orphan_transactions: 38
-- national_orphan_amount: 7614703.00 (₹76,14,703)
```
