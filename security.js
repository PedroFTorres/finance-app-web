window.ArolixSecurity = (() => {
  const LOGIN_URL = "login.html";
  const PROFILE_URL = "perfil.html";

  function getCurrentPage() {
    return window.location.pathname.split("/").pop() || "app.html";
  }

  async function getMfaState() {
    const { data: aalData, error: aalError } =
      await window.supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError) {
      throw aalError;
    }

    const { data: factorsData, error: factorsError } =
      await window.supabase.auth.mfa.listFactors();

    if (factorsError) {
      throw factorsError;
    }

    const verifiedFactors = (factorsData?.all || []).filter(
      (factor) => factor.status === "verified"
    );

    return {
      currentLevel: aalData?.currentLevel || null,
      nextLevel: aalData?.nextLevel || null,
      hasVerifiedMfa: verifiedFactors.length > 0,
      needsAal2:
        aalData?.nextLevel === "aal2" && aalData?.currentLevel !== "aal2"
    };
  }

  async function requireMfaForProtectedPage() {
    if (!window.supabase) {
      window.location.href = LOGIN_URL;
      return false;
    }

    const { data } = await window.supabase.auth.getSession();

    if (!data?.session) {
      window.location.href = LOGIN_URL;
      return false;
    }

    let mfaState;

    try {
      mfaState = await getMfaState();
    } catch (error) {
      console.error("Erro ao validar MFA:", error);
      alert("Não foi possível validar a segurança da sessão. Faça login novamente.");
      await window.supabase.auth.signOut();
      window.location.href = LOGIN_URL;
      return false;
    }

    if (!mfaState.hasVerifiedMfa) {
      if (getCurrentPage() !== PROFILE_URL) {
        alert("Ative a verificação em duas etapas para continuar usando o app.");
        window.location.href = PROFILE_URL;
        return false;
      }

      return true;
    }

    if (mfaState.needsAal2) {
      alert("Confirme o código do Google Authenticator para continuar.");
      await window.supabase.auth.signOut();
      window.location.href = LOGIN_URL;
      return false;
    }

    return true;
  }

  return {
    getMfaState,
    requireMfaForProtectedPage
  };
})();
