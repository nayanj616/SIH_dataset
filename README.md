# MPLADS Dataset Processing & Anomaly Detection Pipeline

This repository contains raw and standardized datasets, along with an end-to-end data preparation and feature engineering pipeline for **MPLADS** (Members of Parliament Local Area Development Scheme) workbooks, prepared for the **Smart India Hackathon (SIH)**.

---

## 📌 Overview

The Members of Parliament Local Area Development Scheme (MPLADS) enables MPs to recommend developmental works in their constituencies. The raw monitoring data is distributed as state-wise multi-sheet Excel workbooks containing works master logs and detailed expenditure transactions.

This pipeline standardizes heterogeneous state workbooks without mutating raw source records, producing:
1. **Cleaned Relational Tables**: Harmonized schema across states with normalized dates and parsed INR currency amounts.
2. **Duplicate Detection**: Deterministic hash-based identification of exact duplicate expenditure transactions without dropping source records.
3. **Audit & Anomaly Risk Indicators**: Work-level feature engineering highlighting expenditure exceeding sanctions, multi-vendor assignments, disbursement discrepancies, and delays.
4. **Data Quality Audit Logs**: Comprehensive reporting of unparseable entries, missing fields, and relational integrity mismatches.

---

## 📁 Repository Structure

```text
SIH_dataset/
├── Andhra Pradesh.xlsx            # Raw state workbook
├── Madhya Pradesh.xlsx            # Raw state workbook
├── Punjab.xlsx                    # Raw state workbook
├── Telengana.xlsx                 # Raw state workbook
├── Uttarakhand.xlsx               # Raw state workbook
├── prepare_mplads_data.py         # Pipeline CLI script
├── sentinel_scorer.py             # Sentinel Risk Score v1 engine
├── requirements.txt               # Python package dependencies
├── sentinel_data_analysis_report.md # Multi-state technical data analysis & anomaly report
├── SENTINEL_RISK_SCORE_V1.md      # Sentinel Risk Score v1 analytical specification
├── .gitignore                     # Git ignore rules
├── README.md                      # Repository documentation
├── scored/                        # Sentinel Risk Score v1 output artifacts
│   ├── work_risk_scores.csv       # Scored works (0-100 score + 4 dimensions)
│   ├── risk_signals.csv           # Detailed triggered anomaly signals
│   └── risk_evidence.json         # Rich evidence payload with raw transaction vouchers
└── processed/                     # Standardized output datasets
    ├── andhra_pradesh/
    ├── madhya_pradesh/
    ├── punjab/
    ├── telangana/
    └── uttarakhand/
        ├── works.csv                    # Cleaned works master
        ├── expenditure_transactions.csv # Standardized transactions + duplicate flags
        ├── work_features.csv            # Engineered risk & tracking features
        └── data_quality_report.csv      # Validation and audit log
```

---

## 📊 Processed Data Schema

Each state directory in `processed/` contains four standardized CSV datasets:

### 1. `works.csv`
Master table of recommended and sanctioned developmental projects.
- `work_id`: Unique identifier for the work item.
- `lok_sabha`, `state`, `constituency`, `mp_name`: Administrative and constituency metadata.
- `work_category`, `work`, `work_description`: Classification and scope of work.
- `ida`: Implementing District Authority.
- `recommended_date`, `recommended_amount`: Recommendation details.
- `sanction_date`, `sanction_amount`: Administrative sanction details.
- `work_status`, `completion_date`, `amount_disbursed`: Execution status and disbursement.
- `data_notes`: Retained audit/notes metadata from source.

### 2. `expenditure_transactions.csv`
Detailed transaction logs with duplicate tracking.
- `expenditure_id`: Deterministic transaction identifier (`EXP-000001`, etc.).
- `work_id`, `state`, `constituency`, `mp_name`: Reference keys.
- `expenditure_date`, `vendor_name`, `payment_status`, `fund_disbursed_amount`: Payment details.
- `is_exact_duplicate`: Boolean flag for identical transactions.
- `duplicate_group_id`: Unique hash identifying duplicate clusters (`DUP-<HASH>`).
- `duplicate_group_size`: Total records sharing the identical profile.
- `potential_duplicate_amount`: Redundant disbursement attributed to duplicate occurrences.
- `expenditure_without_matching_work`: Integrity flag for orphan transactions.

### 3. `work_features.csv`
Work-level aggregation and anomaly detection features for analytical models:
- **Financial Metrics**: `total_expenditure`, `expenditure_vs_sanction_ratio`, `disbursement_vs_sanction_ratio`.
- **Timeline & Delays**: `days_to_sanction`, `days_to_completion`, `days_since_last_expenditure`.
- **Risk & Anomaly Flags**:
  - `expenditure_exceeds_sanction`: `total_expenditure > sanction_amount`
  - `disbursement_exceeds_sanction`: `amount_disbursed > sanction_amount`
  - `completed_without_completion_date`: Marked completed without a recorded date
  - `completed_without_disbursement`: Marked completed without recorded disbursement
  - `high_transaction_count`: Transaction frequency exceeding threshold (> 5)
  - `multiple_vendors`: Work disbursed across multiple vendors
  - `potential_duplicate_transaction`: Work associated with duplicated payment entries

### 4. `data_quality_report.csv`
Complete validation log tracking:
- Header and preamble detection
- Missing values per column
- Unparseable date or monetary formats
- Referential integrity (matched vs unmatched work IDs)
- Duplicate group statistics

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10 or higher
- `pip` package manager

### 1. Installation
Clone the repository and install the dependencies:
```bash
git clone https://github.com/<your-username>/SIH_dataset.git
cd SIH_dataset
pip install -r requirements.txt
```

### 2. Running the Pipeline

To process a single state workbook:
```bash
python prepare_mplads_data.py --input "Uttarakhand.xlsx" --output "processed/uttarakhand"
```

You can specify a custom reference date for recency calculations (defaults to `2026-09-05`):
```bash
python prepare_mplads_data.py --input "Punjab.xlsx" --output "processed/punjab" --reference-date 2026-09-05
```

To reprocess all states in PowerShell:
```powershell
Get-ChildItem -Filter *.xlsx | ForEach-Object {
    $slug = $_.BaseName.ToLower().Replace(" ", "_")
    python prepare_mplads_data.py --input $_.Name --output "processed/$slug"
}
```

---

## 🛡️ Data Integrity Principles
- **Non-destructive**: Source records are never dropped or modified in-place; duplicates and anomalies are flagged rather than deleted.
- **Deterministic**: Deterministic ID schemes and fixed reference dates guarantee reproducibility across runs.
- **Auditability**: Every conversion error, unparseable field, and orphan transaction is documented in `data_quality_report.csv`.

