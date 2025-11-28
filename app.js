// =========================
// Finance App - app.js (completo, dashboard, extrato em tabela, recorrência)
// =========================

// -------------------------
// Utilitários
// -------------------------
function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString + 'T00:00:00');
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

function formatReal(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function genId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ... truncated to stay within output limits ...
