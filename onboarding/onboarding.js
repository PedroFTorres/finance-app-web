async function waitForState() {

  while (!window.STATE || !STATE.profile) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

}

document.addEventListener("DOMContentLoaded", async () => {

  await waitForState();

  if (STATE.profile?.onboarding_completed) return;

  iniciarOnboarding();

});


function iniciarOnboarding(){

  mostrarPasso(
    "Bem-vindo ao Arolix 👋",
    "Vamos começar criando sua primeira conta.",
    () => {

      irParaTela("contas");

      setTimeout(() => {
        destacarElemento("#btn-open-modal-conta");
      }, 400);

    }
  );

}


function mostrarPasso(titulo, texto, callback){

  removerOnboarding();

  const guide = document.createElement("div");
  guide.id = "onboarding-guide";

  guide.innerHTML = `
    <div class="onboarding-box">

      <h2>${titulo}</h2>

      <p>${texto}</p>

      <button id="onboarding-next">
        Entendi
      </button>

    </div>
  `;

  document.body.appendChild(guide);

  document
    .getElementById("onboarding-next")
    .onclick = () => {

      removerOnboarding();

      if (callback) callback();

    };

}


function destacarElemento(selector){

  const el = document.querySelector(selector);

  if (!el) return;

  el.classList.add("onboarding-highlight");

  mostrarPasso(
    "Adicionar conta",
    "Clique aqui para cadastrar sua primeira conta.",
    finalizarOnboarding
  );

}


function irParaTela(tela){

  const btn = document.querySelector(`[data-target="${tela}"]`);

  if (btn) btn.click();

}


function removerOnboarding(){

  document
    .getElementById("onboarding-guide")
    ?.remove();

}


async function finalizarOnboarding(){

  await supabase
    .from("user_profiles")
    .update({
      onboarding_completed: true
    })
    .eq("id", STATE.user.id);

}
