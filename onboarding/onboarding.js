async function waitForState() {
  while (!window.STATE || !STATE.profile) {
    await new Promise(r => setTimeout(r, 100));
  }
}

document.addEventListener("DOMContentLoaded", async () => {

  await waitForState();

  if (STATE.profile?.onboarding_completed) return;

  iniciarOnboarding();

});

function iniciarOnboarding(){
  passoConta();
}

function mostrarPainel(titulo, texto){

  document.getElementById("onboarding-guide")?.remove();

  const guide = document.createElement("div");
  guide.id = "onboarding-guide";

  guide.innerHTML = `
  <div class="onboarding-box">

  <h2>${titulo}</h2>

  <p>${texto}</p>

  </div>
  `;

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

  irParaTela("contas");

  // 🔥 espera renderizar
  setTimeout(() => {
    destacar("#btn-open-modal-conta");
  }, 300);

  mostrarPainel(
    "Passo 1 — Crie sua conta",
    "Clique no botão destacado para cadastrar sua primeira conta."
  );

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

  mostrarPainel(
    "Passo 2 — Crie categorias",
    "Agora vá na aba Categorias e crie pelo menos uma categoria."
  );

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

  irParaTela("lanc");

  mostrarPainel(
    "Passo 3 — Registre um lançamento",
    "Adicione sua primeira receita ou despesa."
  );

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

  document.getElementById("onboarding-guide")?.remove();

  await supabase
  .from("user_profiles")
  .update({
    onboarding_completed: true
  })
  .eq("id", STATE.user.id);

}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.getElementById("onboarding-guide")?.remove();
  }
});
