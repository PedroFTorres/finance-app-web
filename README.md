# Finance App (Web) - Supabase

Aplicativo web para controle financeiro com contas, receitas, despesas, cartões, auditoria, relatórios e exportação.

## Como usar

1. Configure `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `config.js`.
2. Suba os arquivos no repositório GitHub e publique no GitHub Pages ou em qualquer host estático.
3. Crie pelo menos uma conta em `contas_bancarias` para testar.

## Planos e acesso

A integração de pagamento foi removida temporariamente. O foco atual é finalizar segurança, regras de plano e estabilidade antes de ativar o gateway de assinatura.

- `free`: teste gratuito por 5 dias, com acesso financeiro completo, sem Investimentos/CVM.
- `pro`: plano pago de 30 dias, com acesso financeiro completo, sem Investimentos/CVM.
- `vip`: acesso por convite/manual, com tudo do Pro + Investimentos/CVM.

## Pagamento futuro

- Escolher e integrar o gateway depois das regras finais de plano.
- Isolar o gateway em funções genéricas, como `create-payment`, `check-payment` e `payment-webhook`.
- Implementar webhooks para manter o status de assinatura sincronizado (`active`, `past_due`, `canceled`).
- Evitar acoplar telas financeiras diretamente a um provedor específico.

## Auditoria de segurança

Rode os scripts em `supabase/` no SQL Editor do Supabase:

- `security-audit.sql`: audita RLS, policies, grants públicos e valores de plano.
- `revoke-anon-writes.sql`: remove escrita direta de usuários não autenticados.
- `plan-security.sql`: impede que usuários alterem o próprio plano pelo navegador.

Se aparecer policy ampla para `{authenticated}` ou `{public}` com `true`, troque por filtro por usuário:

- `USING (auth.uid() = user_id)` para `SELECT/UPDATE/DELETE`.
- `WITH CHECK (auth.uid() = user_id)` para `INSERT/UPDATE`.

## Checklist de produção

- Ativar e revisar RLS em todas as tabelas do Supabase.
- Validar permissões críticas também no banco/backend.
- Publicar Política de Privacidade e Termos de Uso compatíveis com LGPD.
- Separar ambientes (`dev`, `staging`, `prod`) com chaves e bancos distintos.
- Criar migrações versionadas para banco de dados.
- Configurar domínio de produção nas funções via `APP_ORIGIN`.
- Adicionar testes automatizados para fluxos críticos.
- Monitorar erros, performance e backups.
