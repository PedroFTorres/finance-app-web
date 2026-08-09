begin;

-- Existing investment indexes already cover these columns. Keep the original
-- names and remove the duplicates introduced during pre-sale hardening.
drop index if exists public.idx_investimento_resgates_user_id;
drop index if exists public.idx_investimentos_user_id;

commit;
