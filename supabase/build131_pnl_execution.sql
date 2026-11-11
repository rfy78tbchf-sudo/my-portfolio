-- Scope execution tuning to this existing invoker function; preserve RLS and all calculations.
ALTER FUNCTION public.get_live_period_stock_pnl(text) SET jit TO 'off';
ALTER FUNCTION public.get_live_period_stock_pnl(text) SET work_mem TO '16MB';
