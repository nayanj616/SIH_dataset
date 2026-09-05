# -*- coding: utf-8 -*-
"""
Sentinel MPLADS Monitoring -- Supabase Ingestion Script
======================================================
Loads standardized datasets and risk scoring artifacts into Supabase PostgreSQL.

Tables loaded in order:
  1. works                    (1,000 rows across 5 states)
  2. expenditure_transactions (1,386 rows including 134 duplicates & 38 orphan txs)
  3. work_features            (1,000 rows)
  4. risk_scores              (1,000 rows from Sentinel Risk Score v1)
  5. risk_signals             (1,142 rows with deterministic SHA-256 instance IDs)
  6. risk_evidence            (1,000 JSONB evidence payloads)
  7. dataset_runs             (audit entry recording run metadata)

Usage:
  python scripts/ingest_to_supabase.py [--dry-run] [--batch-size 200]

Environment Variables:
  SUPABASE_URL               Supabase Project URL (e.g. https://xxx.supabase.co)
  SUPABASE_SERVICE_ROLE_KEY  Supabase Service Role Key (bypasses RLS for write)
"""

import os
import sys
import csv
import json
import hashlib
import argparse
import urllib.request
import urllib.error
from datetime import datetime

STATES = [
    'andhra_pradesh',
    'madhya_pradesh',
    'punjab',
    'telangana',
    'uttarakhand'
]

EXPECTED_STATES = {
    'Andhra Pradesh',
    'Madhya Pradesh',
    'Punjab',
    'Telangana',
    'Uttarakhand'
}

def load_dotenv():
    """Simple .env parser without external dependencies."""
    env_paths = ['.env', os.path.join(os.path.dirname(__file__), '..', '.env')]
    for path in env_paths:
        if os.path.isfile(path):
            with open(path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k not in os.environ:
                            os.environ[k] = v

def parse_num(val, as_int=False):
    if val is None:
        return None
    val_str = str(val).strip()
    if val_str == '' or val_str.lower() == 'none' or val_str.lower() == 'null':
        return None
    try:
        if as_int:
            return int(float(val_str))
        return float(val_str)
    except (ValueError, TypeError):
        return None

def parse_bool(val):
    if val is None:
        return None
    val_str = str(val).strip().lower()
    if val_str in ('true', '1', 'yes', 't'):
        return True
    if val_str in ('false', '0', 'no', 'f'):
        return False
    return None

def parse_str(val):
    if val is None:
        return None
    val_str = str(val).strip()
    return val_str if val_str != '' else None

def parse_date(val):
    if val is None:
        return None
    val_str = str(val).strip()
    if not val_str or val_str.lower() in ('none', 'null', 'nan'):
        return None
    for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%Y/%m/%d'):
        try:
            dt = datetime.strptime(val_str, fmt)
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            continue
    return val_str[:10] if len(val_str) >= 10 else None

def compute_signal_instance_id(work_id, signal_id, dimension, points):
    key_str = f"{work_id}|{signal_id}|{dimension}|{points}"
    return hashlib.sha256(key_str.encode('utf-8')).hexdigest()[:32]

class SupabaseClient:
    def __init__(self, url, service_key):
        self.url = url.rstrip('/')
        self.key = service_key
        self.headers = {
            'apikey': self.key,
            'Authorization': f'Bearer {self.key}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal'
        }

    def upsert_batch(self, table_name, records):
        if not records:
            return
        endpoint = f"{self.url}/rest/v1/{table_name}"
        data = json.dumps(records).encode('utf-8')
        req = urllib.request.Request(endpoint, data=data, headers=self.headers, method='POST')
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.status
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='replace')
            raise RuntimeError(f"Failed to upsert to {table_name}: HTTP {e.code} - {err_body}") from e

    def count_table(self, table_name):
        endpoint = f"{self.url}/rest/v1/{table_name}?select=*"
        headers = dict(self.headers)
        headers['Prefer'] = 'count=exact'
        headers['Range-Unit'] = 'items'
        headers['Range'] = '0-0'
        req = urllib.request.Request(endpoint, headers=headers, method='HEAD')
        try:
            with urllib.request.urlopen(req) as resp:
                content_range = resp.headers.get('Content-Range', '')
                if '/' in content_range:
                    return int(content_range.split('/')[-1])
                return None
        except urllib.error.HTTPError:
            endpoint_get = f"{self.url}/rest/v1/{table_name}?select=count"
            req_get = urllib.request.Request(endpoint_get, headers=self.headers, method='GET')
            with urllib.request.urlopen(req_get) as resp_get:
                data = json.loads(resp_get.read().decode('utf-8'))
                if data and isinstance(data, list) and 'count' in data[0]:
                    return data[0]['count']
                return len(data)

def prepare_data(base_dir):
    print("[1/7] Reading source CSV files for 5 states...")
    raw_works = []
    raw_txs = []
    raw_features = []

    processed_dir = os.path.join(base_dir, 'data', 'processed') if os.path.isdir(os.path.join(base_dir, 'data', 'processed')) else os.path.join(base_dir, 'processed')
    scored_dir = os.path.join(base_dir, 'data', 'scored') if os.path.isdir(os.path.join(base_dir, 'data', 'scored')) else os.path.join(base_dir, 'scored')

    for state in STATES:
        state_dir = os.path.join(processed_dir, state)

        # 1. works.csv
        works_path = os.path.join(state_dir, 'works.csv')
        with open(works_path, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                raw_works.append({
                    'work_id': parse_str(row.get('work_id')),
                    'state': parse_str(row.get('state')),
                    'constituency': parse_str(row.get('constituency')),
                    'lok_sabha': parse_str(row.get('lok_sabha')),
                    'mp_name': parse_str(row.get('mp_name')),
                    'work_category': parse_str(row.get('work_category')),
                    'work': parse_str(row.get('work')),
                    'work_description': parse_str(row.get('work_description')),
                    'ida': parse_str(row.get('ida')),
                    'recommended_date': parse_date(row.get('recommended_date')),
                    'recommended_amount': parse_num(row.get('recommended_amount')),
                    'sanction_date': parse_date(row.get('sanction_date')),
                    'sanction_amount': parse_num(row.get('sanction_amount')),
                    'work_status': parse_str(row.get('work_status')),
                    'completion_date': parse_date(row.get('completion_date')),
                    'amount_disbursed': parse_num(row.get('amount_disbursed')),
                    'data_notes': parse_str(row.get('data_notes'))
                })

        # 2. expenditure_transactions.csv
        tx_path = os.path.join(state_dir, 'expenditure_transactions.csv')
        with open(tx_path, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                raw_txs.append({
                    'expenditure_id': parse_str(row.get('expenditure_id')),
                    'work_id': parse_str(row.get('work_id')),
                    'state': parse_str(row.get('state')),
                    'mp_name': parse_str(row.get('mp_name')),
                    'constituency': parse_str(row.get('constituency')),
                    'expenditure_date': parse_date(row.get('expenditure_date')),
                    'vendor_name': parse_str(row.get('vendor_name')),
                    'payment_status': parse_str(row.get('payment_status')),
                    'fund_disbursed_amount': parse_num(row.get('fund_disbursed_amount')),
                    'data_notes': parse_str(row.get('data_notes')),
                    'is_exact_duplicate': parse_bool(row.get('is_exact_duplicate')) or False,
                    'duplicate_group_id': parse_str(row.get('duplicate_group_id')),
                    'duplicate_group_size': parse_num(row.get('duplicate_group_size'), as_int=True),
                    'potential_duplicate_amount': parse_num(row.get('potential_duplicate_amount')) or 0.0,
                    'expenditure_without_matching_work': parse_bool(row.get('expenditure_without_matching_work')) or False
                })

        # 3. work_features.csv
        feat_path = os.path.join(state_dir, 'work_features.csv')
        with open(feat_path, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                raw_features.append({
                    'work_id': parse_str(row.get('work_id')),
                    'total_expenditure': parse_num(row.get('total_expenditure')),
                    'expenditure_transaction_count': parse_num(row.get('expenditure_transaction_count'), as_int=True),
                    'unique_vendor_count': parse_num(row.get('unique_vendor_count'), as_int=True),
                    'duplicate_transaction_count': parse_num(row.get('duplicate_transaction_count'), as_int=True),
                    'duplicate_group_count': parse_num(row.get('duplicate_group_count'), as_int=True),
                    'potential_duplicate_amount_total': parse_num(row.get('potential_duplicate_amount_total')),
                    'days_to_sanction': parse_num(row.get('days_to_sanction'), as_int=True),
                    'days_to_completion': parse_num(row.get('days_to_completion'), as_int=True),
                    'last_expenditure_date': parse_date(row.get('last_expenditure_date')),
                    'days_since_last_expenditure': parse_num(row.get('days_since_last_expenditure'), as_int=True),
                    'expenditure_vs_sanction_ratio': parse_num(row.get('expenditure_vs_sanction_ratio')),
                    'disbursement_vs_sanction_ratio': parse_num(row.get('disbursement_vs_sanction_ratio')),
                    'expenditure_exceeds_sanction': parse_bool(row.get('expenditure_exceeds_sanction')),
                    'disbursement_exceeds_sanction': parse_bool(row.get('disbursement_exceeds_sanction')),
                    'completed_without_completion_date': parse_bool(row.get('completed_without_completion_date')),
                    'completed_without_disbursement': parse_bool(row.get('completed_without_disbursement')),
                    'expenditure_without_matching_work': parse_bool(row.get('expenditure_without_matching_work')),
                    'high_transaction_count': parse_bool(row.get('high_transaction_count')),
                    'multiple_vendors': parse_bool(row.get('multiple_vendors')),
                    'has_potential_duplicate_transaction': parse_bool(row.get('has_potential_duplicate_transaction')),
                    'potential_duplicate_transaction': parse_bool(row.get('potential_duplicate_transaction'))
                })

    # 4. work_risk_scores.csv
    print("[2/7] Reading work_risk_scores.csv...")
    scores_path = os.path.join(scored_dir, 'work_risk_scores.csv')
    raw_scores = []
    with open(scores_path, 'r', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            raw_scores.append({
                'work_id': parse_str(row.get('work_id')),
                'state': parse_str(row.get('state')),
                'risk_score': parse_num(row.get('risk_score'), as_int=True),
                'risk_level': parse_str(row.get('risk_level')),
                'financial_integrity_score': parse_num(row.get('financial_integrity_score'), as_int=True),
                'transaction_pattern_score': parse_num(row.get('transaction_pattern_score'), as_int=True),
                'lifecycle_execution_score': parse_num(row.get('lifecycle_execution_score'), as_int=True),
                'data_quality_score': parse_num(row.get('data_quality_score'), as_int=True),
                'requires_human_review': parse_bool(row.get('requires_human_review')) or False
            })

    # 5. risk_signals.csv
    print("[3/7] Reading risk_signals.csv...")
    signals_path = os.path.join(scored_dir, 'risk_signals.csv')
    raw_signals = []
    with open(signals_path, 'r', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            w_id = parse_str(row.get('work_id'))
            s_id = parse_str(row.get('signal_id'))
            dim = parse_str(row.get('dimension'))
            pts = parse_num(row.get('points'), as_int=True)
            instance_id = compute_signal_instance_id(w_id, s_id, dim, pts)
            raw_signals.append({
                'signal_instance_id': instance_id,
                'work_id': w_id,
                'signal_id': s_id,
                'dimension': dim,
                'severity': parse_str(row.get('severity')),
                'points': pts,
                'observed_value': parse_str(row.get('observed_value')),
                'threshold': parse_str(row.get('threshold')),
                'evidence_summary': parse_str(row.get('evidence_summary'))
            })

    # 6. risk_evidence.json
    print("[4/7] Reading risk_evidence.json...")
    evidence_path = os.path.join(scored_dir, 'risk_evidence.json')
    raw_evidence = []
    run_metadata = {}
    with open(evidence_path, 'r', encoding='utf-8') as f:
        ev_dict = json.load(f)
        for k, v in ev_dict.items():
            if k == '_metadata':
                run_metadata = v
                continue
            raw_evidence.append({
                'work_id': k,
                'evidence': v
            })

    return {
        'works': raw_works,
        'expenditure_transactions': raw_txs,
        'work_features': raw_features,
        'risk_scores': raw_scores,
        'risk_signals': raw_signals,
        'risk_evidence': raw_evidence,
        'run_metadata': run_metadata
    }

def run_validation_checks(data):
    print("\n" + "="*70)
    print("SENTINEL 15-POINT PRE-INGESTION / DATABASE VALIDATION SUITE")
    print("="*70)

    works = data['works']
    txs = data['expenditure_transactions']
    scores = data['risk_scores']
    signals = data['risk_signals']
    evidence = data['risk_evidence']

    works_ids = {w['work_id'] for w in works}
    works_states = {w['state'] for w in works}
    score_ids = {s['work_id'] for s in scores}
    signal_ids = {s['work_id'] for s in signals}
    evidence_ids = {e['work_id'] for e in evidence}

    dup_txs = [t for t in txs if t['is_exact_duplicate']]
    orphan_txs = [t for t in txs if t['expenditure_without_matching_work']]
    ap_null_rec = [w for w in works if w['state'] == 'Andhra Pradesh' and w['recommended_date'] is None]

    checks = [
        ("1. Works count = 1,000", len(works) == 1000 and len(works_ids) == 1000, f"Actual: {len(works)} (Unique: {len(works_ids)})"),
        ("2. Exactly 5 states", works_states == EXPECTED_STATES, f"Actual: {sorted(list(works_states))}"),
        ("3. Expenditure transactions = 1,386", len(txs) == 1386, f"Actual: {len(txs)}"),
        ("4. Risk scores = 1,000", len(scores) == 1000 and len(score_ids) == 1000, f"Actual: {len(scores)}"),
        ("5. Risk evidence = 1,000", len(evidence) == 1000 and len(evidence_ids) == 1000, f"Actual: {len(evidence)}"),
        ("6. Risk signals = 1,142", len(signals) == 1142, f"Actual: {len(signals)}"),
        ("7. Duplicate transaction flags intact", len(dup_txs) == 134, f"Actual: {len(dup_txs)} duplicate rows"),
        ("8. Punjab unmatched transactions preserved", len(orphan_txs) == 38 and all(t['work_id'] not in works_ids for t in orphan_txs), f"Actual: {len(orphan_txs)} orphan txs"),
        ("9. No works deleted due to NULL values", len(ap_null_rec) == 200, f"Actual: {len(ap_null_rec)}/200 AP works with NULL rec_date"),
        ("10. No transactions deleted due to dup status", len(txs) == 1386, f"Actual: {len(txs)} txs present"),
        ("11. Every risk_score work_id in works", score_ids.issubset(works_ids), f"Missing: {len(score_ids - works_ids)}"),
        ("12. Every risk_signal work_id in works", signal_ids.issubset(works_ids), f"Missing: {len(signal_ids - works_ids)}"),
        ("13. Every risk_evidence work_id in works", evidence_ids.issubset(works_ids), f"Missing: {len(evidence_ids - works_ids)}"),
        ("14. Exactly 1 risk score per work", len(scores) == len(works_ids) and score_ids == works_ids, f"Scores: {len(scores)}, Works: {len(works_ids)}"),
        ("15. Exactly 1 risk_evidence per work", len(evidence) == len(works_ids) and evidence_ids == works_ids, f"Evidence: {len(evidence)}, Works: {len(works_ids)}")
    ]

    all_passed = True
    for title, passed, detail in checks:
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status} {title:<46} | {detail}")
        if not passed:
            all_passed = False

    print("="*70)
    if not all_passed:
        raise ValueError("FATAL: One or more data integrity validation checks failed! Aborting ingestion.")
    print("ALL 15 INTEGRITY CHECKS PASSED PERFECTLY.")
    print("="*70 + "\n")
    return True

def ingest(client, data, batch_size=200):
    tables = [
        ('works', data['works']),
        ('expenditure_transactions', data['expenditure_transactions']),
        ('work_features', data['work_features']),
        ('risk_scores', data['risk_scores']),
        ('risk_signals', data['risk_signals']),
        ('risk_evidence', data['risk_evidence'])
    ]

    for table_name, rows in tables:
        total = len(rows)
        print(f"Upserting into '{table_name}' ({total} records, batch_size={batch_size})...")
        for i in range(0, total, batch_size):
            batch = rows[i:i + batch_size]
            client.upsert_batch(table_name, batch)
            print(f"  -> {table_name}: {min(i + batch_size, total)}/{total} rows uploaded", end='\r')
        print(f"\n  [OK] Successfully upserted all {total} rows into '{table_name}'.")

    print("Logging run record into 'dataset_runs'...")
    run_record = [{
        'states_loaded': list(EXPECTED_STATES),
        'total_works': len(data['works']),
        'total_tx': len(data['expenditure_transactions']),
        'total_signals': len(data['risk_signals']),
        'scorer_version': 'v1.1',
        'notes': 'Ingested via Sentinel ingest_to_supabase.py'
    }]
    client.upsert_batch('dataset_runs', run_record)
    print("  [OK] Successfully logged run metadata in 'dataset_runs'.")

def main():
    parser = argparse.ArgumentParser(description="Sentinel Ingestion to Supabase")
    parser.add_argument('--dry-run', action='store_true', help="Validate data locally without uploading to Supabase")
    parser.add_argument('--batch-size', type=int, default=200, help="Batch size for REST upserts (default: 200)")
    args = parser.parse_args()

    load_dotenv()
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

    data = prepare_data(base_dir)
    run_validation_checks(data)

    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if args.dry_run:
        print("[DRY RUN] Local data validation complete. No remote network calls made.")
        return

    if not supabase_url or not supabase_key:
        print("[NOTE] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in environment or .env.")
        print("[NOTE] Local data integrity validation completed successfully.")
        print("[NOTE] To upload into Supabase:")
        print("       1. Copy .env.example to .env and fill in your Supabase credentials.")
        print("       2. Run the initial SQL migration in Supabase SQL editor.")
        print("       3. Re-run: python scripts/ingest_to_supabase.py")
        return

    print(f"Connecting to Supabase at: {supabase_url}")
    client = SupabaseClient(supabase_url, supabase_key)
    ingest(client, data, batch_size=args.batch_size)
    print("\nAll data ingested successfully into Supabase!")

if __name__ == '__main__':
    main()
