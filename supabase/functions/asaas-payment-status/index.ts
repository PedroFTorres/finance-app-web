const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type Profile = {
  id: string;
  plano?: string | null;
  subscription_status?: string | null;
  subscription_ends_at?: string | null;
  plano_expira_em?: string | null;
  asaas_customer_id?: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret ${name} nao configurado.`);
  return value;
}

function asaasBaseUrl() {
  return Deno.env.get("ASAAS_ENV") === "sandbox"
    ? "https://api-sandbox.asaas.com"
    : "https://api.asaas.com";
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  const supabaseUrl = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.error_description || text || `Erro Supabase ${response.status}`);
  }
  return data;
}

async function asaasFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${asaasBaseUrl()}${path}`, {
    ...init,
    headers: {
      access_token: env("ASAAS_API_KEY"),
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.errors?.map((item: { description?: string }) => item.description).filter(Boolean).join(" ")
      || data?.message
      || text
      || `Erro Asaas ${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function getAuthenticatedUser(request: Request) {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    throw new Error("Usuario nao autenticado.");
  }

  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: auth
    }
  });

  const user = await response.json().catch(() => null);
  if (!response.ok || !user?.id) {
    throw new Error("Sessao invalida. Entre novamente.");
  }
  return user as { id: string; email?: string };
}

async function getProfile(userId: string) {
  const rows = await supabaseFetch(
    `/rest/v1/user_profiles?id=eq.${encodeURIComponent(userId)}&select=id,plano,subscription_status,subscription_ends_at,plano_expira_em,asaas_customer_id&limit=1`
  );
  const profile = Array.isArray(rows) ? rows[0] : null;
  if (!profile) throw new Error("Perfil do usuario nao encontrado.");
  return profile as Profile;
}

function isActiveFinancialAccess(profile: Profile) {
  const plan = String(profile.plano || "").toLowerCase();
  const status = String(profile.subscription_status || "").toLowerCase();
  const expiration = profile.subscription_ends_at || profile.plano_expira_em;
  const expirationOk = !expiration || new Date(expiration).getTime() > Date.now();

  if (plan === "vip" && status === "active") return true;
  return plan === "pro" && status === "active" && expirationOk;
}

function extractUserIdFromReference(reference: unknown) {
  const match = String(reference || "").match(/arolix:user:([0-9a-f-]{36})/i);
  return match?.[1] || null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Metodo nao permitido." }, 405);
  }

  try {
    const user = await getAuthenticatedUser(request);
    const profile = await getProfile(user.id);
    const body = await request.json().catch(() => ({})) as { paymentId?: string };
    const paymentId = String(body.paymentId || "").trim();

    let payment: Record<string, unknown> | null = null;
    if (paymentId) {
      payment = await asaasFetch(`/v3/payments/${encodeURIComponent(paymentId)}`);
      const referenceUserId = extractUserIdFromReference(payment.externalReference);
      const sameUserReference = referenceUserId === user.id;
      const sameCustomer = profile.asaas_customer_id && payment.customer === profile.asaas_customer_id;

      if (!sameUserReference && !sameCustomer) {
        throw new Error("Pagamento nao pertence a este usuario.");
      }
    }

    return json({
      paymentStatus: payment?.status || null,
      paymentId: payment?.id || paymentId || null,
      financialAccessActive: isActiveFinancialAccess(profile),
      plan: profile.plano || null,
      subscriptionStatus: profile.subscription_status || null,
      subscriptionEndsAt: profile.subscription_ends_at || profile.plano_expira_em || null
    });
  } catch (error) {
    console.error("asaas-payment-status:", error);
    return json({
      error: error instanceof Error ? error.message : "Erro ao consultar pagamento."
    }, 400);
  }
});
