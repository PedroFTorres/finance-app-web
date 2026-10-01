begin;

alter table public.receitas
  add column if not exists comprovantes jsonb not null default '[]'::jsonb;

alter table public.despesas
  add column if not exists comprovantes jsonb not null default '[]'::jsonb;

update public.receitas
set comprovantes = jsonb_build_array(jsonb_build_object(
  'path', comprovante_path,
  'nome', coalesce(comprovante_nome, 'Comprovante PDF'),
  'uploaded_at', comprovante_uploaded_at
))
where comprovante_path is not null
  and comprovantes = '[]'::jsonb;

update public.despesas
set comprovantes = jsonb_build_array(jsonb_build_object(
  'path', comprovante_path,
  'nome', coalesce(comprovante_nome, 'Comprovante PDF'),
  'uploaded_at', comprovante_uploaded_at
))
where comprovante_path is not null
  and comprovantes = '[]'::jsonb;

commit;
