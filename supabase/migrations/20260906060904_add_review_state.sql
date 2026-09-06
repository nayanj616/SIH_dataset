ALTER TABLE risk_scores ADD COLUMN is_reviewed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE risk_scores ADD COLUMN reviewed_at TIMESTAMPTZ;

DROP VIEW IF EXISTS work_risk_overview;
CREATE OR REPLACE VIEW work_risk_overview AS
SELECT
    w.work_id, w.state, w.constituency, w.lok_sabha, w.mp_name,
    w.work_category, w.work, w.work_description, w.ida,
    w.recommended_date, w.recommended_amount, w.sanction_date, w.sanction_amount,
    w.work_status, w.completion_date, w.amount_disbursed, w.data_notes,
    wf.total_expenditure, wf.expenditure_transaction_count, wf.unique_vendor_count,
    wf.duplicate_transaction_count, wf.duplicate_group_count, wf.potential_duplicate_amount_total,
    wf.days_to_sanction, wf.days_to_completion, wf.days_since_last_expenditure,
    wf.expenditure_vs_sanction_ratio, wf.disbursement_vs_sanction_ratio,
    wf.expenditure_exceeds_sanction, wf.disbursement_exceeds_sanction,
    wf.has_potential_duplicate_transaction, wf.high_transaction_count, wf.multiple_vendors,
    rs.risk_score, rs.risk_level, rs.financial_integrity_score,
    rs.transaction_pattern_score, rs.lifecycle_execution_score, rs.data_quality_score,
    rs.requires_human_review, rs.is_reviewed, rs.reviewed_at
FROM
    works w
    LEFT JOIN work_features wf ON w.work_id = wf.work_id
    LEFT JOIN risk_scores rs ON w.work_id = rs.work_id;

GRANT SELECT ON work_risk_overview TO anon, authenticated;
CREATE POLICY "anon_update_risk_scores" ON risk_scores FOR UPDATE TO anon, authenticated USING (TRUE);
