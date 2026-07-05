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
  investimentos: []
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
    const saldoInicial = Number(conta.saldo_inicial || 0);
    const dataSaldo = conta.data_saldo || null;
    let saldo = saldoInicial;
    let saldoInicialJaDescontado = false;

    (movsPorConta.get(conta.id) || []).forEach((mov) => {
      const valor = Number(mov.valor || 0);
      const isSaldoInicialDuplicado =
        !saldoInicialJaDescontado &&
        mov.tipo === "credito" &&
        String(mov.descricao || "").trim().toLowerCase() === "saldo inicial" &&
        Math.abs(valor - saldoInicial) < 0.000001 &&
        (!dataSaldo || mov.data === dataSaldo);

      if (isSaldoInicialDuplicado) {
        saldoInicialJaDescontado = true;
        return;
      }

      saldo += mov.tipo === "credito" ? valor : -valor;
    });

    return {
      ...conta,
      saldo_calculado: Number(saldo.toFixed(2))
    };
  });
}

function renderContaOptions() {
  const origem = el("invest-conta-origem");
  const destino = el("invest-conta-destino");
  origem.innerHTML = "";
  destino.innerHTML = "";

  const contasCorrentes = state.contas.filter(c => (c.tipo_conta || "corrente") === "corrente");
  const contasInvestimento = state.contas.filter(c => c.tipo_conta === "investimento");

  origem.append(new Option("Selecione a conta corrente", ""));
  contasCorrentes.forEach(c => origem.append(new Option(`${c.nome} — saldo calculado ${money(c.saldo_calculado ?? c.saldo_atual ?? 0)}`, c.id)));

  destino.append(new Option("Selecione a conta de investimento", ""));
  contasInvestimento.forEach(c => destino.append(new Option(`${c.nome} — saldo calculado ${money(c.saldo_calculado ?? c.saldo_atual ?? 0)}`, c.id)));

  if (contasInvestimento.length === 0) {
    const opt = new Option("Crie uma conta do tipo investimento primeiro", "");
    opt.disabled = true;
    destino.append(opt);
  }
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
  renderInvestimentos();
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

  if (state.investimentos.length === 0) {
    list.innerHTML = "<p>Nenhuma aplicação cadastrada ainda.</p>";
  }

  const totals = {
    aplicado: 0,
    rendimento: 0,
    iof: 0,
    ir: 0,
    liquido: 0
  };

  state.investimentos.forEach((item) => {
    const calc = calculateCdb(item);
    totals.aplicado += calc.principal;
    totals.rendimento += calc.rendimentoBruto;
    totals.iof += calc.iof;
    totals.ir += calc.ir;
    totals.liquido += calc.valorLiquido;

    const card = document.createElement("article");
    card.className = "invest-card";
    card.innerHTML = `
      <div>
        <span class="pill">${String(item.tipo || "cdb").toUpperCase()} • ${Number(item.percentual_cdi || 0).toLocaleString("pt-BR")}% do CDI</span>
        <h3>${escapeHtml(item.nome)}</h3>
        <p><strong>Instituição:</strong> ${escapeHtml(item.instituicao || "-")}</p>
        <p><strong>CNPJ:</strong> ${formatCnpj(item.cnpj_emissor)}</p>
        <p><strong>Aplicado em:</strong> ${formatDateBR(item.data_aplicacao)} • <strong>Vencimento:</strong> ${formatDateBR(item.data_vencimento)}</p>
        ${item.liquidez === "carencia" ? `<p><strong>Carência:</strong> ${formatDateBR(item.data_carencia)}${item.dias_carencia ? ` • ${Number(item.dias_carencia)} dias` : ""}</p>` : ""}
        <p><strong>Origem:</strong> ${escapeHtml(accountName(item.conta_origem_id))} • <strong>Destino:</strong> ${escapeHtml(accountName(item.conta_investimento_id))}</p>
        ${item.observacoes ? `<p><strong>Obs.:</strong> ${escapeHtml(item.observacoes)}</p>` : ""}
      </div>
      <div class="invest-meta">
        <div><span>Aplicado</span><strong>${money(calc.principal)}</strong></div>
        <div><span>Bruto</span><strong class="positive">${money(calc.rendimentoBruto)}</strong></div>
        <div><span>IOF ${calc.iofRate}%</span><strong class="negative">${money(calc.iof)}</strong></div>
        <div><span>IR ${calc.irRate}%</span><strong class="negative">${money(calc.ir)}</strong></div>
        <div><span>Dias úteis</span><strong>${calc.diasUteis}</strong></div>
        <div><span>Líquido estimado</span><strong>${money(calc.valorLiquido)}</strong></div>
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

  let saldo = saldoInicial;
  let saldoInicialJaDescontado = false;

  (movs || []).forEach((m) => {
    const valor = Number(m.valor || 0);
    const isSaldoInicialDuplicado =
      !saldoInicialJaDescontado &&
      m.tipo === "credito" &&
      String(m.descricao || "").trim().toLowerCase() === "saldo inicial" &&
      Math.abs(valor - saldoInicial) < 0.000001 &&
      (!dataSaldo || m.data === dataSaldo);

    if (isSaldoInicialDuplicado) {
      saldoInicialJaDescontado = true;
      return;
    }

    saldo += m.tipo === "credito" ? valor : -valor;
  });

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

async function handleSubmit(event) {
  event.preventDefault();
  if (!requireInvestmentAccess()) return;

  const button = event.submitter;
  button.disabled = true;
  setMessage("");

  try {
    const nome = el("invest-nome").value.trim();
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
    el("invest-valor").value = "0,00";
    el("invest-data").value = isoToday();
    el("invest-percentual-cdi").value = "100";
    el("invest-cdi-anual").value = "10,65";
    el("invest-gerar-transferencia").checked = true;
    toggleCarenciaFields();

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
  el("invest-liquidez").addEventListener("change", toggleCarenciaFields);
  el("invest-data").value = isoToday();
  toggleCarenciaFields();

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
