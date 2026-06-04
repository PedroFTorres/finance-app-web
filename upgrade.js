const CHECKOUT_URL = ""; // Configure aqui quando escolher Mercado Pago, Stripe, Asaas etc.

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

setupCheckoutButton();
