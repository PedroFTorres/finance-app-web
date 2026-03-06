document.addEventListener("DOMContentLoaded", async () => {

  if (!window.STATE) return;

  // verifica se é primeiro acesso
  if (STATE.profile?.onboarding_completed) return;

  iniciarOnboarding();

});

function iniciarOnboarding(){

  const guide = document.createElement("div");
  guide.id = "onboarding-guide";

  guide.innerHTML = `
    <div class="onboarding-box">
      <h2>Bem-vindo ao Arolix 👋</h2>

      <p>Vamos fazer um rápido guia para você começar.</p>

      <ul>
        <li>1️⃣ Cadastre sua primeira conta</li>
        <li>2️⃣ Crie categorias</li>
        <li>3️⃣ Registre seus lançamentos</li>
      </ul>

      <button id="onboarding-close">
        Começar
      </button>
    </div>
  `;

  document.body.appendChild(guide);

  document
    .getElementById("onboarding-close")
    .onclick = finalizarOnboarding;

}

async function finalizarOnboarding(){

  document
    .getElementById("onboarding-guide")
    ?.remove();

  // salva no banco que onboarding foi concluído
  await supabase
    .from("user_profiles")
    .update({
      onboarding_completed: true
    })
    .eq("id", STATE.user.id);

}
