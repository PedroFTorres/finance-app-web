import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, requiredEnv } from "../_shared/http.ts";

const MERCADO_PAGO_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";

type BrickPaymentBody = {
  selected_payment_method?: unknown;
  form_data?: Record<string, unknown>;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function cleanObject<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cleanObject(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce(
      (acc, [key, item]) => {
        if (item === undefined || item === null || item === "") return acc;
        const cleaned = cleanObject(item);
        if (
          cleaned &&
          typeof cleaned === "object" &&
          !Array.isArray(cleaned) &&
          Object.keys(cleaned).length === 0
        ) {
          return acc;
        }
        acc[key] = cleaned;
        return acc;
      },
      {} as Record<string, unknown>,
    ) as T;
  }

  return value;
}

function toNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const supabaseAnonKey = requiredEnv("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const mercadoPagoAccessToken = requiredEnv("MERCADO_PAGO_ACCESS_TOKEN");
    const functionBaseUrl = Deno.env.get("FUNCTION_BASE_URL")?.replace(/\/$/, "") ||
      `${supabaseUrl}/functions/v1`;
    const proPrice = Number(Deno.env.get("PRO_PRICE_BRL") || "19.90");
    const planDays = Number(Deno.env.get("PRO_PLAN_DAYS") || "30");

    if (!Number.isFinite(proPrice) || proPrice <= 0) {
      return jsonResponse({ error: "Invalid PRO price" }, 500);
    }

    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.toLowerCase().startsWith("bearer ")) {
      return jsonResponse({ error: "Missing Authorization bearer token" }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: "Invalid session" }, 401);
    }

    const user = userData.user;
    const body = (await req.json().catch(() => ({}))) as BrickPaymentBody;
    const formData = body.form_data || {};
    const payer = (formData.payer || {}) as Record<string, unknown>;
    const paymentMethodId = String(formData.payment_method_id || "");
    const isCardPayment = Boolean(formData.token);

    if (!paymentMethodId) {
      return jsonResponse({ error: "Missing payment method" }, 400);
    }

    const paymentPayload = cleanObject({
      transaction_amount: proPrice,
      description: `Arolix PRO - ${planDays} dias`,
      payment_method_id: paymentMethodId,
      payer: {
        email: payer.email || user.email,
        first_name: payer.first_name,
        last_name: payer.last_name,
        identification: payer.identification,
      },
      external_reference: user.id,
      metadata: {
        supabase_user_id: user.id,
        plan: "pro",
        plan_days: planDays,
      },
      notification_url: `${functionBaseUrl}/mercadopago-webhook`,
      ...(isCardPayment
        ? {
          token: formData.token,
          installments: toNumber(formData.installments, 1),
          issuer_id: formData.issuer_id,
        }
        : {}),
    });

    const paymentResponse = await fetch(MERCADO_PAGO_PAYMENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mercadoPagoAccessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(paymentPayload),
    });

    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) {
      console.error("Mercado Pago payment error:", payment);
      return jsonResponse(
        { error: "Unable to create Mercado Pago payment", details: payment },
        502,
      );
    }

    if (payment.status === "approved") {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
      const approvedAt = payment.date_approved
        ? new Date(payment.date_approved)
        : new Date();
      const endsAt = addDays(approvedAt, planDays);

      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("plano, subscription_ends_at, plano_expira_em")
        .eq("id", user.id)
        .maybeSingle();

      const currentEndsAt = profile?.subscription_ends_at || profile?.plano_expira_em;
      const currentEndDate = currentEndsAt ? new Date(currentEndsAt) : null;
      const finalEndsAt = currentEndDate && currentEndDate > endsAt
        ? currentEndDate
        : endsAt;
      const nextPlan = profile?.plano === "vip" ? "vip" : "pro";

      const { error: updateError } = await supabaseAdmin
        .from("user_profiles")
        .update({
          plano: nextPlan,
          subscription_status: "active",
          subscription_ends_at: finalEndsAt.toISOString(),
          plano_expira_em: finalEndsAt.toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Profile activation error:", updateError);
        return jsonResponse({ error: "Payment approved but profile update failed" }, 500);
      }
    }

    return jsonResponse({
      payment_id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      payment,
    });
  } catch (error) {
    console.error("process-mercadopago-payment error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
