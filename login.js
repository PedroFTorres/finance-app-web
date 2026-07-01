// =========================
// ELEMENTOS PRINCIPAIS
// =========================

const btnSignup = document.getElementById("btn-signup");
const btnSignin = document.getElementById("btn-signin");
const msg = document.getElementById("msg");

let pendingMfaChallenge = null;

function setButtonLoading(button, isLoading, loadingText, defaultText) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : defaultText;
}

function getAppBasePath() {
  const path = window.location.pathname;
  const fileName = path.split("/").pop();

  if (fileName && fileName.includes(".")) {
    return path.slice(0, path.length - fileName.length);
  }

  return path.endsWith("/") ? path : `${path}/`;
}

function getLocalRedirectUrl(page) {
  return `${window.location.origin}${getAppBasePath()}${page}`;
}

function redirectToApp() {
  window.location.href = "app.html";
}

function normalizeOtpCode(code) {
  return String(code || "").replace(/\D/g, "").slice(0, 6);
}

async function startMfaChallengeIfNeeded() {
  const { data: aalData, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aalError) {
    throw aalError;
  }

  const requiresMfa =
    aalData?.nextLevel === "aal2" && aalData?.currentLevel !== "aal2";

  if (!requiresMfa) {
    redirectToApp();
    return;
  }

  const { data: factorsData, error: factorsError } =
    await supabase.auth.mfa.listFactors();

  if (factorsError) {
    throw factorsError;
  }

  const totpFactor = factorsData?.totp?.find(
    (factor) => factor.status === "verified"
  );

  if (!totpFactor) {
    await supabase.auth.signOut();
    throw new Error("Nenhum fator MFA ativo foi encontrado para esta conta.");
  }

  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId: totpFactor.id });

  if (challengeError) {
    throw challengeError;
  }

  pendingMfaChallenge = {
    factorId: totpFactor.id,
    challengeId: challengeData.id
  };

  document.getElementById("modal-mfa")?.classList.remove("hidden");
  document.getElementById("mfa-code")?.focus();
}

// =========================
// LOGIN
// =========================

if (btnSignin) {
  btnSignin.onclick = async () => {
    if (btnSignin.disabled) return;

    setButtonLoading(btnSignin, true, "Entrando...", "Entrar");
    msg.textContent = "";

    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value;

    if (!email || !pass) {
      msg.textContent = "Preencha email e senha.";
      setButtonLoading(btnSignin, false, "Entrando...", "Entrar");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass
    });

    if (error) {
      msg.textContent = error.message;
      setButtonLoading(btnSignin, false, "Entrando...", "Entrar");
      return;
    }

    try {
      await startMfaChallengeIfNeeded();
    } catch (mfaError) {
      msg.textContent =
        mfaError?.message || "Não foi possível validar a segurança da conta.";
      setButtonLoading(btnSignin, false, "Entrando...", "Entrar");
    }
  };
}

// ========================
// MODAL SIGNUP
// =========================

if (btnSignup) {
  btnSignup.onclick = () => {
    document.getElementById("modal-signup").classList.remove("hidden");
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const btnConfirmSignup = document.getElementById("confirm-signup");
  const btnCancelSignup = document.getElementById("cancel-signup");
  const signupMsg = document.getElementById("signup-msg");

  if (btnCancelSignup) {
    btnCancelSignup.onclick = () => {
      document.getElementById("modal-signup").classList.add("hidden");
    };
  }

  if (btnConfirmSignup) {
    btnConfirmSignup.onclick = async () => {
      if (btnConfirmSignup.disabled) return;

      setButtonLoading(btnConfirmSignup, true, "Criando...", "Criar Conta");
      signupMsg.textContent = "";
      signupMsg.style.color = "red";

      const nome = document.getElementById("signup-nome").value.trim();
      const email = document.getElementById("signup-email").value.trim();
      const pass = document.getElementById("signup-password").value;
      const pass2 = document.getElementById("signup-password2").value;

      if (!nome || !email || !pass || !pass2) {
        signupMsg.textContent = "Preencha todos os campos.";
        setButtonLoading(btnConfirmSignup, false, "Criando...", "Criar Conta");
        return;
      }

      if (pass !== pass2) {
        signupMsg.textContent = "As senhas não coincidem.";
        setButtonLoading(btnConfirmSignup, false, "Criando...", "Criar Conta");
        return;
      }

      if (pass.length < 6) {
        signupMsg.textContent = "A senha deve ter no mínimo 6 caracteres.";
        setButtonLoading(btnConfirmSignup, false, "Criando...", "Criar Conta");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          emailRedirectTo: getLocalRedirectUrl("app.html"),
          data: {
            nome
          }
        }
      });

      if (error) {
        if (error.message.includes("rate limit")) {
          signupMsg.textContent =
            "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
        } else {
          signupMsg.textContent = error.message;
        }

        setButtonLoading(btnConfirmSignup, false, "Criando...", "Criar Conta");
        return;
      }

      if (data?.session) {
        signupMsg.style.color = "green";
        signupMsg.textContent = "Conta criada! Entrando...";
        redirectToApp();
        return;
      }

      if (data?.user) {
        signupMsg.style.color = "green";
        signupMsg.textContent =
          "Conta criada! Verifique seu email para confirmar.";
      }

      setButtonLoading(btnConfirmSignup, false, "Criando...", "Criar Conta");
    };
  }

  // =========================
  // MFA DO LOGIN
  // =========================

  const modalMfa = document.getElementById("modal-mfa");
  const mfaCode = document.getElementById("mfa-code");
  const confirmMfa = document.getElementById("confirm-mfa");
  const cancelMfa = document.getElementById("cancel-mfa");
  const mfaMsg = document.getElementById("mfa-msg");

  if (mfaCode) {
    mfaCode.addEventListener("input", () => {
      mfaCode.value = normalizeOtpCode(mfaCode.value);
    });

    mfaCode.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        confirmMfa?.click();
      }
    });
  }

  if (cancelMfa) {
    cancelMfa.onclick = async () => {
      pendingMfaChallenge = null;
      await supabase.auth.signOut();
      modalMfa?.classList.add("hidden");
      setButtonLoading(btnSignin, false, "Entrando...", "Entrar");
      msg.textContent = "Login cancelado.";
    };
  }

  if (confirmMfa) {
    confirmMfa.onclick = async () => {
      if (confirmMfa.disabled) return;

      const code = normalizeOtpCode(mfaCode?.value);

      mfaMsg.textContent = "";
      mfaMsg.style.color = "red";

      if (!pendingMfaChallenge || !code || code.length !== 6) {
        mfaMsg.textContent = "Digite o código de 6 dígitos.";
        return;
      }

      setButtonLoading(confirmMfa, true, "Verificando...", "Verificar");

      const { error } = await supabase.auth.mfa.verify({
        factorId: pendingMfaChallenge.factorId,
        challengeId: pendingMfaChallenge.challengeId,
        code
      });

      if (error) {
        mfaMsg.textContent = error.message;
        setButtonLoading(confirmMfa, false, "Verificando...", "Verificar");
        return;
      }

      pendingMfaChallenge = null;
      mfaMsg.style.color = "green";
      mfaMsg.textContent = "Verificado! Entrando...";
      redirectToApp();
    };
  }

  // =========================
  // ESQUECI MINHA SENHA
  // =========================

  const forgotBtn = document.getElementById("forgot-password");
  const modalReset = document.getElementById("modal-reset");
  const cancelReset = document.getElementById("cancel-reset");
  const sendReset = document.getElementById("send-reset");
  const resetMsg = document.getElementById("reset-modal-msg");

  if (forgotBtn) {
    forgotBtn.onclick = (event) => {
      event.preventDefault();
      modalReset.classList.remove("hidden");
    };
  }

  if (cancelReset) {
    cancelReset.onclick = () => {
      modalReset.classList.add("hidden");
    };
  }

  if (sendReset) {
    sendReset.onclick = async () => {
      if (sendReset.disabled) return;

      setButtonLoading(
        sendReset,
        true,
        "Enviando...",
        "Enviar Link de Recuperação"
      );
      resetMsg.textContent = "";
      resetMsg.style.color = "red";

      const email = document.getElementById("reset-email").value.trim();

      if (!email) {
        resetMsg.textContent = "Digite seu email.";
        setButtonLoading(
          sendReset,
          false,
          "Enviando...",
          "Enviar Link de Recuperação"
        );
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getLocalRedirectUrl("reset.html")
      });

      if (error) {
        resetMsg.textContent = error.message;
        setButtonLoading(
          sendReset,
          false,
          "Enviando...",
          "Enviar Link de Recuperação"
        );
        return;
      }

      resetMsg.style.color = "green";
      resetMsg.textContent =
        "Email enviado! Verifique sua caixa de entrada.";

      setButtonLoading(
        sendReset,
        false,
        "Enviando...",
        "Enviar Link de Recuperação"
      );
    };
  }
});
