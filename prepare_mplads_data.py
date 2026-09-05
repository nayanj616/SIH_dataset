"""Prepare a standardized MPLADS workbook without changing its source data.

Usage:
  python prepare_mplads_data.py --input Uttarakhand.xlsx --output processed/uttarakhand

The source-column maps below are the only workbook-specific portion.  Add a
compatible state's map (if its headers differ) without changing cleaning,
validation, or feature-generation logic.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


# Explicit configuration: never use the machine's current date implicitly.
REFERENCE_DATE = "2026-09-05"
HIGH_TRANSACTION_COUNT_THRESHOLD = 5

SHEET_ROLE_TOKENS = {
    "works": "works_master",
    "expenditure": "expenditure_transactions",
}

# Target field -> actual source field. Keep mappings separate from all logic.
WORKS_COLUMN_MAP = {
    "work_id": "Work_ID",
    "lok_sabha": "Lok_Sabha",
    "state": "State",
    "constituency": "Constituency",
    "mp_name": "MP_Name",
    "work_category": "Work_Category",
    "work": "Work",
    "work_description": "Work_Description",
    "ida": "IDA",
    "recommended_date": "Recommended_Date",
    "recommended_amount": "Recommended_Amount",
    "sanction_date": "Sanction_Date",
    "sanction_amount": "Sanction_Amount",
    "work_status": "Work_Status",
    "completion_date": "Completion_Date",
    "amount_disbursed": "Amount_Disbursed",
    "data_notes": "Data_Notes",
}

EXPENDITURE_COLUMN_MAP = {
    "work_id": "Work_ID",
    "state": "State",
    "mp_name": "MP_Name",
    "constituency": "Constituency",
    "expenditure_date": "Expenditure_Date",
    "vendor_name": "Vendor_Name",
    "payment_status": "Payment_Status",
    "fund_disbursed_amount": "Fund_Disbursed_Amount",
    "data_notes": "Data_Notes",
}
# Optional standardized attributes are included only if the source workbook has
# them. IDA is deliberately not inferred from the works table.
OPTIONAL_EXPENDITURE_COLUMN_MAP = {"ida": "IDA"}

WORKS_COLUMNS = list(WORKS_COLUMN_MAP)
DUPLICATE_COMPARISON_BASE_FIELDS = [
    "work_id", "state", "mp_name", "constituency", "expenditure_date",
    "vendor_name", "payment_status", "fund_disbursed_amount",
]
DUPLICATE_FEATURE_FIELDS = [
    "is_exact_duplicate", "duplicate_group_id", "duplicate_group_size",
    "potential_duplicate_amount",
]
EXPENDITURE_RISK_FIELDS = ["expenditure_without_matching_work"]
DATE_FIELDS = {
    "works": ["recommended_date", "sanction_date", "completion_date"],
    "expenditure": ["expenditure_date"],
}
MONEY_FIELDS = {
    "works": ["recommended_amount", "sanction_amount", "amount_disbursed"],
    "expenditure": ["fund_disbursed_amount"],
}
HEADER_ROW_SIGNATURES = {
    "works": {"Work_ID", "State", "Recommended_Date", "Sanction_Date"},
    "expenditure": {"Work_ID", "State", "Expenditure_Date", "Fund_Disbursed_Amount"},
}


def require_columns(frame: pd.DataFrame, mapping: dict[str, str], sheet: str) -> None:
    missing = sorted(set(mapping.values()) - set(frame.columns))
    if missing:
        raise ValueError(f"Sheet {sheet!r} is missing required columns: {missing}")


def resolve_sheet_roles(workbook: pd.ExcelFile) -> dict[str, str]:
    """Resolve compatible workbook sheet roles without relying on a state prefix.

    Examples include M4_WORKS_MASTER and M5_WORKS_MASTER. The role token is
    stable while the numeric workbook/module prefix is allowed to vary by state.
    """
    resolved: dict[str, str] = {}
    for role, token in SHEET_ROLE_TOKENS.items():
        matches = [sheet for sheet in workbook.sheet_names if token in sheet.casefold()]
        if len(matches) != 1:
            raise ValueError(
                f"Expected exactly one {role} sheet containing {token!r}; found {matches}."
            )
        resolved[role] = matches[0]
    return resolved


def read_source_sheet(input_path: Path, sheet_name: str, role: str) -> tuple[pd.DataFrame, int, int]:
    """Read a role sheet with its real header, safely skipping template preamble rows.

    A header is identified from a role-specific set of required column names.
    Only completely blank rows after that header are excluded; partially filled
    rows are preserved for data-quality handling rather than silently dropped.
    """
    raw_preview = pd.read_excel(input_path, sheet_name=sheet_name, header=None, nrows=50)
    required_headers = HEADER_ROW_SIGNATURES[role]
    header_row = next((
        row_index for row_index, row in raw_preview.iterrows()
        if required_headers.issubset({str(value).strip() for value in row.dropna()})
    ), None)
    if header_row is None:
        raise ValueError(
            f"Could not find a {role} header row in sheet {sheet_name!r}; "
            f"expected at least {sorted(required_headers)}."
        )
    source = pd.read_excel(input_path, sheet_name=sheet_name, header=header_row)
    blank_rows_after_header = int(source.isna().all(axis=1).sum())
    source = source.dropna(axis=0, how="all")
    return source, int(header_row), blank_rows_after_header


def is_present(value: Any) -> bool:
    return not pd.isna(value) and str(value).strip() != ""


def parse_money(value: Any) -> float | None:
    """Parse numeric and common INR-formatted values; leave missing as null."""
    if not is_present(value):
        return None
    if isinstance(value, (int, float, np.number)) and not isinstance(value, bool):
        return float(value)
    cleaned = str(value).strip().replace("₹", "").replace(",", "")
    cleaned = re.sub(r"(?i)\bINR\b|\bRS\.?\b", "", cleaned).strip()
    # Parentheses are an unambiguous common representation for negatives.
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = "-" + cleaned[1:-1].strip()
    try:
        return float(cleaned)
    except (TypeError, ValueError):
        return None


def parse_date(value: Any) -> pd.Timestamp | pd.NaT:
    if not is_present(value):
        return pd.NaT
    return pd.to_datetime(value, errors="coerce")


def make_standard_table(
    source: pd.DataFrame,
    mapping: dict[str, str],
    table_name: str,
    source_sheet: str,
    source_header_row: int,
    findings: list[dict[str, Any]],
) -> pd.DataFrame:
    """Select mapped fields and clean dates/money while recording conversion issues."""
    require_columns(source, mapping, source_sheet)
    standard = source.loc[:, list(mapping.values())].rename(
        columns={source_name: target_name for target_name, source_name in mapping.items()}
    ).copy()

    for field in DATE_FIELDS[table_name]:
        original = standard[field].copy()
        standard[field] = original.map(parse_date)
        invalid = original.map(is_present) & standard[field].isna()
        for source_row in original.index[invalid]:
            findings.append({
                "check_name": "invalid_unparseable_date",
                "table": table_name,
                "field": field,
                "source_row": int(source_row) + source_header_row + 2,
                "record_id": None,
                "count": 1,
                "details": str(original.loc[source_row]),
            })

    for field in MONEY_FIELDS[table_name]:
        original = standard[field].copy()
        standard[field] = original.map(parse_money).astype("Float64")
        invalid = original.map(is_present) & standard[field].isna()
        for source_row in original.index[invalid]:
            findings.append({
                "check_name": "invalid_non_numeric_monetary_value",
                "table": table_name,
                "field": field,
                "source_row": int(source_row) + source_header_row + 2,
                "record_id": None,
                "count": 1,
                "details": str(original.loc[source_row]),
            })
    return standard


def normalize_duplicate_value(value: Any) -> str:
    """Canonical comparison form only; stored source values are never changed."""
    if not is_present(value):
        return "<NULL>"
    if isinstance(value, pd.Timestamp):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, (int, float, np.number)) and not isinstance(value, bool):
        return format(float(value), ".15g")
    # Case and whitespace are presentation differences for text attributes.
    return " ".join(str(value).split()).casefold()


def add_duplicate_features(expenditure: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Flag exact source-attribute repeats without deleting or changing any rows.

    `potential_duplicate_amount` is intentionally allocated to each occurrence
    after the first source-order occurrence in a group. Therefore its sum is the
    group's amount repeated beyond the first record: (group_size - 1) * amount.
    """
    result = expenditure.copy()
    comparison_fields = [
        field for field in DUPLICATE_COMPARISON_BASE_FIELDS if field in result.columns
    ]
    if "ida" in result.columns:
        comparison_fields.append("ida")
    if not comparison_fields:
        raise ValueError("No duplicate comparison fields are available.")

    normalized = pd.DataFrame({
        field: result[field].map(normalize_duplicate_value) for field in comparison_fields
    }, index=result.index)
    # A hash of ordered field/value pairs provides a reproducible, explainable group ID.
    group_keys = normalized.apply(
        lambda row: json.dumps(list(zip(comparison_fields, row.tolist())),
                               ensure_ascii=False, separators=(",", ":")), axis=1
    )
    group_sizes = group_keys.groupby(group_keys).transform("size").astype("Int64")
    is_duplicate = group_sizes.gt(1)
    group_hashes = group_keys.map(
        lambda key: hashlib.sha256(key.encode("utf-8")).hexdigest()[:16].upper()
    )

    result["is_exact_duplicate"] = is_duplicate
    result["duplicate_group_id"] = pd.Series(pd.NA, index=result.index, dtype="string")
    result.loc[is_duplicate, "duplicate_group_id"] = "DUP-" + group_hashes[is_duplicate]
    result["duplicate_group_size"] = group_sizes.where(is_duplicate, pd.NA).astype("Int64")

    # Source order deterministically identifies the one non-excess occurrence.
    occurrence_number = group_keys.groupby(group_keys).cumcount()
    result["potential_duplicate_amount"] = pd.Series(0.0, index=result.index, dtype="Float64")
    repeated_occurrence = is_duplicate & occurrence_number.gt(0)
    result.loc[repeated_occurrence, "potential_duplicate_amount"] = result.loc[
        repeated_occurrence, "fund_disbursed_amount"
    ]
    return result, comparison_fields


def add_summary_finding(findings: list[dict[str, Any]], check: str, table: str,
                        field: str | None, count: int, details: str = "") -> None:
    findings.append({"check_name": check, "table": table, "field": field,
                     "source_row": None, "record_id": None, "count": count,
                     "details": details})


def format_dates_for_csv(frame: pd.DataFrame, fields: list[str]) -> pd.DataFrame:
    result = frame.copy()
    for field in fields:
        result[field] = result[field].dt.strftime("%Y-%m-%d")
    return result


def make_features(works: pd.DataFrame, expenditure: pd.DataFrame,
                  reference_date: pd.Timestamp) -> pd.DataFrame:
    """Create one work-level record; missing inputs intentionally produce nulls."""
    matched = expenditure[expenditure["work_id"].isin(works["work_id"])].copy()
    grouped = matched.groupby("work_id", dropna=False)
    aggregates = grouped.agg(
        total_expenditure=("fund_disbursed_amount", lambda values: values.sum(min_count=1)),
        expenditure_transaction_count=("expenditure_id", "size"),
        unique_vendor_count=("vendor_name", lambda values: values.dropna().nunique()),
        last_expenditure_date=("expenditure_date", "max"),
        duplicate_transaction_count=("is_exact_duplicate", "sum"),
        duplicate_group_count=("duplicate_group_id", lambda values: values.dropna().nunique()),
        potential_duplicate_amount_total=("potential_duplicate_amount", lambda values: values.sum(min_count=1)),
    ).reset_index()
    features = works[["work_id", "recommended_date", "sanction_date", "completion_date",
                      "sanction_amount", "amount_disbursed", "work_status"]].merge(
        aggregates, on="work_id", how="left", validate="one_to_one"
    )
    features["expenditure_transaction_count"] = (
        features["expenditure_transaction_count"].fillna(0).astype("Int64")
    )
    features["unique_vendor_count"] = features["unique_vendor_count"].fillna(0).astype("Int64")
    features["duplicate_transaction_count"] = (
        features["duplicate_transaction_count"].fillna(0).astype("Int64")
    )
    features["duplicate_group_count"] = features["duplicate_group_count"].fillna(0).astype("Int64")
    features["potential_duplicate_amount_total"] = (
        features["potential_duplicate_amount_total"].fillna(0).astype("Float64")
    )

    features["days_to_sanction"] = (
        features["sanction_date"] - features["recommended_date"]
    ).dt.days.astype("Int64")
    features["days_to_completion"] = (
        features["completion_date"] - features["recommended_date"]
    ).dt.days.astype("Int64")

    valid_sanction = features["sanction_amount"].notna() & features["sanction_amount"].ne(0)
    features["expenditure_vs_sanction_ratio"] = np.where(
        valid_sanction, features["total_expenditure"] / features["sanction_amount"], np.nan
    )
    features["disbursement_vs_sanction_ratio"] = np.where(
        valid_sanction, features["amount_disbursed"] / features["sanction_amount"], np.nan
    )
    features["days_since_last_expenditure"] = (
        reference_date - features["last_expenditure_date"]
    ).dt.days.astype("Int64")

    normalized_status = features["work_status"].fillna("").str.strip().str.casefold()
    # Only whole-work completion statuses qualify; "partially completed" does not.
    completed = normalized_status.isin({"completed", "work completed"})
    features["expenditure_exceeds_sanction"] = (
        features["total_expenditure"].notna() & valid_sanction &
        features["total_expenditure"].gt(features["sanction_amount"])
    )
    features["disbursement_exceeds_sanction"] = (
        features["amount_disbursed"].notna() & valid_sanction &
        features["amount_disbursed"].gt(features["sanction_amount"])
    )
    features["completed_without_completion_date"] = completed & features["completion_date"].isna()
    features["completed_without_disbursement"] = completed & features["amount_disbursed"].isna()
    # The actionable version is also emitted per expenditure transaction. A work-level
    # row cannot represent an unmatched transaction without fabricating a missing work.
    features["expenditure_without_matching_work"] = False
    features["high_transaction_count"] = (
        features["expenditure_transaction_count"] > HIGH_TRANSACTION_COUNT_THRESHOLD
    )
    features["multiple_vendors"] = features["unique_vendor_count"] > 1
    features["has_potential_duplicate_transaction"] = features["duplicate_transaction_count"] > 0
    # Kept as a separate named risk-indicator field for downstream anomaly rules.
    features["potential_duplicate_transaction"] = features["has_potential_duplicate_transaction"]

    keep = [
        "work_id", "total_expenditure", "expenditure_transaction_count", "unique_vendor_count",
        "duplicate_transaction_count", "duplicate_group_count", "potential_duplicate_amount_total",
        "days_to_sanction", "days_to_completion", "expenditure_vs_sanction_ratio",
        "disbursement_vs_sanction_ratio", "last_expenditure_date", "days_since_last_expenditure",
        "expenditure_exceeds_sanction", "disbursement_exceeds_sanction",
        "completed_without_completion_date", "completed_without_disbursement",
        "expenditure_without_matching_work", "high_transaction_count", "multiple_vendors",
        "has_potential_duplicate_transaction", "potential_duplicate_transaction",
    ]
    return features[keep]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Source .xlsx workbook")
    parser.add_argument("--output", type=Path, required=True, help="Directory for output CSV files")
    parser.add_argument("--reference-date", default=REFERENCE_DATE, help="YYYY-MM-DD for recency features")
    args = parser.parse_args()
    reference_date = pd.to_datetime(args.reference_date, format="%Y-%m-%d", errors="raise")

    findings: list[dict[str, Any]] = []
    workbook = pd.ExcelFile(args.input)
    source_sheets = resolve_sheet_roles(workbook)
    source_works, works_header_row, works_blank_rows = read_source_sheet(
        args.input, source_sheets["works"], "works"
    )
    source_expenditure, expenditure_header_row, expenditure_blank_rows = read_source_sheet(
        args.input, source_sheets["expenditure"], "expenditure"
    )

    add_summary_finding(findings, "source_sheet_names", "workbook", None, len(workbook.sheet_names),
                        json.dumps(workbook.sheet_names))
    add_summary_finding(findings, "source_filename", "workbook", None, 1, args.input.name)
    add_summary_finding(findings, "resolved_works_source_sheet", "works", None, 1,
                        source_sheets["works"])
    add_summary_finding(findings, "resolved_expenditure_source_sheet", "expenditure", None, 1,
                        source_sheets["expenditure"])
    add_summary_finding(findings, "source_header_row", "works", None, works_header_row + 1)
    add_summary_finding(findings, "source_header_row", "expenditure", None, expenditure_header_row + 1)
    add_summary_finding(findings, "pre_header_non_data_row_count", "works", None, works_header_row)
    add_summary_finding(findings, "pre_header_non_data_row_count", "expenditure", None, expenditure_header_row)
    add_summary_finding(findings, "blank_row_count_after_header", "works", None, works_blank_rows)
    add_summary_finding(findings, "blank_row_count_after_header", "expenditure", None, expenditure_blank_rows)
    for table, source in [("works", source_works), ("expenditure", source_expenditure)]:
        add_summary_finding(findings, "source_row_count", table, None, len(source))
        add_summary_finding(findings, "source_columns", table, None, len(source.columns),
                            json.dumps(list(source.columns)))
        for column, count in source.isna().sum().items():
            add_summary_finding(findings, "source_missing_value_count", table, str(column), int(count))
    add_summary_finding(findings, "source_expenditure_transaction_count", "expenditure", None,
                        len(source_expenditure))

    works = make_standard_table(
        source_works, WORKS_COLUMN_MAP, "works", source_sheets["works"], works_header_row, findings
    )
    expenditure_map = EXPENDITURE_COLUMN_MAP.copy()
    for target_field, source_field in OPTIONAL_EXPENDITURE_COLUMN_MAP.items():
        if source_field in source_expenditure.columns:
            expenditure_map[target_field] = source_field
    expenditure = make_standard_table(
        source_expenditure, expenditure_map, "expenditure", source_sheets["expenditure"],
        expenditure_header_row, findings
    )
    # Include zero-count conversion checks too: absence of bad rows is itself a reportable result.
    for table, fields in DATE_FIELDS.items():
        for field in fields:
            count = sum(
                row["check_name"] == "invalid_unparseable_date" and
                row["table"] == table and row["field"] == field
                for row in findings
            )
            add_summary_finding(findings, "invalid_unparseable_date_count", table, field, count)
    for table, fields in MONEY_FIELDS.items():
        for field in fields:
            count = sum(
                row["check_name"] == "invalid_non_numeric_monetary_value" and
                row["table"] == table and row["field"] == field
                for row in findings
            )
            add_summary_finding(findings, "invalid_non_numeric_monetary_value_count", table, field, count)
    # Deterministic IDs make reruns reproducible while retaining every source row.
    expenditure.insert(0, "expenditure_id", [f"EXP-{index:06d}" for index in range(1, len(expenditure) + 1)])
    expenditure, duplicate_comparison_fields = add_duplicate_features(expenditure)

    duplicate_works = works[works["work_id"].duplicated(keep=False)]
    add_summary_finding(findings, "work_id_is_unique", "works", "work_id",
                        int(works["work_id"].is_unique),
                        "1 means unique; 0 means duplicate IDs are present")
    for source_row, row in duplicate_works.iterrows():
        findings.append({"check_name": "duplicate_work_id", "table": "works", "field": "work_id",
                         "source_row": int(source_row) + works_header_row + 2, "record_id": row["work_id"],
                         "count": 1, "details": "Duplicate work_id retained; no rows removed."})
    add_summary_finding(findings, "duplicate_work_id_count", "works", "work_id", len(duplicate_works))

    unmatched = expenditure[~expenditure["work_id"].isin(works["work_id"])]
    expenditure["expenditure_without_matching_work"] = expenditure["work_id"].isin(works["work_id"]).eq(False)
    for source_row, row in unmatched.iterrows():
        findings.append({"check_name": "unmatched_expenditure_work_id", "table": "expenditure",
                         "field": "work_id", "source_row": int(source_row) + expenditure_header_row + 2,
                         "record_id": row["expenditure_id"], "count": 1,
                         "details": f"work_id={row['work_id']} is not present in works."})
    add_summary_finding(findings, "every_expenditure_work_id_exists_in_works", "expenditure", "work_id",
                        int(len(unmatched) == 0), "1 means all matched; 0 means unmatched records are present")
    add_summary_finding(findings, "unmatched_expenditure_record_count", "expenditure", "work_id", len(unmatched))
    add_summary_finding(findings, "matched_expenditure_record_count", "expenditure", "work_id",
                        len(expenditure) - len(unmatched))
    add_summary_finding(findings, "distinct_unmatched_expenditure_work_id_count", "expenditure", "work_id",
                        unmatched["work_id"].nunique(dropna=True))
    add_summary_finding(findings, "distinct_matched_expenditure_work_id_count", "expenditure", "work_id",
                        expenditure.loc[~expenditure["expenditure_without_matching_work"], "work_id"].nunique(dropna=True))

    # Exact duplicates use normalized original transaction attributes, never generated IDs.
    duplicate_expenditure = expenditure[expenditure["is_exact_duplicate"]]
    for source_row, row in duplicate_expenditure.iterrows():
        findings.append({"check_name": "exact_duplicate_transaction_row", "table": "expenditure",
                         "field": None, "source_row": int(source_row) + expenditure_header_row + 2,
                         "record_id": row["expenditure_id"], "count": 1,
                         "details": f"Group {row['duplicate_group_id']}; retained, not removed."})
    duplicate_group_count = int(expenditure["duplicate_group_id"].dropna().nunique())
    duplicate_works_count = int(expenditure.loc[
        expenditure["is_exact_duplicate"], "work_id"
    ].nunique())
    potential_duplicate_amount_total = float(expenditure["potential_duplicate_amount"].sum(min_count=1))
    add_summary_finding(findings, "duplicate_comparison_fields", "expenditure", None,
                        len(duplicate_comparison_fields), json.dumps(duplicate_comparison_fields))
    add_summary_finding(findings, "output_expenditure_transaction_count", "expenditure", None, len(expenditure))
    add_summary_finding(findings, "exact_duplicate_transaction_row_count", "expenditure", None,
                        len(duplicate_expenditure), "Rows are retained; this is not a removal count.")
    add_summary_finding(findings, "duplicate_group_count", "expenditure", None, duplicate_group_count)
    add_summary_finding(findings, "works_with_potential_duplicate_transactions", "works", None,
                        duplicate_works_count)
    add_summary_finding(findings, "total_potential_duplicate_amount", "expenditure", "fund_disbursed_amount",
                        potential_duplicate_amount_total,
                        "Sum of repeated occurrences beyond the first within each exact duplicate group.")
    add_summary_finding(findings, "rows_removed_due_to_duplicate_detection", "expenditure", None, 0,
                        "All source transaction rows are retained.")

    features = make_features(works, expenditure, reference_date)
    # Output and preparation-context counts are kept in the DQ report. Data_Notes
    # remains metadata only: none of these counts affect features or risk signals.
    add_summary_finding(findings, "source_works_row_count", "works", None, len(source_works))
    add_summary_finding(findings, "output_works_row_count", "works", None, len(works))
    add_summary_finding(findings, "unique_work_id_count", "works", "work_id",
                        works["work_id"].nunique(dropna=True))
    add_summary_finding(findings, "missing_completion_date_count", "works", "completion_date",
                        int(works["completion_date"].isna().sum()))
    add_summary_finding(findings, "missing_amount_disbursed_count", "works", "amount_disbursed",
                        int(works["amount_disbursed"].isna().sum()))
    add_summary_finding(findings, "works_with_expenditure_transaction_count", "works", "work_id",
                        int((features["expenditure_transaction_count"] > 0).sum()))
    add_summary_finding(findings, "works_with_populated_data_notes_count", "works", "data_notes",
                        int(works["data_notes"].map(is_present).sum()),
                        "Data_Notes is retained as source/data-quality context only.")
    add_summary_finding(findings, "expenditure_with_populated_data_notes_count", "expenditure", "data_notes",
                        int(expenditure["data_notes"].map(is_present).sum()),
                        "Data_Notes is retained as source/data-quality context only.")
    validation_details = (
        "Pipeline completed; row-preservation and conversion checks are reported above. "
        f"Unmatched expenditure records retained: {len(unmatched)}."
    )
    add_summary_finding(findings, "validation_status", "workbook", None, 1, validation_details)
    quality_report = pd.DataFrame(findings, columns=[
        "check_name", "table", "field", "source_row", "record_id", "count", "details"
    ])

    args.output.mkdir(parents=True, exist_ok=True)
    format_dates_for_csv(works, DATE_FIELDS["works"])[WORKS_COLUMNS].to_csv(
        args.output / "works.csv", index=False, na_rep=""
    )
    expenditure_columns = [
        "expenditure_id", *expenditure_map, *DUPLICATE_FEATURE_FIELDS, *EXPENDITURE_RISK_FIELDS
    ]
    format_dates_for_csv(expenditure, DATE_FIELDS["expenditure"])[expenditure_columns].to_csv(
        args.output / "expenditure_transactions.csv", index=False, na_rep=""
    )
    format_dates_for_csv(features, ["last_expenditure_date"]).to_csv(
        args.output / "work_features.csv", index=False, na_rep=""
    )
    quality_report.to_csv(args.output / "data_quality_report.csv", index=False, na_rep="")

    summary = {
        "source_works": len(source_works),
        "source_expenditure_transactions": len(source_expenditure),
        "unique_work_ids": works["work_id"].nunique(dropna=True),
        "unmatched_expenditure_records": len(unmatched),
        "duplicate_work_ids": len(duplicate_works),
        "missing_completion_dates": int(works["completion_date"].isna().sum()),
        "missing_amount_disbursed_values": int(works["amount_disbursed"].isna().sum()),
        "works_with_expenditure_transactions": int((features["expenditure_transaction_count"] > 0).sum()),
        "output_expenditure_transactions": len(expenditure),
        "exact_duplicate_transaction_rows": len(duplicate_expenditure),
        "duplicate_groups": duplicate_group_count,
        "works_with_potential_duplicate_transactions": duplicate_works_count,
        "total_potential_duplicate_amount": potential_duplicate_amount_total,
        "rows_removed_due_to_duplicate_detection": 0,
    }
    print("Processing summary")
    for name, value in summary.items():
        print(f"- {name}: {value}")


if __name__ == "__main__":
    main()
