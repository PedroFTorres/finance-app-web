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

function textFromCell(row, index) {
  return row?.children?.[index]?.textContent?.trim() || "-";
}

function listText(item, selector, fallback = "-") {
  return item?.querySelector(selector)?.textContent?.trim() || fallback;
}

function normalizeListItems(selector) {
  return Array.from(document.querySelectorAll(`${selector} > li`))
    .filter(item => !item.classList.contains("lanc-empty") && !item.classList.contains("fatura-empty"));
}

function buildLancamentosReportHTML(selector, emptyText) {
  const items = normalizeListItems(selector);

  if (!items.length) {
    return `<p class="print-empty">${escapeHTML(emptyText)}</p>`;
  }

  return `
    <div class="report-list">
      ${items.map((item, index) => {
        const isReceita = item.classList.contains("lanc-receita");
        const isDespesa = item.classList.contains("lanc-despesa");
        const tone = isReceita ? "credit" : "debit";
        const date = listText(item, ".lanc-date");
        const title = listText(item, ".lanc-title", item.textContent?.trim() || "-");
        const value = listText(item, ".lanc-value");
        const chips = Array.from(item.querySelectorAll(".lanc-chip"))
          .map(chip => chip.textContent.trim())
          .filter(Boolean);

        return `
          <article class="report-row report-row-${tone} ${index % 2 ? "report-row-alt" : ""}">
            <div class="report-date">${escapeHTML(date)}</div>
            <div class="report-main">
              <strong>${escapeHTML(title)}</strong>
              ${chips.length ? `<div class="report-tags">${chips.map(chip => `<span>${escapeHTML(chip)}</span>`).join("")}</div>` : ""}
            </div>
            <div class="report-value ${isDespesa ? "report-value-debit" : "report-value-credit"}">${escapeHTML(value)}</div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function buildFaturaReportHTML() {
  const summary = document.querySelector("#fatura-summary");
  const compras = normalizeListItems("#lista-compras-fatura");
  const titulo = document.querySelector("#fatura-titulo")?.textContent?.trim() || "Cartão";
  const periodo = document.querySelector("#fatura-periodo")?.textContent?.trim() || "-";
  const total = document.querySelector("#fatura-total")?.textContent?.trim() || "-";

  return `
    <section class="print-summary-grid print-summary-grid-compact">
      <div><span>Cartão</span><strong>${escapeHTML(titulo)}</strong></div>
      <div><span>Competência</span><strong>${escapeHTML(periodo)}</strong></div>
      <div><span>Total da fatura</span><strong>${escapeHTML(total)}</strong></div>
      ${summary ? `<div><span>Status</span><strong>${escapeHTML(summary.textContent.trim() || "-")}</strong></div>` : ""}
    </section>
    <section class="print-section">
      <div class="section-title-row">
        <h2>Compras e abatimentos</h2>
        <span class="movement-count">${compras.length} item(ns)</span>
      </div>
      ${compras.length ? `
        <div class="report-list">
          ${compras.map((item, index) => {
            const isPagamento = item.classList.contains("fatura-row-pagamento");
            const date = listText(item, ".fatura-data");
            const title = listText(item, ".fatura-desc", item.textContent?.trim() || "-");
            const meta = listText(item, ".fatura-meta", isPagamento ? "Pagamento / abatimento" : "Compra no cartão");
            const parcela = listText(item, ".fatura-parcela", "");
            const value = listText(item, ".fatura-valor, .valor-pagamento");
            const tone = isPagamento ? "credit" : "debit";
            return `
              <article class="report-row report-row-${tone} ${index % 2 ? "report-row-alt" : ""}">
                <div class="report-date">${escapeHTML(date)}</div>
                <div class="report-main">
                  <strong>${escapeHTML(title)}</strong>
                  <div class="report-tags">
                    <span>${escapeHTML(meta)}</span>
                    ${parcela ? `<span>${escapeHTML(parcela)}</span>` : ""}
                  </div>
                </div>
                <div class="report-value ${isPagamento ? "report-value-credit" : "report-value-debit"}">${escapeHTML(value)}</div>
              </article>
            `;
          }).join("")}
        </div>
      ` : '<p class="print-empty">Nenhuma compra lançada nesta fatura.</p>'}
    </section>
  `;
}

function buildExtratoMovimentosHTML() {
  const rows = Array.from(document.querySelectorAll("#table-extrato tbody tr"));

  if (!rows.length) {
    return '<p class="print-empty">Nenhuma movimentação encontrada.</p>';
  }

  return `
    <div class="statement-list">
      ${rows.map(row => {
        const tipoTexto = textFromCell(row, 2);
        const isCredito = /cr[eé]dito/i.test(tipoTexto);
        const rowClass = isCredito ? "statement-row statement-row-credit" : "statement-row statement-row-debit";
        const tipoClass = isCredito ? "statement-type statement-credit" : "statement-type statement-debit";

        return `
          <article class="${rowClass}">
            <div class="statement-date">${escapeHTML(textFromCell(row, 0))}</div>
            <div class="statement-main">
              <strong>${escapeHTML(textFromCell(row, 1))}</strong>
              <span class="${tipoClass}">${escapeHTML(tipoTexto)}</span>
            </div>
            <div class="statement-amount">
              <span>Valor</span>
              <strong>${escapeHTML(textFromCell(row, 3))}</strong>
            </div>
            <div class="statement-balance">
              <span>Saldo</span>
              <strong>${escapeHTML(textFromCell(row, 4))}</strong>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function buildPrintStyles() {
  return `
    <style>
      :root {
        --brand: #7c4dff;
        --brand-dark: #2f2463;
        --ink: #232634;
        --muted: #6f7280;
        --line: #e8e3f6;
        --soft: #faf8ff;
        --soft-strong: #f1ecff;
        --green: #15803d;
        --red: #c62828;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        padding: 22px;
        background: #f7f7fb;
        color: var(--ink);
        font-family: Inter, Arial, Helvetica, sans-serif;
        font-size: 13px;
      }

      .report-page {
        max-width: 1060px;
        margin: 0 auto;
        padding: 26px;
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 8px;
      }

      .print-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 2px solid var(--line);
      }

      .print-logo {
        display: block;
        width: 118px;
        height: auto;
        margin-bottom: 10px;
      }

      h1 {
        margin: 0;
        color: var(--brand);
        font-size: 26px;
        line-height: 1.1;
      }

      .meta {
        min-width: 190px;
        margin: 0;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.45;
        text-align: right;
      }

      .meta strong {
        display: block;
        color: var(--brand-dark);
        font-size: 13px;
      }

      .print-account-card {
        display: grid;
        grid-template-columns: 1.4fr 1fr 1fr 1fr;
        gap: 10px;
        margin: 0 0 12px;
      }

      .print-account-card > div,
      .print-summary-grid > div {
        min-height: 56px;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--soft);
      }

      .print-account-card > div:first-child {
        grid-column: span 2;
      }

      .print-account-card span,
      .print-summary-grid span {
        display: block;
        margin-bottom: 4px;
        color: #85808f;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .04em;
        line-height: 1.2;
        text-transform: uppercase;
      }

      .print-account-card strong,
      .print-summary-grid strong {
        display: block;
        color: var(--ink);
        font-size: 13px;
        line-height: 1.25;
        overflow-wrap: anywhere;
      }

      .print-summary-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
        margin: 0 0 18px;
      }

      .print-summary-grid > div:last-child {
        background: var(--soft-strong);
        border-color: #cfc2ff;
      }

      .print-section {
        margin-top: 18px;
      }

      .section-title-row {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 8px;
      }

      h2 {
        margin: 0;
        color: var(--brand-dark);
        font-size: 17px;
        line-height: 1.2;
      }

      .movement-count {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }

      thead th {
        padding: 9px 10px;
        border-top: 1px solid #ded7f5;
        border-bottom: 1px solid #ded7f5;
        background: var(--soft-strong);
        color: var(--brand-dark);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .03em;
        text-align: left;
        text-transform: uppercase;
      }

      tbody td {
        padding: 9px 10px;
        border-bottom: 1px solid #ececf2;
        background: #fff !important;
        vertical-align: top;
      }

      tbody tr:nth-child(even),
      tbody tr:nth-child(odd) {
        background: #fff !important;
      }

      th:nth-child(4),
      th:nth-child(5),
      td:nth-child(4),
      td:nth-child(5) {
        text-align: right;
        white-space: nowrap;
      }

      .extrato-credito,
      .extrato-saldo-positivo {
        color: var(--green);
        font-weight: 800;
      }

      .extrato-debito,
      .extrato-saldo-negativo {
        color: var(--red);
        font-weight: 800;
      }

      .statement-list {
        display: grid;
        gap: 8px;
      }

      .statement-row,
      .report-row {
        display: grid;
        grid-template-columns: 96px minmax(0, 1fr) 132px 132px;
        gap: 12px;
        align-items: center;
        min-height: 58px;
        padding: 10px 12px;
        border: 1px solid #ebe6f8;
        border-left: 5px solid var(--red);
        border-radius: 8px;
        background: #fff;
      }

      .report-row {
        grid-template-columns: 96px minmax(0, 1fr) 150px;
      }

      .statement-row:nth-child(even),
      .report-row-alt {
        background: #fbfaff;
      }

      .statement-row-credit,
      .report-row-credit {
        border-left-color: #22c55e;
      }

      .statement-row-debit,
      .report-row-debit {
        border-left-color: #ef4444;
      }

      .statement-date,
      .report-date {
        color: var(--brand-dark);
        font-size: 12px;
        font-weight: 900;
        white-space: nowrap;
      }

      .statement-main strong,
      .report-main strong {
        display: block;
        color: var(--ink);
        font-size: 12px;
        line-height: 1.25;
        overflow-wrap: anywhere;
      }

      .report-list {
        display: grid;
        gap: 8px;
      }

      .report-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 6px;
      }

      .report-tags span {
        display: inline-flex;
        align-items: center;
        min-height: 20px;
        padding: 2px 7px;
        border-radius: 999px;
        background: #f5f1ff;
        color: #655f75;
        font-size: 9px;
        font-weight: 800;
      }

      .report-value {
        color: var(--ink);
        font-size: 12px;
        font-weight: 900;
        text-align: right;
        white-space: nowrap;
      }

      .report-value-credit {
        color: var(--green);
      }

      .report-value-debit {
        color: var(--red);
      }

      .statement-type {
        display: inline-flex;
        align-items: center;
        margin-top: 5px;
        padding: 3px 8px;
        border-radius: 999px;
        background: #f5f1ff;
        font-size: 10px;
        font-weight: 900;
      }

      .statement-credit {
        color: var(--green);
      }

      .statement-debit {
        color: var(--red);
      }

      .statement-amount,
      .statement-balance {
        text-align: right;
      }

      .statement-amount span,
      .statement-balance span {
        display: block;
        margin-bottom: 3px;
        color: #918aa1;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .04em;
        text-transform: uppercase;
      }

      .statement-amount strong,
      .statement-balance strong {
        display: block;
        color: var(--ink);
        font-size: 12px;
        font-weight: 900;
        white-space: nowrap;
      }

      .print-empty {
        margin: 0;
        padding: 18px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--soft);
        color: var(--muted);
        font-weight: 700;
      }

      .report-footer {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-top: 18px;
        padding-top: 10px;
        border-top: 1px solid var(--line);
        color: #8a8497;
        font-size: 10px;
      }

      @media print {
        @page {
          size: A4;
          margin: 10mm;
        }

        body {
          padding: 0;
          background: #fff;
        }

        .report-page {
          max-width: none;
          padding: 0;
          border: 0;
          border-radius: 0;
        }

        .print-header,
        .print-account-card,
        .print-summary-grid,
        tr,
        .statement-row,
        .report-row {
          break-inside: avoid;
        }
      }
    </style>
  `;
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
        const movimentoCount = document.querySelectorAll("#table-extrato tbody tr").length;
        conteudoHTML = `
          ${buildExtratoInfoHTML()}
          ${buildExtratoResumoHTML()}
          <section class="print-section">
            <div class="section-title-row">
              <h2>Movimentações</h2>
              <span class="movement-count">${movimentoCount} movimento(s)</span>
            </div>
            ${buildExtratoMovimentosHTML()}
          </section>
        `;
    }

    if (tipo === "receitas") {
        titulo = "Contas a Receber";
        conteudoHTML = buildLancamentosReportHTML("#list-receitas", "Nenhuma conta a receber encontrada.");
    }

    if (tipo === "despesas") {
        titulo = "Contas a Pagar";
        conteudoHTML = buildLancamentosReportHTML("#list-despesas", "Nenhuma conta a pagar encontrada.");
    }

    if (tipo === "fatura") {
        titulo = "Fatura do Cartão";
        conteudoHTML = buildFaturaReportHTML();
    }

    const win = window.open("", "_blank");
    const geradoEm = new Date().toLocaleString("pt-BR");
    win.document.write(`
        <html>
        <head>
            <meta charset="utf-8" />
            <title>${escapeHTML(titulo)}</title>
            ${buildPrintStyles()}
        </head>
        <body>
            <main class="report-page">
                <header class="print-header">
                    <div>
                        <img src="logo-arolix.png" class="print-logo" alt="Arolix">
                        <h1>${escapeHTML(titulo)}</h1>
                    </div>
                    <p class="meta">
                        Gerado em
                        <strong>${escapeHTML(geradoEm)}</strong>
                    </p>
                </header>
                <div class="print-content">
                    ${conteudoHTML}
                </div>
                <footer class="report-footer">
                    <span>Arolix Finance</span>
                    <span>Documento para conferência interna</span>
                </footer>
            </main>
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
