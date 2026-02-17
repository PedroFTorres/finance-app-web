btnSignup = document.getElementById("btn-signup");
btnSignin = document.getElementById("btn-signin");
msg = document.getElementById("msg");

btnSignup.onclick = async () => {
  let email = document.getElementById("email").value;
  let pass = document.getElementById("password").value;

  const { error } = await supabase.auth.signUp({ email, password: pass });

  if (error) {
  msg.textContent = error.message;
  return;
}

msg.textContent =
  "Conta criada! Verifique seu email para confirmar antes de entrar.";

};

btnSignin.onclick = async () => {
  let email = document.getElementById("email").value;
  let pass = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });

  if (error) return msg.textContent = error.message;

  // Login OK → redireciona para o app
  window.location.href = "app.html";
};
