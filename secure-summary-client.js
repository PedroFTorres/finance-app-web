/* secure-summary-client.js
   Integração opcional do dashboard com Edge Function segura.
   Não altera o fluxo principal do app.js; apenas sobrescreve os 3 totais
   quando a função estiver disponível e o usuário autenticado.
*/
(function () {
  "use strict";

  const FUNCTION_URL = "https://febwinynlbviadasgwlg.supabase.co/functions/v1/secure-summary";

  function fmtMoney(v) {
    return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  async function carregarResumoSeguro() {
    if (!window.supabase?.auth) return;
    try {
      const { data } = await window.supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;

      const resp = await fetch(FUNCTION_URL, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });
      const body = await resp.json();
      if (!resp.ok) {
        console.warn("Resumo seguro indisponível:", body);
        return;
      }

      const receberEl = document.getElementById("dash-receber");
      const pagarEl = document.getElementById("dash-pagar");
      const saldoPrevistoEl = document.getElementById("dash-saldo-previsto");

      if (receberEl) receberEl.textContent = fmtMoney(body.total_receitas);
      if (pagarEl) pagarEl.textContent = fmtMoney(body.total_despesas);
      if (saldoPrevistoEl) saldoPrevistoEl.textContent = fmtMoney(body.saldo);
    } catch (err) {
      console.warn("Falha ao carregar resumo seguro:", err);
    }
  }

  window.addEventListener("load", () => {
    setTimeout(carregarResumoSeguro, 1200);
  });
})();
