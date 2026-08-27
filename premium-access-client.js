/* premium-access-client.js
   Regras centrais de acesso do Arolix.
*/
(function () {
  "use strict";

  const TRIAL_DAYS = 5;

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addDays(date, days) {
    const copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function planOf(profile) {
    return String(profile?.plano || profile?.plan || "free").toLowerCase();
  }

  function statusOf(profile) {
    return String(profile?.subscription_status || "").toLowerCase();
  }

  function expirationOf(profile) {
    return parseDate(profile?.subscription_ends_at || profile?.plano_expira_em);
  }

  function trialStartOf(profile) {
    return parseDate(profile?.trial_started_at || profile?.created_at);
  }

  function isVip(profile) {
    return planOf(profile) === "vip" && statusOf(profile) === "active";
  }

  function isPro(profile) {
    const endsAt = expirationOf(profile);
    return planOf(profile) === "pro"
      && statusOf(profile) === "active"
      && (!endsAt || endsAt >= new Date());
  }

  function hasTrialAccess(profile) {
    const start = trialStartOf(profile);
    return planOf(profile) === "free" && !!start && addDays(start, TRIAL_DAYS) >= new Date();
  }

  function hasPaidAccess(profile) {
    return isPro(profile) || isVip(profile);
  }

  function hasFinancialAccess(profile) {
    return hasPaidAccess(profile) || hasTrialAccess(profile);
  }

  function hasInvestmentAccess(profile) {
    return isVip(profile);
  }

  function hasPremiumAccess(profile) {
    return hasFinancialAccess(profile);
  }

  function financialBlockedMessage() {
    return "Seu período gratuito terminou. Assine o plano Pro para continuar usando o Arolix.";
  }

  function investmentBlockedMessage() {
    return "Investimentos e CVM estão disponíveis apenas para usuários VIP.";
  }

  function getUpgradeMessage(message) {
    return `${message || financialBlockedMessage()}\n\nAssine o Pro por R$ 9,90 para continuar usando o Arolix.`;
  }

  function goToUpgrade(msg) {
    alert(getUpgradeMessage(msg));
    setTimeout(() => {
      window.location.href = "upgrade.html";
    }, 500);
  }

  window.ArolixAccess = Object.assign(window.ArolixAccess || {}, {
    AROLIX_TRIAL_DAYS: TRIAL_DAYS,
    isPro,
    isVip,
    hasTrialAccess,
    hasPaidAccess,
    hasFinancialAccess,
    hasInvestmentAccess,
    hasPremiumAccess,
    financialBlockedMessage,
    investmentBlockedMessage,
    getUpgradeMessage,
    goToUpgrade
  });

  function showUpgradeMessage() {
    if (document.getElementById("premium-upgrade-alert")) return;

    const alertBox = document.createElement("div");
    alertBox.id = "premium-upgrade-alert";
    alertBox.style.cssText = [
      "margin:12px 0",
      "padding:12px 14px",
      "border-radius:10px",
      "background:#fff3cd",
      "color:#664d03",
      "border:1px solid #ffecb5",
      "font-size:14px"
    ].join(";");
    alertBox.appendChild(document.createTextNode(`${financialBlockedMessage()} `));

    const upgradeLink = document.createElement("a");
    upgradeLink.href = "upgrade.html";
    upgradeLink.textContent = "Ir para upgrade";
    upgradeLink.style.cssText = "margin-left:8px;font-weight:700;";
    alertBox.appendChild(upgradeLink);

    const main = document.querySelector("main");
    if (main) main.prepend(alertBox);
  }

  function applyFinancialAccessUI(accessGranted) {
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

  function markInvestmentUnavailable(profile) {
    const allowed = hasInvestmentAccess(profile);
    document
      .querySelectorAll('[data-requires-investment], a[href="investimentos.html"], button[data-target="investimentos"]')
      .forEach((el) => {
        el.classList.toggle("is-locked", !allowed);
        if (!allowed) {
          el.setAttribute("title", investmentBlockedMessage());
        } else {
          el.removeAttribute("title");
        }
      });
  }

  async function loadAndApplyAccess() {
    try {
      if (!window.supabase?.auth) return;

      const { data: sessionData } = await window.supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) return;

      const { data: profile, error } = await window.supabase
        .from("user_profiles")
        .select("plano, subscription_status, subscription_ends_at, plano_expira_em, trial_started_at, created_at")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.warn("Erro ao carregar perfil de acesso:", error);
        return;
      }

      applyFinancialAccessUI(hasFinancialAccess(profile || {}));
      markInvestmentUnavailable(profile || {});

      console.log(
        "Acesso financeiro:",
        hasFinancialAccess(profile || {}),
        "Acesso investimentos:",
        hasInvestmentAccess(profile || {})
      );
    } catch (err) {
      console.warn("Falha ao aplicar controle de acesso:", err);
    }
  }

  window.addEventListener("load", () => {
    setTimeout(loadAndApplyAccess, 600);
  });
})();
