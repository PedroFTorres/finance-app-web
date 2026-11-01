# Pro — atualização de preço

Preço aprovado em 01/11/2026: **R$ 19,90 por 30 dias**. Teste grátis de 5 dias preservado. Investimentos/CVM continuam fora do Pro.

Atualizados: index/vendas, página de controle de cartão, guia de compras parceladas, upgrade, mensagem de acesso bloqueado e JSON-LD da oferta.

O valor usado na criação de novas cobranças é definido no servidor em `supabase/functions/asaas-create-checkout/index.ts`: `PLAN_VALUE = 19.90`. O navegador não define o preço. Nenhum código altera cobranças já emitidas ou períodos de acesso existentes. Teste de checkout com rede simulada cobre inclusive tentativa de enviar preço/duração pelo cliente.

## Publicação coordenada

Em 01/11/2026, a função `asaas-create-checkout` foi publicada na versão 9 (ACTIVE), mantendo `verify_jwt: true`. O código remoto foi relido e confirmado com `PLAN_VALUE = 19.90` e `PLAN_DAYS = 30`. A comparação com a versão 8 confirmou alteração apenas no preço. Nenhuma cobrança real foi criada para verificação.

1. Função `asaas-create-checkout` publicada no projeto de produção, preservando configurações de autenticação e secrets atuais.
2. Publicar os arquivos web no GitHub Pages e verificar preço nas páginas, upgrade e JSON-LD.
3. Confirmar a versão da função e seu código implantado. Não gerar cobrança real apenas para testar sem autorização específica; testes locais usam rede simulada.

Publicar apenas as páginas deixa o preço anunciado diferente do checkout até a função também ser atualizada. Deploy no GitHub Pages não publica Edge Functions automaticamente.
