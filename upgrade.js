document.getElementById("btn-assinar").onclick = async () => {

  // 🔥 TEMPORÁRIO (simula upgrade)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert("Sessão inválida. Faça login novamente.");
    window.location.href = "login.html";
    return;
  }

  const expiraEm = new Date();
  expiraEm.setMonth(expiraEm.getMonth() + 1);

  const { error } = await supabase
    .from("user_profiles")
    .update({
      plano: "pro",
      subscription_status: "active",
      subscription_ends_at: expiraEm.toISOString()
    })
    .eq("id", user.id);

  if (error) {
    console.error("Falha ao atualizar assinatura:", error);
    alert("Não foi possível ativar seu plano agora. Tente novamente.");
    return;
  }


  alert("Parabéns! Você agora é PRO 🚀");

  window.location.href = "app.html";
};
