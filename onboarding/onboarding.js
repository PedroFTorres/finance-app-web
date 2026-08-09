async function waitForState() {
  while (!window.STATE || !STATE.profile) {
    await new Promise(r => setTimeout(r, 100));
  }
}

document.addEventListener("DOMContentLoaded", async () => {

  await waitForState();

  // 🔥 espera o app terminar
  while (!window.APP_READY) {
    await new Promise(r => setTimeout(r, 100));
  }

  if (STATE.profile?.onboarding_completed) return;

  iniciarOnboarding();

});

async function esperarElemento(selector, timeout = 5000) {

  const start = Date.now();

  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;

    await new Promise(r => setTimeout(r, 100));
  }

  console.error("Elemento NÃO encontrado:", selector);
  return null;
}

function iniciarOnboarding(){
  passoConta();
}

async function concluirOnboarding(){
  clearHighlights();
  document.getElementById("onboarding-guide")?.remove();

  await supabase
  .from("user_profiles")
  .update({
    onboarding_completed: true
  })
  .eq("id", STATE.user.id);
}

const onboardingSteps = [
  "Conta bancária",
  "Categorias",
  "Primeiro lançamento"
];

function clearHighlights() {
  document.querySelectorAll(".onboarding-highlight")
    .forEach(el => el.classList.remove("onboarding-highlight"));
}

function mostrarPainel({ titulo, texto, etapa, acaoTexto, onAcao }){

  document.getElementById("onboarding-guide")?.remove();

  const guide = document.createElement("div");
  guide.id = "onboarding-guide";

  const box = document.createElement("div");
  box.className = "onboarding-box";
  const intro = document.createElement("div");
  intro.className = "onboarding-intro";
  const heading = document.createElement("h2");
  heading.textContent = String(titulo ?? "");
  const description = document.createElement("p");
  description.textContent = String(texto ?? "");
  const badge = document.createElement("span");
  badge.className = "onboarding-step";
  badge.textContent = etapa ? `Etapa ${etapa} de ${onboardingSteps.length}` : "Configuração inicial";
  const checklist = document.createElement("ol");
  checklist.className = "onboarding-checklist";
  onboardingSteps.forEach((label, index) => {
    const item = document.createElement("li");
    const numero = index + 1;
    item.className = numero < etapa ? "done" : (numero === etapa ? "active" : "");
    item.textContent = label;
    checklist.appendChild(item);
  });
  const actions = document.createElement("div");
  actions.className = "onboarding-actions";
  if (acaoTexto && typeof onAcao === "function") {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "onboarding-primary";
    action.textContent = acaoTexto;
    action.addEventListener("click", onAcao);
    actions.appendChild(action);
  }
  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "onboarding-skip";
  skip.textContent = "Concluir depois";
  skip.addEventListener("click", concluirOnboarding);
  actions.appendChild(skip);
  intro.append(badge, heading, description);
  box.append(intro, checklist, actions);
  guide.appendChild(box);

  document.body.appendChild(guide);

}

function irParaTela(tela){

  if (window.App && App.showScreen) {
    App.showScreen(tela);
  }

}

function destacar(selector){

  const el = document.querySelector(selector);

  if (!el) {
    console.error("Elemento não encontrado:", selector);
    return;
  }

  el.classList.add("onboarding-highlight");

}

async function passoConta(){

  clearHighlights();
  irParaTela("contas");

  const btn = await esperarElemento("#btn-open-modal-conta");

  if (btn) {
    btn.classList.add("onboarding-highlight");
  }

  mostrarPainel({
    titulo: "Comece pela conta bancária",
    texto: "Cadastre a conta que vai receber seus movimentos. Ela será a base do extrato, dos pagamentos e do saldo atual.",
    etapa: 1,
    acaoTexto: "Adicionar conta",
    onAcao: () => btn?.click()
  });

  verificarConta();
}

async function verificarConta(){

  const { data } = await supabase
  .from("contas_bancarias")
  .select("id")
  .eq("user_id", STATE.user.id)
  .limit(1);

  if(data && data.length > 0){

    passoCategoria();
    return;

  }

  setTimeout(verificarConta, 2000);

}

async function passoCategoria(){

  clearHighlights();
  irParaTela("contas");

  const btnCategoria = await esperarElemento('[data-tab="categorias"]');

  if (btnCategoria) {
    btnCategoria.click();
  }

  const btnAdd = await esperarElemento("#btn-add-categoria");

  if (btnAdd) {
    btnAdd.classList.add("onboarding-highlight");
  }

  mostrarPainel({
    titulo: "Organize por categorias",
    texto: "Crie categorias para enxergar despesas, receitas e compras do cartão nos gráficos e relatórios.",
    etapa: 2,
    acaoTexto: "Adicionar categoria",
    onAcao: () => btnAdd?.click()
  });

  verificarCategoria();
}

async function verificarCategoria(){

  const { data } = await supabase
  .from("categorias")
  .select("id")
  .eq("user_id", STATE.user.id)
  .limit(1);

  if(data && data.length > 0){

    passoLancamento();
    return;

  }

  setTimeout(verificarCategoria, 2000);

}

async function passoLancamento(){

  clearHighlights();
  irParaTela("lanc");

  mostrarPainel({
    titulo: "Registre o primeiro lançamento",
    texto: "Inclua uma receita ou despesa para a dashboard, o extrato e a previsão começarem a trabalhar com dados reais.",
    etapa: 3,
    acaoTexto: "Adicionar lançamento",
    onAcao: () => document.getElementById("btn-open-add-lanc")?.click()
  });

  verificarLancamento();

}

async function verificarLancamento(){

  const { data } = await supabase
  .from("movimentacoes")
  .select("id")
  .eq("user_id", STATE.user.id)
  .limit(1);

  if(data && data.length > 0){

    finalizarOnboarding();
    return;

  }

  setTimeout(verificarLancamento, 2000);

}

async function finalizarOnboarding(){
  clearHighlights();
  await concluirOnboarding();
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    clearHighlights();
    document.getElementById("onboarding-guide")?.remove();
  }
});
