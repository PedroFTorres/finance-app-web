// print.js — relatórios de impressão/PDF

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

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateBR(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function getSelectedExtratoContaInfo() {
  const select = document.querySelector("#select-contas-extrato");
  const option = select?.selectedOptions?.[0];
  if (!option) return null;

  return {
    nome: option.dataset.nome || option.textContent || "-",
    banco: option.dataset.banco || "-",
    agencia: option.dataset.agencia || "-",
    conta: option.dataset.conta || "-",
    tipoConta: option.dataset.tipoConta || "-",
    saldoInicial: option.dataset.saldoInicial || "-",
    dataSaldo: option.dataset.dataSaldo || "",
    saldoAtual: option.dataset.saldoAtual || "-"
  };
}

function buildExtratoInfoHTML() {
  const conta = getSelectedExtratoContaInfo();
  const extrato = document.querySelector("#tab-extrato");
  const inicio = extrato?.dataset.inicio || "";
  const fim = extrato?.dataset.fim || "";
  const periodo = inicio || fim
    ? `${formatDateBR(inicio)} a ${formatDateBR(fim)}`
    : (document.querySelector("#extrato-mes-label")?.textContent || "-");

  if (!conta) {
    return `
      <section class="print-info-grid">
        <div><span>Período</span><strong>${escapeHTML(periodo)}</strong></div>
      </section>
    `;
  }

  return `
    <section class="print-account-card">
      <div>
        <span>Conta</span>
        <strong>${escapeHTML(conta.nome)}</strong>
      </div>
      <div>
        <span>Banco</span>
        <strong>${escapeHTML(conta.banco)}</strong>
      </div>
      <div>
        <span>Agência</span>
        <strong>${escapeHTML(conta.agencia)}</strong>
      </div>
      <div>
        <span>Número da conta</span>
        <strong>${escapeHTML(conta.conta)}</strong>
      </div>
      <div>
        <span>Tipo</span>
        <strong>${escapeHTML(conta.tipoConta || "-")}</strong>
      </div>
      <div>
        <span>Período</span>
        <strong>${escapeHTML(periodo)}</strong>
      </div>
      <div>
        <span>Saldo inicial cadastrado</span>
        <strong>${escapeHTML(conta.saldoInicial)}</strong>
      </div>
      <div>
        <span>Data do saldo</span>
        <strong>${escapeHTML(formatDateBR(conta.dataSaldo))}</strong>
      </div>
    </section>
  `;
}

function buildExtratoResumoHTML() {
  const extrato = document.querySelector("#tab-extrato");
  const saldoAnterior = extrato?.dataset.saldoAnterior || "-";
  const totalReceitas = extrato?.dataset.totalReceitas || document.querySelector("#total-receitas-extrato")?.textContent || "-";
  const totalDespesas = extrato?.dataset.totalDespesas || document.querySelector("#total-despesas-extrato")?.textContent || "-";
  const saldoPeriodo = extrato?.dataset.saldoPeriodo || document.querySelector("#saldo-periodo-extrato")?.textContent || "-";
  const saldoFinal = extrato?.dataset.saldoFinal || document.querySelector("#saldo-atual-conta-extrato")?.textContent || "-";

  return `
    <section class="print-summary-grid">
      <div><span>Saldo anterior</span><strong>${escapeHTML(saldoAnterior)}</strong></div>
      <div><span>Total receitas</span><strong>${escapeHTML(totalReceitas)}</strong></div>
      <div><span>Total despesas</span><strong>${escapeHTML(totalDespesas)}</strong></div>
      <div><span>Saldo do período</span><strong>${escapeHTML(saldoPeriodo)}</strong></div>
      <div><span>Saldo final</span><strong>${escapeHTML(saldoFinal)}</strong></div>
    </section>
  `;
}

function gerarPDF(tipo) {
    let titulo = "";
    let conteudoHTML = "";

    if (tipo === "extrato") {
        titulo = "Extrato da Conta";
        const tabelaLimpa = cloneAndStripActions("#table-extrato");
        conteudoHTML = `
          ${buildExtratoInfoHTML()}
          ${buildExtratoResumoHTML()}
          <section class="print-section">
            <h2>Movimentações</h2>
            ${tabelaLimpa || "<p>Nenhuma movimentação encontrada.</p>"}
          </section>
        `;
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
