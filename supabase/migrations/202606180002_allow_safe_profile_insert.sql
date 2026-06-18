begin;

-- Compatibility for the currently deployed profile upsert. Entitlement
-- columns remain unavailable to browser clients.
grant insert (id, nome, avatar_url, cpf, onboarding_completed, updated_at)
  on table public.user_profiles to authenticated;

commit;
