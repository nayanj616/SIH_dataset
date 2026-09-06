-- Grant UPDATE privilege on risk_scores to anon and authenticated roles
-- Required to allow the frontend (anon client) to persist review state
-- RLS policy "anon_update_risk_scores" limits UPDATE to is_reviewed and reviewed_at columns by design
GRANT UPDATE (is_reviewed, reviewed_at) ON risk_scores TO anon, authenticated;

