document.getElementById("btn-assinar").onclick = async () => {

  // 🔥 TEMPORÁRIO (simula upgrade)
  const { data: { user } } = await supabase.auth.getUser();

  await supabase
    .from("user_profiles")
    .update({ plano: "pro" })
    .eq("id", user.id);

  alert("Parabéns! Você agora é PRO 🚀");

  window.location.href = "app.html";
};
