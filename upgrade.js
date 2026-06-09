const PAYMENT_FUNCTION_NAME = "process-mercadopago-payment";
const PAYMENT_BRICK_CONTAINER_ID = "payment-brick-container";

let paymentBrickController = null;
let isPaymentBrickLoading = false;
let premiumPollingTimer = null;

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

function getRejectedPaymentMessage(result) {
  const statusDetail = String(
    result?.status_detail || result?.payment?.status_detail || "",
  );

  const messages = {
    cc_rejected_bad_filled_card_number:
      "Pagamento recusado. Confira o numero do cartao e tente novamente.",
    cc_rejected_bad_filled_date:
      "Pagamento recusado. Confira a validade do cartao e tente novamente.",
    cc_rejected_bad_filled_security_code:
      "Pagamento recusado. Confira o codigo de seguranca e tente novamente.",
    cc_rejected_bad_filled_other:
      "Pagamento recusado. Confira os dados do cartao e tente novamente.",
    cc_rejected_call_for_authorize:
      "Pagamento recusado pelo banco. Autorize a compra com o banco ou use outro cartao.",
    cc_rejected_card_disabled:
      "Pagamento recusado. O cartao esta desabilitado. Use outro cartao ou Pix.",
    cc_rejected_duplicated_payment:
      "Pagamento recusado por tentativa duplicada. Aguarde alguns minutos ou use outro meio de pagamento.",
    cc_rejected_high_risk:
      "Pagamento recusado pelos controles de seguranca do Mercado Pago. Use outro cartao ou Pix.",
    cc_rejected_insufficient_amount:
      "Pagamento recusado por limite insuficiente. Use outro cartao ou Pix.",
    cc_rejected_invalid_installments:
      "Pagamento recusado para o parcelamento escolhido. Tente em 1 vez ou use outro cartao.",
    cc_rejected_max_attempts:
      "Pagamento recusado por muitas tentativas. Aguarde alguns minutos ou use outro cartao.",
    cc_rejected_other_reason:
      "Pagamento recusado pelo Mercado Pago. Use outro cartao ou Pix.",
  };

  return messages[statusDetail] || "Pagamento recusado. Use outro cartao ou Pix.";
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
  stopPremiumPolling();
  panel.classList.add("hidden");
  document.body.style.overflow = "";
}

function scrollPaymentDialogToPix() {
  const dialog = document.querySelector(".payment-dialog");
  const pixBox = document.getElementById("pix-result");

  if (!dialog || !pixBox) return;

  requestAnimationFrame(() => {
    pixBox.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
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

  const copyButton = document.getElementById("copy-pix-code");
  if (copyButton) {
    copyButton.onclick = copyPixCode;
  }

  pixBox.classList.add("pix-result-highlight");
  setTimeout(() => {
    pixBox.classList.remove("pix-result-highlight");
  }, 2200);

  scrollPaymentDialogToPix();
}

function isPremiumProfile(profile) {
  if (!profile) return false;
  const plan = String(profile.plano || "").toLowerCase();
  return (
    (plan === "pro" || plan === "vip") &&
    profile.subscription_status === "active"
  );
}

function stopPremiumPolling() {
  if (!premiumPollingTimer) return;
  clearInterval(premiumPollingTimer);
  premiumPollingTimer = null;
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

function waitForPremiumActivation() {
  stopPremiumPolling();

  let attempts = 0;
  const maxAttempts = 90;

  setPaymentStatus(
    "Pagamento enviado. Aguardando confirmacao automatica do Mercado Pago...",
    "pending",
  );

  premiumPollingTimer = setInterval(async () => {
    attempts += 1;

    try {
      const isActive = await checkPremiumActivation();

      if (isActive) {
        stopPremiumPolling();
        setPaymentStatus("Pagamento confirmado. Abrindo o Arolix PRO...", "success");
        setTimeout(() => {
          window.location.href = "app.html";
        }, 1200);
        return;
      }
    } catch (error) {
      console.warn("Verificacao de PRO falhou:", error);
    }

    if (attempts >= maxAttempts) {
      stopPremiumPolling();
      setPaymentStatus(
        "Pagamento enviado. Se o PRO nao abrir automaticamente, recarregue o app em alguns instantes.",
        "pending",
      );
    }
  }, 4000);
}

async function processPayment(formData, selectedPaymentMethod) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    throw new Error("Sessao expirada. Faca login novamente.");
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

    if (data?.error === "MERCADO_PAGO_INVALID_CREDENTIALS") {
      throw new Error(
        "Cartao indisponivel por configuracao do Mercado Pago. Confira se a Public Key do site e o Access Token do Supabase sao da mesma aplicacao e do mesmo ambiente.",
      );
    }

    throw new Error(data?.details?.message || data?.error || "Pagamento recusado");
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
  setPaymentStatus(`Escolha Pix ou cartao para pagar ${formatPrice(amount)}.`);

  try {
    const mercadoPago = new window.MercadoPago(publicKey, { locale: "pt-BR" });
    const bricksBuilder = mercadoPago.bricks();

    paymentBrickController = await bricksBuilder.create(
      "payment",
      PAYMENT_BRICK_CONTAINER_ID,
      {
        initialization: {
          amount,
        },
        customization: {
          paymentMethods: {
            bankTransfer: "pix",
            creditCard: "all",
          },
        },
        callbacks: {
          onReady: () => {
            setPaymentStatus(`Escolha Pix ou cartao para pagar ${formatPrice(amount)}.`);
          },
          onSubmit: ({ selectedPaymentMethod, formData }) => {
            setPaymentStatus("Processando pagamento...");

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
                  } else if (result.status === "pending") {
                    setPaymentStatus(
                      "Pagamento pendente. Aguardando confirmacao automatica do Mercado Pago...",
                      "pending",
                    );
                    waitForPremiumActivation();
                  } else if (isRejectedPaymentStatus(result.status)) {
                    stopPremiumPolling();
                    setPaymentStatus(getRejectedPaymentMessage(result), "error");
                  } else {
                    setPaymentStatus(
                      `Pagamento recebido com status: ${result.status || "em analise"}.`,
                      "pending",
                    );
                    waitForPremiumActivation();
                  }

                  resolve();
                })
                .catch((error) => {
                  console.error("Erro no pagamento:", error);
                  setPaymentStatus(
                    error?.message ||
                      "Nao foi possivel concluir o pagamento. Confira os dados e tente novamente.",
                    "error",
                  );
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

  if (!btn) return;
  btn.onclick = hidePaymentPanel;

  if (panel) {
    panel.onclick = (event) => {
      if (event.target === panel) {
        hidePaymentPanel();
      }
    };
  }
}

showPaymentReturnMessage();
setupCheckoutButton();
setupClosePaymentButton();
