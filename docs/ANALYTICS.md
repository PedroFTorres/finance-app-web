# Estatísticas públicas (GA4)

ID de medição: `G-YCEFKJH08Z`. Não é segredo. Sem API secret ou credencial no navegador.

## Escopo e consentimento

- `public-analytics.js` somente em index/vendas, controle-cartao-credito e guia de compras parceladas, em HTTPS nos hosts arolix.com.br/www.arolix.com.br. Preview local não mede.
- Sem carregar Google antes de aceitar (consentimento básico). Recusa tem igual acesso e botão junto à aceitação; alteração pelo rodapé. Escolha local de até 180 dias.
- Retirada desativa, apaga cookies `_ga` acessíveis e recarrega para descarregar a biblioteca. Sincronização por evento storage entre abas do mesmo domínio. Não apaga dados históricos do Google.
- Sem tags nas telas privadas, autenticação e pagamentos. A chave de preferência não é uma sessão de usuário.
- Aviso específico em privacidade-estatisticas.html. Não substitui uma política completa do aplicativo nem revisão de obrigações legais.

## Dados/eventos

`page_view`: título fixo, URL pública canônica sem query/hash. Referência externa apenas na origem, nunca caminho privado. UTMs não são preservadas: perde-se atribuição detalhada em favor da minimização.

`public_cta_click`: ação fixa `open_login` ou `view_plans`. Não significa cadastro ou compra. Sem user_id, texto livre, informações de formulário ou dados financeiros.

Signals, personalização e consentimentos de publicidade desativados. Cookies com validade configurada em 180 dias, sem renovação automática. Navegadores podem limitar a duração.

## Antes e depois de publicar

1. No fluxo Web do Google Analytics, confirmar **Medição otimizada desativada**; não temos API para verificar a configuração remota. Não ativar coleta de dados fornecidos pelo usuário nem Google Signals.
2. Revisar no painel retenção, acessos administrativos e eventual necessidade de CMP certificada antes de integrar Google Ads ou ampliar regiões/escopo. Não se declara conformidade legal automática.
3. Publicar os arquivos pelo workflow habitual. Até publicar, “Teste a instalação” pode não encontrar a tag.
4. Abrir site em janela privada, aceitar estatísticas e conferir Tempo real/Tag Assistant. Com recusa a tag não deve ser detectada — esperado. Bloqueadores também podem impedir a medição. Confirmar recebimento no GA é verificação manual pendente.
5. Não marcar cliques como `purchase`/`sign_up`. Conversões reais exigem outra implementação validada com confirmação de cadastro/pagamento, sem dados financeiros pessoais.

## Testes

`node --test tests/*.test.js`, `pnpm lint` e `node scripts/check-public-analytics.cjs`. O teste de navegador intercepta todo o tráfego, inclusive Google: não gera visitas nem dados reais. Testa consentimento, recusa, retirada, cookies, expiração, minimização, páginas internas, preview local e responsividade.

Referências: https://developers.google.com/tag-platform/security/guides/consent e https://developers.google.com/analytics/devguides/collection/ga4/reference/config .
