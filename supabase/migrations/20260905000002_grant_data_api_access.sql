-- Explicit Data API privileges for the ingestion service role.
-- service_role bypasses RLS but still needs table privileges.

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE
  public.works,
  public.expenditure_transactions,
  public.work_features,
  public.risk_scores,
  public.risk_signals,
  public.risk_evidence,
  public.dataset_runs
TO service_role;

-- Dashboard/client read access.
-- RLS policies already restrict these tables to read access in the prototype.

GRANT SELECT
ON TABLE
  public.works,
  public.expenditure_transactions,
  public.work_features,
  public.risk_scores,
  public.risk_signals,
  public.risk_evidence,
  public.dataset_runs
TO anon, authenticated;

-- The dashboard views also need explicit Data API access.

GRANT SELECT
ON public.work_risk_overview,
   public.state_risk_summary
TO anon, authenticated, service_role;