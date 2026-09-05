# Sentinel: Comprehensive Multi-State MPLADS Data Analysis Report

**Project**: Sentinel (AI-Powered MPLADS Monitoring & Anomaly Detection)  
**Dataset Scope**: Andhra Pradesh, Madhya Pradesh, Punjab, Telangana, Uttarakhand  
**Data Pipeline Status**: Stable ingestion pipeline (`prepare_mplads_data.py`), standardized relational tables (`works.csv`, `expenditure_transactions.csv`, `work_features.csv`, `data_quality_report.csv`)  
**Analysis Execution Date**: 2026-09-05  

---

## 1. Executive Summary & Core Metrics

Across all 5 processed state workbooks, the dataset comprises:
- **Total Works**: **1,000** records (exactly 200 works per state).
- **Total Expenditure Transactions**: **1,386** records.
- **Works with Expenditure**: **660** works (**66.0%** of all works).
- **Works without Expenditure**: **340** works (**34.0%** of all works).
- **Identified Duplicate Transactions**: **134** records (**9.67%** of transactions) across **44** unique duplicate clusters.
- **Potential Duplicate Disbursed Amount**: **₹44,04,754.00** across **23** works.
- **Unmatched Expenditure Records**: **38** transactions (**2.74%** of transactions) totaling **₹76,14,703.00** across **14** distinct `work_id`s, isolated entirely to Punjab.

---

## 2. State-by-State Overview

| State | Works Count | Expenditure Transactions | Works with Expenditure | Works without Expenditure | % Active Works | Total Sanctioned (₹) | Total Expenditure (₹) | Potential Duplicate Amount (₹) | Unmatched Exp Amount (₹) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Andhra Pradesh** | 200 | 143 | 131 | 69 | 65.5% | ₹11,04,91,424.00 | ₹6,57,36,548.00 | ₹0.00 | ₹0.00 |
| **Madhya Pradesh** | 200 | 251 | 150 | 50 | 75.0% | ₹16,33,70,812.00 | ₹10,23,61,659.00 | ₹9,48,165.00 | ₹0.00 |
| **Punjab** | 200 | 452 | 123 | 77 | 61.5% | ₹12,71,61,682.00 | ₹7,67,11,883.00 | ₹33,84,820.00 | ₹76,14,703.00 |
| **Telangana** | 200 | 151 | 143 | 57 | 71.5% | ₹12,79,15,340.00 | ₹7,38,15,699.00 | ₹0.00 | ₹0.00 |
| **Uttarakhand** | 200 | 389 | 113 | 87 | 56.5% | ₹16,44,66,000.00 | ₹6,75,97,069.00 | ₹71,769.00 | ₹0.00 |
| **Total / Overall**| **1,000** | **1,386** | **660** | **340** | **66.0%** | **₹69,34,05,258.00**| **₹38,62,22,858.00**| **₹44,04,754.00** | **₹76,14,703.00** |

---

## 3. Categorical Distributions

### A. Work Status Distribution (`work_status`)

| Work Status | Overall Count | % Total | AP | MP | Punjab | Telangana | Uttarakhand |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Physical Inspection** | 248 | 24.8% | 49 | 54 | 54 | 63 | 28 |
| **Sanction** | 220 | 22.0% | 54 | 37 | 42 | 35 | 52 |
| **Vendor Identification** | 214 | 21.4% | 30 | 68 | 43 | 28 | 45 |
| **Work partially Completed** | 137 | 13.7% | 33 | 16 | 34 | 28 | 26 |
| **Work Completed** | 115 | 11.5% | 22 | 19 | 13 | 39 | 22 |
| **Time Estimation** | 66 | 6.6% | 12 | 6 | 14 | 7 | 27 |

> [!NOTE]
> Only 11.5% of works in the dataset are recorded as fully completed. A substantial portion (46.2%) remain in pre-execution or early administrative phases (`Sanction`, `Vendor Identification`, `Time Estimation`).

### B. Work Category Distribution (`work_category`)

| Work Category | Overall Count | % Total | AP | MP | Punjab | Telangana | Uttarakhand |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Normal/Others** | 886 | 88.6% | 188 | 180 | 165 | 170 | 183 |
| **Repair and Renovation** | 76 | 7.6% | 11 | 5 | 20 | 25 | 15 |
| **Trust and Society** | 38 | 3.8% | 1 | 15 | 15 | 5 | 2 |

---

## 4. Missing-Value Patterns & Structural Anomalies

### Table-by-Table Missingness

1. **`works.csv` Table**:
   - `lok_sabha`: Missing in **600** rows (**60.0%**). Completely unpopulated in AP, MP, and Punjab workbooks.
   - `completion_date`: Missing in **725** rows (**72.5%**). Populated only when work has finished or reached terminal inspection.
   - `amount_disbursed`: Missing in **733** rows (**73.3%**).
   - `recommended_date` & `recommended_amount`: Missing in **217** rows (**21.7%**).
     - **Critical Finding for Andhra Pradesh**: Missing in **200 / 200** works (**100.0%**). In AP, the source Excel sheet uses an isolated numbering series for recommendations that does not map to `work_id` in the sanctioned sheet.
     - Punjab missing: 9 (4.5%), Telangana missing: 3 (1.5%), Uttarakhand missing: 3 (1.5%), MP missing: 2 (1.0%).
   - `work_description`: Missing in **3** rows (**0.3%**).
   - `data_notes`: Missing in **494** rows (**49.4%**). Note: In AP, 100% of rows contain an administrative note explaining the recommendation ID mismatch.
   - Core identifiers (`work_id`, `state`, `constituency`, `mp_name`, `work`, `ida`, `sanction_date`, `sanction_amount`, `work_status`): **0% missing** (100% complete).

2. **`expenditure_transactions.csv` Table**:
   - Core fields (`expenditure_id`, `work_id`, `state`, `mp_name`, `constituency`, `expenditure_date`, `vendor_name`, `payment_status`, `fund_disbursed_amount`): **0% missing**.
   - `duplicate_group_id` & `duplicate_group_size`: Missing in **1,252** rows (**90.33%**), as expected since they are only assigned to duplicate occurrences.
   - `data_notes`: Missing in **1,274** rows (**91.92%**).

3. **`work_features.csv` Table**:
   - `total_expenditure`, `expenditure_vs_sanction_ratio`, `last_expenditure_date`, `days_since_last_expenditure`: Missing in **340** rows (**34.0%**), corresponding strictly to works with zero transactions.
   - `days_to_sanction`: Missing in **217** rows (**21.7%**), driven by missing `recommended_date`.
   - `days_to_completion`: Missing in **787** rows (**78.7%**), requiring both `recommended_date` and `completion_date`.
   - `disbursement_vs_sanction_ratio`: Missing in **733** rows (**73.3%**), driven by missing `amount_disbursed`.

---

## 5. Financial & Transactional Distributions

### Four Distinct Monetary Concepts

To maintain analytical rigor, Sentinel distinguishes four monetary dimensions:
1. **Sanctioned Amount**: Approved administrative ceiling per work.
2. **Total Expenditure**: Cumulative sum of transaction disbursements recorded in the transaction log for that work.
3. **Amount Disbursed**: Master-level work disbursement reported in the works register.
4. **Individual Transaction Amount**: Single disbursement line item in the expenditure log.

### Summary Statistics Table

| Metric | Count | Min | P10 | P25 | Median (P50) | Mean | P75 | P90 | P95 | P99 | Max | Std Dev |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Sanctioned Amount (₹)** | 1,000 | 16,665 | 1,29,000 | 2,00,000 | 4,00,000 | 6,93,405 | 7,55,572 | 15,00,000 | 24,95,000 | 50,00,000 | 1,61,77,075 | 10,96,124 |
| **Recommended Amount (₹)**| 783 | 16,665 | 1,00,000 | 2,00,000 | 3,00,000 | 5,97,611 | 6,16,092 | 10,23,709 | 18,00,000 | 50,00,000 | 1,61,77,075 | 10,17,610 |
| **Amount Disbursed (₹)** | 267 | 12,562 | 1,29,894 | 1,99,604 | 3,86,946 | 6,42,105 | 5,18,030 | 11,08,129 | 22,79,979 | 45,82,935 | 1,61,76,660 | 12,21,791 |
| **Total Exp (Active Works)**| 660 | 12,562 | 1,24,999 | 1,99,604 | 3,67,156 | 5,85,186 | 5,99,734 | 11,04,724 | 16,44,355 | 39,18,687 | 1,61,76,660 | 9,54,837 |
| **Individual Tx Amount (₹)**| 1,386 | 85 | 7,812 | 25,124 | 1,00,769 | 2,84,154 | 3,69,119 | 6,80,245 | 10,23,007 | 25,14,913 | 81,00,000 | 5,50,254 |
| **Exp / Sanction Ratio** | 660 | 0.1688 | 0.6000 | 0.9462 | 0.9989 | 0.9144 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.1737 |
| **Disb / Sanction Ratio** | 267 | 0.2799 | 0.9838 | 0.9981 | 1.0000 | 0.9861 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.0604 |

### Key Empirical Observations

1. **Upper Bound Strictness**: Both `expenditure_vs_sanction_ratio` and `disbursement_vs_sanction_ratio` exhibit a hard ceiling at **1.0000**. In this 1,000-work dataset, no work has cumulative expenditure or recorded disbursement strictly exceeding its sanctioned amount.
2. **Left-Tail Scope Reductions**: While expenditures do not exceed sanctions, a meaningful subset of completed works has very low expenditure-to-sanction ratios (minimum 0.1688, P10 0.6000). For example, work `WS/MP380/2025-2026/209175` is marked "Work Completed" with only 27.99% of its ₹10,00,000 budget utilized.
3. **Transaction Count Skewness**:
   - 46.7% of works have exactly 1 transaction.
   - 34.0% have 0 transactions.
   - 11.1% have 2 transactions.
   - Only 5.1% (51 works) have > 5 transactions, reaching an extreme outlier of 29 transactions.
4. **Vendor Count Distribution**:
   - 56.6% of works have exactly 1 vendor.
   - 3.4% have 2 vendors; 1.5% have 4 vendors.
   - Only 35 works (3.5%) have 5 or more distinct vendors, reaching an extreme of 21 vendors for a single ₹2,00,000 work.

---

## 6. Analysis of Deterministic Anomaly Indicators

| Anomaly Indicator | Total Works Affected | % of Works | Affected States | Key State Concentrations | Finding / Diagnostic |
| :--- | :---: | :---: | :--- | :--- | :--- |
| **`expenditure_exceeds_sanction`** | 0 | 0.0% | None | - | Ceiling strictly enforced in source accounting. |
| **`disbursement_exceeds_sanction`** | 0 | 0.0% | None | - | Ceiling strictly enforced in source accounting. |
| **`completed_without_completion_date`** | 0 | 0.0% | None | - | 100% of "Work Completed" entries have dates. |
| **`completed_without_disbursement`** | 4 | 0.4% | AP (1), Telangana (3) | AP (0.5%), Telangana (1.5%) | "Zombie" completion: Work marked completed on paper, but zero disbursement recorded in works or transactions. |
| **`high_transaction_count` (> 5)** | 51 | 5.1% | MP (3), Punjab (25), UK (23) | Punjab (12.5%), UK (11.5%) | Highly fragmented execution; transaction slicing across dozens of vouchers. |
| **`multiple_vendors` (> 1)** | 94 | 9.4% | MP (7), Punjab (45), TG (1), UK (41) | Punjab (22.5%), UK (20.5%) | Multi-vendor involvement on simple community works (up to 21 distinct vendors). |
| **`potential_duplicate_transaction`** | 22 | 2.2% | MP (2), Punjab (17), UK (3) | Punjab (8.5%), UK (1.5%), MP (1.0%) | Identical transaction attributes entered multiple times; redundant fund outflow. |
| **`expenditure_without_matching_work`** | 38 (tx) / 14 (works) | 2.74% (tx) | Punjab (38 tx) | Punjab (100% of unmatched) | Orphan disbursements: money spent without a parent record in works register (₹76.15 Lakhs). |

---

## 7. Deep-Dive: Duplicate Transactions

- **Total Duplicate Rows**: **134** transactions (**9.67%** of all 1,386 transactions).
- **Total Duplicate Groups**: **44** unique hash-based duplicate clusters.
- **Affected Works**: **23** works (22 in works master + 1 unmatched).
- **Total Potential Duplicate Disbursed Amount**: **₹44,04,754.00**.

### State-Wise Duplicate Breakdown

| State | Duplicate Rows | Duplicate Groups | Works Affected | % State Transactions | Potential Duplicate Amount (₹) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Punjab** | 100 | 27 | 18 | 22.12% | ₹33,84,820.00 |
| **Madhya Pradesh** | 12 | 6 | 2 | 4.78% | ₹9,48,165.00 |
| **Uttarakhand** | 22 | 11 | 3 | 5.66% | ₹71,769.00 |
| **Andhra Pradesh** | 0 | 0 | 0 | 0.00% | ₹0.00 |
| **Telangana** | 0 | 0 | 0 | 0.00% | ₹0.00 |

### Duplicate Group Size Distribution

- **Pairs (Size 2)**: 32 groups (64 rows)
- **Triples (Size 3)**: 4 groups (12 rows)
- **Quads (Size 4)**: 1 group (4 rows)
- **Quintuples (Size 5)**: 2 groups (10 rows)
- **Sextuples (Size 6)**: 1 group (6 rows)
- **Septuples (Size 7)**: 1 group (7 rows)
- **10-Repeats (Size 10)**: 2 groups (20 rows) — e.g. Shaheed Baba Dharam Singh Sekhon Traders in Punjab repeated 10 times with ₹68,400 on the exact same date!
- **11-Repeats (Size 11)**: 1 group (11 rows)

---

## 8. Deep-Dive: Unmatched Expenditure Work_IDs

- **Total Unmatched Transactions**: **38** transactions.
- **Distinct Unmatched Work IDs**: **14** IDs.
- **Total Unmatched Disbursed Amount**: **₹76,14,703.00**.
- **Geographic Concentration**: **100% in Punjab** (Constituency MP381).
- **Representative Pattern**:
  - `WS/MP381/2024-2025/153036`: ₹1,43,320 disbursed to `SURINDER TRADERS`.
  - `WS/MP381/2024-2025/164560`: Two disbursements of ₹1,00,585 and ₹99,415 to `SARPANCH GRAM PANCHAYAT JAUNS`.
  - `WS/MP381/2025-2026/203253`: Two duplicate disbursements of ₹35,000 each to `SARPANCH GRAM PANCHAYAT JHANDEY` (orphan AND duplicate!).

---

## 9. Statistical Outlier & Execution Delay Analysis

### Timeline Metric Distributions

| Metric | Sample Size | Min | Median | Mean | P90 | P95 | Max |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Days to Sanction** | 783 | 1 day | 68 days | 99.3 days | 221 days | 323 days | 532 days (~1.5 yrs) |
| **Days to Completion** | 213 | 10 days | 236 days | 249.8 days | 418 days | 477 days | 615 days (~1.7 yrs) |
| **Days Since Last Exp** | 660 | 2 days | 156 days | 195.4 days | 445 days | 499 days | 641 days (~21 mos) |

- **Sanity Validation**: 0 works have negative `days_to_sanction` or negative `days_to_completion`.
- **Prolonged Inactivity Outliers**: 10% of active works have had no financial transactions for > 445 days (up to 641 days), indicating stalled or abandoned projects.
