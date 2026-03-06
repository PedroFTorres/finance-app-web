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

let etapa = 0;

const passos = [

{
titulo: "Bem-vindo ao Arolix 👋",
texto: "Vamos configurar seu sistema financeiro em poucos passos."
},

{
titulo: "Passo 1 — Crie sua conta",
texto: "Vá até a tela Contas e clique em 'Adicionar conta'."
},

{
titulo: "Passo 2 — Crie categorias",
texto: "Depois vá na aba Categorias e crie categorias para suas receitas e despesas."
},

{
titulo: "Passo 3 — Adicione lançamentos",
texto: "Agora registre receitas ou despesas na tela Lançamentos."
},

{
titulo: "Tudo pronto 🎉",
texto: "Seu sistema está pronto para usar."
}

];

function iniciarOnboarding(){
  mostrarPasso();
}

function mostrarPasso(){

  removerOnboarding();

  const passo = passos[etapa];

  const guide = document.createElement("div");
  guide.id = "onboarding-guide";

  guide.innerHTML = `
  <div class="onboarding-box">

  <h2>${passo.titulo}</h2>

  <p>${passo.texto}</p>

  <button id="onboarding-next">
  ${etapa === passos.length-1 ? "Finalizar" : "Próximo"}
  </button>

  </div>
  `;

  document.body.appendChild(guide);

  document
  .getElementById("onboarding-next")
  .onclick = proximoPasso;

}

function proximoPasso(){

  etapa++;

  if (etapa >= passos.length){

    finalizarOnboarding();

    return;

  }

  mostrarPasso();

}

function removerOnboarding(){
  document.getElementById("onboarding-guide")?.remove();
}

async function finalizarOnboarding(){

  removerOnboarding();

  await supabase
  .from("user_profiles")
  .update({
  onboarding_completed: true
  })
  .eq("id", STATE.user.id);

}
