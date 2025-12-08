// =======================
// PRINT SYSTEM FINANCE APP
// =======================

function gerarPDF(tipo) {
    let titulo = "";
    let conteudo = "";

    if (tipo === "extrato") {
        titulo = "Extrato da Conta";
        const tabela = document.querySelector("#table-extrato").outerHTML;
        const totals = document.querySelector(".extrato-totals").outerHTML;
        conteudo = tabela + totals;
    }

    if (tipo === "receitas") {
        titulo = "Contas a Receber";
        conteudo = document.querySelector("#list-receitas").outerHTML;
    }

    if (tipo === "despesas") {
        titulo = "Contas a Pagar";
        conteudo = document.querySelector("#list-despesas").outerHTML;
    }

    if (tipo === "fatura") {
        titulo = "Fatura do Cartão";
        const sum = document.querySelector("#fatura-summary").outerHTML;
        const lista = document.querySelector("#lista-compras-fatura").outerHTML;
        conteudo = sum + lista;
    }

    // Abre nova janela com layout limpo para impressão
    const win = window.open("", "_blank");

    win.document.write(`
        <html>
        <head>
            <title>${titulo}</title>
            <link rel="stylesheet" href="print.css">
        </head>
        <body>

        <div class="print-header">
            <img src="logo-arolix.png" class="print-logo">
            <h1>${titulo}</h1>
            <p>Gerado em: ${new Date().toLocaleString("pt-BR")}</p>
        </div>

        <div class="print-content">
            ${conteudo}
        </div>

        </body>
        </html>
    `);

    win.document.close();
    win.focus();

    // Aguarda renderização antes de imprimir
    setTimeout(() => win.print(), 300);
}


// -------------------------
// Ligação dos botões
// -------------------------

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
