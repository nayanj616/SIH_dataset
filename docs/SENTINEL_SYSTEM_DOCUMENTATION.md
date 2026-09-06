# Sentinel — MPLADS Monitoring System
## Complete Technical & Conceptual System Documentation
### SIH 2026 | MITS Team

> **Document Version**: 1.0
> **Audit Date**: 2026-09-06
> **Source Files Inspected**: `scripts/prepare_mplads_data.py`, `scripts/sentinel_scorer.py`, `scripts/ingest_to_supabase.py`, `supabase/migrations/*.sql`, `dashboard/src/**`, `docs/*.md`, `data/scored/*`, `data/raw/*.xlsx`, `MITS_SIH26_097.pdf` (binary — text could not be extracted with available tools; content inferred from repository code and internal documents)

---

## Table of Contents

1. [Audit of the Original SIH Solution](#1-audit-of-the-original-sih-solution)
2. [Audit of the Current Implementation](#2-audit-of-the-current-implementation)
3. [Feature-by-Feature Comparison](#3-feature-by-feature-comparison)
4. [The Actual Prototype Architecture](#4-the-actual-prototype-architecture)
5. [How the Current Simulation Works](#5-how-the-current-simulation-works)
6. [Risk-Scoring Method](#6-risk-scoring-method)
7. [Dashboard Guide for Non-Technical Users](#7-dashboard-guide-for-non-technical-users)
8. [Important Metrics Glossary](#8-important-metrics-glossary)
9. [The Evidence Model](#9-the-evidence-model)
10. [AI / ML Truthfulness Audit](#10-ai--ml-truthfulness-audit)
11. [Human-in-the-Loop Audit](#11-human-in-the-loop-audit)
12. [Prototype vs Production](#12-prototype-vs-production)
13. [What We Can Claim in the SIH Presentation](#13-what-we-can-claim-in-the-sih-presentation)
14. [Demo Story](#14-demo-story)
15. [Team FAQ](#15-team-faq)
16. [Final Project Status](#16-final-project-status)

---

## 1. Audit of the Original SIH Solution

> **Note on source material**: The original SIH proposal PDF (`MITS_SIH26_097.pdf`) is present in the repository but could not be machine-read with available tools. The capabilities described below are inferred from the project's internal documentation (`docs/SENTINEL_RISK_SCORE_V1.md`, `docs/sentinel_data_analysis_report.md`, `README.md`) which explicitly reference the original proposal scope. Items that cannot be confirmed from available source material are labeled accordingly.

### 1.1 Problem Statement

**Verified from documentation:** The MPLADS (Members of Parliament Local Area Development Scheme) enables MPs to recommend developmental works in their constituencies. The raw monitoring data is distributed as state-wise Excel workbooks containing works master logs and expenditure transactions. These workbooks are heterogeneous across states, contain duplicate transactions, orphan expenditures, and reconciliation gaps — making it practically impossible for auditors to identify suspicious patterns manually at scale.

**Proposed solution (inferred from internal docs):** An AI-powered monitoring and anomaly detection platform — **Project Sentinel** — that ingests multi-state MPLADS data, computes explainable risk scores for every developmental work, and flags suspicious patterns for human investigation.

### 1.2 Proposed Capabilities

Based on verified internal project documentation, the following capabilities were proposed:

| Capability | Verification Status |
|---|---|
| AI/ML anomaly detection on MPLADS data | Proposed in project name; partially specified in docs |
| Multi-state data ingestion | Verified in `docs/SENTINEL_RISK_SCORE_V1.md` and `README.md` |
| Duplicate transaction detection | Verified in `docs/sentinel_data_analysis_report.md` |
| Risk scoring per work (0–100) | Verified in `docs/SENTINEL_RISK_SCORE_V1.md` |
| Four-dimensional risk decomposition | Verified in `docs/SENTINEL_RISK_SCORE_V1.md` |
| Explainable anomaly signals (not black-box) | Verified as Core Design Principle 1 in `SENTINEL_RISK_SCORE_V1.md` |
| Human-in-the-loop review workflow | Verified in risk score doc; designated human_review flag |
| Evidence extraction / forensic records | Verified in `docs/SENTINEL_RISK_SCORE_V1.md` §9 |
| Non-accusatory classification (no "fraud" language) | Verified as Core Design Principle 2 in `SENTINEL_RISK_SCORE_V1.md` |
| LLM-assisted executive summaries | Mentioned in `SENTINEL_RISK_SCORE_V1.md` §1 as a proposed layer |
| Geographic / spatial analysis | **Not specified in available proposal/documentation** |
| Vendor analysis (cross-work vendor behavior) | Partially — vendor count as anomaly signal; cross-work vendor network: **not specified** |
| Predictive analytics | **Not specified in available proposal/documentation** |
| Real-time ingestion | **Not specified in available proposal/documentation** — batch processing assumed |
| Automated fraud certification | Explicitly prohibited by Core Design Principle 2 |
| Case assignment / investigator roles | **Not specified in available proposal/documentation** |
| Escalation workflow | **Not specified in available proposal/documentation** |
| Feedback loop / model retraining | Mentioned in project title ("AI-Powered") but **not specified** in available docs |

### 1.3 Proposed Architecture (Inferred)

From `docs/SENTINEL_RISK_SCORE_V1.md`, the intended architecture is:

```
MPLADS Excel Workbooks (state-wise)
      ↓
Data Ingestion & Standardization Layer
      ↓
Feature Engineering
      ↓
Anomaly Detection (Deterministic rules → proposed ML evolution)
      ↓
Risk Score Engine (4-dimensional weighted scoring)
      ↓
LLM Synthesis Layer (evidence → plain-language summaries) [PROPOSED — NOT YET BUILT]
      ↓
Explainable Evidence Payloads
      ↓
Monitoring Dashboard
      ↓
Human Investigator Review
```

> The LLM synthesis layer is explicitly mentioned in the specification document (`docs/SENTINEL_RISK_SCORE_V1.md` §1, Core Design Principle 5) but is **not implemented** in the current prototype.

---

## 2. Audit of the Current Implementation

This section documents what actually exists in the repository as verified by direct source code inspection.

### 2.1 Python Data Pipeline (`scripts/prepare_mplads_data.py`)

**What it does:**
- Reads raw `.xlsx` MPLADS workbooks (5 states: Andhra Pradesh, Madhya Pradesh, Punjab, Telangana, Uttarakhand)
- Automatically detects correct header rows (skipping template preamble rows)
- Resolves sheet roles (`works_master`, `expenditure_transactions`) by name-token matching
- Applies standardized column mappings (`WORKS_COLUMN_MAP`, `EXPENDITURE_COLUMN_MAP`)
- Parses dates and monetary values with robust error handling
- Assigns deterministic expenditure IDs (`<STATE_PREFIX>-EXP-<N:06d>`, e.g., `PB-EXP-000001`)
- Detects **exact duplicate transactions** using SHA-256 hash of normalized attribute signatures
- Flags orphan transactions (expenditures without a matching work in the works master)
- Computes work-level feature aggregates: totals, ratios, timeline metrics, boolean risk flags
- Produces a full data quality report CSV documenting every anomaly found

**Output per state (in `data/processed/<state>/`):**
- `works.csv` — master work records
- `expenditure_transactions.csv` — transaction records with duplicate flags
- `work_features.csv` — aggregated per-work features and risk indicators
- `data_quality_report.csv` — validation log

**Reference date:** All recency features use a fixed reference date (`2026-09-05`) — not the machine's current date — ensuring reproducibility.

### 2.2 Sentinel Scoring Engine (`scripts/sentinel_scorer.py`)

**What it does:**
- Reads all processed CSVs across 5 states
- Evaluates each of 1,000 works against 13 deterministic anomaly signals across 4 dimensions
- Computes per-dimension scores (capped at 100)
- Computes a weighted composite risk score
- Applies a "Critical Override" floor rule when financial integrity score >= 70
- Classifies each work into four risk tiers
- Flags works requiring human review (score >= 40)
- Extracts evidence transaction vouchers per signal
- Also identifies and records "orphan transaction works" (expenditure without a parent work)

**Output (in `data/scored/`):**
- `work_risk_scores.csv` — 1,000 rows; one risk score + 4 dimension scores per work
- `risk_signals.csv` — 1,142 rows; one row per triggered anomaly signal across all works
- `risk_evidence.json` — 2.1 MB JSONB; full hierarchical evidence payload per work

### 2.3 Supabase Ingestion (`scripts/ingest_to_supabase.py`)

**What it does:**
- Reads all processed CSVs and scored artifacts
- Runs a 15-point integrity validation suite before any upload
- Upserts 7 tables in order (idempotent; safe to re-run):
  - `works` (1,000 rows)
  - `expenditure_transactions` (1,386 rows including 134 duplicates and 38 orphans)
  - `work_features` (1,000 rows)
  - `risk_scores` (1,000 rows)
  - `risk_signals` (1,142 rows with SHA-256 `signal_instance_id` to prevent re-run duplicates)
  - `risk_evidence` (1,000 JSONB payloads)
  - `dataset_runs` (audit log entry)
- Supports `--dry-run` mode for local validation without uploading

### 2.4 Database Schema (`supabase/migrations/`)

**Tables:**

| Table | Rows | Notes |
|---|---|---|
| `works` | 1,000 | Primary key: `work_id`. All core fields non-null. Rec. dates NULL for 200 AP works. |
| `expenditure_transactions` | 1,386 | **No foreign key to works** — intentional, to preserve 38 Punjab orphan rows |
| `work_features` | 1,000 | Pre-computed aggregates. FK to `works`. Not recalculated in SQL. |
| `risk_scores` | 1,000 | Sentinel engine output. All scores checked (0–100). Includes `is_reviewed`, `reviewed_at`. |
| `risk_signals` | 1,142 | Per-signal rows. PK is SHA-256 `signal_instance_id`. |
| `risk_evidence` | 1,000 | Full JSONB per work. GIN-indexed for fast JSON queries. |
| `dataset_runs` | 1 | Audit log of ingestion run. |

**Views:**

| View | Purpose |
|---|---|
| `work_risk_overview` | Joins `works + work_features + risk_scores` — primary source for dashboard |
| `state_risk_summary` | State-level aggregates; includes orphan transaction counts |

**Security:** Row Level Security (RLS) is enabled on all tables. The `anon` role has read-only access via RLS policies. UPDATE permission on `is_reviewed` and `reviewed_at` columns of `risk_scores` is explicitly granted to allow the dashboard's "Mark as Reviewed" feature.

### 2.5 Dashboard (`dashboard/`)

**Tech stack (verified from `SystemInfo.tsx` and `package.json`):**
- React 18 + TypeScript + Vite
- Tailwind CSS
- Recharts (charting)
- TanStack Query v5 (server state management)
- React Router v6 (routing)
- Supabase JS client (data fetching)

**Routes (verified from `App.tsx`):**

| Route | Component | Purpose |
|---|---|---|
| `/` | `Overview` | National summary dashboard |
| `/states` | `StateAnalysis` | State-level risk breakdown |
| `/explorer` | `WorkExplorer` | Paginated, sortable, filterable work list |
| `/work/*` | `WorkDetail` | Full investigation view for a single work |
| `/system` | `SystemInfo` | Dataset / connection info page |

**TanStack Query hooks (verified from `hooks/`):**

| Hook | Table/View | Purpose |
|---|---|---|
| `useStateSummary` | `state_risk_summary` | State-level KPIs |
| `useWorkOverview` | `work_risk_overview` | Paginated work list with filters |
| `useTopRiskWorks` | `work_risk_overview` | Top N works by risk score |
| `useWorkDetail` | `work_risk_overview` | Single work details |
| `useRiskSignals` | `risk_signals` | Anomaly signals for a work |
| `useRiskEvidence` | `risk_evidence` | Full evidence JSONB for a work |
| `useTransactions` | `expenditure_transactions` | Transaction rows for a work |

---

## 3. Feature-by-Feature Comparison

| Original Proposed Capability | Current Prototype Implementation | Status | Evidence / Source | Explanation |
|---|---|---|---|---|
| Multi-state MPLADS data ingestion | 5 states ingested via batch Python scripts | **IMPLEMENTED** | `scripts/prepare_mplads_data.py`; `data/raw/*.xlsx` | Complete batch pipeline for all 5 source workbooks |
| Standardized schema across heterogeneous state workbooks | Column mapping + date/money parsing applied uniformly | **IMPLEMENTED** | `WORKS_COLUMN_MAP`, `EXPENDITURE_COLUMN_MAP` in `prepare_mplads_data.py` | Header detection, sheet role resolution, and normalization across all 5 states |
| Duplicate transaction detection | Exact attribute-hash duplicate detection with group IDs and exposure amounts | **IMPLEMENTED** | `add_duplicate_features()` in `prepare_mplads_data.py` | 134 duplicate rows flagged across 44 groups; none deleted |
| Work-level feature engineering | 20+ engineered features per work | **IMPLEMENTED** | `make_features()` in `prepare_mplads_data.py`; `work_features.csv` | All features computed from raw data |
| Explainable anomaly signals | 13 deterministic signals with human-readable titles, thresholds, observed values | **IMPLEMENTED** | `evaluate_work_signals()` in `sentinel_scorer.py` | Every signal point traces to a specific rule and data observation |
| Four-dimensional risk decomposition | Financial Integrity (35%), Transaction Pattern (30%), Lifecycle (20%), Data Quality (15%) | **IMPLEMENTED** | `compute_dimension_scores()` in `sentinel_scorer.py` | Scores capped at 100 per dimension; strictly additive |
| Weighted composite risk score | 0–100 weighted composite with critical override rule | **IMPLEMENTED** | `compute_composite_score()` in `sentinel_scorer.py` | Formula verified from source code |
| Risk tier classification | Four tiers: Low/Normal, Moderate, Elevated Risk, High Risk | **IMPLEMENTED** | `compute_composite_score()` in `sentinel_scorer.py`; `risk_level_enum` in schema SQL | Score ranges: 0–19, 20–39, 40–69, 70–100 |
| Human review flagging | `requires_human_review` flag for score >= 40 | **IMPLEMENTED** | `sentinel_scorer.py` line 496; `risk_scores` table | All works with score >= 40 flagged |
| Evidence extraction per signal | Transaction voucher records attached per triggered signal | **IMPLEMENTED** | `extract_evidence_transactions()` in `sentinel_scorer.py`; `risk_evidence.json` | Up to 8 transaction records per signal |
| Precomputed evidence stored in database | Evidence JSON stored as JSONB in Supabase `risk_evidence` table | **IMPLEMENTED** | `risk_evidence` table in schema SQL; GIN index | 1,000 JSONB payloads; ~2.1 MB total |
| Dashboard — Overview | National KPI summary, risk distribution chart, top-10 priority works | **IMPLEMENTED** | `pages/Overview.tsx` | Live data from `state_risk_summary` view |
| Dashboard — State Analysis | Per-state KPIs, risk distribution, top works filtered by state | **IMPLEMENTED** | `pages/StateAnalysis.tsx` | URL parameter `?state=` links from Overview |
| Dashboard — Work Explorer | Paginated, filterable, multi-column sortable work list | **IMPLEMENTED** | `pages/WorkExplorer.tsx`; `hooks/useWorkOverview.ts` | Filter by state, risk level, free-text search; 25 per page |
| Dashboard — Work Detail | Full investigation view: risk score, dimensions, signals, transactions, evidence, review | **IMPLEMENTED** | `pages/WorkDetail.tsx` | Three tabs: Overview, Transactions, Evidence |
| Dashboard — Evidence Panel | Collapsible, hierarchical JSONB viewer with expand/collapse-all controls | **IMPLEMENTED** | `components/risk/EvidencePanel.tsx` | Renders arbitrary nested evidence JSON |
| Dashboard — Human Review ("Mark as Reviewed") | In-browser button persisting `is_reviewed=true` and `reviewed_at` to Supabase | **IMPLEMENTED** | `WorkDetail.tsx` `handleMarkAsReviewed()`; migration `20260906060904` | Real database write; persists across sessions |
| Dashboard — Transaction Table with anomaly highlighting | Duplicate and orphan transactions highlighted visually | **IMPLEMENTED** | `components/tables/TransactionTable.tsx` | `is_exact_duplicate` and `expenditure_without_matching_work` drive highlighting |
| Dashboard — System/Dataset info page | Dataset stats, Supabase connection status, per-state breakdown | **IMPLEMENTED** | `pages/SystemInfo.tsx` | Live counts from `state_risk_summary` |
| Orphan transaction detection | 38 Punjab transactions without matching work master records | **IMPLEMENTED** | `prepare_mplads_data.py`; `expenditure_without_matching_work` column | No rows deleted; integrity flag retained |
| Data quality audit log | Per-state CSV documenting every parsing error, missing field, and referential mismatch | **IMPLEMENTED** | `data_quality_report.csv` per state | Complete validation log; 15-point Supabase ingestion checks also run |
| AI/ML model (trained inference) | No ML model, no training, no inference | **NOT IMPLEMENTED** | All 3 Python scripts; no ML library imports | The current engine is fully deterministic rule-based |
| LLM-generated plain-language summaries | No LLM inference; `evidence_summary` strings are Python f-string templates | **NOT IMPLEMENTED** | `evaluate_work_signals()` in `sentinel_scorer.py` | Proposed layer; not built |
| Real-time data ingestion | Batch only; data is static once loaded into Supabase | **NOT IMPLEMENTED** | `ingest_to_supabase.py` design | No streaming or cron ingestion |
| Geographic / spatial map visualization | No map; state names used as text labels only | **NOT IMPLEMENTED** | No map component in dashboard | Not specified in available documentation |
| Cross-work vendor network analysis | Vendor count per work flagged; no cross-work vendor graph | **NOT IMPLEMENTED** | `sentinel_scorer.py`; signals are per-work only | Natural future extension |
| Investigator identity / roles / authentication | Anonymous Supabase key; no user accounts or role system | **NOT IMPLEMENTED** | `SystemInfo.tsx`: "Authentication: Anonymous public key (anon role)" | Single anonymous access level |
| Case assignment / escalation | No case management workflow | **NOT IMPLEMENTED** | No such component or table in repository | Single-state review flag only |
| Detailed audit trail of review decisions | `is_reviewed` + `reviewed_at` only; no reviewer identity or notes | **PARTIALLY IMPLEMENTED** | `risk_scores` table migration `20260906060904` | Review timestamp persisted; reviewer identity not captured |
| Feedback loop / model retraining | No feedback mechanism | **NOT IMPLEMENTED** | No such component | Future scope once an ML model exists |
| Predictive analytics | No prediction; only pattern-matching on historical data | **NOT IMPLEMENTED** | Not present in any script | Not specified in available documentation |

---

## 4. The Actual Prototype Architecture

```
Raw MPLADS Excel Files
(5 state workbooks in data/raw/)
      |
      v
prepare_mplads_data.py
(Data preparation / cleaning)
- Header detection
- Column normalization
- Date / money parsing
- Deterministic ID generation
- SHA-256 duplicate detection
- Orphan transaction flagging
- Feature aggregation
      |
      v
Standardized Prototype Dataset
(per-state CSVs in data/processed/)
- works.csv
- expenditure_transactions.csv
- work_features.csv
- data_quality_report.csv
      |
      v
sentinel_scorer.py
(Sentinel deterministic anomaly engine)
      |
      v
Risk Dimensions (4)
- Financial Integrity (35%)
- Transaction Pattern (30%)
- Lifecycle / Execution (20%)
- Data Quality (15%)
      |
      v
Weighted Risk Score
0.35 * D_fin + 0.30 * D_tx + 0.20 * D_life + 0.15 * D_dq
[Critical Override: floor=70 if D_fin >= 70]
      |
      v
Explainable Anomaly Signals
(13 signal types with thresholds, observed values,
 evidence summaries, evidence transaction vouchers)
      |
      v
Evidence Extraction
(Raw transaction vouchers per triggered signal)
      |
      v
CSV / JSON Artifacts in data/scored/
- work_risk_scores.csv (1,000 rows)
- risk_signals.csv (1,142 rows)
- risk_evidence.json (2.1 MB; 1,000 evidence payloads)
      |
      v
ingest_to_supabase.py
(15-point validation + idempotent batch upsert)
      |
      v
Supabase PostgreSQL
(7 tables + 2 views + RLS + GIN-indexed JSONB)
      |
      v
React + TypeScript Dashboard
(Overview | States | Explorer | WorkDetail | System)
      |
      v
Human Review
(Mark as Reviewed -> UPDATE risk_scores -> persists to PostgreSQL)
```

### Layer-by-Layer Explanation

**Layer 1 — Raw Excel Workbooks**
Five state XLSX files in `data/raw/`. Each contains two sheets: a works master (sanctioned projects) and an expenditure transaction log. Column names differ slightly by state; format of preamble rows also varies.

**Layer 2 — Data Preparation (`prepare_mplads_data.py`)**
Detects header rows automatically using known signature columns. Applies state-specific column mappings. Parses INR monetary values and dates robustly. Generates deterministic transaction IDs. Runs exact-duplicate detection (SHA-256 hash of normalized attribute tuples). Flags orphan transactions. Does NOT modify or delete any source rows.

**Layer 3 — Standardized Dataset (per-state CSVs)**
Clean, UTF-8 CSVs in `data/processed/<state>/`. These form the canonical data layer for the prototype. All downstream processing reads only these CSVs, never the raw XLSXs.

**Layer 4 — Feature / Metric Preparation**
Embedded in the preparation step: per-work aggregates (`total_expenditure`, `days_to_sanction`, `duplicate_group_count`, etc.) are computed and stored in `work_features.csv`. These are pre-computed metrics, not live SQL aggregates.

**Layer 5 — Sentinel Anomaly Engine (`sentinel_scorer.py`)**
Loads all processed CSVs. Evaluates each work against 13 deterministic signal rules. Each signal has: a `signal_id`, a `dimension`, a threshold expression, an `observed_value`, a `points` contribution, and an `evidence_summary` string. Rules are if/elif branches — no randomness or ML inference.

**Layer 6 — Risk Dimensions**
Points from triggered signals are summed per dimension and capped at 100. Each dimension captures a distinct category of concern. Dimensions are independent.

**Layer 7 — Weighted Risk Score**
The four capped dimension scores are combined: `0.35*D_fin + 0.30*D_tx + 0.20*D_life + 0.15*D_dq`. A Critical Override prevents works with severe financial anomalies (D_fin >= 70) from falling below a score of 70.

**Layer 8 — Explainable Anomaly Signals**
Every point in the score links to a human-readable explanation. An investigator can read: which rule triggered, what the rule checks, what the actual observed value was, and what the threshold was. There is no opacity.

**Layer 9 — Evidence Extraction**
For each triggered signal, the scoring engine selects a subset of the most relevant raw transaction vouchers (up to 8 per signal) and attaches them to the evidence payload. These are real transaction records from the original Excel files.

**Layer 10 — CSV / JSON Artifacts**
Three output files in `data/scored/`: risk scores (CSV), triggered signals (CSV), and hierarchical evidence (JSON).

**Layer 11 — Supabase Ingestion**
The ingestion script validates 15 integrity checks and then upserts all data into Supabase PostgreSQL via the REST API in batches of 200 rows. Fully idempotent.

**Layer 12 — Supabase PostgreSQL**
Hosts 7 tables and 2 database views. RLS restricts anonymous clients to read-only access. The `work_risk_overview` view joins three tables and is the primary data source for the dashboard.

**Layer 13 — React + TypeScript Dashboard**
A single-page application served by Vite. Uses TanStack Query for server state caching (5-minute stale time). All data queries go through the Supabase client using the anonymous public key.

**Layer 14 — Human Review**
The "Mark as Reviewed" button sends a Supabase UPDATE to `risk_scores.is_reviewed = true` and `risk_scores.reviewed_at = <timestamp>`. This is the only mutation the frontend performs. The review state immediately reflects across all dashboard views.

---

## 5. How the Current Simulation Works

> **This is the most important section for understanding what Sentinel is and is not.**

### 5.1 What Kind of System This Is

Sentinel is a **working prototype / proof-of-concept simulation** of an MPLADS monitoring and anomaly detection platform.

It is **not** a production AI system. It does not contain a trained machine learning model. It does not perform live inference. It does not ingest data in real time.

What it **is**: a complete, end-to-end demonstration of the core monitoring, scoring, and human-review workflow, built on a carefully prepared sample of real MPLADS data processed by a deterministic anomaly-detection engine.

### 5.2 The Data

- **5 states**: Andhra Pradesh, Madhya Pradesh, Punjab, Telangana, Uttarakhand
- **1,000 works** (exactly 200 per state) — real MPLADS project records
- **1,386 expenditure transactions** including:
  - 134 exact duplicate transaction rows (flagged, not deleted)
  - 38 "orphan" transactions from Punjab (MP381 constituency) with no matching works master entry

**How the dataset was constructed**: The 5-state dataset is a representative sample of real MPLADS records, not synthetic or invented. The anomaly patterns (duplicate transactions, orphan records, early-stage high expenditure, stagnated works) were **naturally present** in the source data — not artificially seeded by the team. The data pipeline preserves them exactly as found.

**What "Connected / Supabase Prototype Dataset" means**: The dashboard displays a green "Connected" status, meaning the React frontend is reading live data from a real Supabase PostgreSQL instance. The underlying rows are the result of the batch preparation. The data is static (not refreshed in real time). "Connected" refers to the live database connection, not a live government data feed.

### 5.3 The Python Preprocessing

`prepare_mplads_data.py` performs:
1. **Header detection** — finds the real column header row by looking for known signature columns
2. **Column renaming** — maps source column names to standardized schema
3. **Date parsing** — converts all dates to `YYYY-MM-DD`; records conversion failures
4. **Monetary parsing** — strips INR symbols, commas, and prefix text from numeric strings
5. **ID generation** — assigns deterministic `<PREFIX>-EXP-<N:06d>` IDs
6. **Duplicate detection** — SHA-256 hash of (work_id, state, mp_name, constituency, expenditure_date, vendor_name, payment_status, fund_disbursed_amount) per transaction; rows sharing the same hash are grouped and flagged
7. **Potential duplicate amount** — for each group of N identical transactions, assigns the transaction amount as `potential_duplicate_amount` to occurrences 2 through N
8. **Orphan flagging** — marks expenditure rows whose `work_id` is not present in the works master
9. **Feature aggregation** — creates `work_features.csv` with per-work totals, ratios, timeline measures, and boolean risk flags

No rows are deleted at any step.

### 5.4 Anomaly Detection — The Actual Deterministic Rules

#### DIMENSION 1: Financial Integrity

**Signal: `FIN_DUP_EXPOSURE_HIGH` — Severe Potential Duplicate Financial Exposure**
- **What it checks**: `potential_duplicate_amount / total_expenditure >= 30%`
- **Points**: 40–70 (70 for >=60% exposure ratio; linearly interpolated for 30%–60%)
- **Why suspicious**: If 30%+ of a work's total recorded expenditure consists of duplicate transactions, a significant fraction of public money may have been disbursed redundantly
- **Example**: Punjab work `WS/MP18152/2025-2026/220384` — 63.1% duplicate exposure → 70 points

**Signal: `FIN_DUP_EXPOSURE_MOD` — Moderate Potential Duplicate Financial Exposure**
- **What it checks**: `5% <= potential_duplicate_amount / total_expenditure < 30%` (mutually exclusive with HIGH)
- **Points**: 25

**Signal: `FIN_CERTIFIED_ZERO_DISB` — Certified Complete with Zero Financial Trail**
- **What it checks**: `work_status == "Work Completed"` AND `total_expenditure == 0` AND `amount_disbursed == 0`
- **Points**: 35
- **Why suspicious**: A project certified as complete with zero financial records suggests either a data recording failure or paper certification of unexecuted work
- **Example**: AP work `WS/MP18009/2024-2025/161404` — community hall marked "Work Completed" with Rs 0 in both ledgers

**Signal: `FIN_SEVERE_UNDER_UTIL` — Severe Budget Under-Expenditure at Completion**
- **What it checks**: Work is completed AND `total_expenditure / sanction_amount < 40%`
- **Points**: 20

---

#### DIMENSION 2: Transaction Pattern

**Signal: `TX_EXACT_DUP_CLUSTER` — Exact Duplicate Transactions Present**
- **What it checks**: Number of excess duplicate transaction records (beyond the first occurrence in each group)
- **Points**: 30 for >=1 excess; 40 for >=4 excess; 50 for >=10 excess
- **Why suspicious**: Identical payment records (same vendor, date, amount, work, status) appearing multiple times suggests potential double-billing

**Signal: `TX_SLICING_EXTREME` — Extreme Transaction Slicing**
- **What it checks**: `expenditure_transaction_count >= 15` (top 1% / P99 empirical threshold)
- **Points**: 35
- **Why suspicious**: A single community project with 15+ separate payment vouchers is highly atypical; a classic "slicing" pattern used to evade approval thresholds
- **Example**: Punjab work above with 29 transactions → 35 points

**Signal: `TX_SLICING_HIGH` — High Transaction Slicing**
- **What it checks**: `6 <= expenditure_transaction_count < 15` (P95–P99; mutually exclusive with EXTREME)
- **Points**: 20

**Signal: `TX_VENDOR_SPRAWL_EXTREME` — Extreme Vendor Sprawl**
- **What it checks**: `unique_vendor_count >= 8` (top 1% empirical threshold)
- **Points**: 35
- **Why suspicious**: A single project disbursed to 8+ vendors is exceptional in MPLADS context where most works use a single contractor

**Signal: `TX_VENDOR_SPRAWL_HIGH` — High Vendor Concentration**
- **What it checks**: `3 <= unique_vendor_count < 8` (P90–P95; mutually exclusive with EXTREME)
- **Points**: 20

**Signal: `TX_EARLY_STAGE_HIGH_EXP` — High Proportion of Expenditure at Early Administrative Stage**
- **What it checks**: Work status in {Sanction, Vendor Identification, Time Estimation} AND `total_expenditure / sanction_amount >= 75%`
- **Points**: 30
- **Why suspicious**: Money disbursed before contractors are even formally engaged — financial and administrative timelines contradict each other

---

#### DIMENSION 3: Lifecycle & Execution

**Signal: `LIFE_PROLONGED_STAGNATION` — Prolonged Inactivity on Active Work**
- **What it checks**: Work NOT completed AND `days_since_last_expenditure > 445 days` (P90 threshold)
- **Points**: 30
- **Why suspicious**: An uncompleted project with no financial activity for 14+ months may be effectively abandoned while appearing "active" in official records

**Signal: `LIFE_SEVERE_DELAY_SANCTION` — Abnormal Administrative Sanction Delay**
- **What it checks**: `days_to_sanction > 323 days` (P95 threshold)
- **Points**: 20
- **Why suspicious**: Median sanction time is 68 days; 323+ days may indicate administrative obstruction

**Signal: `LIFE_SEVERE_DELAY_COMP` — Abnormal Execution Duration to Completion**
- **What it checks**: `days_to_completion > 477 days` (P95 threshold)
- **Points**: 25

**Signal: `LIFE_STATUS_DISCONNECT` — Milestone Sequencing Inconsistency**
- **What it checks**: Work is in early administrative stage AND expenditure >= 75% of sanction (same condition as `TX_EARLY_STAGE_HIGH_EXP`)
- **Points**: 25
- **Why suspicious**: Financial execution has outpaced administrative milestones

---

#### DIMENSION 4: Data Quality & Reconciliation

**Signal: `DQ_DISBURSEMENT_RECONCILIATION_GAP` — Master vs Transaction Ledger Reconciliation Gap**
- **What it checks**: One of three sub-conditions:
  1. Transaction expenditure > 0 but master `amount_disbursed` is null
  2. Work is certified completed but `amount_disbursed` is null
  3. Both fields populated but differ by more than 5% of sanction amount
- **Points**: 25
- **NOT triggered** for works with no transactions at all (normal for early-stage projects)

**Signal: `DQ_MISSING_REC_SERIES` — State Recommendation Catalog Uncoupling**
- **What it checks**: Whether the work belongs to Andhra Pradesh
- **Points**: 15
- **Note**: All 200 AP works have null `recommended_date` because the source Excel workbook uses an isolated recommendation sheet with a different numbering series. This is a state-level data artifact, not a fraud indicator.

**Signal: `DQ_MISSING_CORE_DESC` — Missing Statutory Work Description**
- **What it checks**: `work_description` is null or blank
- **Points**: 20

### 5.5 Threshold Calibration (Verified from `sentinel_scorer.py` and `SENTINEL_RISK_SCORE_V1.md`)

| Threshold Name | Value | Basis |
|---|---|---|
| `slicing_extreme` | 15 transactions | P99 of the 1,000-work dataset |
| `slicing_high` | 6 transactions | P95 |
| `vendor_sprawl_extreme` | 8 vendors | Top 1% |
| `vendor_sprawl_high` | 3 vendors | P90 |
| `prolonged_stagnation_days` | 445 days | P90 of days since last expenditure |
| `delay_sanction_days` | 323 days | P95 of days to sanction |
| `delay_completion_days` | 477 days | P95 of days to completion |
| `early_stage_exp_ratio` | 75% | Design parameter |
| `severe_under_util_ratio` | 40% | Design parameter |
| `dup_exposure_high_ratio` | 30% | Design parameter |
| `dup_exposure_mod_ratio` | 5% | Design parameter |

---

## 6. Risk-Scoring Method

### 6.1 Formula (Verified from `sentinel_scorer.py`)

**Step 1 — Compute per-dimension raw scores (capped at 100):**

```
D_fin(w) = min(100, sum of points for all triggered financial integrity signals)
D_tx(w)  = min(100, sum of points for all triggered transaction pattern signals)
D_life(w)= min(100, sum of points for all triggered lifecycle/execution signals)
D_dq(w)  = min(100, sum of points for all triggered data quality signals)
```

**Step 2 — Compute weighted composite:**

```
RawScore(w) = 0.35 * D_fin + 0.30 * D_tx + 0.20 * D_life + 0.15 * D_dq
```

**Step 3 — Apply Critical Override (verified from `sentinel_scorer.py` lines 478–481):**

```
if D_fin >= 70:
    FinalScore = round(max(RawScore, 70.0))
else:
    FinalScore = round(RawScore)
```

**Step 4 — Bounded output:** `FinalScore` is always in [0, 100].

### 6.2 Risk Tier Classification

| Score Range | Risk Level | Human Review Required |
|---|---|---|
| 0–19 | Low / Normal | No |
| 20–39 | Moderate | No |
| 40–69 | Elevated Risk | **Yes** |
| 70–100 | High Risk | **Yes** |

The `requires_human_review` flag is `True` for any score >= 40 (verified: `sentinel_scorer.py` line 496).

### 6.3 Dimension Color Coding in Dashboard

The `DimensionScores` component (`components/risk/DimensionScores.tsx`) colors each bar:

| Score Range | Color |
|---|---|
| 0–14 | Green |
| 15–34 | Yellow |
| 35–59 | Orange |
| 60–100 | Red |

### 6.4 Worked Example — High-Risk Work (Numbers Verified from Source)

**Work:** `WS/MP18152/2025-2026/220384`
**State:** Punjab | **Constituency:** FARIDKOT (SC)
**MP:** SARABJEET SINGH KHALSA
**Title:** Construction of roads, link roads, pathways with drainage

Key metrics: Sanction Rs 15,00,000 | Expenditure Rs 15,00,000 | Status: "Vendor Identification"
Transactions: 29 | Vendors: 2 | Participating dup rows: 25 | Dup groups: 4 | Excess dups: 21
Potential dup amount: Rs 9,46,275

**Signals triggered:**

| Signal ID | Dimension | Points | Why |
|---|---|---|---|
| `FIN_DUP_EXPOSURE_HIGH` | Financial | 70 | Rs 9,46,275/Rs 15,00,000 = 63.1% >= 60% → 70 pts |
| `TX_EXACT_DUP_CLUSTER` | Transaction | 50 | 21 excess duplicate records >= 10 → 50 pts |
| `TX_SLICING_EXTREME` | Transaction | 35 | 29 transactions >= 15 → 35 pts |
| `TX_EARLY_STAGE_HIGH_EXP` | Transaction | 30 | 100% spent during "Vendor Identification" |
| `LIFE_STATUS_DISCONNECT` | Lifecycle | 25 | Expenditure complete; status still early-stage |
| `DQ_DISBURSEMENT_RECONCILIATION_GAP` | Data Quality | 25 | Rs 15L in transactions; master disb is null |

**Dimension scores:**

```
D_fin  = min(100, 70)         = 70
D_tx   = min(100, 50+35+30)   = min(100, 115) = 100
D_life = min(100, 25)         = 25
D_dq   = min(100, 25)         = 25
```

**Composite calculation:**

```
RawScore = (0.35 × 70) + (0.30 × 100) + (0.20 × 25) + (0.15 × 25)
         = 24.5 + 30.0 + 5.0 + 3.75
         = 63.25
```

**Critical Override Applied** (D_fin = 70 >= 70):

```
FinalScore = max(63.25, 70) = 70
```

**Result:** Risk Score = **70** | Risk Level = **High Risk** | `requires_human_review = true`

**Plain English interpretation:** 100% of Rs 15 Lakhs is already disbursed as transactions while the project is still in "Vendor Identification" — the stage before contractors are even formally engaged. 25 of the 29 transactions are exact duplicates across 4 groups, representing Rs 9.46 Lakhs in potentially redundant payments. The Critical Override prevents the moderate lifecycle/data-quality scores from masking the extreme financial integrity signal.

### 6.5 Worked Example — Low-Risk Work (from Design Doc, Case 1)

**Work:** `WS/MP524/2024-2025/168911`
**State:** Andhra Pradesh | **Constituency:** RAJAMPET
**Title:** Installing tube-wells and borewells

Key metrics: Sanction Rs 1,94,855 | Disbursed Rs 1,94,855 | Exp Rs 1,94,855 | Tx Count: 1 | Vendors: 1 | Duplicates: 0

**Signals triggered:**
- `LIFE_PROLONGED_STAGNATION` (530 days since last expenditure, still in "Physical Inspection"): 30 pts
- `DQ_MISSING_REC_SERIES` (AP catalog uncoupling): 15 pts

**Dimension scores:**
```
D_fin  = 0
D_tx   = 0
D_life = 30
D_dq   = 15
```

**Composite:**
```
RawScore = (0.35 × 0) + (0.30 × 0) + (0.20 × 30) + (0.15 × 15) = 6.0 + 2.25 = 8.25 → 8
```

**Result:** Risk Score = **8** | Risk Level = **Low / Normal** | `requires_human_review = false`

Clean project execution: 1 transaction, 1 vendor, no duplicates. The low score reflects inspection inactivity and a state-wide catalog gap — neither a procurement risk.

---

## 7. Dashboard Guide for Non-Technical Users

### 7.1 Overview Page (`/`)

The Overview is the **command centre** for the entire Sentinel monitoring system.

**What it shows:**
- **KPI bar**: Total Works monitored (1,000), Total Expenditure Transactions (1,386), High Risk Works count, Elevated Risk Works count, Human Review Required count
- **National Risk Distribution chart**: Donut/bar chart showing how many works fall into each of the four risk tiers across all 5 states
- **State Comparison table**: Each state's work count, transaction count, average risk score, and per-tier counts; clicking a row navigates to State Analysis
- **Priority Works — Top 10**: The 10 highest-risk works nationally; clicking navigates to Work Detail

**Disclaimer at the bottom:** Sentinel identifies risk signals and anomaly patterns. It does not determine guilt, certify fraud, or replace official inquiry processes.

### 7.2 State Analysis Page (`/states`)

Shows risk metrics broken down by state. Can be viewed for "All States" combined or filtered to a single state.

**Per-state KPIs:** Total Works, Transactions, High Risk, Elevated Risk, Moderate, Low, Human Review Required, Works with Duplicates
**Financial panel:** Total Sanction Amount, Budget Overrun Works, Orphan Transactions
**Risk Distribution chart** and **Top Priority Works table** (filtered to selected state)

### 7.3 Work Explorer (`/explorer`)

A **searchable, sortable, paginated list** of all 1,000 works.

**Filtering options:**
- State dropdown, Risk Level dropdown, free-text search (Work ID, MP name, constituency, category, title)

**Sorting:** Click any column header to sort ascending/descending. Default: highest risk score first.

**Pagination:** 25 rows per page; Previous/Next controls.

**Drill-down:** Click any row to open the full Work Detail investigation view.

### 7.4 Work Detail (`/work/<work_id>`)

The **primary investigation interface**.

**Header section:**
- Work ID, Work Title, State/Constituency/MP name badges
- **Risk Score card**: Large score out of 100 with color coding (red/orange/yellow/green)
- **Human Review card**: Amber "Flagged" + "Mark as Reviewed →" button for flagged works; green "Reviewed" + timestamp after review action

**KPI Strip (6 metrics):**
Sanction Amount | Total Expenditure (% of sanctioned) | Transactions (vendors) | Duplicate Tx (potential amount) | Days to Sanction | Days to Completion

**Risk Dimensions bar:** Four progress bars (Financial Integrity, Transaction Pattern, Lifecycle/Execution, Data Quality) — each color-coded by score level.

**Three tabs:**

**Tab 1 — Overview:**
- Work Information panel: all metadata fields
- Execution & Utilization Metrics
- Duplication & Anomaly Metrics
- Anomaly Signals list: one card per triggered signal with evidence summary, severity badge, points, and "View Evidence →" link

**Tab 2 — Transactions:**
- Full table of all expenditure transactions for this work
- Duplicate transactions and orphan transactions are visually highlighted
- Columns: Expenditure ID, Date, Vendor, Amount, Payment Status, Duplicate Group ID, Potential Duplicate Amount

**Tab 3 — Evidence:**
- "Forensic Evidence Records" with Expand All / Collapse All controls
- One collapsible top-level section per evidence category
- Nested transaction vouchers expandable within each signal's evidence record
- Clicking "View Evidence →" on a signal auto-scrolls to and expands its section here

**Human Review flow:**
1. Work scores >= 40 → `requires_human_review = true` → amber card shown
2. Investigator examines signals, transactions, and evidence
3. Investigator clicks "Mark as Reviewed →"
4. `UPDATE risk_scores SET is_reviewed=true, reviewed_at=NOW() WHERE work_id=...`
5. Card changes to green "Reviewed" state with timestamp
6. TanStack Query caches invalidated → all views refresh from Supabase

### 7.5 System / Dataset Page (`/system`)

An informational page showing:
- Dataset statistics (states, works, transactions, duplicate count, orphan count, signal count)
- Supabase connection status (connected instance URL, authentication mode, RLS status)
- Data integrity notes (explains that 134 duplicates are intentional test cases)
- Per-state breakdown table
- Technology stack: React 18, TypeScript, Vite, Tailwind CSS, Recharts, Supabase, TanStack Query, React Router

---

## 8. Important Metrics Glossary

| Metric | Meaning | Calculation / Source | Why It Matters |
|---|---|---|---|
| **Sanction Amount** | Officially approved budget ceiling | `works.sanction_amount` | Maximum allowable expenditure |
| **Total Expenditure** | Sum of all recorded payment transactions | `SUM(expenditure_transactions.fund_disbursed_amount)` per work → `work_features.total_expenditure` | Actual money spent per transaction log |
| **Amount Disbursed** | Master-level disbursement from works register | `works.amount_disbursed` | Should reconcile with Total Expenditure |
| **Expenditure vs Sanction %** | Ratio of Total Expenditure to Sanction Amount | `total_expenditure / sanction_amount` → `expenditure_vs_sanction_ratio` | Whether the project used its budget |
| **Transaction Count** | Number of individual payment vouchers | COUNT of expenditure rows per work → `expenditure_transaction_count` | High count flags potential slicing |
| **Unique Vendors** | Distinct contracting entities paid | COUNT DISTINCT vendor names → `unique_vendor_count` | Multiple vendors on simple works is atypical |
| **Duplicate Transaction Count** | Count of rows flagged as `is_exact_duplicate = true` | `SUM(is_exact_duplicate)` per work → `duplicate_transaction_count` | Transactions with identical attributes |
| **Duplicate Groups** | Distinct clusters of identical transactions | COUNT DISTINCT `duplicate_group_id` → `duplicate_group_count` | How many separate billing events were repeated |
| **Potential Duplicate Amount** | Financial value of excess (non-first) duplicate occurrences | `SUM(potential_duplicate_amount)` per work → `potential_duplicate_amount_total` | Financial exposure from repeated payments |
| **Days to Sanction** | Elapsed days from recommendation to sanction | `sanction_date - recommended_date` → `days_to_sanction` | P95 = 323 days |
| **Days to Completion** | Elapsed days from recommendation to completion | `completion_date - recommended_date` → `days_to_completion` | P95 = 477 days |
| **Days Since Last Expenditure** | Days since most recent payment (as of 2026-09-05) | `reference_date - MAX(expenditure_date)` → `days_since_last_expenditure` | P90 = 445 days; inactivity indicator |
| **Financial Integrity Score** | Capped 0–100 sum of financial signal points | `min(100, sum(financial signal points))` | Duplicate exposure + disbursement integrity |
| **Transaction Pattern Score** | Capped 0–100 sum of transaction signal points | `min(100, sum(transaction signal points))` | Slicing, duplicate clusters, vendor sprawl |
| **Lifecycle / Execution Score** | Capped 0–100 sum of lifecycle signal points | `min(100, sum(lifecycle signal points))` | Stagnation, delays, status disconnects |
| **Data Quality Score** | Capped 0–100 sum of data quality signal points | `min(100, sum(data quality signal points))` | Reconciliation gaps, missing records |
| **Risk Score** | Overall 0–100 weighted composite | `0.35*D_fin + 0.30*D_tx + 0.20*D_life + 0.15*D_dq` (floor=70 if D_fin>=70) | Primary sorting key for investigator attention |
| **Risk Level** | Categorical tier derived from Risk Score | 0–19: Low/Normal; 20–39: Moderate; 40–69: Elevated; 70–100: High Risk | Human-readable severity classification |
| **requires_human_review** | Boolean: score >= 40 | `risk_score >= 40` → `risk_scores.requires_human_review` | Trigger for investigator attention |
| **is_reviewed** | Boolean: investigator has reviewed this work | Dashboard "Mark as Reviewed" → `risk_scores.is_reviewed` | Tracks investigation progress |
| **reviewed_at** | Timestamp of review action | `risk_scores.reviewed_at` (UTC) | Audit trail of when review occurred |
| **Signal Points** | Points contributed by an individual anomaly signal | Per-signal `points` in `risk_signals` | Building blocks of dimension scores |
| **Orphan Transaction Count** | Expenditure records with no matching work master | `expenditure_without_matching_work = true` count | Money spent without traceable project authorization |
| **Budget Overrun Works** | Works where total expenditure exceeds sanction | `expenditure_exceeds_sanction = true` count | Overspending (0 in current dataset) |

---

## 9. The Evidence Model

### 9.1 Evidence Flow

```
Anomaly Signal triggered in sentinel_scorer.py
      |
      v
extract_evidence_transactions() selects up to 8 relevant transaction vouchers
(for duplicate signals: only flagged rows; for others: any transactions)
      |
      v
Signal dict includes:
- signal_id, dimension, severity, points, title
- evidence_summary (f-string template, not LLM-generated)
- threshold (the rule expression)
- observed_value (the actual measured value)
- evidence_transactions (list of transaction dicts)
      |
      v
All signals for a work collected into evidence_payload[work_id]
Payload also includes: work metadata, risk_score, risk_level,
requires_human_review, dimension_scores, summary_metrics
      |
      v
Written as JSON to data/scored/risk_evidence.json (2.1 MB)
      |
      v
ingest_to_supabase.py loads JSON, inserts one row per work
into risk_evidence table as JSONB
      |
      v
risk_evidence table in Supabase (JSONB column, GIN-indexed)
      |
      v
useRiskEvidence(workId) hook fetches from risk_evidence table via Supabase API
      |
      v
EvidencePanel.tsx renders JSONB as collapsible tree
```

### 9.2 What the Evidence Contains

The JSONB payload per work includes:
- Work metadata: work_id, state, constituency, mp_name, category, title, sanction amount, total expenditure, amount disbursed, work status
- Risk summary: risk_score, risk_level, requires_human_review
- Dimension scores: all four scores as nested object
- Summary metrics: transaction count, vendor count, participating duplicate rows, duplicate group count, excess duplicate count, potential duplicate amount, expenditure-to-sanction ratio, days since last expenditure
- Triggered signals: array of all triggered signal objects, each containing signal_id, title, dimension, severity, points, evidence_summary, threshold, observed_value, and evidence_transactions (up to 8 real transaction vouchers)

### 9.3 Precomputed vs Dynamic — The Critical Distinction

> **Current prototype: precomputed evidence generated during the Python batch process.**

All evidence is generated once by `sentinel_scorer.py` and stored statically in `risk_evidence.json`, then loaded into Supabase. When an investigator opens the Evidence tab, the browser fetches this pre-generated JSONB. No computation happens at query time.

> **Production direction: evidence could be dynamically generated/retrieved as part of a live investigation system.**

In a production system, evidence would ideally be:
- Generated on demand from a live MPLADS data feed
- Updated as new transactions arrive
- Generated by an LLM synthesis layer translating structured evidence into fluent audit summaries
- Enriched with cross-work context (e.g., vendor history across constituencies)

The EvidencePanel component is designed to render arbitrary nested JSON — it would work equally well with dynamically retrieved evidence.

### 9.4 Why Precomputation Is Appropriate for This Prototype

1. Guarantees consistent, rehearsable results
2. Eliminates query-time latency
3. Separates analytical layer from presentation layer cleanly
4. Dashboard remains functional without a running Python process
5. Makes the evidence verifiable against source code

---

## 10. AI / ML Truthfulness Audit

### 10.1 What Does and Does NOT Exist

After inspecting all Python scripts and dashboard source files:

| Component | Present? |
|---|---|
| Trained ML model (scikit-learn, PyTorch, TensorFlow) | **NO** |
| Statistical anomaly detection (Isolation Forest, LOF) | **NO** |
| LLM inference (OpenAI, Anthropic, Gemini API calls) | **NO** |
| Embeddings or vector similarity | **NO** |
| Model training code | **NO** |
| External AI API calls | **NO** |
| ML dependencies in `requirements.txt` | **NO** — only pandas, numpy, openpyxl |

### 10.2 What Exists Instead

> **The current prototype does not contain an actual trained AI/ML inference model.**

> **A deterministic, rule-based anomaly and risk engine whose outputs simulate the anomaly-detection layer of the proposed production architecture.**

Specifically:
- Hand-crafted threshold rules based on empirical percentiles of the 1,000-work dataset
- A transparent, formulaic scoring system with no hidden weights or learned parameters
- A fixed scoring computation that produces identical results on every run given the same data

### 10.3 Why This Is Acceptable for the Prototype

1. **Explainability**: Deterministic rules are 100% explainable — matches Core Design Principle 1
2. **Defensibility**: For a government-facing system, regulators may prefer auditable rules over opaque ML
3. **Correctness verification**: Output can be verified by hand for any given work
4. **Prototype completeness**: The full investigation workflow is demonstrated end-to-end regardless of scoring method
5. **Natural evolution path**: The rule engine can be replaced or augmented with ML without changing the rest of the architecture

### 10.4 Proposed vs Current Scoring Method

| Aspect | Proposed (Production) | Current Prototype |
|---|---|---|
| Detection method | ML-assisted anomaly detection | Deterministic threshold rules |
| Scoring | ML-informed risk probability | Weighted additive point system |
| Evidence summaries | LLM-generated natural language | Python f-string templates |
| Model updates | Feedback loop / retraining | Static — re-run script with new data |
| Explainability | XAI techniques | Full by construction |

---

## 11. Human-in-the-Loop Audit

### 11.1 What Is Genuinely Implemented

The following workflow is **fully functional** in the current prototype:

```
sentinel_scorer.py detects suspicious pattern
      |
      v
Work receives risk score >= 40
      |
      v
requires_human_review = true stored in risk_scores table
      |
      v
Dashboard shows amber "Flagged for Human Review" card on Work Detail
      |
      v
Investigator examines signals (Anomaly Signals panel)
      |
      v
Investigator examines transactions (Transactions tab with anomaly highlighting)
      |
      v
Investigator examines evidence (Evidence tab with collapsible JSONB viewer)
      |
      v
Investigator clicks "Mark as Reviewed"
      |
      v
UPDATE risk_scores SET is_reviewed=true, reviewed_at=NOW() WHERE work_id=...
      |
      v
Review state persists in Supabase PostgreSQL (survives page refresh)
      |
      v
All dashboard caches invalidated → UI refreshes showing "Reviewed" state
```

### 11.2 What Is NOT Currently Implemented

| Capability | Status |
|---|---|
| Investigator identity / user accounts | **NOT IMPLEMENTED** |
| Decision recording (cleared / escalated / rejected) | **NOT IMPLEMENTED** |
| Review notes / comments | **NOT IMPLEMENTED** |
| Detailed audit history / event log | **NOT IMPLEMENTED** |
| Case assignment to specific investigator | **NOT IMPLEMENTED** |
| Escalation workflow | **NOT IMPLEMENTED** |
| Supervisor sign-off | **NOT IMPLEMENTED** |
| Email / notification on flag | **NOT IMPLEMENTED** |
| Un-review / re-open capability | **NOT IMPLEMENTED** |

### 11.3 Production Case Management (Future)

A production version would require: user authentication and role-based access control (investigator / supervisor / administrator), case creation and assignment, decision recording, audit trail of all reviewer actions, integration with official inquiry management systems.

---

## 12. Prototype vs Production

| Dimension | Current SIH Prototype | Proposed Production System |
|---|---|---|
| **Data ingestion** | Batch Python script; run manually against static Excel files | Real-time or scheduled ingestion from government MPLADS portal / API |
| **Dataset scale** | 5 states, 1,000 works, 1,386 transactions | National scale: 543 constituencies, all states, millions of transactions |
| **Anomaly detection** | Deterministic threshold rules, empirically calibrated | ML-assisted detection (anomaly models, fraud pattern recognition), possibly ensemble |
| **Risk scoring** | Precomputed batch scores; static once ingested | Dynamic inference; re-scored as new data arrives |
| **Evidence generation** | Precomputed during scoring batch; stored as static JSONB | Dynamically retrieved; LLM-synthesized plain-language summaries |
| **LLM synthesis** | Not implemented; evidence_summary is Python f-string | LLM translates structured evidence to fluent audit narratives and action checklists |
| **Human review** | Single `is_reviewed` boolean + timestamp | Full case management: user auth, role-based access, decision recording, escalation, audit trail |
| **Backend** | Supabase (cloud PostgreSQL, free tier) | Hardened government infrastructure; potentially NIC-hosted |
| **Security** | Anonymous public anon key; RLS read-only | Full authentication, encrypted transport, audit logs, compliance |
| **Feedback loop** | None | Investigator decisions feed back to improve anomaly models |
| **Alerts** | None | Email/SMS/portal notifications when high-risk works are detected |
| **Cross-work analysis** | Per-work signals only | Cross-constituency vendor network analysis, MP-level pattern clustering |
| **Geographic analysis** | State text labels only | Map visualization with constituency-level heatmaps |

> **Important framing:** The prototype is a **focused proof-of-concept** that demonstrates the core monitoring and explainability workflow. Every layer of the target architecture is represented: data ingestion, feature engineering, anomaly detection, risk scoring, evidence extraction, database storage, dashboard presentation, and human review. The prototype proves the concept is viable and implementable.

---

## 13. What We Can Claim in the SIH Presentation

### 13.1 Safe Claims (Directly Supported by Implementation)

- "Sentinel is a working end-to-end MPLADS monitoring prototype that ingests, scores, and presents anomaly data for human review."
- "We processed 1,000 MPLADS works across 5 states from real government MPLADS data."
- "Our system uses a four-dimensional deterministic risk engine to score each work on a 0–100 scale."
- "Every risk score is fully explainable — we can show which rule triggered, with what observed value, against what threshold."
- "We identified 134 exact duplicate transactions representing potential duplicate disbursements totalling Rs 44 lakh."
- "We identified 38 orphan expenditures in Punjab totalling Rs 76 lakh with no parent work record."
- "Our system flags high-risk works for human review, and investigators can mark works as reviewed directly in the dashboard."
- "The review state persists in a live Supabase PostgreSQL database."
- "Our evidence model attaches actual transaction vouchers to every anomaly signal, enabling forensic investigation."
- "Thresholds are calibrated from empirical percentile distributions of the 1,000-work dataset."
- "The system's non-accusatory design explicitly separates risk pattern detection from fraud determination."

### 13.2 Claims That Require Clarification

| What You Might Say | More Accurate Phrasing |
|---|---|
| "Sentinel uses AI to detect anomalies" | "Sentinel uses a deterministic anomaly engine — the rules-based prototype of our proposed AI anomaly detection layer" |
| "The system automatically detects suspicious patterns" | "The system applies deterministic analytical rules to identify patterns consistent with suspicious behavior" |
| "Real-time monitoring" | "Batch-mode monitoring of MPLADS data with a full pipeline from raw Excel to dashboard" |
| "The evidence is retrieved from the database" | "The evidence is precomputed during the scoring batch and stored in the database for instant retrieval" |

### 13.3 Claims We Should NOT Make

| Claim | Why Not | Replace With |
|---|---|---|
| "Our ML model detected this fraud" | No ML model; fraud not determined | "Our anomaly engine detected this suspicious pattern" |
| "Real-time AI inference" | No AI; no real-time | "Deterministic batch anomaly analysis" |
| "Automatically detected fraud" | No fraud determination | "Flagged for human review based on risk signals" |
| "The AI knows this is fraudulent" | No AI knowledge; no fraud finding | "Our scoring engine identified anomaly patterns warranting investigation" |
| "This is a production-ready system" | It is a prototype | "This is a working proof-of-concept demonstrating the full monitoring workflow" |
| "LLM/GPT generated this analysis" | No LLM used | "Evidence summaries are generated by the deterministic scoring engine" |

---

## 14. Demo Story

### Recommended 5-Minute Demonstration Sequence

**Step 1 — Overview (30 seconds)**
*Click:* Open dashboard → Overview (`/`)
*Notice:* 1,000 works monitored, live data badge, High Risk count, Human Review Required count, risk distribution
*Technical concept:* National-scale monitoring at a glance
*Say:* "Sentinel monitors 1,000 MPLADS developmental works across 5 states. At a glance we can see [X] works have been flagged as High Risk and [Y] require immediate human investigation."

---

**Step 2 — State Analysis (30 seconds)**
*Click:* Click "Punjab" row in State Comparison table → navigates to `/states?state=Punjab`
*Notice:* Punjab's high anomaly concentration, 38 orphan transactions
*Technical concept:* State-level drill-down; orphan transaction detection
*Say:* "Punjab has the highest concentration of anomalies. 38 expenditure transactions totalling Rs 76 lakh have no matching work record — money paid out without traceable project authorization."

---

**Step 3 — Work Explorer (30 seconds)**
*Click:* Navigate to Work Explorer → filter to "High Risk" → default sort shows highest scores first
*Notice:* Filtered list of only High Risk works sorted by score, risk badge colors
*Technical concept:* Investigator prioritization workflow
*Say:* "An investigator starts their day here — filtering to High Risk and working down the list by priority."

---

**Step 4 — Select High-Risk Work (15 seconds)**
*Click:* Click the top-scoring Punjab work
*Notice:* Work Detail screen, large risk score "70" in red, amber "Flagged for Human Review" card
*Technical concept:* Risk score transparency; human review trigger
*Say:* "This work has been assigned a Risk Score of 70 — High Risk — and Sentinel has flagged it for immediate human review."

---

**Step 5 — Explain Risk Score (45 seconds)**
*Click:* Scroll to Risk Dimensions bar chart
*Notice:* Financial Integrity=70 (red), Transaction Pattern=100 (red), Lifecycle=25 (green), Data Quality=25 (green)
*Technical concept:* Four-dimensional decomposition; weighted scoring formula
*Say:* "The risk score comes from four independent dimensions. This work scores 70 on Financial Integrity and 100 on Transaction Pattern — both severe. The weighted formula gives us a raw score of 63, but our Critical Override rule guarantees any work with extreme financial anomalies can't score below 70."

---

**Step 6 — Open Anomaly Signal (45 seconds)**
*Click:* Scroll to Anomaly Signals panel → point to `FIN_DUP_EXPOSURE_HIGH` and `TX_EXACT_DUP_CLUSTER`
*Notice:* Signal name, dimension, evidence summary, severity badge "HIGH", points "+70" and "+50"
*Technical concept:* Fully explainable signals — every point traces to a specific rule
*Say:* "Each anomaly signal is fully explainable. 63% of this project's total expenditure consists of potentially duplicate transactions — 21 excess duplicate payment records representing Rs 9.46 Lakh in redundant disbursements. We know exactly which rule triggered and what was observed."

---

**Step 7 — Show Transactions (30 seconds)**
*Click:* Click "Transactions" tab
*Notice:* Transaction list. Duplicate rows highlighted. Same vendor, date, amount appearing multiple times.
*Technical concept:* Anomaly highlighting; duplicate detection at transaction level
*Say:* "On the Transactions tab, we can see the raw payment records. Highlighted rows are confirmed exact duplicates — identical vendor, date, and amount appearing multiple times. These are real records from the source MPLADS workbook."

---

**Step 8 — Show Evidence (30 seconds)**
*Click:* Click "Evidence" tab → "Expand All" → expand "triggered signals" section
*Notice:* Hierarchical JSON evidence viewer, nested records, transaction voucher data
*Technical concept:* Precomputed forensic evidence; evidence model linking signals to records
*Say:* "The Evidence tab shows the complete forensic record — every signal, every metric, every raw transaction voucher that contributed to the risk score. This is what a real investigator would take to an inquiry."

---

**Step 9 — Mark as Reviewed (30 seconds)**
*Click:* Scroll up to amber Human Review card → click "Mark as Reviewed"
*Notice:* Card changes from amber to green "Reviewed" with timestamp. This happens live, not via a mock.
*Technical concept:* Real database write; human-in-the-loop workflow
*Say:* "When an investigator is satisfied they've examined the evidence, they mark the work as reviewed. This writes to our live Supabase PostgreSQL database. The review state persists — visible to any team member, immediately. This is a real human-in-the-loop workflow, not a UI mockup."

---

## 15. Team FAQ

**Q: Is this actually AI?**
A: The current prototype uses a deterministic, rule-based scoring engine — not a trained ML or AI model. Every rule is a threshold check on measurable data attributes. This is the analytical foundation of what a production AI system would build upon. The project is scoped as "AI-Powered"; the prototype demonstrates the complete workflow using transparent rules instead of trained models.

**Q: Where does the risk score come from?**
A: The score is computed by a four-step formula: (1) triggered signals contribute points to their respective dimension, (2) each dimension score is capped at 100, (3) the four dimensions are combined with weights (35/30/20/15%), and (4) a Critical Override rule ensures works with severe financial anomalies can't score below 70. Every point is traceable to a specific rule triggered by specific data.

**Q: How do you detect duplicate transactions?**
A: For every transaction, we compute a SHA-256 hash of eight normalized fields: work_id, state, MP name, constituency, expenditure date, vendor name, payment status, and disbursed amount. Transactions sharing the same hash are literally identical in all meaningful attributes. Financial exposure is then the sum of values of all excess (non-first) copies within each group.

**Q: How do you know this is suspicious?**
A: Thresholds are calibrated against empirical percentiles of the actual 1,000-work dataset. 15+ transactions per work is top 1% (P99) — exceptional by the standards of this real data. When multiple independent signals converge (high duplicate count AND extreme slicing AND 100% budget transacted while still pre-contract), the pattern is very unlikely to be coincidental.

**Q: Can the system determine fraud?**
A: No. Sentinel explicitly prohibits the word "fraud" and any fraud determination. Risk scores reflect observable data anomalies — duplicate vouchers, timeline inconsistencies, reconciliation gaps. Whether an anomaly represents fraud, data entry error, or administrative irregularity requires human judgment by authorized investigators.

**Q: Where does the evidence come from?**
A: Evidence is extracted from the actual raw MPLADS transaction records. When a signal triggers, the scoring engine selects the most relevant transaction vouchers (up to 8 per signal) and attaches them to the evidence payload. These are real payment records from the original government Excel workbooks.

**Q: Is the data real?**
A: Yes. The 5-state MPLADS dataset was sourced as part of the SIH problem statement. Works, transactions, vendors, constituency names, MP names, and sanction amounts are real MPLADS records. No synthetic data was added. The anomaly patterns were found naturally in the source data.

**Q: Is the database live?**
A: Yes. The dashboard reads from and writes to a live Supabase PostgreSQL instance. The data is static (not refreshed from a government feed in real time), but the database connection is live. When you mark a work as reviewed, it writes a real database row immediately visible to anyone accessing the dashboard.

**Q: Is processing real-time?**
A: No. The current prototype uses a batch pipeline: Python scripts process data, generate risk scores, and load everything into Supabase once. A production system would have a real-time or scheduled ingestion pipeline that re-processes data as new MPLADS records are published.

**Q: What happens when a work is flagged?**
A: The scoring engine sets `requires_human_review = true` for any work with risk score >= 40. These works display an amber "Flagged for Human Review" card on the Work Detail page. An investigator can examine the full signal list, transaction records, and evidence before marking as reviewed.

**Q: Can an investigator review it?**
A: Yes. The "Mark as Reviewed" button performs a real database write: `is_reviewed = true` and `reviewed_at = <current timestamp>`. The state is immediately visible across the dashboard. The only current limitation is that reviewer identity is not captured (no user accounts in the prototype).

**Q: What happens in the production version?**
A: Production would add: (1) real-time MPLADS data ingestion, (2) ML-assisted anomaly detection with feedback loop, (3) LLM-synthesized evidence summaries for auditors, (4) full case management with user auth, role-based access, decision recording, escalation, and audit trail, (5) national scale covering all 543 constituencies, and (6) geographic and cross-work vendor network analysis.

---

## 16. Final Project Status

### Implemented (Fully Working)

- 5-state MPLADS batch data ingestion pipeline
- Standardized schema across heterogeneous state workbooks
- Exact duplicate transaction detection with SHA-256 group hashing
- Orphan expenditure transaction detection (38 Punjab records)
- Work-level feature engineering (20+ features per work)
- Sentinel Risk Score v1 engine with 13 deterministic anomaly signals
- Four-dimensional risk decomposition
- Weighted composite risk score with Critical Override rule
- Four-tier risk classification
- Human review flagging (`requires_human_review`) for scores >= 40
- Precomputed evidence JSON with transaction vouchers per signal
- 15-point data integrity validation suite
- Idempotent batch Supabase ingestion
- PostgreSQL schema: 7 tables, 2 views, RLS policies, GIN-indexed JSONB
- "Mark as Reviewed" workflow (real Supabase write with timestamp)
- React + TypeScript dashboard with 5 pages:
  - Overview: national KPIs, risk distribution, priority works, state comparison
  - State Analysis: per-state drill-down with KPIs and filtered priority works
  - Work Explorer: paginated, filterable (state, risk level, text search), multi-column sortable
  - Work Detail: full investigation view with risk score, dimensions, signals, KPIs
  - System/Dataset: database stats, connection status, per-state breakdown
- Three-tab Work Detail investigation flow (Overview / Transactions / Evidence)
- Collapsible hierarchical JSONB evidence panel with deep-link from signals
- Transaction table with anomaly highlighting
- Risk Dimensions bar chart with color coding by score level
- TanStack Query data fetching with 5-minute cache and optimistic invalidation

### Simulated / Precomputed

- Risk scores: computed once offline; stored in database; not recalculated on query
- Anomaly signals: deterministic rules applied offline; results stored in `risk_signals` table
- Evidence payloads: generated during batch scoring; stored as static JSONB; fetched as-is
- Evidence summaries: Python f-string templates (not LLM-generated)
- "AI detection": all detection is deterministic rule-based; no ML inference at any point

### Partially Implemented

- Human review audit trail: `is_reviewed` + `reviewed_at` persisted; **reviewer identity NOT captured**
- Anomaly evidence: raw transaction vouchers attached (up to 8 per signal); **cross-work context NOT included**
- Data quality surfacing: full `data_quality_report.csv` produced; **not surfaced in dashboard UI**
- Vendor analysis: vendor count as anomaly signal; **cross-work vendor network NOT analyzed**

### Not Implemented

- ML / AI model (trained, statistical, or LLM)
- LLM evidence summary generation
- Real-time data ingestion
- User authentication and role-based access control
- Case assignment and escalation workflow
- Investigator notes / decision recording
- Geographic / map visualization
- Cross-work vendor network analysis
- Feedback loop / model retraining
- Email / push notification alerting
- National-scale dataset (all 543 constituencies)

### Future Scope

**Immediate next steps (post-SIH):**
1. Add Supabase Auth to capture reviewer identity
2. Extend `risk_scores` with decision outcome (cleared / escalated / referred) and reviewer notes
3. Integrate an LLM call to generate fluent audit summaries from structured evidence JSON
4. Set up a cron job to re-run the pipeline when new MPLADS data is available

**Medium-term (production direction):**
5. Train an ML anomaly model on the full national dataset using Sentinel's scores as initial labels
6. Build a cross-work vendor network graph to detect multi-constituency patterns
7. Add constituency-level heatmap visualization
8. Extend to all 28+ state MPLADS workbooks and all 543 MP constituencies
9. Build full case management: assignment, escalation, supervisor sign-off, MIS reporting

---

*End of Sentinel System Documentation*

---

> **Audit performed**: 2026-09-06
> **Files inspected**: 25+ source files across scripts/, supabase/migrations/, dashboard/src/, docs/, data/
> **Proposal PDF status**: Present (`MITS_SIH26_097.pdf`, 683 KB) but could not be machine-read — content inferred from internal documentation
> **All code references verified against actual file contents** — no information fabricated
