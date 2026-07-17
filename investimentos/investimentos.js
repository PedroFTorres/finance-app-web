const INVEST_ALLOWED_EMAILS = [
  "pedrofernandot@gmail.com"
];

const IOF_TABLE = [
  0, 96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50,
  46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0
];

const state = {
  user: null,
  profile: null,
  contas: [],
  investimentos: [],
  resgates: [],
  formMode: "novo"
};

const el = (id) => document.getElementById(id);

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function parseMoneyBR(value) {
  if (typeof value === "number") return value;
  const normalized = String(value || "")
    .trim()
    .replace(/\s/g, "")
    .replace(/[R$]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function parsePercentBR(value, fallback = 0) {
  const parsed = parseMoneyBR(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function parseISODate(value) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`);
}

function daysBetween(startISO, endISO = isoToday()) {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (!start || !end) return 0;
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function businessDaysBetween(startISO, endISO = isoToday()) {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (!start || !end || end < start) return 0;

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.max(0, count - 1);
}

function irRateByDays(days) {
  if (days <= 180) return 22.5;
  if (days <= 360) return 20;
  if (days <= 720) return 17.5;
  return 15;
}

function formatDateBR(iso) {
  if (!iso) return "-";
  const d = parseISODate(iso);
  if (!d) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function addDaysISO(startISO, days) {
  const start = parseISODate(startISO);
  const totalDays = Number(days || 0);
  if (!start || !Number.isFinite(totalDays) || totalDays <= 0) return null;
  start.setDate(start.getDate() + totalDays);
  return start.toISOString().slice(0, 10);
}

function normalizeCnpj(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 14);
}

function formatCnpj(value) {
  const digits = normalizeCnpj(value);
  if (digits.length !== 14) return digits || "-";
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function calculateCdb(investimento, endDate = isoToday()) {
  const principal = Number(investimento.valor_aplicado || 0);
  const percentualCdi = Number(investimento.percentual_cdi || 0) / 100;
  const cdiAnnual = Number(investimento.cdi_anual_referencia || 0) / 100;
  const diasCorridos = daysBetween(investimento.data_aplicacao, endDate);
  const diasUteis = businessDaysBetween(investimento.data_aplicacao, endDate);
  const dailyCdi = Math.pow(1 + cdiAnnual, 1 / 252) - 1;
  const dailyProduct = dailyCdi * percentualCdi;
  const bruto = principal * (Math.pow(1 + dailyProduct, diasUteis) - 1);
  const iofRate = diasCorridos <= 30 ? IOF_TABLE[diasCorridos] || 0 : 0;
  const iof = Math.max(0, bruto * (iofRate / 100));
  const baseIr = Math.max(0, bruto - iof);
  const irRate = irRateByDays(diasCorridos);
  const ir = baseIr * (irRate / 100);
  const liquido = principal + bruto - iof - ir;

  return {
    principal,
    diasCorridos,
    diasUteis,
    rendimentoBruto: bruto,
    iofRate,
    iof,
    irRate,
    ir,
    valorLiquido: liquido
  };
}

function groupId(item) {
  return item?.produto_grupo_id || item?.id || "";
}

function resgatesByInvestimento() {
  return (state.resgates || []).reduce((acc, resgate) => {
    const key = resgate.investimento_id;
    if (!key) return acc;
    acc[key] = acc[key] || [];
    acc[key].push(resgate);
    return acc;
  }, {});
}

function principalResgatado(investimentoId) {
  return (state.resgates || [])
    .filter(r => r.investimento_id === investimentoId)
    .reduce((sum, r) => sum + Number(r.valor_principal_resgatado || 0), 0);
}

function principalDisponivel(aporte) {
  return Math.max(0, Number(aporte.valor_aplicado || 0) - principalResgatado(aporte.id));
}

function canRedeemAporte(aporte, dataResgate = isoToday()) {
  if (aporte.liquidez === "diaria") return { ok: true, reason: "" };
  if (aporte.liquidez === "carencia") {
    const dataCarencia = aporte.data_carencia || addDaysISO(aporte.data_aplicacao, aporte.dias_carencia);
    if (dataCarencia && dataResgate < dataCarencia) {
      return { ok: false, reason: `Carência até ${formatDateBR(dataCarencia)}` };
    }
  }
  if (aporte.liquidez === "vencimento" && aporte.data_vencimento && dataResgate < aporte.data_vencimento) {
    return { ok: false, reason: `Resgate apenas no vencimento em ${formatDateBR(aporte.data_vencimento)}` };
  }
  return { ok: true, reason: "" };
}

function buildProductGroups() {
  const map = new Map();

  (state.investimentos || []).forEach((item) => {
    const gid = groupId(item);
    if (!map.has(gid)) {
      map.set(gid, {
        id: gid,
        base: item,
        aportes: [],
        principalAplicado: 0,
        principalDisponivel: 0,
        rendimento: 0,
        iof: 0,
        ir: 0,
        liquido: 0
      });
    }

    const group = map.get(gid);
    group.aportes.push(item);
  });

  [...map.values()].forEach((group) => {
    group.aportes.sort((a, b) => String(a.data_aplicacao).localeCompare(String(b.data_aplicacao)));
    group.base = group.aportes[0] || group.base;

    group.aportes.forEach((aporte) => {
      const disponivel = principalDisponivel(aporte);
      const proportion = Number(aporte.valor_aplicado || 0) > 0 ? disponivel / Number(aporte.valor_aplicado || 0) : 0;
      const calc = calculateCdb({ ...aporte, valor_aplicado: disponivel });
      group.principalAplicado += Number(aporte.valor_aplicado || 0);
      group.principalDisponivel += disponivel;
      group.rendimento += calc.rendimentoBruto;
      group.iof += calc.iof;
      group.ir += calc.ir;
      group.liquido += calc.valorLiquido;
      aporte.__principalDisponivel = disponivel;
      aporte.__resgatado = Number(aporte.valor_aplicado || 0) - disponivel;
      aporte.__proporcaoDisponivel = proportion;
    });
  });

  return [...map.values()].sort((a, b) => String(a.base.nome).localeCompare(String(b.base.nome)));
}

function buildResgatePreview(produtoGrupoId, valorPrincipal, dataResgate = isoToday()) {
  const group = buildProductGroups().find(g => g.id === produtoGrupoId);
  if (!group) return { ok: false, message: "Selecione um produto válido.", slices: [] };
  if (!valorPrincipal || valorPrincipal <= 0) return { ok: false, message: "Informe o valor principal do resgate.", slices: [] };
  if (valorPrincipal > group.principalDisponivel + 0.000001) {
    return {
      ok: false,
      message: `Valor acima do disponível neste produto: ${money(group.principalDisponivel)}.`,
      slices: []
    };
  }

  let restante = valorPrincipal;
  const slices = [];

  for (const aporte of group.aportes) {
    if (restante <= 0) break;
    const disponivel = principalDisponivel(aporte);
    if (disponivel <= 0) continue;

    const redeemCheck = canRedeemAporte(aporte, dataResgate);
    if (!redeemCheck.ok) {
      return {
        ok: false,
        message: `Este produto ainda não permite resgate. ${redeemCheck.reason}.`,
        slices: []
      };
    }

    const principal = Math.min(disponivel, restante);
    const proporcao = principal / Number(aporte.valor_aplicado || 1);
    const calcTotal = calculateCdb(aporte, dataResgate);
    const rendimento = Math.max(0, calcTotal.rendimentoBruto * proporcao);
    const iof = Math.max(0, calcTotal.iof * proporcao);
    const ir = Math.max(0, calcTotal.ir * proporcao);
    const liquido = principal + rendimento - iof - ir;

    slices.push({
      aporte,
      principal,
      rendimento,
      iof,
      ir,
      liquido,
      diasCorridos: calcTotal.diasCorridos,
      iofRate: calcTotal.iofRate,
      irRate: calcTotal.irRate
    });

    restante -= principal;
  }

  const totals = slices.reduce((acc, slice) => {
    acc.principal += slice.principal;
    acc.rendimento += slice.rendimento;
    acc.iof += slice.iof;
    acc.ir += slice.ir;
    acc.liquido += slice.liquido;
    return acc;
  }, { principal: 0, rendimento: 0, iof: 0, ir: 0, liquido: 0 });

  return { ok: true, group, slices, totals };
}

function setMessage(text, success = false) {
  const msg = el("form-msg");
  msg.textContent = text || "";
  msg.style.color = success ? "#16a34a" : "#dc2626";
}

function setContaMessage(text, success = false) {
  const msg = el("conta-invest-msg");
  msg.textContent = text || "";
  msg.style.color = success ? "#16a34a" : "#dc2626";
}

function setResgateMessage(text, success = false) {
  const msg = el("resgate-msg");
  msg.textContent = text || "";
  msg.style.color = success ? "#16a34a" : "#dc2626";
}

function activateInvestmentTab(tabName, mode = null) {
  document.querySelectorAll(".invest-tab").forEach((button) => {
    const isActive = button.dataset.investTab === tabName &&
      (!button.dataset.investMode || button.dataset.investMode === mode);
    button.classList.toggle("active", isActive);
  });

  document.querySelectorAll(".invest-tab-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== `panel-${tabName}`);
    panel.classList.toggle("active", panel.id === `panel-${tabName}`);
  });

  if (tabName === "aplicacao") {
    setInvestmentFormMode(mode || "novo");
  }
}

function setInvestmentFormMode(mode) {
  state.formMode = mode === "aporte" ? "aporte" : "novo";
  const isAporte = state.formMode === "aporte";
  const group = el("grupo-produto-existente");
  const title = el("invest-form-title");
  const saveButton = el("btn-salvar-investimento");

  group.classList.toggle("hidden", !isAporte);
  title.textContent = isAporte ? "Novo aporte em CDB existente" : "Nova aplicação CDB";
  saveButton.textContent = isAporte ? "Salvar aporte" : "Salvar aplicação";

  if (!isAporte) {
    el("invest-produto-existente").value = "";
    el("invest-nome").disabled = false;
    el("invest-cnpj").disabled = false;
  } else {
    preencherProdutoExistente();
  }

  setMessage("");
}

function setupCleanMoneyInput(input) {
  if (!input) return;

  input.addEventListener("focus", () => {
    if (parseMoneyBR(input.value) === 0) {
      input.value = "";
      return;
    }
    input.select();
  });

  input.addEventListener("blur", () => {
    if (!input.value.trim()) {
      input.value = "0,00";
    }
  });
}

function setAccessAlert(text) {
  const alert = el("access-alert");
  alert.textContent = text;
  alert.classList.toggle("hidden", !text);
}

function requireInvestmentAccess() {
  const email = String(state.user?.email || "").toLowerCase();
  return INVEST_ALLOWED_EMAILS.includes(email);
}

async function loadSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "../login.html";
    return false;
  }

  state.user = user;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  state.profile = profile || null;

  if (!requireInvestmentAccess()) {
    setAccessAlert("Módulo de investimentos em beta privado. No lançamento público, ele será liberado por plano.");
    el("form-investimento").classList.add("hidden");
  }

  return true;
}

async function loadContas() {
  const { data, error } = await supabase
    .from("contas_bancarias")
    .select("id,nome,saldo_atual,saldo_inicial,data_saldo,tipo_conta")
    .eq("user_id", state.user.id)
    .order("nome");

  if (error) throw error;
  state.contas = await contasComSaldoCalculado(data || []);
  renderContaOptions();
}

async function contasComSaldoCalculado(contas) {
  if (!contas.length) return [];

  const { data: movs, error } = await supabase
    .from("movimentacoes")
    .select("conta_id,tipo,valor,descricao,data")
    .eq("user_id", state.user.id);

  if (error) throw error;

  const movsPorConta = new Map();
  (movs || []).forEach((mov) => {
    if (!movsPorConta.has(mov.conta_id)) movsPorConta.set(mov.conta_id, []);
    movsPorConta.get(mov.conta_id).push(mov);
  });

  return contas.map((conta) => {
    const saldo = computeContaBalance(conta, movsPorConta.get(conta.id) || []);
    return {
      ...conta,
      saldo_calculado: Number(saldo.toFixed(2))
    };
  });
}

function computeContaBalance(conta, movs = []) {
    const saldoInicial = Number(conta.saldo_inicial || 0);
    const dataSaldo = conta.data_saldo || null;
    const moneyEq = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) < 0.000001;
    const sumMovs = (lista) => (lista || []).reduce((total, mov) => {
      const valor = Number(mov.valor || 0);
      return total + (mov.tipo === "credito" ? valor : -valor);
    }, 0);
    const movsAteDataSaldo = dataSaldo
      ? (movs || []).filter(mov => mov.data && mov.data <= dataSaldo)
      : [];
    const saldoAteDataSaldo = sumMovs(movsAteDataSaldo);

    if (dataSaldo && movsAteDataSaldo.length > 0 && moneyEq(saldoAteDataSaldo, saldoInicial)) {
      return sumMovs(movs || []);
    }

    let saldo = saldoInicial;
    let saldoInicialJaDescontado = false;

    (movs || []).forEach((mov) => {
      const valor = Number(mov.valor || 0);
      const isSaldoInicialDuplicado =
        !saldoInicialJaDescontado &&
        mov.tipo === "credito" &&
        String(mov.descricao || "").trim().toLowerCase() === "saldo inicial" &&
        moneyEq(valor, saldoInicial) &&
        (!dataSaldo || mov.data === dataSaldo);

      if (isSaldoInicialDuplicado) {
        saldoInicialJaDescontado = true;
        return;
      }

      saldo += mov.tipo === "credito" ? valor : -valor;
    });

    return saldo;
}

function renderContaOptions() {
  const origem = el("invest-conta-origem");
  const destino = el("invest-conta-destino");
  const resgateDestino = el("resgate-conta-destino");
  origem.innerHTML = "";
  destino.innerHTML = "";
  if (resgateDestino) resgateDestino.innerHTML = "";

  const contasCorrentes = state.contas.filter(c => (c.tipo_conta || "corrente") === "corrente");
  const contasInvestimento = state.contas.filter(c => c.tipo_conta === "investimento");

  origem.append(new Option("Selecione a conta corrente", ""));
  contasCorrentes.forEach(c => origem.append(new Option(`${c.nome} — saldo calculado ${money(c.saldo_calculado ?? c.saldo_atual ?? 0)}`, c.id)));

  if (resgateDestino) {
    resgateDestino.append(new Option("Selecione a conta corrente destino", ""));
    contasCorrentes.forEach(c => resgateDestino.append(new Option(`${c.nome} — conta corrente`, c.id)));
  }

  destino.append(new Option("Selecione a conta de investimento", ""));
  contasInvestimento.forEach(c => destino.append(new Option(`💼 ${c.nome} — conta investimento`, c.id)));

  if (contasInvestimento.length === 0) {
    const opt = new Option("Crie uma conta do tipo investimento primeiro", "");
    opt.disabled = true;
    destino.append(opt);
  }

  renderContasInvestimento(contasInvestimento);
}

function renderContasInvestimento(contasInvestimento = []) {
  const list = el("lista-contas-investimento");
  if (!list) return;

  if (!contasInvestimento.length) {
    list.innerHTML = `<p class="muted">Nenhuma conta de investimento criada ainda.</p>`;
    return;
  }

  list.innerHTML = contasInvestimento.map((conta) => `
    <div class="mini-item investment-account-item">
      <div>
        <strong>${escapeHtml(conta.nome)}</strong>
        <span>Conta separada para patrimônio aplicado</span>
      </div>
      <em>Investimento</em>
    </div>
  `).join("");
}

function toggleCarenciaFields() {
  const isCarencia = el("invest-liquidez").value === "carencia";
  el("grupo-carencia").classList.toggle("hidden", !isCarencia);
  if (!isCarencia) {
    el("invest-data-carencia").value = "";
    el("invest-dias-carencia").value = "";
  }
}

async function loadInvestimentos() {
  const { data, error } = await supabase
    .from("investimentos")
    .select("*")
    .eq("user_id", state.user.id)
    .order("data_aplicacao", { ascending: false });

  if (error) throw error;
  state.investimentos = data || [];
  await loadResgates();
  renderInvestimentos();
  renderProdutoOptions();
  renderResgatePreview();
}

async function loadResgates() {
  const { data, error } = await supabase
    .from("investimento_resgates")
    .select("*")
    .eq("user_id", state.user.id)
    .order("data_resgate", { ascending: false });

  if (error) {
    console.warn("Tabela de resgates ainda não disponível.", error);
    state.resgates = [];
    return;
  }

  state.resgates = data || [];
}

function renderProdutoOptions() {
  const produtos = buildProductGroups();
  const aporteSelect = el("invest-produto-existente");
  const resgateSelect = el("resgate-produto");

  if (aporteSelect) {
    const current = aporteSelect.value;
    aporteSelect.innerHTML = "";
    aporteSelect.append(new Option("Selecione o produto para aporte", ""));
    produtos.forEach((produto) => {
      aporteSelect.append(new Option(`${produto.base.nome} — disponível ${money(produto.principalDisponivel)}`, produto.id));
    });
    aporteSelect.value = produtos.some(p => p.id === current) ? current : "";
  }

  if (resgateSelect) {
    const current = resgateSelect.value;
    resgateSelect.innerHTML = "";
    resgateSelect.append(new Option("Selecione o produto", ""));
    produtos
      .filter(p => p.principalDisponivel > 0)
      .forEach((produto) => {
        resgateSelect.append(new Option(`${produto.base.nome} — disponível ${money(produto.principalDisponivel)}`, produto.id));
      });
    resgateSelect.value = produtos.some(p => p.id === current) ? current : "";
  }
}

function preencherProdutoExistente() {
  const produtoId = el("invest-produto-existente").value;
  if (!produtoId) {
    el("invest-nome").disabled = false;
    el("invest-cnpj").disabled = false;
    if (state.formMode === "aporte") {
      el("invest-nome").value = "";
      el("invest-cnpj").value = "";
    }
    return;
  }

  const produto = buildProductGroups().find(p => p.id === produtoId);
  if (!produto) return;
  const base = produto.base;

  el("invest-nome").value = base.nome || "";
  el("invest-cnpj").value = formatCnpj(base.cnpj_emissor || "");
  el("invest-vencimento").value = base.data_vencimento || "";
  el("invest-liquidez").value = base.liquidez || "diaria";
  el("invest-data-carencia").value = base.data_carencia || "";
  el("invest-dias-carencia").value = base.dias_carencia || "";
  el("invest-percentual-cdi").value = String(base.percentual_cdi || 100).replace(".", ",");
  el("invest-cdi-anual").value = String(base.cdi_anual_referencia || 10.65).replace(".", ",");
  el("invest-conta-destino").value = base.conta_investimento_id || "";
  el("invest-nome").disabled = true;
  el("invest-cnpj").disabled = true;
  toggleCarenciaFields();
}

async function criarContaInvestimento() {
  if (!requireInvestmentAccess()) return;

  const button = el("btn-criar-conta-investimento");
  const nome = el("nova-conta-investimento-nome").value.trim();

  if (!nome) {
    setContaMessage("Informe o nome da conta de investimento.");
    return;
  }

  button.disabled = true;
  setContaMessage("");

  try {
    const conta = {
      id: uid(),
      user_id: state.user.id,
      nome,
      saldo_inicial: 0,
      saldo_atual: 0,
      data_saldo: isoToday(),
      tipo_conta: "investimento"
    };

    const { error } = await supabase
      .from("contas_bancarias")
      .insert([conta]);

    if (error) throw error;

    el("nova-conta-investimento-nome").value = "";
    await loadContas();
    setContaMessage("Conta de investimento criada.", true);
  } catch (error) {
    console.error(error);
    setContaMessage(error.message || "Erro ao criar conta de investimento.");
  } finally {
    button.disabled = false;
  }
}


function accountName(id) {
  return state.contas.find(c => c.id === id)?.nome || "-";
}

function renderInvestimentos() {
  const list = el("lista-investimentos");
  list.innerHTML = "";

  const grupos = buildProductGroups();

  if (grupos.length === 0) {
    list.innerHTML = "<p>Nenhuma aplicação cadastrada ainda.</p>";
  }

  const totals = {
    aplicado: 0,
    rendimento: 0,
    iof: 0,
    ir: 0,
    liquido: 0
  };

  grupos.forEach((grupo) => {
    const item = grupo.base;
    totals.aplicado += grupo.principalDisponivel;
    totals.rendimento += grupo.rendimento;
    totals.iof += grupo.iof;
    totals.ir += grupo.ir;
    totals.liquido += grupo.liquido;

    const aportesHtml = grupo.aportes.map((aporte) => {
      const disponivel = principalDisponivel(aporte);
      const calc = calculateCdb({ ...aporte, valor_aplicado: disponivel });
      return `
        <tr>
          <td>${formatDateBR(aporte.data_aplicacao)}</td>
          <td>${money(aporte.valor_aplicado)}</td>
          <td>${money(aporte.__resgatado || 0)}</td>
          <td>${money(disponivel)}</td>
          <td>${money(calc.valorLiquido)}</td>
          <td>${calc.iofRate}% / ${calc.irRate}%</td>
        </tr>
      `;
    }).join("");

    const card = document.createElement("article");
    card.className = "invest-card";
    card.innerHTML = `
      <div>
        <span class="pill">${String(item.tipo || "cdb").toUpperCase()} • ${Number(item.percentual_cdi || 0).toLocaleString("pt-BR")}% do CDI</span>
        <h3>${escapeHtml(item.nome)}</h3>
        <p><strong>Instituição:</strong> ${escapeHtml(item.instituicao || "-")}</p>
        <p><strong>CNPJ:</strong> ${formatCnpj(item.cnpj_emissor)}</p>
        <p><strong>Aportes:</strong> ${grupo.aportes.length} • <strong>Vencimento:</strong> ${formatDateBR(item.data_vencimento)}</p>
        ${item.liquidez === "carencia" ? `<p><strong>Carência:</strong> ${formatDateBR(item.data_carencia)}${item.dias_carencia ? ` • ${Number(item.dias_carencia)} dias` : ""}</p>` : ""}
        <p><strong>Destino:</strong> ${escapeHtml(accountName(item.conta_investimento_id))}</p>
        ${item.observacoes ? `<p><strong>Obs.:</strong> ${escapeHtml(item.observacoes)}</p>` : ""}
        <div class="aportes-table-wrap">
          <table class="aportes-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Aporte</th>
                <th>Resgatado</th>
                <th>Disponível</th>
                <th>Líquido estimado</th>
                <th>IOF/IR</th>
              </tr>
            </thead>
            <tbody>${aportesHtml}</tbody>
          </table>
        </div>
      </div>
      <div class="invest-meta">
        <div><span>Principal disponível</span><strong>${money(grupo.principalDisponivel)}</strong></div>
        <div><span>Rendimento bruto</span><strong class="positive">${money(grupo.rendimento)}</strong></div>
        <div><span>IOF estimado</span><strong class="negative">${money(grupo.iof)}</strong></div>
        <div><span>IR estimado</span><strong class="negative">${money(grupo.ir)}</strong></div>
        <div><span>Total aportado</span><strong>${money(grupo.principalAplicado)}</strong></div>
        <div><span>Líquido estimado</span><strong>${money(grupo.liquido)}</strong></div>
      </div>
    `;
    list.appendChild(card);
  });

  el("total-aplicado").textContent = money(totals.aplicado);
  el("total-rendimento").textContent = money(totals.rendimento);
  el("total-iof").textContent = money(totals.iof);
  el("total-ir").textContent = money(totals.ir);
  el("total-liquido").textContent = money(totals.liquido);
}

async function recalcConta(contaId) {
  if (!contaId) return;

  const { data: conta } = await supabase
    .from("contas_bancarias")
    .select("saldo_inicial,data_saldo")
    .eq("id", contaId)
    .eq("user_id", state.user.id)
    .maybeSingle();

  const saldoInicial = Number(conta?.saldo_inicial || 0);
  const dataSaldo = conta?.data_saldo || null;

  const { data: movs, error } = await supabase
    .from("movimentacoes")
    .select("tipo,valor,descricao,data")
    .eq("conta_id", contaId)
    .eq("user_id", state.user.id);

  if (error) throw error;

  const saldo = computeContaBalance({ saldo_inicial: saldoInicial, data_saldo: dataSaldo }, movs || []);

  await supabase
    .from("contas_bancarias")
    .update({ saldo_atual: Number(saldo.toFixed(2)) })
    .eq("id", contaId)
    .eq("user_id", state.user.id);
}

async function registrarTransferenciaInvestimento(investimento, origemId, destinoId) {
  const valor = Number(investimento.valor_aplicado || 0);
  const transferenciaId = uid();
  const descricao = `Aplicação CDB — ${investimento.nome}`;

  const { error: errTransf } = await supabase.from("transferencias").insert([{
    id: transferenciaId,
    user_id: state.user.id,
    conta_origem: origemId,
    conta_destino: destinoId,
    valor,
    data: investimento.data_aplicacao,
    descricao
  }]);
  if (errTransf) throw errTransf;

  const { error: errMov } = await supabase.from("movimentacoes").insert([
    {
      id: uid(),
      user_id: state.user.id,
      conta_id: origemId,
      tipo: "debito",
      valor,
      data: investimento.data_aplicacao,
      descricao: `Aplicação enviada — ${investimento.nome}`,
      transferencia_id: transferenciaId
    },
    {
      id: uid(),
      user_id: state.user.id,
      conta_id: destinoId,
      tipo: "credito",
      valor,
      data: investimento.data_aplicacao,
      descricao: `Aplicação recebida — ${investimento.nome}`,
      transferencia_id: transferenciaId
    }
  ]);
  if (errMov) throw errMov;

  await Promise.all([
    recalcConta(origemId),
    recalcConta(destinoId)
  ]);

  return transferenciaId;
}

async function registrarTransferenciaResgate({ produtoNome, valorLiquido, dataResgate, origemId, destinoId }) {
  const transferenciaId = uid();
  const descricao = `Resgate CDB — ${produtoNome}`;

  const { error: errTransf } = await supabase.from("transferencias").insert([{
    id: transferenciaId,
    user_id: state.user.id,
    conta_origem: origemId,
    conta_destino: destinoId,
    valor: Number(valorLiquido.toFixed(2)),
    data: dataResgate,
    descricao
  }]);
  if (errTransf) throw errTransf;

  const { error: errMov } = await supabase.from("movimentacoes").insert([
    {
      id: uid(),
      user_id: state.user.id,
      conta_id: origemId,
      tipo: "debito",
      valor: Number(valorLiquido.toFixed(2)),
      data: dataResgate,
      descricao: `Resgate enviado — ${produtoNome}`,
      transferencia_id: transferenciaId
    },
    {
      id: uid(),
      user_id: state.user.id,
      conta_id: destinoId,
      tipo: "credito",
      valor: Number(valorLiquido.toFixed(2)),
      data: dataResgate,
      descricao: `Resgate recebido — ${produtoNome}`,
      transferencia_id: transferenciaId
    }
  ]);
  if (errMov) throw errMov;

  await Promise.all([
    recalcConta(origemId),
    recalcConta(destinoId)
  ]);

  return transferenciaId;
}

function renderResgatePreview() {
  const previewEl = el("resgate-preview");
  if (!previewEl) return;

  const produtoId = el("resgate-produto").value;
  const valor = parseMoneyBR(el("resgate-valor").value);
  const dataResgate = el("resgate-data").value || isoToday();
  const preview = buildResgatePreview(produtoId, valor, dataResgate);

  if (!produtoId || !valor) {
    previewEl.innerHTML = "Selecione um produto e informe o valor para estimar líquido, IOF e IR.";
    previewEl.classList.remove("preview-error");
    return;
  }

  if (!preview.ok) {
    previewEl.innerHTML = escapeHtml(preview.message);
    previewEl.classList.add("preview-error");
    return;
  }

  previewEl.classList.remove("preview-error");
  previewEl.innerHTML = `
    <div class="preview-grid">
      <div><span>Principal resgatado</span><strong>${money(preview.totals.principal)}</strong></div>
      <div><span>Rendimento bruto</span><strong>${money(preview.totals.rendimento)}</strong></div>
      <div><span>IOF estimado</span><strong>${money(preview.totals.iof)}</strong></div>
      <div><span>IR estimado</span><strong>${money(preview.totals.ir)}</strong></div>
      <div><span>Líquido estimado</span><strong>${money(preview.totals.liquido)}</strong></div>
    </div>
    <p>Estimativa feita aporte por aporte, usando primeiro os aportes mais antigos.</p>
  `;
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!requireInvestmentAccess()) return;

  const button = event.submitter;
  button.disabled = true;
  setMessage("");

  try {
    const nome = el("invest-nome").value.trim();
    const produtoExistenteId = state.formMode === "aporte" ? (el("invest-produto-existente").value || null) : null;
    const produtoExistente = produtoExistenteId
      ? buildProductGroups().find(p => p.id === produtoExistenteId)
      : null;
    const valor = parseMoneyBR(el("invest-valor").value);
    const dataAplicacao = el("invest-data").value;
    const origemId = el("invest-conta-origem").value || null;
    const destinoId = el("invest-conta-destino").value || null;
    const gerarTransferencia = el("invest-gerar-transferencia").checked;
    const liquidez = el("invest-liquidez").value;
    const diasCarencia = Number(el("invest-dias-carencia").value || 0);
    const dataCarencia = el("invest-data-carencia").value || addDaysISO(dataAplicacao, diasCarencia);

    if (!nome || !valor || valor <= 0 || !dataAplicacao) {
      throw new Error("Informe nome, valor e data da aplicação.");
    }

    if (state.formMode === "aporte" && !produtoExistente) {
      throw new Error("Selecione o produto CDB que receberá este aporte.");
    }

    if (liquidez === "carencia" && !dataCarencia && !diasCarencia) {
      throw new Error("Informe a data fim da carência ou a quantidade de dias de carência.");
    }

    if (gerarTransferencia && (!origemId || !destinoId)) {
      throw new Error("Para gerar a transferência, selecione conta origem e conta de investimento.");
    }

    if (gerarTransferencia && origemId === destinoId) {
      throw new Error("Conta origem e destino precisam ser diferentes.");
    }

    const investimento = {
      id: uid(),
      user_id: state.user.id,
      produto_grupo_id: produtoExistente ? produtoExistente.id : null,
      tipo: "cdb",
      indexador: "cdi",
      nome,
      instituicao: "Santander",
      cnpj_emissor: normalizeCnpj(el("invest-cnpj").value),
      valor_aplicado: Number(valor.toFixed(2)),
      data_aplicacao: dataAplicacao,
      data_vencimento: el("invest-vencimento").value || null,
      percentual_cdi: parsePercentBR(el("invest-percentual-cdi").value || 100, 100),
      cdi_anual_referencia: parsePercentBR(el("invest-cdi-anual").value || 0),
      liquidez,
      data_carencia: liquidez === "carencia" ? dataCarencia : null,
      dias_carencia: liquidez === "carencia" && diasCarencia > 0 ? diasCarencia : null,
      conta_origem_id: origemId,
      conta_investimento_id: destinoId,
      observacoes: el("invest-observacoes").value.trim() || null,
      status: "ativo"
    };

    if (!investimento.produto_grupo_id) {
      investimento.produto_grupo_id = investimento.id;
    }

    const { error } = await supabase.from("investimentos").insert([investimento]);
    if (error) throw error;

    if (gerarTransferencia) {
      const transferenciaId = await registrarTransferenciaInvestimento(investimento, origemId, destinoId);
      await supabase
        .from("investimentos")
        .update({ transferencia_id: transferenciaId })
        .eq("id", investimento.id)
        .eq("user_id", state.user.id);
    }

    event.target.reset();
    el("invest-produto-existente").value = "";
    el("invest-nome").disabled = false;
    el("invest-cnpj").disabled = false;
    el("invest-valor").value = "0,00";
    el("invest-data").value = isoToday();
    el("invest-percentual-cdi").value = "100";
    el("invest-cdi-anual").value = "10,65";
    el("invest-gerar-transferencia").checked = true;
    toggleCarenciaFields();
    setInvestmentFormMode(state.formMode);

    await loadContas();
    await loadInvestimentos();
    setMessage("Aplicação salva com sucesso.", true);
  } catch (error) {
    console.error(error);
    setMessage(error.message || "Erro ao salvar aplicação.");
  } finally {
    button.disabled = false;
  }
}

async function handleResgateSubmit(event) {
  event.preventDefault();
  if (!requireInvestmentAccess()) return;

  const button = event.submitter;
  button.disabled = true;
  setResgateMessage("");

  try {
    const produtoId = el("resgate-produto").value;
    const valor = parseMoneyBR(el("resgate-valor").value);
    const dataResgate = el("resgate-data").value || isoToday();
    const contaDestinoId = el("resgate-conta-destino").value || null;
    const observacoes = el("resgate-observacoes").value.trim() || null;
    const preview = buildResgatePreview(produtoId, valor, dataResgate);

    if (!preview.ok) throw new Error(preview.message);
    if (!contaDestinoId) throw new Error("Selecione a conta corrente que vai receber o resgate.");

    const contaInvestimentoId = preview.group.base.conta_investimento_id;
    if (!contaInvestimentoId) throw new Error("Este produto não possui conta de investimento destino.");

    const rows = preview.slices.map((slice) => ({
      id: uid(),
      user_id: state.user.id,
      investimento_id: slice.aporte.id,
      produto_grupo_id: preview.group.id,
      data_resgate: dataResgate,
      valor_bruto_solicitado: Number(valor.toFixed(2)),
      valor_principal_resgatado: Number(slice.principal.toFixed(2)),
      rendimento_bruto: Number(slice.rendimento.toFixed(2)),
      iof: Number(slice.iof.toFixed(2)),
      ir: Number(slice.ir.toFixed(2)),
      valor_liquido: Number(slice.liquido.toFixed(2)),
      conta_destino_id: contaDestinoId,
      transferencia_id: null,
      observacoes
    }));

    const { error } = await supabase.from("investimento_resgates").insert(rows);
    if (error) throw error;

    let transferenciaId = null;
    try {
      transferenciaId = await registrarTransferenciaResgate({
        produtoNome: preview.group.base.nome,
        valorLiquido: preview.totals.liquido,
        dataResgate,
        origemId: contaInvestimentoId,
        destinoId: contaDestinoId
      });

      await supabase
        .from("investimento_resgates")
        .update({ transferencia_id: transferenciaId })
        .in("id", rows.map(r => r.id))
        .eq("user_id", state.user.id);
    } catch (transferError) {
      await supabase
        .from("investimento_resgates")
        .delete()
        .in("id", rows.map(r => r.id))
        .eq("user_id", state.user.id);
      throw transferError;
    }

    event.target.reset();
    el("resgate-data").value = isoToday();
    el("resgate-valor").value = "0,00";

    await loadContas();
    await loadInvestimentos();
    setResgateMessage("Resgate registrado com sucesso.", true);
  } catch (error) {
    console.error(error);
    setResgateMessage(error.message || "Erro ao registrar resgate.");
  } finally {
    button.disabled = false;
  }
}

async function boot() {
  el("btn-voltar").onclick = () => { window.location.href = "../app.html"; };
  el("btn-sair").onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "../login.html";
  };
  el("btn-recarregar").onclick = async () => {
    await loadContas();
    await loadInvestimentos();
  };
  el("btn-criar-conta-investimento").onclick = criarContaInvestimento;
  el("form-investimento").addEventListener("submit", handleSubmit);
  el("form-resgate").addEventListener("submit", handleResgateSubmit);
  el("invest-produto-existente").addEventListener("change", preencherProdutoExistente);
  el("invest-liquidez").addEventListener("change", toggleCarenciaFields);
  document.querySelectorAll(".invest-tab").forEach((button) => {
    button.addEventListener("click", () => {
      activateInvestmentTab(button.dataset.investTab, button.dataset.investMode || null);
    });
  });
  setupCleanMoneyInput(el("invest-valor"));
  setupCleanMoneyInput(el("resgate-valor"));
  ["resgate-produto", "resgate-valor", "resgate-data"].forEach((id) => {
    el(id).addEventListener("input", renderResgatePreview);
    el(id).addEventListener("change", renderResgatePreview);
  });
  el("invest-data").value = isoToday();
  el("resgate-data").value = isoToday();
  toggleCarenciaFields();
  activateInvestmentTab("aplicacao", "novo");

  try {
    const ok = await loadSession();
    if (!ok) return;
    await loadContas();
    await loadInvestimentos();
  } catch (error) {
    console.error(error);
    setAccessAlert(
      "Não foi possível carregar o módulo. Verifique se a migration de investimentos foi aplicada no Supabase."
    );
  }
}

document.addEventListener("DOMContentLoaded", boot);
