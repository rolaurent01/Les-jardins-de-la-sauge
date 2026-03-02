-- Migration 010 : fixation du search_path sur toutes les fonctions publiques
-- Supabase signale que les fonctions sans search_path explicite sont vulnérables
-- à un détournement via un schéma prioritaire dans le search_path de la session.
-- Fix : SET search_path = public sur chaque fonction.

ALTER FUNCTION public.immutable_unaccent(text)
  SET search_path = public;

ALTER FUNCTION public.fn_set_updated_at()
  SET search_path = public;

ALTER FUNCTION public._ps_upsert(
  UUID, INTEGER, INTEGER,
  DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL,
  INTEGER, INTEGER, INTEGER, INTEGER
)
  SET search_path = public;

ALTER FUNCTION public.fn_ps_harvests()
  SET search_path = public;

ALTER FUNCTION public.fn_ps_cuttings()
  SET search_path = public;

ALTER FUNCTION public.fn_ps_dryings()
  SET search_path = public;

ALTER FUNCTION public.fn_ps_sortings()
  SET search_path = public;

ALTER FUNCTION public.fn_ps_production_lot_ingredients()
  SET search_path = public;

ALTER FUNCTION public.fn_ps_production_lots_time()
  SET search_path = public;

ALTER FUNCTION public.fn_ps_direct_sales()
  SET search_path = public;

ALTER FUNCTION public.fn_ps_purchases()
  SET search_path = public;

ALTER FUNCTION public.recalculate_production_summary()
  SET search_path = public;
