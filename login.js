btnSignup = document.getElementById("btn-signup");
btnSignin = document.getElementById("btn-signin");
msg = document.getElementById("msg");

btnSignup.onclick = async () => {
  let email = document.getElementById("email").value;
  let pass = document.getElementById("password").value;

  const { error } = await supabase.auth.signUp({ email, password: pass });

  msg.textContent = error ? error.message : "Conta criada! Agora faça login.";
};

btnSignin.onclick = async () => {
  let email = document.getElementById("email").value;
  let pass = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });

  if (error) return msg.textContent = error.message;

  // Login OK → redireciona para o app
  window.location.href = "app.html";
};
