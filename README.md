# Finance App (Web) - Supabase

Pequeno app para controle de contas, receitas e despesas.

## Como usar
1. Configure `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `config.js`.
2. Suba os arquivos no repositório GitHub e publique no GitHub Pages ou em qualquer host estático.
3. Crie pelo menos uma conta em `contas_bancarias` para testar.

## Status de pagamento

A integração de pagamento foi removida temporariamente. O foco atual é finalizar a segurança, as regras de plano e a estabilidade do app antes de escolher um novo gateway.

Planos mantidos no app:

- `free`: plano gratuito com limites.
- `pro`: plano pago futuro.
- `vip`: acesso total gratuito concedido manualmente pelo administrador.

## Checklist para deixar o app profissional

### 1) Segurança e conformidade
- Ativar RLS em todas as tabelas do Supabase e criar policies por usuário (`auth.uid() = user_id`).
- Nunca expor dados sensíveis no front-end; validar permissões também no banco/backend.
- Bloquear alterações client-side nos campos de plano e assinatura.
- Revogar permissões diretas de escrita para `anon`.
- Publicar Política de Privacidade e Termos de Uso compatíveis com LGPD.

### 2) Planos e acesso
- Manter os planos `free`, `pro` e `vip`.
- Garantir limites do plano Free no banco, não apenas no front-end.
- Permitir `vip` apenas por ação administrativa.
- Bloquear/limitar funcionalidades premium quando assinatura estiver inativa.

### 3) Pagamento futuro
- Escolher um novo gateway somente depois que a segurança estiver fechada.
- Isolar o futuro gateway em funções genéricas, por exemplo `create-payment`, `check-payment` e `payment-webhook`.
- Implementar webhooks para manter status de assinatura sincronizado (`active`, `past_due`, `canceled`).
- Evitar acoplar o app diretamente a um provedor específico.

### 4) Arquitetura de produção
- Mover regras críticas para banco/backend sempre que possível.
- Separar ambientes (`dev`, `staging`, `prod`) com chaves e bancos distintos.
- Criar migrações versionadas para banco de dados.
- Configurar domínio de produção nas funções via `APP_ORIGIN`.

### 5) Qualidade e confiabilidade
- Adicionar testes automatizados para fluxos críticos.
- Configurar CI/CD com validações antes de deploy.
- Monitoramento de erros e performance.
- Backup e plano de recuperação de desastres.

## Auditoria de segurança

Rode os scripts em `supabase/` no SQL Editor do Supabase:

- `security-audit.sql`: audita RLS, policies, grants públicos e valores de plano.
- `revoke-anon-writes.sql`: remove escrita direta de usuários não autenticados.
- `plan-security.sql`: impede que usuários alterem o próprio plano pelo navegador.

Se aparecer policy ampla para `{authenticated}` ou `{public}` com `true`, troque por filtro por usuário, por exemplo:

- `USING (auth.uid() = user_id)` para `SELECT/UPDATE/DELETE`.
- `WITH CHECK (auth.uid() = user_id)` para `INSERT/UPDATE`.
