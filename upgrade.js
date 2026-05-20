const CHECKOUT_URL = "https://mpago.li/1BXpNxM";
const ENABLE_MANUAL_CONFIRM = new URLSearchParams(window.location.search).get("manual") === "1";

  function setupCheckoutButton() {
  const btn = document.getElementById("btn-assinar");
  if (!btn) return;
  btn.onclick = () => {
    window.open(CHECKOUT_URL, "_blank", "noopener,noreferrer");
  };
}

async function ativarProManual() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert("Sessão inválida. Faça login novamente.");
    window.location.href = "login.html";
    return;
  }

  const expira = new Date();
  expira.setDate(expira.getDate() + 30);
  
    const { error } = await supabase
    .from("user_profiles")
    .update({
      plano: "pro",
      subscription_status: "active",
      subscription_ends_at: expiraEm.toISOString()
    })
    .eq("id", user.id);

  if (error) {
    console.error("Falha ao atualizar assinatura:", error);
    alert("Não foi possível ativar seu plano agora. Tente novamente.");
    return;
  }
   alert("Plano PRO ativado por 30 dias!");
  
  window.location.href = "app.html";
  }

function setupManualConfirmButton() {
  const btn = document.getElementById("btn-ja-paguei");
  if (!btn) return;

  if (ENABLE_MANUAL_CONFIRM) {
    btn.classList.remove("hidden");
    btn.onclick = ativarProManual;
  } else {
    btn.classList.add("hidden");
  }
}

setupCheckoutButton();
setupManualConfirmButton();
