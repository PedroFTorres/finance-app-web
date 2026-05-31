const CHECKOUT_URL = ""; // Configure aqui quando escolher Mercado Pago, Stripe, Asaas etc.
const ENABLE_MANUAL_CONFIRM = new URLSearchParams(window.location.search).get("manual") === "1";

  function setupCheckoutButton() {
  const btn = document.getElementById("btn-assinar");
  if (!btn) return;
    
  btn.onclick = () => {
  if (!CHECKOUT_URL) {
      alert(
        "Checkout ainda não configurado. Escolha e configure uma plataforma de pagamento antes de vender o plano PRO."
      );
      return;
    }
    
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
      plano_expira_em: expira.toISOString(),
      subscription_status: "active",
      subscription_ends_at: expira.toISOString()
      })
    .eq("id", user.id);

  if (error) {
    console.error("Falha ao ativar PRO manual:", error);
    alert("Não foi possível ativar o plano agora. Tente novamente.");
    return;
  }
  
   alert("Plano PRO de teste ativado por 30 dias!");
  window.location.href = "app.html";
  
  }

function setupManualConfirmButton() {
  const btn = document.getElementById("btn-ja-paguei");
  if (!btn) return;

  if (ENABLE_MANUAL_CONFIRM) {
    btn.classList.remove("hidden");
    btn.textContent = "Ativar PRO teste";
    btn.onclick = ativarProManual;
  } else {
    btn.classList.add("hidden");
  }
}

setupCheckoutButton();
setupManualConfirmButton();
