/* Shared browser/Node helpers. No database writes during reads. */
(function (root) {
  'use strict';

  function localISODate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function addMonthsClamped(iso, months) {
    const [year, month, day] = String(iso).slice(0, 10).split('-').map(Number);
    const target = new Date(year, month - 1 + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, lastDay));
    return localISODate(target);
  }

  function businessDaysBetween(startISO, endISO) {
    const start = new Date(`${startISO}T00:00:00Z`);
    const end = new Date(`${endISO}T00:00:00Z`);
    const days = Math.floor((end - start) / 86400000);
    if (!Number.isFinite(days) || days <= 0) return 0;
    let count = Math.floor(days / 7) * 5;
    for (let index = 1; index <= days % 7; index++) {
      const day = (start.getUTCDay() + index) % 7;
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  }

  function parseMoney(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    let text = String(value || '').trim().replace(/R\$|\s/g, '');
    if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
    const number = Number(text);
    return Number.isFinite(number) ? number : 0;
  }

  async function selectAll(query, pageSize = 500) {
    const rows = [];
    // A unique tie-breaker keeps rows with the same date/name on stable pages.
    query = query.order('id', { ascending: true });
    for (let offset = 0; ; offset += pageSize) {
      const result = await query.range(offset, offset + pageSize - 1);
      if (result.error) return { data: null, error: result.error };
      if (!Array.isArray(result.data)) {
        return { data: null, error: new Error('Resposta inválida ao carregar o histórico.') };
      }
      rows.push(...result.data);
      if (result.data.length < pageSize) return { data: rows, error: null };
    }
  }

  async function selectIn(queryFactory, values, batchSize = 100) {
    const ids = [...new Set(values || [])];
    const rows = [];
    for (let index = 0; index < ids.length; index += batchSize) {
      const result = await selectAll(queryFactory(ids.slice(index, index + batchSize)));
      if (result.error) return { data: null, error: result.error };
      rows.push(...result.data);
    }
    return { data: rows, error: null };
  }

  function computeContaBalance(conta, movements = []) {
    const initial = Number(conta?.saldo_inicial || 0);
    const initialDate = conta?.data_saldo || null;
    const sameMoney = (a, b) => Math.abs(Number(a) - Number(b)) < 0.000001;
    const delta = movement => {
      const value = Number(movement.valor || 0);
      if (!Number.isFinite(value)) throw new Error('Valor inválido no histórico da conta.');
      if (movement.tipo === 'credito') return value;
      if (movement.tipo === 'debito') return -value;
      throw new Error('Tipo inválido no histórico da conta.');
    };
    const sum = list => list.reduce((total, item) => total + delta(item), 0);
    const before = initialDate ? movements.filter(m => m.data && m.data <= initialDate) : [];
    // Legacy accounts may already represent their opening balance in the ledger.
    if (initialDate && before.length && sameMoney(sum(before), initial)) {
      return Number(sum(movements).toFixed(2));
    }
    let skippedInitial = false;
    const balance = movements.reduce((total, movement) => {
      if (!skippedInitial && movement.tipo === 'credito'
        && String(movement.descricao || '').trim().toLowerCase() === 'saldo inicial'
        && sameMoney(movement.valor, initial)
        && (!initialDate || movement.data === initialDate)) {
        skippedInitial = true;
        return total;
      }
      return total + delta(movement);
    }, initial);
    return Number(balance.toFixed(2));
  }

  function detectBank(name, catalog, fallback) {
    const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const text = ` ${normalize(name).replace(/[^a-z0-9]+/g, ' ')} `;
    const matches = catalog.flatMap(bank => (bank.aliases || []).map(alias => ({
      bank, alias: normalize(alias).replace(/[^a-z0-9]+/g, ' ')
    }))).filter(({ alias }) => alias && text.includes(` ${alias} `));
    matches.sort((a, b) => b.alias.length - a.alias.length);
    return matches[0]?.bank || fallback;
  }

  function createBankLogo(bank) {
    const logo = document.createElement('span');
    logo.className = 'bank-logo';
    logo.style.setProperty('--bank-color', bank.color || '#7c4dff');
    logo.style.setProperty('--bank-bg', bank.bg || '#f4f0ff');
    logo.textContent = bank.initials || '🏦';
    logo.setAttribute('aria-hidden', 'true');
    if (bank.logo) {
      const img = document.createElement('img');
      img.alt = `Logo ${bank.name}`;
      img.hidden = true;
      img.addEventListener('load', () => {
        for (const child of Array.from(logo.childNodes)) {
          if (child !== img) child.remove();
        }
        logo.classList.add('bank-logo-with-image');
        img.hidden = false;
      }, { once: true });
      img.addEventListener('error', () => img.remove(), { once: true });
      logo.appendChild(img);
      img.src = bank.logo;
    }
    return logo;
  }

  async function transfer(client, { id, origem, destino, valor, data, descricao }) {
    const amount = Number(valor);
    if (!id || !origem || !destino || origem === destino || !data || !Number.isFinite(amount) || amount <= 0) {
      throw new Error('Informe contas diferentes, data e valor válido para transferir.');
    }
    const result = await client.rpc('arolix_transferir', {
      p_id: id, p_origem: origem, p_destino: destino,
      p_valor: Number(amount.toFixed(2)), p_data: data, p_descricao: descricao
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function deleteTransfer(client, id) {
    const { error } = await client.rpc('arolix_excluir_transferencia', { p_id: id });
    if (error) throw error;
  }

  const api = { localISODate, addMonthsClamped, businessDaysBetween, parseMoney, selectAll, selectIn, computeContaBalance, detectBank, createBankLogo, transfer, deleteTransfer };
  root.ArolixRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
