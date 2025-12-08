// print.js — versão que limpa colunas de ação antes de imprimir

function cloneAndStripActions(selectorTable) {
  const original = document.querySelector(selectorTable);
  if (!original) return null;

  // clona a tabela inteira
  const clone = original.cloneNode(true);

  // identificar índice da coluna 'Ações' (th)
  const thead = clone.querySelector("thead");
  let actionIndex = -1;
  if (thead) {
    const ths = Array.from(thead.querySelectorAll("th"));
    actionIndex = ths.findIndex(th => /Ações|Acoes|Ação/i.test(th.textContent));
    // se encontrado, remove o th
    if (actionIndex >= 0) ths[actionIndex].remove();
  }

  // remover botões e colunas de ação do body
  const rows = clone.querySelectorAll("tbody tr");
  rows.forEach(tr => {
    // remover o botão (caso exista)
    tr.querySelectorAll("button, .action-btn, .nav-btn").forEach(b => b.remove());
    // se actionIndex válido, remover a célula correspondente
    if (actionIndex >= 0) {
      const tds = tr.querySelectorAll("td");
      if (tds[actionIndex]) tds[actionIndex].remove();
    }
  });

  // também limpar qualquer coluna de ações no tfoot (ex.: totais)
  const tfoot = clone.querySelector("tfoot");
  if (tfoot && actionIndex >= 0) {
    tfoot.querySelectorAll("tr").forEach(r => {
      const tds = r.querySelectorAll("td");
      if (tds[actionIndex]) tds[actionIndex].remove();
    });
  }

  return clone.outerHTML;
}

function gerarPDF(tipo) {
    let titulo = "";
    let conteudoHTML = "";

    if (tipo === "extrato") {
        titulo = "Extrato da Conta";
        // usa a função que clona e remove ações
        const tabelaLimpa = cloneAndStripActions("#table-extrato");
        const totals = document.querySelector(".extrato-totals")?.outerHTML || "";
        conteudoHTML = (tabelaLimpa || "<p>Nenhuma informação de extrato encontrada.</p>") + totals;
    }

    if (tipo === "receitas") {
        titulo = "Contas a Receber";
        // para listas simples, clona e remove botões
        const lista = document.querySelector("#list-receitas");
        if (lista) {
            const clone = lista.cloneNode(true);
            clone.querySelectorAll("button").forEach(b => b.remove());
            conteudoHTML = clone.outerHTML;
        } else conteudoHTML = "<p>Nenhuma conta a receber encontrada.</p>";
    }

    if (tipo === "despesas") {
        titulo = "Contas a Pagar";
        const lista = document.querySelector("#list-despesas");
        if (lista) {
            const clone = lista.cloneNode(true);
            clone.querySelectorAll("button").forEach(b => b.remove());
            conteudoHTML = clone.outerHTML;
        } else conteudoHTML = "<p>Nenhuma conta a pagar encontrada.</p>";
    }

    if (tipo === "fatura") {
        titulo = "Fatura do Cartão";
        const sum = document.querySelector("#fatura-summary")?.outerHTML || "";
        const lista = document.querySelector("#lista-compras-fatura");
        if (lista) {
            const clone = lista.cloneNode(true);
            clone.querySelectorAll("button").forEach(b => b.remove());
            conteudoHTML = sum + clone.outerHTML;
        } else conteudoHTML = sum;
    }

    const win = window.open("", "_blank");
    win.document.write(`
        <html>
        <head>
            <meta charset="utf-8" />
            <title>${titulo}</title>
            <link rel="stylesheet" href="print.css">
        </head>
        <body>
            <div class="print-header">
                <img src="logo-arolix.png" class="print-logo" alt="logo">
                <h1>${titulo}</h1>
                <p class="meta">Gerado em: ${new Date().toLocaleString("pt-BR")}</p>
            </div>
            <div class="print-content">
                ${conteudoHTML}
            </div>
        </body>
        </html>
    `);
    win.document.close();
    win.focus();

    // garantir renderização antes de chamar print
    setTimeout(() => win.print(), 350);
}

document.addEventListener("DOMContentLoaded", () => {
    const b1 = document.getElementById("btn-print-extrato");
    if (b1) b1.onclick = () => gerarPDF("extrato");

    const b2 = document.getElementById("btn-print-receitas");
    if (b2) b2.onclick = () => gerarPDF("receitas");

    const b3 = document.getElementById("btn-print-despesas");
    if (b3) b3.onclick = () => gerarPDF("despesas");

    const b4 = document.getElementById("btn-print-fatura");
    if (b4) b4.onclick = () => gerarPDF("fatura");
});

