btnSignup = document.getElementById("btn-signup");
btnSignin = document.getElementById("btn-signin");
msg = document.getElementById("msg");

btnSignup.onclick = () => {
  document.getElementById("modal-signup").classList.remove("hidden");
};

btnSignin.onclick = async () => {
  let email = document.getElementById("email").value;
  let pass = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });

  if (error) return msg.textContent = error.message;

  // Login OK → redireciona para o app
  window.location.href = "app.html";
};
// =========================// MODAL SIGNUP - LÓGICA SEGURA// =========================

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

      const nome = document.getElementById("signup-nome").value.trim();
      const email = document.getElementById("signup-email").value.trim();
      const pass = document.getElementById("signup-password").value;
      const pass2 = document.getElementById("signup-password2").value;

      if (!nome || !email || !pass || !pass2) {
        signupMsg.textContent = "Preencha todos os campos.";
        return;
      }

      if (pass !== pass2) {
        signupMsg.textContent = "As senhas não coincidem.";
        return;
      }

      const { data, error } = await supabase.auth.signUp({
  email,
  password: pass,
  options: {
    emailRedirectTo: "https://pedroftorres.github.io/finance-app-web/app.html"
  }
});

     if (error) {

  if (error.message.includes("rate limit")) {
    signupMsg.textContent =
      "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    return;
  }

  signupMsg.textContent = error.message;
  return;
}

      if (data?.user) {
        await supabase.from("user_profiles").insert([{
          id: data.user.id,
          nome: nome,
          plano: "free"
        }]);
      }

      signupMsg.textContent =
        "Conta criada! Verifique seu email para confirmar.";
    };
  }

});
