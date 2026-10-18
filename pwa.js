/* Installation UI only. Does not access authentication or financial data. */
(() => {
  const base = new URL('.', document.currentScript.src);
  let installPrompt;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register(new URL('service-worker.js', base), { scope: base.pathname, updateViaCache: 'none' })
      .catch(() => { /* The online app remains usable if installation is unavailable. */ });
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    document.querySelectorAll('.pwa-install-button').forEach(button => button.remove());
    document.getElementById('pwa-install-dialog')?.close();
  });
  document.addEventListener('DOMContentLoaded', () => {
    if (standalone()) return;
    const host = document.querySelector('.shell-secondary-nav, .login-box, .entry-card, main');
    if (!host) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'pwa-install-button';
    button.textContent = 'Instalar Arolix';
    const dialog = document.createElement('dialog');
    dialog.id = 'pwa-install-dialog'; dialog.className = 'pwa-install-dialog';
    dialog.setAttribute('aria-labelledby', 'pwa-install-title');
    dialog.innerHTML = '<h2 id="pwa-install-title">Arolix no seu celular</h2><p>O mesmo Arolix, com seus dados sincronizados no computador e no celular.</p><h3>No iPhone</h3><ol><li>Abra o Arolix no <strong>Safari</strong>.</li><li>Toque em <strong>Compartilhar</strong> e em <strong>Adicionar à Tela de Início</strong>.</li><li>Se aparecer, mantenha <strong>Abrir como App da Web</strong> ativado e toque em <strong>Adicionar</strong>.</li></ol><h3>Android ou computador</h3><p>Use a opção <strong>Instalar aplicativo</strong> no menu do navegador, quando disponível.</p><p class="pwa-install-note">Acesso com internet. Seus dados e suas configurações de segurança continuam os mesmos.</p><button type="button" autofocus>Entendi</button>';
    dialog.querySelector('button').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    } });
    dialog.addEventListener('close', () => button.focus());
    button.addEventListener('click', async () => {
      if (installPrompt) {
        const prompt = installPrompt; installPrompt = null;
        try { await prompt.prompt(); await prompt.userChoice; } catch { dialog.showModal(); }
      } else dialog.showModal();
    });
    host.appendChild(button); document.body.appendChild(dialog);
  });
})();
