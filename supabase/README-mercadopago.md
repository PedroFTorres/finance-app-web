# Mercado Pago + Supabase Edge Functions

Este backend prepara o fluxo seguro de pagamento PRO:

1. `create-mercadopago-checkout`
   - Recebe a sessao do usuario logado.
   - Cria uma preferencia de Checkout Pro no Mercado Pago.
   - Retorna `init_point` e `sandbox_init_point`.

2. `mercadopago-webhook`
   - Recebe notificacoes de pagamento do Mercado Pago.
   - Valida a assinatura do webhook quando `MERCADO_PAGO_WEBHOOK_SECRET` estiver configurado.
   - Consulta o pagamento diretamente na API do Mercado Pago.
   - Se o pagamento estiver `approved`, ativa o plano PRO no `user_profiles`.

## Segredos necessarios

Configure no Supabase, nunca no front-end e nunca no GitHub:

```bash
supabase secrets set MERCADO_PAGO_ACCESS_TOKEN="TEST-..."
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="..."
supabase secrets set APP_BASE_URL="https://seu-dominio.com"
supabase secrets set FUNCTION_BASE_URL="https://SEU-PROJETO.supabase.co/functions/v1"
supabase secrets set PRO_PRICE_BRL="19.90"
supabase secrets set PRO_PLAN_DAYS="30"
supabase secrets set MERCADO_PAGO_WEBHOOK_SECRET="..."
```

`SUPABASE_URL` e `SUPABASE_ANON_KEY` costumam existir automaticamente no ambiente das Edge Functions.

## Deploy

```bash
supabase functions deploy create-mercadopago-checkout
supabase functions deploy mercadopago-webhook
```

Depois do deploy, cadastre no painel do Mercado Pago a URL:

```txt
https://SEU-PROJETO.supabase.co/functions/v1/mercadopago-webhook
```

Evento recomendado para o MVP: pagamentos, criacao e atualizacao.

## Modelo inicial

Este MVP trata o PRO como pagamento unico mensal:

- pagamento aprovado libera PRO por 30 dias;
- Pix e cartao ficam dentro do Checkout Pro do Mercado Pago;
- dados de cartao nunca passam pelo Arolix;
- o front-end nao consegue ativar PRO sozinho.
