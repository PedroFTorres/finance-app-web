# SEO do Arolix

## Posicionamento

A página principal apresenta um aplicativo de controle financeiro pessoal, não apenas a marca.
Termos de intenção: organizar receitas e despesas, contas a pagar e a receber,
controlar cartão de crédito e parcelas, gastos por categoria, celular e computador.
São hipóteses de termos, sem alegação de volume de busca ou posição garantida.
Investimentos continuam privados e não são anunciados como parte do Pro.

## Implementado no site

- Conteúdo e metadados renderizados em HTML, acessíveis sem executar JavaScript.
- Título descritivo e um único H1; texto voltado às tarefas do usuário.
- Canonical da página principal: https://arolix.com.br/.
- index.html e vendas.html mantêm o mesmo conteúdo, com canonical para a raiz.
- Sitemap contém somente o endereço público canônico, sem parâmetros nem duplicatas.
- robots.txt informa o sitemap e não bloqueia CSS/JS da página.
- Páginas do aplicativo, autenticação e pagamento têm noindex, follow.
  Não bloquear essas páginas no robots.txt: o rastreador precisa ler o noindex.
  Isso não é proteção de dados; autenticação e políticas do banco continuam indispensáveis.
- JSON-LD WebSite e WebApplication descrevem apenas recursos e preço reais.
  Não foram criadas avaliações, estrelas ou promessas de destaque no Google.

## Próximo passo na conta do proprietário

1. Entrar em https://search.google.com/search-console/ com sua conta Google.
2. Adicionar uma propriedade de domínio para arolix.com.br, se ainda não existir.
3. Copiar o registro TXT de verificação fornecido pelo Google e adicioná-lo ao DNS.
   Não alterar registros A, CNAME, MX, SPF ou DKIM existentes.
4. Após a verificação, enviar https://arolix.com.br/sitemap.xml em Sitemaps.
5. Inspecionar https://arolix.com.br/, testar a URL publicada e solicitar indexação.
6. Acompanhar indexação, impressões, cliques e consultas sem marca.

Não há token de verificação inventado nem solicitação automática de indexação.
SEO não garante indexação, posição ou prazo. Não é necessário comprar anúncios para indexar.

## Conteúdo futuro

Criar guias originais e úteis, ligados à página principal, para necessidades específicas:
controle de compras parceladas, organização das contas do mês e análise por categoria.
Evitar páginas quase iguais feitas apenas para repetir variações de palavras-chave.
Usar as consultas reais do Search Console para priorizar as próximas páginas.

## Referências oficiais

- https://developers.google.com/search/docs/fundamentals/seo-starter-guide?hl=pt-br
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?hl=pt-br
- https://developers.google.com/search/docs/crawling-indexing/block-indexing?hl=pt-br
- https://developers.google.com/search/docs/appearance/site-names?hl=pt-br
