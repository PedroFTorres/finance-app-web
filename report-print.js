(function () {
  // One isolated print document: app navigation and screen CSS never leak into PDFs.
  function open({title, html, styles = ''}) {
    const win = window.open('', '_blank');
    if (!win) { window.alert('Permita abrir a janela de impressão para gerar o relatório.'); return null; }
    const doc = win.document;
    doc.open(); doc.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>'); doc.close();
    doc.title = `Arolix - ${title}`;
    if (styles) doc.head.insertAdjacentHTML('beforeend', styles);
    const styled = fetch(new URL('report-print.css?v=20261027-3', document.baseURI).href).then(async response => {
      if (!response.ok) return false;
      const sheet = doc.createElement('style'); sheet.textContent = await response.text(); doc.head.appendChild(sheet); return true;
    }).catch(() => false);
    const page = doc.createElement('main'); page.className = 'report-page';
    const header = doc.createElement('header'); header.className = 'print-header';
    const brand = doc.createElement('div');
    const logo = doc.createElement('img'); logo.className = 'print-logo'; logo.alt = 'Arolix';
    const logoData = fetch(new URL('logo-arolix.png', document.baseURI).href).then(async response => {
      if (!response.ok) throw new Error('Logo indisponível');
      const blob = await response.blob();
      return new Promise((resolve,reject) => {const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);});
    }).catch(() => null);
    const heading = doc.createElement('h1'); heading.textContent = title;
    brand.append(logo,heading);
    const meta = doc.createElement('div'); meta.className = 'print-meta';
    meta.textContent = `RELATÓRIO FINANCEIRO\nEmitido em ${new Date().toLocaleString('pt-BR')}`;
    header.append(brand,meta);
    const content = doc.createElement('div'); content.className = 'print-content'; content.innerHTML = html;
    const footer = doc.createElement('footer'); footer.className = 'report-footer';
    ['Arolix • Clareza para decidir.', 'Relatório de uso pessoal'].forEach(text => {const span = doc.createElement('span'); span.textContent = text; footer.appendChild(span);});
    page.append(header,content,footer); doc.body.appendChild(page);
    const toolbar = doc.createElement('div'); toolbar.className = 'print-toolbar';
    const button = doc.createElement('button'); button.type = 'button'; button.disabled = true; button.textContent = 'Preparando relatório…'; button.addEventListener('click', () => win.print()); toolbar.appendChild(button); doc.body.prepend(toolbar);
    win.reportReady = (async () => {
      doc.documentElement.dataset.printStage = 'stylesheet';
      const ok = await styled;
      doc.documentElement.dataset.printStage = 'images';
      const source = await logoData;
      if (source) { logo.src = source; await logo.decode().catch(() => {}); }
      doc.documentElement.dataset.printStage = 'fonts';
      await doc.fonts.ready;
      if (!ok || !logo.naturalWidth) { toolbar.append(' Não foi possível carregar o layout ou a logo. Feche e tente novamente.'); return false; }
      doc.documentElement.dataset.printStage = 'ready';
      button.disabled = false; button.textContent = 'Imprimir / Salvar PDF';
      win.focus(); win.print(); return true;
    })();
    return win;
  }
  window.ArolixReportPrint = {open};
})();
