-- Remove direct write grants from unauthenticated users.
-- RLS still protects tables, but anon should not have INSERT/UPDATE/DELETE grants on app data.

revoke insert, update, delete on all tables in schema public from anon;

-- Keep future tables safer too.
alter default privileges in schema public revoke insert, update, delete on tables from anon;

-- Re-run this check after executing the revokes. It should return zero rows.
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'public')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
order by table_name, grantee, privilege_type;
