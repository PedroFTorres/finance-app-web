# Arolix no iPhone e no computador

Uma única aplicação responsiva, mesma conta e mesmos dados. A instalação não cria
um banco separado nem uma cópia dos lançamentos. No iPhone pode ser necessário
entrar novamente e confirmar o MFA na primeira abertura pela tela inicial.

## Instalar no iPhone

1. Abra https://arolix.com.br no Safari.
2. Toque em Compartilhar → Adicionar à Tela de Início.
3. Se disponível, mantenha “Abrir como App da Web” ativado e toque em Adicionar.
4. Abra pelo ícone Arolix e entre normalmente.

O botão “Instalar Arolix”, no menu Mais ou na tela de login, também explica os passos.
No Chrome/Edge/Android, usa a instalação oferecida pelo navegador quando disponível.

## Conexão e atualizações

- Os módulos precisam de internet. Não há edição/sincronização offline.
- O service worker mantém somente `offline.html`, uma mensagem pública sem dados.
- Não armazena documentos autenticados, respostas Supabase, comprovantes ou saldos.
- Páginas e scripts continuam vindo da rede; o worker não serve versões antigas do app.
- Login, MFA e permissões continuam sendo os mesmos. Não houve alteração no banco.
- Requer HTTPS em produção; localhost é permitido apenas para testes.
- Não há publicação na App Store, push ou biometria adicionados por esta adaptação.

## Validação

`pnpm check` valida integridade, manifesto/ícones e política de cache.
`node scripts/check-mobile-pwa.cjs` usa servidor local e navegador isolado, sem
scripts financeiros nem acesso ao banco real. Cobre larguras 375/390/430/1440px,
menus, instruções de instalação, modal, desconexão e reconexão.

Antes de liberar para clientes, validar em iPhone físico: Safari e modo instalado,
login/MFA (incluindo alternar para o autenticador), teclado aberto, anexar PDF,
rolagem de faturas/balanço, rotação e retorno após bloquear a tela. A emulação no
computador não substitui esses testes de comportamento do iOS.
