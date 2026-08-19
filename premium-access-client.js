/* premium-access-client.js
   Regras centrais de acesso do Arolix.
*/
(function () {
  "use strict";

  function dateIsValid(date) {
    if (!date) return true;
    const parsed = new Date(date);
    return !Number.isNaN(parsed.getTime()) && parsed > new Date();
  }

  function planOf(profile) {
    return String(profile?.plano || "free").toLowerCase();
  }

  function statusOf(profile) {
    return String(profile?.subscription_status || "").toLowerCase();
  }

  function hasPaidAccess(profile) {
    const plano = planOf(profile);
    return ["pro", "vip"].includes(plano)
      && statusOf(profile) === "active"
      && dateIsValid(profile?.subscription_ends_at)
      && dateIsValid(profile?.plano_expira_em);
  }

  function hasFinancialAccess(profile) {
    if (!profile) return false;
    const plano = planOf(profile);

    if (hasPaidAccess(profile)) return true;
    if (plano !== "free") return false;

    const trialStartedAt = profile.trial_started_at || profile.created_at;
    if (!trialStartedAt) return false;

    const start = new Date(trialStartedAt);
    if (Number.isNaN(start.getTime())) return false;
    const trialEndsAt = new Date(start.getTime() + 5 * 86400000);
    return trialEndsAt > new Date();
  }

  function hasInvestmentAccess(profile) {
    return planOf(profile) === "vip" && hasPaidAccess(profile);
  }

  function financialBlockedMessage() {
    return "Seu período gratuito terminou. Assine o plano Pro para continuar usando o Arolix.";
  }

  function investmentBlockedMessage() {
    return "Investimentos e CVM estão disponíveis apenas para usuários VIP.";
  }

  function goToUpgrade(msg) {
    alert((msg || financialBlockedMessage()) + "\n\nFaça upgrade para liberar.");
    setTimeout(() => {
      window.location.href = "upgrade.html";
    }, 500);
  }

  window.ArolixAccess = {
    dateIsValid,
    hasPaidAccess,
    hasFinancialAccess,
    hasInvestmentAccess,
    financialBlockedMessage,
    investmentBlockedMessage,
    goToUpgrade
  };

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
    alert.appendChild(document.createTextNode(`${financialBlockedMessage()} `));
    const upgradeLink = document.createElement("a");
    upgradeLink.href = "upgrade.html";
    upgradeLink.textContent = "Ir para upgrade";
    upgradeLink.style.cssText = "margin-left:8px;font-weight:700;";
    alert.appendChild(upgradeLink);

    // coloca no topo do main
    const main = document.querySelector("main");
    if (main) main.prepend(alert);
  }

  function applyAccessUI(accessGranted) {
    const premiumButtons = [
      document.getElementById("btn-print-extrato"),
    ].filter(Boolean);

    premiumButtons.forEach((btn) => {
      btn.disabled = !accessGranted;
      btn.style.opacity = accessGranted ? "1" : "0.55";
      btn.title = accessGranted ? "" : "Seu período gratuito terminou";
    });

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
        .select("plano, subscription_status, subscription_ends_at, plano_expira_em, trial_started_at, created_at")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.warn("Erro ao carregar perfil premium:", error);
        return;
      }

      const access = hasFinancialAccess(profile);
      applyAccessUI(access);

      console.log("Financial access:", access, profile);
    } catch (err) {
      console.warn("Falha ao aplicar controle premium:", err);
    }
  }

  window.addEventListener("load", () => {
    setTimeout(loadProfileAndApplyAccess, 1300);
  });
})();
