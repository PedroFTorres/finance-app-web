const PAYMENT_FUNCTION_NAME = "process-mercadopago-payment";
const PAYMENT_STATUS_FUNCTION_NAME = "check-mercadopago-payment";
const PAYMENT_BRICK_CONTAINER_ID = "payment-brick-container";

let paymentBrickController = null;
let isPaymentBrickLoading = false;
let paymentPollingTimer = null;

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
  if (message) alert(message);
}

function setButtonLoading(btn, loading) {
  btn.disabled = loading;
  btn.textContent = loading ? "Carregando pagamento..." : "Desbloquear tudo";
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function setPaymentStatus(message, type = "") {
  const status = document.getElementById("payment-status");
  if (!status) return;
  status.textContent = message;
  status.className = `payment-status ${type}`.trim();
}

function scrollToPaymentStatus() {
  document.getElementById("payment-status")?.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
}

function isRejectedPaymentStatus(status) {
  return ["rejected", "cancelled", "refunded", "charged_back"].includes(
    String(status || "").toLowerCase(),
  );
}

function showPaymentPanel() {
  const panel = document.getElementById("payment-panel");
  if (!panel) return;
  panel.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function hidePaymentPanel() {
  const panel = document.getElementById("payment-panel");
  if (!panel) return;
  stopPaymentPolling();
  panel.classList.add("hidden");
  document.body.style.overflow = "";
}

async function copyPixCode() {
  const field = document.getElementById("pix-code");
  const btn = document.getElementById("copy-pix-code");
  const code = field?.value;

  if (!code || !navigator.clipboard) return;

  await navigator.clipboard.writeText(code);

  if (btn) {
    const originalText = btn.textContent;
    btn.textContent = "Codigo copiado";
    setTimeout(() => {
      btn.textContent = originalText;
    }, 1800);
  }
}

function showPixResult(payment) {
  const pixBox = document.getElementById("pix-result");
  if (!pixBox) return;

  const transactionData = payment?.point_of_interaction?.transaction_data || {};
  const qrCodeBase64 = transactionData.qr_code_base64;
  const qrCode = transactionData.qr_code;
  const ticketUrl = transactionData.ticket_url;

  if (!qrCodeBase64 && !qrCode && !ticketUrl) {
    pixBox.classList.add("hidden");
    pixBox.innerHTML = "";
    return;
  }

  pixBox.classList.remove("hidden");
  pixBox.innerHTML = `
    <h3>Pagamento Pix gerado</h3>
    <p class="pix-waiting">Use o QR Code abaixo ou copie o codigo Pix. Depois de pagar, mantenha esta janela aberta para o Arolix liberar seu PRO automaticamente.</p>
    ${qrCodeBase64 ? `<img src="data:image/png;base64,${qrCodeBase64}" alt="QR Code Pix">` : ""}
    ${qrCode ? `
      <label class="pix-copy-label" for="pix-code">Pix copia e cola</label>
      <textarea id="pix-code" readonly>${qrCode}</textarea>
      <button id="copy-pix-code" class="pix-copy-button" type="button">Copiar codigo Pix</button>
    ` : ""}
    ${ticketUrl ? `<a href="${ticketUrl}" target="_blank" rel="noopener">Abrir instrucoes de pagamento</a>` : ""}
  `;

  document.getElementById("copy-pix-code")?.addEventListener("click", copyPixCode);
  pixBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

function isPremiumProfile(profile) {
  if (!profile) return false;
  const plan = String(profile.plano || "").toLowerCase();
  return (plan === "pro" || plan === "vip") && profile.subscription_status === "active";
}

function stopPaymentPolling() {
  if (!paymentPollingTimer) return;
  clearInterval(paymentPollingTimer);
  paymentPollingTimer = null;
}

async function checkPremiumActivation() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  if (!userId) return false;

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("plano, subscription_status, subscription_ends_at, plano_expira_em")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Nao foi possivel verificar liberacao PRO:", error);
    return false;
  }

  return isPremiumProfile(profile);
}

async function checkMercadoPagoPayment(paymentId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    throw new Error("Sessao expirada. Faca login novamente.");
  }

  const response = await fetch(
    `${window.APP_CONFIG.SUPABASE_URL}/functions/v1/${PAYMENT_STATUS_FUNCTION_NAME}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: window.APP_CONFIG.SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payment_id: paymentId }),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel consultar o pagamento.");
  }

  return data;
}

function waitForPaymentOutcome(paymentId) {
  stopPaymentPolling();

  let attempts = 0;
  const maxAttempts = 90;

  setPaymentStatus(
    "Pix gerado. Aguardando confirmacao automatica do Mercado Pago...",
    "pending",
  );
  scrollToPaymentStatus();

  paymentPollingTimer = setInterval(async () => {
    attempts += 1;

    try {
      if (paymentId) {
        const payment = await checkMercadoPagoPayment(paymentId);

        if (isRejectedPaymentStatus(payment.status)) {
          stopPaymentPolling();
          setPaymentStatus("Pagamento Pix nao foi aprovado. Gere um novo Pix e tente novamente.", "error");
          scrollToPaymentStatus();
          return;
        }
      }

      if (await checkPremiumActivation()) {
        stopPaymentPolling();
        setPaymentStatus("Pagamento confirmado. Abrindo o Arolix PRO...", "success");
        scrollToPaymentStatus();
        setTimeout(() => {
          window.location.href = "app.html";
        }, 1200);
      }
    } catch (error) {
      console.warn("Verificacao de PRO falhou:", error);
    }

    if (attempts >= maxAttempts) {
      stopPaymentPolling();
      setPaymentStatus(
        "Pix gerado. Se o PRO nao abrir automaticamente apos o pagamento, recarregue o app em alguns instantes.",
        "pending",
      );
      scrollToPaymentStatus();
    }
  }, 4000);
}

async function processPayment(formData, selectedPaymentMethod) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const deviceSessionId = window.MP_DEVICE_SESSION_ID || null;

  if (!accessToken) {
    throw new Error("Sessao expirada. Faca login novamente.");
  }

  if (selectedPaymentMethod !== "bank_transfer" && formData?.payment_method_id !== "pix") {
    throw new Error("No momento, o Arolix aceita somente Pix.");
  }

  const response = await fetch(
    `${window.APP_CONFIG.SUPABASE_URL}/functions/v1/${PAYMENT_FUNCTION_NAME}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: window.APP_CONFIG.SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        selected_payment_method: selectedPaymentMethod,
        form_data: formData,
        device_session_id: deviceSessionId,
      }),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Detalhes do erro de pagamento:", data);

    if (data?.error === "PIX_NOT_ENABLED_ON_MERCADO_PAGO_ACCOUNT") {
      throw new Error(
        "Pix ainda nao esta habilitado na conta Mercado Pago recebedora. Cadastre uma chave Pix no Mercado Pago e tente novamente.",
      );
    }

    throw new Error(data?.details?.message || data?.error || "Nao foi possivel gerar o Pix.");
  }

  return data;
}

async function initializePaymentBrick() {
  if (paymentBrickController || isPaymentBrickLoading) return;

  const publicKey = window.APP_CONFIG?.MERCADO_PAGO_PUBLIC_KEY;
  const amount = Number(window.APP_CONFIG?.PRO_PRICE_BRL || 1);

  if (!publicKey) {
    setPaymentStatus("Chave publica do Mercado Pago nao configurada.", "error");
    return;
  }

  if (!window.MercadoPago) {
    setPaymentStatus("SDK do Mercado Pago nao carregou. Recarregue a pagina.", "error");
    return;
  }

  isPaymentBrickLoading = true;
  setPaymentStatus(`Gere um Pix para pagar ${formatPrice(amount)}.`);

  try {
    const mercadoPago = new window.MercadoPago(publicKey, { locale: "pt-BR" });
    const bricksBuilder = mercadoPago.bricks();

    paymentBrickController = await bricksBuilder.create(
      "payment",
      PAYMENT_BRICK_CONTAINER_ID,
      {
        initialization: { amount },
        customization: {
          paymentMethods: {
            bankTransfer: "pix",
          },
        },
        callbacks: {
          onReady: () => {
            setPaymentStatus(`Gere um Pix para pagar ${formatPrice(amount)}.`);
          },
          onSubmit: ({ selectedPaymentMethod, formData }) => {
            setPaymentStatus("Gerando Pix...");
            scrollToPaymentStatus();

            return new Promise((resolve, reject) => {
              processPayment(formData, selectedPaymentMethod)
                .then((result) => {
                  showPixResult(result.payment);

                  if (result.status === "approved") {
                    setPaymentStatus(
                      "Pagamento aprovado. Seu PRO sera liberado em instantes.",
                      "success",
                    );
                    setTimeout(() => {
                      window.location.href = "app.html";
                    }, 2500);
                  } else {
                    setPaymentStatus(
                      "Pix gerado. Aguardando confirmacao automatica do Mercado Pago...",
                      "pending",
                    );
                    waitForPaymentOutcome(result.payment_id);
                  }

                  resolve();
                })
                .catch((error) => {
                  console.error("Erro no pagamento:", error);
                  setPaymentStatus(
                    error?.message || "Nao foi possivel gerar o Pix. Tente novamente.",
                    "error",
                  );
                  scrollToPaymentStatus();
                  reject(error);
                });
            });
          },
          onError: (error) => {
            console.error("Erro no Mercado Pago Brick:", error);
            setPaymentStatus("Erro ao carregar o pagamento. Recarregue a pagina.", "error");
          },
        },
      },
    );
  } catch (error) {
    console.error("Falha ao iniciar Payment Brick:", error);
    setPaymentStatus("Nao foi possivel carregar o pagamento agora.", "error");
  } finally {
    isPaymentBrickLoading = false;
  }
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

      showPaymentPanel();
      await initializePaymentBrick();
    } catch (err) {
      console.error("Falha ao abrir pagamento:", err);
      alert("Nao foi possivel iniciar o pagamento agora. Tente novamente.");
    } finally {
      setButtonLoading(btn, false);
    }
  };
}

function setupClosePaymentButton() {
  const btn = document.getElementById("btn-fechar-pagamento");
  const panel = document.getElementById("payment-panel");

  if (btn) btn.onclick = hidePaymentPanel;

  if (panel) {
    panel.onclick = (event) => {
      if (event.target === panel) hidePaymentPanel();
    };
  }
}

showPaymentReturnMessage();
setupCheckoutButton();
setupClosePaymentButton();
