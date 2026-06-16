import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, requiredEnv } from "../_shared/http.ts";

const MERCADO_PAGO_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";

type BrickPaymentBody = {
  selected_payment_method?: unknown;
  form_data?: Record<string, unknown>;
  device_session_id?: unknown;
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

function isPixPayment(selectedPaymentMethod: unknown, paymentMethodId: unknown) {
  return (
    String(selectedPaymentMethod || "") === "bank_transfer" &&
    String(paymentMethodId || "") === "pix"
  );
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
    const deviceSessionId = String(body.device_session_id || "").trim();

    if (!isPixPayment(body.selected_payment_method, paymentMethodId)) {
      return jsonResponse({ error: "Only Pix payments are enabled" }, 400);
    }

    const paymentPayload = cleanObject({
      transaction_amount: proPrice,
      description: `Arolix PRO - ${planDays} dias`,
      payment_method_id: "pix",
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
      additional_info: {
        items: [
          {
            id: "arolix-pro-30",
            title: `Arolix PRO - ${planDays} dias`,
            description: `Assinatura Arolix PRO por ${planDays} dias`,
            category_id: "services",
            quantity: 1,
            unit_price: proPrice,
          },
        ],
        payer: {
          first_name: payer.first_name,
          last_name: payer.last_name,
        },
      },
      notification_url: `${functionBaseUrl}/mercadopago-webhook`,
    });

    const paymentResponse = await fetch(MERCADO_PAGO_PAYMENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mercadoPagoAccessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
        ...(deviceSessionId ? { "X-meli-session-id": deviceSessionId } : {}),
      },
      body: JSON.stringify(paymentPayload),
    });

    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) {
      console.error("Mercado Pago Pix payment error:", payment);
      const mercadoPagoMessage = String(payment?.message || "");
      const isPixKeyMissing = mercadoPagoMessage.includes(
        "Collector user without key enabled for QR render",
      );
      const isInvalidCredentials = mercadoPagoMessage
        .toLowerCase()
        .includes("invalid credentials");

      return jsonResponse(
        {
          error: isPixKeyMissing
            ? "PIX_NOT_ENABLED_ON_MERCADO_PAGO_ACCOUNT"
            : isInvalidCredentials
              ? "MERCADO_PAGO_INVALID_CREDENTIALS"
              : "Unable to create Mercado Pago Pix payment",
          message: isPixKeyMissing
            ? "A conta Mercado Pago recebedora ainda nao tem chave Pix habilitada para gerar QR Code."
            : isInvalidCredentials
              ? "Public Key e Access Token do Mercado Pago parecem ser de ambientes ou aplicacoes diferentes."
              : undefined,
          details: payment,
        },
        isPixKeyMissing || isInvalidCredentials ? 400 : 502,
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
