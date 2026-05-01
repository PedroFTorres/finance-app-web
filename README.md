```md
# Finance App (Web) - Supabase


Pequeno app para controle de contas, receitas e despesas.


## Como usar
1. Substitua `SUPABASE_URL` e `SUPABASE_ANON_KEY` em `supabase.js` pelos valores do seu projeto.
2. Suba os arquivos no repositório GitHub e publique no GitHub Pages (ou use qualquer host estático).
3. Crie pelo menos uma conta em `contas_bancarias` para testar.


## Observações
- Atualmente o app assume RLS desabilitado para facilitar o desenvolvimento.
- Para produção, habilite RLS e crie policies adequadas.

## Checklist para deixar o app profissional (SaaS por assinatura)

### 1) Segurança e conformidade (prioridade máxima)
- Ativar **RLS** em todas as tabelas do Supabase e criar policies por usuário (`auth.uid() = user_id`).
- Nunca expor dados sensíveis no front-end; validar permissões também no backend.
- Implementar rate limiting, proteção contra brute force e auditoria de login.
- Publicar Política de Privacidade e Termos de Uso (LGPD), com fluxo de consentimento.

### 2) Cobrança recorrente
- Integrar gateway de assinatura (Stripe, Asaas, Mercado Pago ou Pagar.me).
- Definir planos (mensal/anual), período de teste e lógica de upgrade/downgrade.
- Implementar **webhooks** para manter status de assinatura sincronizado (`active`, `past_due`, `canceled`).
- Bloquear/limitar funcionalidades premium quando assinatura estiver inativa.

### 3) Arquitetura de produção
- Mover regras críticas (assinatura, permissões, cálculos sensíveis) para backend/serverless.
- Separar ambientes (`dev`, `staging`, `prod`) com chaves e bancos distintos.
- Criar migrações versionadas para banco de dados.

### 4) Qualidade e confiabilidade
- Adicionar testes automatizados (unitários + integração + e2e).
- Configurar CI/CD (ex.: GitHub Actions) com lint, testes e deploy automático.
- Monitoramento de erros e performance (Sentry/LogRocket + analytics).
- Backup e plano de recuperação de desastres.

### 5) UX para conversão em assinatura
- Melhorar onboarding (valor entregue em menos de 2 minutos).
- Tela de pricing clara com comparação de planos e CTA forte.
- Fluxo de checkout sem fricção + recuperação de carrinho/pagamento falho.
- E-mails transacionais: boas-vindas, trial acabando, falha de pagamento, retenção.

### 6) Métricas de negócio (essenciais para SaaS)
- Acompanhar MRR, churn, LTV, CAC, taxa de conversão do trial e inadimplência.
- Implementar eventos de produto (ativação, retenção D7/D30, uso de features premium).
- Criar dashboard executivo para decisões semanais.

### 7) Suporte e operação
- Central de ajuda (FAQ), canal de suporte e SLA de resposta.
- Fluxo para cancelamento simples e reativação (evita chargeback e melhora reputação).
- Roadmap público simples para coletar feedback e priorizar melhorias.

## Próximos passos sugeridos (30 dias)
1. Semana 1: RLS + policies + estrutura de planos.
2. Semana 2: integração de pagamentos + webhooks.
3. Semana 3: controle de acesso premium + onboarding e pricing.
4. Semana 4: métricas SaaS + testes críticos + monitoramento.

## Auditoria extra de policies (recomendado)

Além do `rls-check.sql`, rode `rls-audit.sql` para achar riscos comuns:

- Policies com `qual = true` ou `with_check = true` (acesso amplo).
- Policies duplicadas para mesma tabela/comando/role (sobreposição difícil de manter).
- Policies sem `auth.uid()` (exceto `service_role`) que merecem revisão manual.

Se aparecer policy ampla para `{authenticated}` ou `{public}` com `true`, o ideal é trocar por filtro por usuário, por exemplo:

- `USING (auth.uid() = user_id)` para `SELECT/UPDATE/DELETE`.
- `WITH CHECK (auth.uid() = user_id)` para `INSERT/UPDATE`.



