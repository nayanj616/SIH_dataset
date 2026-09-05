"""Sentinel Risk Score v1 Engine.

Evaluates 1,000 MPLADS works across four independent dimensions:
  1. Financial Integrity (35%)
  2. Transaction Pattern (30%)
  3. Lifecycle & Execution (20%)
  4. Data Quality & Reconciliation (15%)

Produces three output artifacts in scored/:
  - work_risk_scores.csv (one row per work)
  - risk_signals.csv (one row per triggered signal)
  - risk_evidence.json (hierarchical evidence payload with raw transaction vouchers)
"""

from __future__ import annotations

import csv
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any

# Directory paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "processed"
OUTPUT_DIR = BASE_DIR / "scored"

STATES = ["andhra_pradesh", "madhya_pradesh", "punjab", "telangana", "uttarakhand"]

# Thresholds calibrated to 5-state baseline empirical quantiles
THRESHOLDS = {
    "slicing_extreme": 15,          # Top 1% percentile
    "slicing_high": 6,              # P95 percentile
    "vendor_sprawl_extreme": 8,     # Top 1% percentile
    "vendor_sprawl_high": 3,        # P90 percentile
    "prolonged_stagnation_days": 445, # P90 days since last expenditure
    "delay_sanction_days": 323,     # P95 days to sanction
    "delay_completion_days": 477,   # P95 days to completion
    "early_stage_exp_ratio": 0.75,  # 75% budget in early stage
    "severe_under_util_ratio": 0.40,# < 40% budget on completed work
    "dup_exposure_high_ratio": 0.30,# >= 30% duplicate ratio
    "dup_exposure_mod_ratio": 0.05, # >= 5% duplicate ratio
}


def parse_float(val: Any) -> float | None:
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("nan", "nat", "none", ""):
        return None
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def parse_int(val: Any) -> int | None:
    f = parse_float(val)
    return int(f) if f is not None and not math.isnan(f) else None


def normalize_status(status: str | None) -> str:
    return str(status or "").strip().lower()


def load_processed_data() -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]], list[dict[str, Any]]]:
    """Load works, features, transactions, and orphan transactions across all states."""
    works: list[dict[str, Any]] = []
    features: dict[str, dict[str, Any]] = {}
    txs_by_work: dict[str, list[dict[str, Any]]] = defaultdict(list)
    orphan_txs: list[dict[str, Any]] = []

    for state in STATES:
        state_dir = DATA_DIR / state
        works_file = state_dir / "works.csv"
        feat_file = state_dir / "work_features.csv"
        tx_file = state_dir / "expenditure_transactions.csv"

        if works_file.exists():
            with open(works_file, mode="r", encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    row["state_slug"] = state
                    works.append(row)

        if feat_file.exists():
            with open(feat_file, mode="r", encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    features[row["work_id"]] = row

        if tx_file.exists():
            with open(tx_file, mode="r", encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    wid = row["work_id"]
                    is_unmatched = str(row.get("expenditure_without_matching_work", "")).strip().lower() == "true"
                    if is_unmatched:
                        orphan_txs.append(row)
                    txs_by_work[wid].append(row)

    return works, features, txs_by_work, orphan_txs


def extract_evidence_transactions(transactions: list[dict[str, Any]], filter_type: str = "all", max_records: int = 10) -> list[dict[str, Any]]:
    """Extract clean transaction vouchers for the evidence JSON payload."""
    matched: list[dict[str, Any]] = []
    for t in transactions:
        if filter_type == "duplicates":
            if str(t.get("is_exact_duplicate", "")).strip().lower() == "true":
                matched.append({
                    "expenditure_id": t.get("expenditure_id"),
                    "expenditure_date": t.get("expenditure_date"),
                    "vendor_name": t.get("vendor_name"),
                    "fund_disbursed_amount": parse_float(t.get("fund_disbursed_amount")),
                    "payment_status": t.get("payment_status"),
                    "duplicate_group_id": t.get("duplicate_group_id"),
                    "potential_duplicate_amount": parse_float(t.get("potential_duplicate_amount")),
                })
        else:
            matched.append({
                "expenditure_id": t.get("expenditure_id"),
                "expenditure_date": t.get("expenditure_date"),
                "vendor_name": t.get("vendor_name"),
                "fund_disbursed_amount": parse_float(t.get("fund_disbursed_amount")),
                "payment_status": t.get("payment_status"),
            })

    return matched[:max_records]


def evaluate_work_signals(
    work: dict[str, Any],
    feat: dict[str, Any],
    txs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Evaluate deterministic signals across all 4 dimensions for a single work."""
    signals: list[dict[str, Any]] = []

    # Parsed metrics
    sanction_amt = parse_float(work.get("sanction_amount")) or 0.0
    amount_disb = parse_float(work.get("amount_disbursed"))
    total_exp = parse_float(feat.get("total_expenditure")) or 0.0
    tx_count = parse_int(feat.get("expenditure_transaction_count")) or len(txs)
    vendor_count = parse_int(feat.get("unique_vendor_count")) or len(set(t["vendor_name"] for t in txs if t.get("vendor_name")))
    pot_dup_amt = parse_float(feat.get("potential_duplicate_amount_total")) or 0.0
    
    # Calculate duplicate details explicitly
    dup_rows = [t for t in txs if str(t.get("is_exact_duplicate", "")).strip().lower() == "true"]
    participating_dup_rows = len(dup_rows)
    excess_dup_rows = [t for t in txs if (parse_float(t.get("potential_duplicate_amount")) or 0.0) > 0.0]
    excess_dup_count = len(excess_dup_rows)
    dup_groups = set(t.get("duplicate_group_id") for t in dup_rows if t.get("duplicate_group_id"))
    dup_group_count = len(dup_groups)

    status_norm = normalize_status(work.get("work_status"))
    is_completed = status_norm in ("completed", "work completed")
    is_early_stage = status_norm in ("sanction", "vendor identification", "time estimation")

    exp_to_sanction = total_exp / sanction_amt if sanction_amt > 0 else 0.0
    dup_exposure_ratio = pot_dup_amt / total_exp if total_exp > 0 else 0.0

    days_to_sanc = parse_int(feat.get("days_to_sanction"))
    days_to_comp = parse_int(feat.get("days_to_completion"))
    days_since_last_exp = parse_int(feat.get("days_since_last_expenditure"))

    # =========================================================================
    # 1. FINANCIAL INTEGRITY SIGNALS
    # =========================================================================
    if dup_exposure_ratio >= THRESHOLDS["dup_exposure_high_ratio"]:
        pts = 70 if dup_exposure_ratio >= 0.60 else round(40 + (dup_exposure_ratio - 0.30) / 0.30 * 30)
        signals.append({
            "signal_id": "FIN_DUP_EXPOSURE_HIGH",
            "dimension": "financial_integrity",
            "severity": "High",
            "points": pts,
            "title": "Severe Potential Duplicate Financial Exposure",
            "evidence_summary": f"Potential duplicate disbursements total ₹{pot_dup_amt:,.2f}, representing {dup_exposure_ratio:.1%} of total recorded expenditure (₹{total_exp:,.2f}).",
            "threshold": f">= {THRESHOLDS['dup_exposure_high_ratio']:.0%} duplicate expenditure ratio",
            "observed_value": f"{dup_exposure_ratio:.1%}",
            "evidence_transactions": extract_evidence_transactions(txs, "duplicates", 8),
        })
    elif dup_exposure_ratio >= THRESHOLDS["dup_exposure_mod_ratio"]:
        signals.append({
            "signal_id": "FIN_DUP_EXPOSURE_MOD",
            "dimension": "financial_integrity",
            "severity": "Moderate",
            "points": 25,
            "title": "Moderate Potential Duplicate Financial Exposure",
            "evidence_summary": f"Potential duplicate disbursements total ₹{pot_dup_amt:,.2f}, representing {dup_exposure_ratio:.1%} of total recorded expenditure (₹{total_exp:,.2f}).",
            "threshold": f">= {THRESHOLDS['dup_exposure_mod_ratio']:.0%} duplicate expenditure ratio",
            "observed_value": f"{dup_exposure_ratio:.1%}",
            "evidence_transactions": extract_evidence_transactions(txs, "duplicates", 5),
        })

    if is_completed and total_exp == 0.0 and (amount_disb is None or amount_disb == 0.0):
        signals.append({
            "signal_id": "FIN_CERTIFIED_ZERO_DISB",
            "dimension": "financial_integrity",
            "severity": "Moderate",
            "points": 35,
            "title": "Certified Complete with Zero Recorded Financial Trail",
            "evidence_summary": f"Project is certified as '{work.get('work_status')}', but ₹0 expenditure transactions and ₹0 master disbursement are recorded.",
            "threshold": "Status == Completed AND total_expenditure == 0 AND amount_disbursed == 0",
            "observed_value": "Exp: ₹0, Disb: ₹0",
            "evidence_transactions": [],
        })
    elif is_completed and total_exp > 0.0 and exp_to_sanction < THRESHOLDS["severe_under_util_ratio"]:
        signals.append({
            "signal_id": "FIN_SEVERE_UNDER_UTIL",
            "dimension": "financial_integrity",
            "severity": "Moderate",
            "points": 20,
            "title": "Severe Budget Under-Expenditure at Completion",
            "evidence_summary": f"Work completed with only {exp_to_sanction:.1%} of sanctioned budget spent (₹{total_exp:,.2f} spent of ₹{sanction_amt:,.2f} sanctioned).",
            "threshold": f"< {THRESHOLDS['severe_under_util_ratio']:.0%} expenditure ratio at completion",
            "observed_value": f"{exp_to_sanction:.1%}",
            "evidence_transactions": extract_evidence_transactions(txs, "all", 4),
        })

    # =========================================================================
    # 2. TRANSACTION PATTERN SIGNALS
    # =========================================================================
    if excess_dup_count >= 10:
        signals.append({
            "signal_id": "TX_EXACT_DUP_CLUSTER",
            "dimension": "transaction_pattern",
            "severity": "High",
            "points": 50,
            "title": "Large Cluster of Exact Duplicate Transactions",
            "evidence_summary": f"{participating_dup_rows} transactions participate in duplicate groups ({excess_dup_count} excess redundant copies across {dup_group_count} clusters).",
            "threshold": ">= 10 excess duplicate transactions",
            "observed_value": f"{excess_dup_count} excess copies ({participating_dup_rows} participating)",
            "evidence_transactions": extract_evidence_transactions(txs, "duplicates", 8),
        })
    elif excess_dup_count >= 4:
        signals.append({
            "signal_id": "TX_EXACT_DUP_CLUSTER",
            "dimension": "transaction_pattern",
            "severity": "High",
            "points": 40,
            "title": "Multiple Exact Duplicate Transactions",
            "evidence_summary": f"{participating_dup_rows} transactions participate in duplicate groups ({excess_dup_count} excess redundant copies across {dup_group_count} clusters).",
            "threshold": ">= 4 excess duplicate transactions",
            "observed_value": f"{excess_dup_count} excess copies ({participating_dup_rows} participating)",
            "evidence_transactions": extract_evidence_transactions(txs, "duplicates", 6),
        })
    elif excess_dup_count >= 1:
        signals.append({
            "signal_id": "TX_EXACT_DUP_CLUSTER",
            "dimension": "transaction_pattern",
            "severity": "Moderate",
            "points": 30,
            "title": "Exact Duplicate Transactions Present",
            "evidence_summary": f"{participating_dup_rows} transactions participate in duplicate groups ({excess_dup_count} excess redundant copies across {dup_group_count} clusters).",
            "threshold": ">= 1 excess duplicate transaction",
            "observed_value": f"{excess_dup_count} excess copies ({participating_dup_rows} participating)",
            "evidence_transactions": extract_evidence_transactions(txs, "duplicates", 4),
        })

    # Slicing (Mutually Exclusive)
    if tx_count >= THRESHOLDS["slicing_extreme"]:
        signals.append({
            "signal_id": "TX_SLICING_EXTREME",
            "dimension": "transaction_pattern",
            "severity": "High",
            "points": 35,
            "title": "Extreme Transaction Slicing",
            "evidence_summary": f"Expenditure is fragmented across {tx_count} separate payment transactions (top 1% percentile across 1,000 works).",
            "threshold": f">= {THRESHOLDS['slicing_extreme']} transactions",
            "observed_value": tx_count,
            "evidence_transactions": extract_evidence_transactions(txs, "all", 6),
        })
    elif tx_count >= THRESHOLDS["slicing_high"]:
        signals.append({
            "signal_id": "TX_SLICING_HIGH",
            "dimension": "transaction_pattern",
            "severity": "Moderate",
            "points": 20,
            "title": "High Transaction Slicing",
            "evidence_summary": f"Expenditure is fragmented across {tx_count} separate payment transactions (P95 percentile).",
            "threshold": f">= {THRESHOLDS['slicing_high']} transactions",
            "observed_value": tx_count,
            "evidence_transactions": extract_evidence_transactions(txs, "all", 5),
        })

    # Vendor Sprawl (Mutually Exclusive)
    if vendor_count >= THRESHOLDS["vendor_sprawl_extreme"]:
        signals.append({
            "signal_id": "TX_VENDOR_SPRAWL_EXTREME",
            "dimension": "transaction_pattern",
            "severity": "High",
            "points": 35,
            "title": "Extreme Vendor Sprawl",
            "evidence_summary": f"Expenditure is disbursed across {vendor_count} distinct contracting entities for this work (top 1% percentile).",
            "threshold": f">= {THRESHOLDS['vendor_sprawl_extreme']} vendors",
            "observed_value": vendor_count,
            "evidence_transactions": extract_evidence_transactions(txs, "all", 6),
        })
    elif vendor_count >= THRESHOLDS["vendor_sprawl_high"]:
        signals.append({
            "signal_id": "TX_VENDOR_SPRAWL_HIGH",
            "dimension": "transaction_pattern",
            "severity": "Moderate",
            "points": 20,
            "title": "High Vendor Concentration",
            "evidence_summary": f"Expenditure is disbursed across {vendor_count} distinct contracting entities (P90 percentile).",
            "threshold": f">= {THRESHOLDS['vendor_sprawl_high']} vendors",
            "observed_value": vendor_count,
            "evidence_transactions": extract_evidence_transactions(txs, "all", 4),
        })

    # Early-Stage High Expenditure
    if is_early_stage and total_exp > 0.0 and exp_to_sanction >= THRESHOLDS["early_stage_exp_ratio"]:
        signals.append({
            "signal_id": "TX_EARLY_STAGE_HIGH_EXP",
            "dimension": "transaction_pattern",
            "severity": "Moderate",
            "points": 30,
            "title": "High Proportion of Expenditure at Early Administrative Stage",
            "evidence_summary": f"{exp_to_sanction:.1%} of sanctioned budget is represented by expenditure transactions (₹{total_exp:,.2f}) while project status remains officially in '{work.get('work_status')}'.",
            "threshold": f">= {THRESHOLDS['early_stage_exp_ratio']:.0%} expenditure in preliminary status",
            "observed_value": f"{exp_to_sanction:.1%} spent during '{work.get('work_status')}'",
            "evidence_transactions": extract_evidence_transactions(txs, "all", 4),
        })

    # =========================================================================
    # 3. LIFECYCLE & EXECUTION SIGNALS
    # =========================================================================
    if not is_completed and days_since_last_exp is not None and days_since_last_exp > THRESHOLDS["prolonged_stagnation_days"]:
        signals.append({
            "signal_id": "LIFE_PROLONGED_STAGNATION",
            "dimension": "lifecycle_execution",
            "severity": "Moderate",
            "points": 30,
            "title": "Prolonged Inactivity on Active Work",
            "evidence_summary": f"No expenditure transactions recorded for {days_since_last_exp} days (P90 delay threshold) on an uncompleted project.",
            "threshold": f"> {THRESHOLDS['prolonged_stagnation_days']} days since last expenditure",
            "observed_value": f"{days_since_last_exp} days",
            "evidence_transactions": extract_evidence_transactions(txs, "all", 2),
        })

    if days_to_sanc is not None and days_to_sanc > THRESHOLDS["delay_sanction_days"]:
        signals.append({
            "signal_id": "LIFE_SEVERE_DELAY_SANCTION",
            "dimension": "lifecycle_execution",
            "severity": "Moderate",
            "points": 20,
            "title": "Abnormal Administrative Sanction Delay",
            "evidence_summary": f"Sanction required {days_to_sanc} days from recommendation date (P95 threshold).",
            "threshold": f"> {THRESHOLDS['delay_sanction_days']} days",
            "observed_value": f"{days_to_sanc} days",
            "evidence_transactions": [],
        })

    if days_to_comp is not None and days_to_comp > THRESHOLDS["delay_completion_days"]:
        signals.append({
            "signal_id": "LIFE_SEVERE_DELAY_COMP",
            "dimension": "lifecycle_execution",
            "severity": "Moderate",
            "points": 25,
            "title": "Abnormal Execution Duration to Completion",
            "evidence_summary": f"Completion required {days_to_comp} days from recommendation date (P95 threshold).",
            "threshold": f"> {THRESHOLDS['delay_completion_days']} days",
            "observed_value": f"{days_to_comp} days",
            "evidence_transactions": [],
        })

    if is_early_stage and total_exp > 0.0 and exp_to_sanction >= THRESHOLDS["early_stage_exp_ratio"]:
        signals.append({
            "signal_id": "LIFE_STATUS_DISCONNECT",
            "dimension": "lifecycle_execution",
            "severity": "Moderate",
            "points": 25,
            "title": "Milestone Sequencing Inconsistency",
            "evidence_summary": f"Complete or near-complete financial disbursement precedes formal physical execution milestones (Status: '{work.get('work_status')}').",
            "threshold": "Substantial financial execution prior to execution milestone",
            "observed_value": f"Status: {work.get('work_status')}, Exp: {exp_to_sanction:.1%}",
            "evidence_transactions": [],
        })

    # =========================================================================
    # 4. DATA QUALITY & RECONCILIATION SIGNALS
    # =========================================================================
    # Meaningful reconciliation anomaly:
    # Condition 1: tx expenditure exists, but master disbursement is missing
    # Condition 2: work is completed, but master disbursement is missing
    # Condition 3: both populated, but differ by > 5% of sanction
    has_disb_gap = False
    disb_gap_reason = ""
    if total_exp > 0.0 and (amount_disb is None or amount_disb == 0.0):
        has_disb_gap = True
        disb_gap_reason = f"Expenditure transactions record ₹{total_exp:,.2f} disbursed, but master amount_disbursed is unpopulated."
    elif is_completed and (amount_disb is None or amount_disb == 0.0):
        has_disb_gap = True
        disb_gap_reason = "Work is certified completed, but master amount_disbursed is null/unpopulated."
    elif amount_disb is not None and total_exp > 0.0 and sanction_amt > 0.0:
        diff = abs(total_exp - amount_disb)
        if diff > 0.05 * sanction_amt:
            has_disb_gap = True
            disb_gap_reason = f"Master amount_disbursed (₹{amount_disb:,.2f}) differs from transaction sum (₹{total_exp:,.2f}) by ₹{diff:,.2f} (> 5% of sanction)."

    if has_disb_gap:
        signals.append({
            "signal_id": "DQ_DISBURSEMENT_RECONCILIATION_GAP",
            "dimension": "data_quality",
            "severity": "Moderate",
            "points": 25,
            "title": "Master Disbursement vs Transaction Ledger Reconciliation Gap",
            "evidence_summary": disb_gap_reason,
            "threshold": "Transaction expenditure without master disbursement OR completed without disbursement OR > 5% mismatch",
            "observed_value": f"Disb: {amount_disb}, Exp: {total_exp}",
            "evidence_transactions": extract_evidence_transactions(txs, "all", 3),
        })

    # State catalog disconnect (e.g. Andhra Pradesh recommendation ID series mismatch)
    data_notes = str(work.get("data_notes") or "").lower()
    is_ap_mismatch = (work.get("state") or "").lower() == "andhra pradesh" or "works recommended source" in data_notes
    if is_ap_mismatch:
        signals.append({
            "signal_id": "DQ_MISSING_REC_SERIES",
            "dimension": "data_quality",
            "severity": "Low",
            "points": 15,
            "title": "State Recommendation Catalog Uncoupling",
            "evidence_summary": "Recommended sheet Work_ID series does not map to sanctioned master series in source workbook; recommendation dates unlinked.",
            "threshold": "State-level recommendation series unmapped",
            "observed_value": "AP Catalog Uncoupling",
            "evidence_transactions": [],
        })

    # Missing core descriptive metadata
    work_desc = str(work.get("work_description") or "").strip()
    if not work_desc or work_desc.lower() in ("nan", "none", ""):
        signals.append({
            "signal_id": "DQ_MISSING_CORE_DESC",
            "dimension": "data_quality",
            "severity": "Moderate",
            "points": 20,
            "title": "Missing Statutory Work Description",
            "evidence_summary": "The statutory project description field is blank or unpopulated in the works register.",
            "threshold": "work_description is null or blank",
            "observed_value": "<BLANK>",
            "evidence_transactions": [],
        })

    return signals


def compute_dimension_scores(signals: list[dict[str, Any]]) -> dict[str, int]:
    """Compute capped (0-100) scores for each of the 4 dimensions."""
    dim_points: dict[str, int] = {
        "financial_integrity": 0,
        "transaction_pattern": 0,
        "lifecycle_execution": 0,
        "data_quality": 0,
    }

    for s in signals:
        dim = s["dimension"]
        dim_points[dim] = dim_points.get(dim, 0) + s["points"]

    # Cap each dimension at 100
    return {dim: min(100, pts) for dim, pts in dim_points.items()}


def compute_composite_score(dimension_scores: dict[str, int]) -> tuple[int, str, bool]:
    """Compute the weighted composite risk score and assign severity tier."""
    raw_composite = (
        0.35 * dimension_scores["financial_integrity"]
        + 0.30 * dimension_scores["transaction_pattern"]
        + 0.20 * dimension_scores["lifecycle_execution"]
        + 0.15 * dimension_scores["data_quality"]
    )

    # Critical Override Rule:
    # If financial integrity risk is >= 70 (severe duplicate exposure or unlinked funds),
    # the composite score cannot fall below 70.
    if dimension_scores["financial_integrity"] >= 70:
        final_score = round(max(raw_composite, 70.0))
    else:
        final_score = round(raw_composite)

    # Ensure bounded [0, 100]
    final_score = max(0, min(100, final_score))

    # Determine risk level
    if final_score >= 70:
        risk_level = "High Risk"
    elif final_score >= 40:
        risk_level = "Elevated Risk"
    elif final_score >= 20:
        risk_level = "Moderate"
    else:
        risk_level = "Low / Normal"

    requires_human_review = final_score >= 40
    return final_score, risk_level, requires_human_review


def evaluate_all_works() -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    """Execute Sentinel Risk Score v1 across all works."""
    works, features, txs_by_work, orphan_txs = load_processed_data()

    score_rows: list[dict[str, Any]] = []
    signal_rows: list[dict[str, Any]] = []
    evidence_payload: dict[str, Any] = {}

    for work in works:
        wid = work["work_id"]
        feat = features.get(wid, {})
        txs = txs_by_work.get(wid, [])

        signals = evaluate_work_signals(work, feat, txs)
        dim_scores = compute_dimension_scores(signals)
        final_score, risk_level, requires_review = compute_composite_score(dim_scores)

        # 1. Row for work_risk_scores.csv
        score_rows.append({
            "work_id": wid,
            "state": work.get("state"),
            "risk_score": final_score,
            "risk_level": risk_level,
            "financial_integrity_score": dim_scores["financial_integrity"],
            "transaction_pattern_score": dim_scores["transaction_pattern"],
            "lifecycle_execution_score": dim_scores["lifecycle_execution"],
            "data_quality_score": dim_scores["data_quality"],
            "requires_human_review": requires_review,
        })

        # 2. Rows for risk_signals.csv
        for s in signals:
            signal_rows.append({
                "work_id": wid,
                "signal_id": s["signal_id"],
                "dimension": s["dimension"],
                "severity": s["severity"],
                "points": s["points"],
                "observed_value": s["observed_value"],
                "threshold": s["threshold"],
                "evidence_summary": s["evidence_summary"],
            })

        # Duplicate counts
        dup_rows = [t for t in txs if str(t.get("is_exact_duplicate", "")).strip().lower() == "true"]
        excess_dup_rows = [t for t in txs if (parse_float(t.get("potential_duplicate_amount")) or 0.0) > 0.0]
        dup_groups = set(t.get("duplicate_group_id") for t in dup_rows if t.get("duplicate_group_id"))

        # 3. Payload for risk_evidence.json
        evidence_payload[wid] = {
            "work_id": wid,
            "state": work.get("state"),
            "constituency": work.get("constituency"),
            "mp_name": work.get("mp_name"),
            "work_category": work.get("work_category"),
            "work_title": work.get("work"),
            "sanction_amount": parse_float(work.get("sanction_amount")),
            "total_expenditure": parse_float(feat.get("total_expenditure")),
            "amount_disbursed": parse_float(work.get("amount_disbursed")),
            "work_status": work.get("work_status"),
            "risk_score": final_score,
            "risk_level": risk_level,
            "requires_human_review": requires_review,
            "dimension_scores": dim_scores,
            "summary_metrics": {
                "expenditure_transaction_count": parse_int(feat.get("expenditure_transaction_count")) or len(txs),
                "unique_vendor_count": parse_int(feat.get("unique_vendor_count")) or len(set(t["vendor_name"] for t in txs if t.get("vendor_name"))),
                "participating_duplicate_rows": len(dup_rows),
                "duplicate_group_count": len(dup_groups),
                "excess_duplicate_count": len(excess_dup_rows),
                "potential_duplicate_amount": parse_float(feat.get("potential_duplicate_amount_total")) or 0.0,
                "expenditure_vs_sanction_ratio": parse_float(feat.get("expenditure_vs_sanction_ratio")),
                "days_since_last_expenditure": parse_int(feat.get("days_since_last_expenditure")),
            },
            "triggered_signals": signals,
        }

    # Also record orphan expenditure works in the evidence store
    orphan_groups = defaultdict(list)
    for otx in orphan_txs:
        orphan_groups[otx["work_id"]].append(otx)

    orphan_summary: dict[str, Any] = {}
    for wid, otx_list in orphan_groups.items():
        tot_amt = sum(parse_float(t.get("fund_disbursed_amount")) or 0.0 for t in otx_list)
        orphan_summary[wid] = {
            "work_id": wid,
            "state": otx_list[0].get("state", "Punjab"),
            "constituency": otx_list[0].get("constituency"),
            "transaction_count": len(otx_list),
            "total_unmatched_amount": tot_amt,
            "transactions": extract_evidence_transactions(otx_list, "all", 10),
            "status": "Orphan Transaction Work (No matching Works Master entry)",
        }
    evidence_payload["_metadata"] = {
        "engine": "Sentinel-RiskScore-v1",
        "total_works_scored": len(score_rows),
        "total_signals_triggered": len(signal_rows),
        "total_orphan_works": len(orphan_summary),
        "orphan_works": orphan_summary,
    }

    return score_rows, signal_rows, evidence_payload


def main() -> None:
    print("Executing Sentinel Risk Score v1 Engine...")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    score_rows, signal_rows, evidence_payload = evaluate_all_works()

    # 1. Write work_risk_scores.csv
    scores_file = OUTPUT_DIR / "work_risk_scores.csv"
    score_cols = [
        "work_id",
        "state",
        "risk_score",
        "risk_level",
        "financial_integrity_score",
        "transaction_pattern_score",
        "lifecycle_execution_score",
        "data_quality_score",
        "requires_human_review",
    ]
    with open(scores_file, mode="w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=score_cols)
        writer.writeheader()
        writer.writerows(score_rows)
    print(f"-> Generated {scores_file} ({len(score_rows)} works)")

    # 2. Write risk_signals.csv
    signals_file = OUTPUT_DIR / "risk_signals.csv"
    signal_cols = [
        "work_id",
        "signal_id",
        "dimension",
        "severity",
        "points",
        "observed_value",
        "threshold",
        "evidence_summary",
    ]
    with open(signals_file, mode="w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=signal_cols)
        writer.writeheader()
        writer.writerows(signal_rows)
    print(f"-> Generated {signals_file} ({len(signal_rows)} triggered signals)")

    # 3. Write risk_evidence.json
    evidence_file = OUTPUT_DIR / "risk_evidence.json"
    with open(evidence_file, mode="w", encoding="utf-8") as f:
        json.dump(evidence_payload, f, indent=2)
    print(f"-> Generated {evidence_file} ({len(evidence_payload) - 1} works with rich evidence)")

    # Execution summary
    levels = defaultdict(int)
    for r in score_rows:
        levels[r["risk_level"]] += 1

    print("\nSentinel Risk Score v1 Execution Summary:")
    for lvl in ["Low / Normal", "Moderate", "Elevated Risk", "High Risk"]:
        cnt = levels[lvl]
        pct = (cnt / len(score_rows)) * 100
        print(f"  - {lvl:<15}: {cnt:>4} works ({pct:>5.1f}%)")
    
    review_count = sum(1 for r in score_rows if r["requires_human_review"])
    print(f"  - Human Review Required: {review_count} works ({(review_count/len(score_rows))*100:.1f}%)")


if __name__ == "__main__":
    main()

