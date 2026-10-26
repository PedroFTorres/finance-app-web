# Regra do balanço financeiro pessoal

Este relatório é gerencial: entradas e saídas realizadas, mais previsões cadastradas.
Não representa balanço patrimonial, lucro contábil, saldo bancário nem uma DFC
completa segundo o CPC 03. Não apura ativos, passivos e patrimônio líquido.

## Datas e fórmulas

- Já recebido/pago: movimentação vinculada pela data da baixa; inclui o valor real,
  juros e descontos. A baixa do lançamento é fallback quando não existe movimento.
- Falta receber/pagar: saldo pendente cadastrado, por vencimento. Inclui faturas
  abertas líquidas de pagamentos, sem repetir as faturas já convertidas em despesa.
- Resultado realizado = já recebido − já pago.
- Saldo previsto neste relatório = falta receber − falta pagar. Não é o saldo final
  da conta, nem soma dinheiro já realizado ou patrimônio investido.
- Transferências internas e movimentações do módulo de investimentos não são
  receitas/despesas de consumo neste relatório. Valores que o usuário cadastrou
  manualmente como receita/despesa continuam obedecendo ao seu cadastro.

## Cartões e categorias

A categoria da compra é a dimensão; cartão é o meio de pagamento. Por isso,
Academia no lançamento e Academia no cartão formam uma única linha da tabela.
A fatura técnica é substituída pela composição por categoria, nunca adicionada
novamente. Compras ainda não pagas ficam em previsão; não viram saída realizada
só porque a compra ocorreu. Estornos reduzem o gasto da categoria correspondente.

Pagamentos parciais sem identificação de quais compras foram quitadas são rateados
proporcionalmente, com arredondamento em centavos. Essa distribuição é gerencial,
não prova que uma compra específica foi liquidada. Juros/diferenças sem categoria
identificável ficam em ajustes explícitos, preservando o total efetivamente pago.

Sem vínculo inequívoco entre fatura e compras, a categoria original é mantida.
Renegociações cadastradas diretamente como Cartão de Crédito não são distribuídas
por adivinhação entre Academia, Alimentação etc. Não se alteram registros bancários.

## Conferência

Em cada coluna, o total das categorias e dos meses deve coincidir com o total
do período. Os testes cobrem fatura aberta/fechada/paga, baixas parciais, juros,
desconto, estorno, filtros, virada de ano, categorias comuns às duas origens e
preservação dos registros originais.

A tela do balanço não repete o detalhamento de lançamentos por categoria. Os
registros continuam disponíveis nos módulos originais e na exportação CSV.

Referência de distinção: CPC 03 (R2), Demonstração dos Fluxos de Caixa:
https://www.cpc.org.br/CPC/Documentos-emitidos/Pronunciamentos/Pronunciamento?Id=34
