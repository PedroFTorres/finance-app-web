// =========================// ELEMENTOS PRINCIPAIS// =========================

const btnSignup = document.getElementById("btn-signup");
const btnSignin = document.getElementById("btn-signin");
const msg = document.getElementById("msg");

// =========================// LOGIN// =========================

if (btnSignin) {
  btnSignin.onclick = async () => {

    if (btnSignin.disabled) return;

    btnSignin.disabled = true;
    btnSignin.textContent = "Entrando...";

    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value;

    if (!email || !pass) {
      msg.textContent = "Preencha email e senha.";
      btnSignin.disabled = false;
      btnSignin.textContent = "Entrar";
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass
    });

    if (error) {
      msg.textContent = error.message;
      btnSignin.disabled = false;
      btnSignin.textContent = "Entrar";
      return;
    }

    window.location.href = "app.html";
  };
}

// ========================// MODAL SIGNUP// =========================

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

      btnConfirmSignup.disabled = true;
      btnConfirmSignup.textContent = "Criando...";

      const nome = document.getElementById("signup-nome").value.trim();
      const email = document.getElementById("signup-email").value.trim();
      const pass = document.getElementById("signup-password").value;
      const pass2 = document.getElementById("signup-password2").value;

      if (!nome || !email || !pass || !pass2) {
        signupMsg.textContent = "Preencha todos os campos.";
        btnConfirmSignup.disabled = false;
        btnConfirmSignup.textContent = "Criar Conta";
        return;
      }

      if (pass !== pass2) {
        signupMsg.textContent = "As senhas não coincidem.";
        btnConfirmSignup.disabled = false;
        btnConfirmSignup.textContent = "Criar Conta";
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          emailRedirectTo:
            "https://pedroftorres.github.io/finance-app-web/app.html"
        }
      });

      if (error) {

        if (error.message.includes("rate limit")) {
          signupMsg.textContent =
            "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
        } else {
          signupMsg.textContent = error.message;
        }

        btnConfirmSignup.disabled = false;
        btnConfirmSignup.textContent = "Criar Conta";
        return;
      }

      if (data?.user) {
        await supabase.from("user_profiles").insert([{
          id: data.user.id,
          nome: nome,
          plano: "free"
        }]);
      }

      signupMsg.style.color = "green";
      signupMsg.textContent =
        "Conta criada! Verifique seu email para confirmar.";

      btnConfirmSignup.disabled = false;
      btnConfirmSignup.textContent = "Criar Conta";
    };
  }

  // =========================// ESQUECI MINHA SENHA// =========================

  const forgotBtn = document.getElementById("forgot-password");
  const modalReset = document.getElementById("modal-reset");
  const cancelReset = document.getElementById("cancel-reset");
  const sendReset = document.getElementById("send-reset");
  const resetMsg = document.getElementById("reset-modal-msg");

  if (forgotBtn) {
    forgotBtn.onclick = () => {
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

      sendReset.disabled = true;
      sendReset.textContent = "Enviando...";

      const email = document.getElementById("reset-email").value.trim();

      if (!email) {
        resetMsg.textContent = "Digite seu email.";
        sendReset.disabled = false;
        sendReset.textContent = "Enviar Link de Recuperação";
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo:
          "https://pedroftorres.github.io/finance-app-web/reset.html"
      });

      if (error) {
        resetMsg.textContent = error.message;
        sendReset.disabled = false;
        sendReset.textContent = "Enviar Link de Recuperação";
        return;
      }

      resetMsg.style.color = "green";
      resetMsg.textContent =
        "Email enviado! Verifique sua caixa de entrada.";

      sendReset.disabled = false;
      sendReset.textContent = "Enviar Link de Recuperação";
    };
  }

});
