# Capitalização

Módulo independente de acompanhamento. Não gera ou altera movimentações,
despesas, receitas, compras ou pagamentos de faturas.

## Fluxos

- Cadastro: condições, identificação, vigência, contribuição atual e consulta
  opcional do resgate no banco. Dados pessoais nunca são publicados no código.
- Pagamentos: vínculos com despesas existentes, inclusive série recorrente já
  cadastrada. A baixa continua no lançamento original; cancelar a baixa reduz
  o total confirmado. Não cria parcelas futuras automaticamente.
- Cartão: vincula a contribuição individual, não o total da fatura. Confirma
  pagamento após quitação integral da fatura; pagamento parcial não é rateado
  arbitrariamente entre compras. Não vincular também uma despesa paralela da
  mesma contribuição.
- Prêmios e resgates: vínculos com receitas existentes. Só receitas baixadas
  entram nos recebidos; resgate é identificado separadamente do prêmio.
- Desvincular ou remover título apaga apenas o acompanhamento, não o financeiro.

## Estimativas

`raspa48_662222_2024` corresponde exclusivamente ao processo SUSEP
15414.662222/2024-10, ficha de produto de 48 meses, tabela da página 3.
Percentuais por quantidade de contribuições confirmadas, base TR=0.
A taxa de 0,73% da hipótese atuarial **não** é reaplicada sobre a soma paga.
Não é cotação líquida nem confirmação de carência ou liberação de resgate.

O modelo Raspa DinDin 60 meses não inclui tabela não fornecida. Permite informar
uma consulta datada do banco sem supor que o total pago esteja disponível.
A base nominal ao término é informativa, sem projetar TR ou reajustes futuros.

## Segurança e testes

Migração `20261018200527_capitalizacao_tracking.sql`: tabelas com RLS,
propriedade, MFA AAL2, acesso financeiro ativo, FKs e unicidade de vínculos.
Adiciona índice único ao UUID de receitas para permitir a referência, sem
reescrever a chave primária composta legada ou os registros financeiros.

- `pnpm check`: regras, integridade HTML e regressões do app.
- `node scripts/check-capitalizacao-browser.cjs`: navegação e formulários com
  dados fictícios, sem acesso ao banco real. Requer Playwright e Chrome;
  `AROLIX_BROWSER_RUNTIME` pode apontar ao diretório node_modules do runtime.
- `supabase/tests/capitalizacao_security.sql`: integração RLS com rollback.
  Exige perfil com acesso ativo como fixture. Nunca usar dados pessoais em
  fixtures publicadas.

O módulo não consulta raspadinhas, não promete premiação e não executa resgate
no Santander. As operações bancárias continuam no banco.
