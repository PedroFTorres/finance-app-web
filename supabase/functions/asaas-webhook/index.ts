const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
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

function eventId(payload: Record<string, unknown>) {
  const payment = payload.payment as Record<string, unknown> | undefined;
  const subscription = payload.subscription as Record<string, unknown> | undefined;
  const event = String(payload.event || "UNKNOWN");
  const id = payload.id || payload.eventId || payment?.id || subscription?.id;
  if (!id || event === "UNKNOWN") throw new Error("Evento sem identificador ou tipo.");
  return `${event}:${String(id)}`;
}

function paymentPayload(payload: Record<string, unknown>) {
  return (payload.payment || {}) as Record<string, unknown>;
}

function subscriptionPayload(payload: Record<string, unknown>) {
  return (payload.subscription || {}) as Record<string, unknown>;
}

function extractUserIdFromReference(reference: unknown) {
  const match = String(reference || "").match(/arolix:user:([0-9a-f-]{36})/i);
  return match?.[1] || null;
}

async function findUserId(payload: Record<string, unknown>) {
  const payment = paymentPayload(payload);
  const subscription = subscriptionPayload(payload);
  const directUserId = extractUserIdFromReference(payment.externalReference || subscription.externalReference);
  if (directUserId) return directUserId;

  const customerId = String(payment.customer || subscription.customer || "");
  if (!customerId) return null;

  const rows = await supabaseFetch(
    `/rest/v1/user_profiles?asaas_customer_id=eq.${encodeURIComponent(customerId)}&select=id&limit=1`
  );
  return Array.isArray(rows) && rows[0]?.id ? String(rows[0].id) : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Metodo nao permitido." }, 405);
  }

  try {
    const expectedToken = env("ASAAS_WEBHOOK_TOKEN");
    const receivedToken = request.headers.get("asaas-access-token") || request.headers.get("access_token");
    if (!receivedToken || receivedToken !== expectedToken) {
      return json({ error: "Webhook nao autorizado." }, 401);
    }

    const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
    const providerEventId = eventId(payload);
    const userId = await findUserId(payload);
    if (!userId) {
      // Return a failure so the provider can retry after the customer is linked.
      return json({ error: "Usuario do pagamento ainda nao identificado." }, 503);
    }
    const processed = await supabaseFetch("/rest/v1/rpc/arolix_processar_evento_asaas", {
      method: "POST",
      body: JSON.stringify({ p_event_id: providerEventId, p_user_id: userId, p_payload: payload })
    });
    return json({ ok: true, duplicate: processed === false });
  } catch (error) {
    console.error("asaas-webhook:", error);
    return json({
      error: error instanceof Error ? error.message : "Erro ao processar webhook."
    }, 500);
  }
});
