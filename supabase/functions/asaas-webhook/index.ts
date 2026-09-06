const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const PAID_EVENTS = new Set([
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED"
]);

const PROBLEM_EVENTS = new Set([
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_REFUND_RECEIVED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
  "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
]);

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
  return `${event}:${String(id || crypto.randomUUID())}`;
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

async function insertEvent(payload: Record<string, unknown>, userId: string | null) {
  const payment = paymentPayload(payload);
  const subscription = subscriptionPayload(payload);
  const event = String(payload.event || "UNKNOWN");
  const providerEventId = eventId(payload);

  const rows = await supabaseFetch("/rest/v1/subscription_events?on_conflict=provider,provider_event_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      provider: "asaas",
      event_id: providerEventId,
      provider_event_id: providerEventId,
      event_type: event,
      user_id: userId,
      customer_id: payment.customer || subscription.customer || null,
      payment_id: payment.id || null,
      subscription_id: subscription.id || null,
      external_reference: payment.externalReference || subscription.externalReference || null,
      payload,
      processed_at: new Date().toISOString()
    })
  });

  return Array.isArray(rows) && rows.length > 0;
}

async function activatePro(userId: string, paymentId: unknown, subscriptionId: unknown) {
  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + 30);

  await supabaseFetch(`/rest/v1/user_profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      plano: "pro",
      subscription_status: "active",
      subscription_provider: "asaas",
      subscription_started_at: new Date().toISOString(),
      subscription_ends_at: endsAt.toISOString(),
      plano_expira_em: endsAt.toISOString(),
      asaas_last_payment_id: paymentId || null,
      asaas_subscription_id: subscriptionId || null,
      updated_at: new Date().toISOString()
    })
  });
}

async function markPaymentProblem(userId: string) {
  await supabaseFetch(`/rest/v1/user_profiles?id=eq.${encodeURIComponent(userId)}&plano=eq.pro`, {
    method: "PATCH",
    body: JSON.stringify({
      subscription_status: "past_due",
      updated_at: new Date().toISOString()
    })
  });
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
    const event = String(payload.event || "UNKNOWN");
    const userId = await findUserId(payload);
    const inserted = await insertEvent(payload, userId);

    if (!inserted) {
      return json({ ok: true, duplicate: true });
    }

    if (!userId) {
      console.warn("Webhook Asaas sem usuario relacionado:", payload);
      return json({ ok: true, warning: "usuario_nao_identificado" });
    }

    const payment = paymentPayload(payload);
    const subscription = subscriptionPayload(payload);

    if (PAID_EVENTS.has(event)) {
      await activatePro(userId, payment.id, payment.subscription || subscription.id);
    } else if (PROBLEM_EVENTS.has(event)) {
      await markPaymentProblem(userId);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("asaas-webhook:", error);
    return json({
      error: error instanceof Error ? error.message : "Erro ao processar webhook."
    }, 400);
  }
});
