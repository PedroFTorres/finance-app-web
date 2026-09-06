const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const PLAN_VALUE = 9.90;
const PLAN_DAYS = 30;

type Profile = {
  id: string;
  nome?: string | null;
  cpf?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
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

function onlyDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function isoDatePlusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
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
  if (!response.ok || !user?.id || !user?.email) {
    throw new Error("Sessao invalida. Entre novamente.");
  }
  return user as { id: string; email: string };
}

async function getProfile(userId: string) {
  const rows = await supabaseFetch(
    `/rest/v1/user_profiles?id=eq.${encodeURIComponent(userId)}&select=id,nome,cpf,telefone,whatsapp,asaas_customer_id`
  );
  const profile = Array.isArray(rows) ? rows[0] : null;
  if (!profile) throw new Error("Perfil do usuario nao encontrado.");
  return profile as Profile;
}

async function saveProfileCustomer(userId: string, customerId: string) {
  await supabaseFetch(`/rest/v1/user_profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      asaas_customer_id: customerId,
      subscription_provider: "asaas",
      updated_at: new Date().toISOString()
    })
  });
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

async function ensureAsaasCustomer(profile: Profile, email: string) {
  if (profile.asaas_customer_id) return profile.asaas_customer_id;

  const cpfCnpj = onlyDigits(profile.cpf);
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
    throw new Error("Complete seu CPF/CNPJ no perfil antes de assinar o plano Pro.");
  }

  const phone = onlyDigits(profile.whatsapp || profile.telefone);
  const customer = await asaasFetch("/v3/customers", {
    method: "POST",
    body: JSON.stringify({
      name: profile.nome || email,
      email,
      cpfCnpj,
      mobilePhone: phone || undefined,
      externalReference: `arolix:user:${profile.id}`
    })
  });

  if (!customer?.id) throw new Error("Asaas nao retornou o cliente criado.");
  await saveProfileCustomer(profile.id, customer.id);
  return customer.id as string;
}

async function createPayment(customerId: string, userId: string) {
  const externalReference = `arolix:user:${userId}:plan:pro:${crypto.randomUUID()}`;

  const payment = await asaasFetch("/v3/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: "UNDEFINED",
      value: PLAN_VALUE,
      dueDate: isoDatePlusDays(1),
      description: "Plano Pro Arolix - 30 dias",
      externalReference
    })
  });

  await supabaseFetch("/rest/v1/subscription_events", {
    method: "POST",
    body: JSON.stringify({
      provider: "asaas",
      event_id: externalReference,
      provider_event_id: externalReference,
      event_type: "CHECKOUT_CREATED",
      user_id: userId,
      customer_id: customerId,
      payment_id: payment?.id || null,
      external_reference: externalReference,
      payload: payment || {},
      processed_at: new Date().toISOString()
    })
  });

  return payment;
}

async function recordCheckoutFailure(userId: string | null, customerId: string | null, error: unknown) {
  if (!userId) return;

  const message = error instanceof Error ? error.message : "Erro ao criar pagamento.";
  const eventId = `CHECKOUT_FAILED:${crypto.randomUUID()}`;

  await supabaseFetch("/rest/v1/subscription_events", {
    method: "POST",
    body: JSON.stringify({
      provider: "asaas",
      event_id: eventId,
      provider_event_id: eventId,
      event_type: "CHECKOUT_FAILED",
      user_id: userId,
      customer_id: customerId,
      payload: { message },
      processed_at: new Date().toISOString()
    })
  }).catch((logError) => {
    console.warn("Nao foi possivel registrar falha de checkout:", logError);
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Metodo nao permitido." }, 405);
  }

  let userId: string | null = null;
  let customerId: string | null = null;

  try {
    const user = await getAuthenticatedUser(request);
    userId = user.id;
    const profile = await getProfile(user.id);
    customerId = await ensureAsaasCustomer(profile, user.email);
    const payment = await createPayment(customerId, user.id);

    return json({
      paymentId: payment?.id,
      invoiceUrl: payment?.invoiceUrl || payment?.bankSlipUrl || payment?.paymentLink || null,
      externalReference: payment?.externalReference,
      value: PLAN_VALUE,
      days: PLAN_DAYS
    });
  } catch (error) {
    console.error("asaas-create-checkout:", error);
    await recordCheckoutFailure(userId, customerId, error);
    return json({
      error: error instanceof Error ? error.message : "Erro ao criar pagamento."
    }, 400);
  }
});
