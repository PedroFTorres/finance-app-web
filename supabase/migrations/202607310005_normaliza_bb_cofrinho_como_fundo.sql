begin;

update public.investimentos
set
  tipo = 'fundo_investimento',
  indexador = 'manual',
  cnpj_emissor = '54603259000156',
  data_vencimento = null,
  percentual_cdi = 0,
  cdi_anual_referencia = 0,
  liquidez = 'diaria',
  classe_fundo = coalesce(classe_fundo, 'Renda Fixa'),
  administrador = coalesce(administrador, 'Banco do Brasil')
where lower(nome) like '%reserva cofrinho%'
   or cnpj_emissor in ('54603259001556', '54603259000156');

commit;
