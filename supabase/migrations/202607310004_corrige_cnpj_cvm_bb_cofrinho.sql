begin;

update public.investimentos
set cnpj_emissor = '54603259000156'
where cnpj_emissor = '54603259001556'
  and tipo = 'fundo_investimento';

commit;
