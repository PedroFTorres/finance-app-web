const CHECKOUT_FUNCTION_NAME = "create-mercadopago-checkout";

function getPaymentMessage() {
  const status = new URLSearchParams(window.location.search).get("payment");

  if (status === "success") {
    return "Pagamento aprovado. Seu plano PRO sera liberado em instantes.";
  }

  if (status === "pending") {
    return "Pagamento pendente. Assim que o Mercado Pago confirmar, seu PRO sera liberado.";
  }

  if (status === "failure") {
    return "Pagamento nao concluido. Voce pode tentar novamente quando quiser.";
  }

  return "";
}

function showPaymentReturnMessage() {
  const message = getPaymentMessage();
  if (!message) return;

  alert(message);
}

function setButtonLoading(btn, loading) {
  btn.disabled = loading;
  btn.textContent = loading ? "Abrindo checkout..." : "Desbloquear tudo";
}

function setupCheckoutButton() {
  const btn = document.getElementById("btn-assinar");
  if (!btn) return;
    
  btn.onclick = async () => {
    setButtonLoading(btn, true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session) {
        alert("Faca login para assinar o plano PRO.");
        window.location.href = "login.html";
        return;
      }

      const { data, error } = await supabase.functions.invoke(CHECKOUT_FUNCTION_NAME, {
        method: "POST",
      });

      if (error) {
        console.error("Erro ao criar checkout:", error);
        alert("Nao foi possivel abrir o checkout agora. Tente novamente.");
        return;
      }

      const checkoutUrl = data?.init_point || data?.sandbox_init_point;

      if (!checkoutUrl) {
        console.error("Checkout sem URL:", data);
        alert("O Mercado Pago nao retornou uma URL de checkout.");
        return;
      }

      window.location.href = checkoutUrl;
    } catch (err) {
      console.error("Falha no checkout:", err);
      alert("Nao foi possivel iniciar o pagamento agora. Tente novamente.");
    } finally {
      setButtonLoading(btn, false);
    }
  };
}

showPaymentReturnMessage();
setupCheckoutButton();
