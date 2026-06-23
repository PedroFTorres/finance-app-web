/* premium-access-client.js
   Passo 3.2 — bloqueio premium no frontend com base em user_profiles.
*/
(function () {
  "use strict";

  function hasPremiumAccess(profile) {
    if (!profile) return false;
    const planoOk = ["pro", "vip"].includes((profile.plano || "").toLowerCase());
    const statusOk = (profile.subscription_status || "").toLowerCase() === "active";
    return planoOk && statusOk;
  }

  function showUpgradeMessage() {
    // Evita duplicar aviso
    if (document.getElementById("premium-upgrade-alert")) return;

    const alert = document.createElement("div");
    alert.id = "premium-upgrade-alert";
    alert.style.cssText = `
      margin:12px 0;padding:12px 14px;border-radius:10px;
      background:#fff3cd;color:#664d03;border:1px solid #ffecb5;
      font-size:14px;
    `;
    alert.appendChild(document.createTextNode(
      "🔒 Recurso premium. Faça upgrade para liberar esta funcionalidade. "
    ));
    const upgradeLink = document.createElement("a");
    upgradeLink.href = "upgrade.html";
    upgradeLink.textContent = "Ir para upgrade";
    upgradeLink.style.cssText = "margin-left:8px;font-weight:700;";
    alert.appendChild(upgradeLink);

    // coloca no topo do main
    const main = document.querySelector("main");
    if (main) main.prepend(alert);
  }

  function applyPremiumUI(accessGranted) {
    // Exemplo de alvos premium (ajuste conforme seu app)
    const premiumButtons = [
      document.getElementById("btn-print-extrato"), // exemplo atual
    ].filter(Boolean);

    premiumButtons.forEach((btn) => {
      btn.disabled = !accessGranted;
      btn.style.opacity = accessGranted ? "1" : "0.55";
      btn.title = accessGranted ? "" : "Recurso disponível apenas para assinantes Pro/VIP ativos";
    });

    // Se não tiver acesso, mostra aviso
    if (!accessGranted) showUpgradeMessage();
  }

  async function loadProfileAndApplyAccess() {
    if (!window.supabase?.auth) return;

    try {
      const { data: sess } = await window.supabase.auth.getSession();
      const user = sess?.session?.user;
      if (!user) return;

      const { data: profile, error } = await window.supabase
        .from("user_profiles")
        .select("plano, subscription_status")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.warn("Erro ao carregar perfil premium:", error);
        return;
      }

      const access = hasPremiumAccess(profile);
      applyPremiumUI(access);

      console.log("Premium access:", access, profile);
    } catch (err) {
      console.warn("Falha ao aplicar controle premium:", err);
    }
  }

  window.addEventListener("load", () => {
    setTimeout(loadProfileAndApplyAccess, 1300);
  });
})();
