import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, requiredEnv } from "../_shared/http.ts";

const MERCADO_PAGO_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";

type MercadoPagoNotification = {
  type?: string;
  action?: string;
  data?: {
    id?: string | number;
  };
};

function parseSignature(signatureHeader: string) {
  return signatureHeader.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

async function verifyMercadoPagoSignature(req: Request, dataId: string) {
  const secret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
  if (!secret) {
    console.warn("MERCADO_PAGO_WEBHOOK_SECRET not set; skipping signature check.");
    return true;
  }

  const signatureHeader = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const { ts, v1 } = parseSignature(signatureHeader);

  if (!ts || !v1 || !requestId || !dataId) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(manifest),
  );
  const expected = toHex(signature);

  return timingSafeEqual(expected, v1);
}

function getPaymentId(req: Request, body: MercadoPagoNotification) {
  const url = new URL(req.url);
  return String(
    body.data?.id ||
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      "",
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const mercadoPagoAccessToken = requiredEnv("MERCADO_PAGO_ACCESS_TOKEN");
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const supabaseServiceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const expectedPrice = Number(Deno.env.get("PRO_PRICE_BRL") || "19.90");
    const planDays = Number(Deno.env.get("PRO_PLAN_DAYS") || "30");

    const body = (await req.json().catch(() => ({}))) as MercadoPagoNotification;
    const paymentId = getPaymentId(req, body);

    if (!paymentId) {
      return jsonResponse({ received: true, ignored: "missing payment id" });
    }

    const isSignatureValid = await verifyMercadoPagoSignature(req, paymentId);
    if (!isSignatureValid) {
      return jsonResponse({ error: "Invalid webhook signature" }, 401);
    }

    const paymentResponse = await fetch(`${MERCADO_PAGO_PAYMENTS_URL}/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${mercadoPagoAccessToken}`,
      },
    });

    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) {
      console.error("Mercado Pago payment fetch error:", payment);
      return jsonResponse({ error: "Unable to fetch payment" }, 502);
    }

    if (payment.status !== "approved") {
      return jsonResponse({
        received: true,
        payment_id: paymentId,
        status: payment.status,
      });
    }

    const userId = payment.external_reference ||
      payment.metadata?.supabase_user_id ||
      payment.metadata?.user_id;

    if (!userId) {
      console.error("Approved payment without user reference:", paymentId);
      return jsonResponse({ error: "Payment missing user reference" }, 422);
    }

    const paidAmount = Number(payment.transaction_amount || 0);
    if (Math.abs(paidAmount - expectedPrice) > 0.01) {
      console.error("Unexpected payment amount:", { paymentId, paidAmount, expectedPrice });
      return jsonResponse({ error: "Unexpected payment amount" }, 422);
    }

    const approvedAt = payment.date_approved
      ? new Date(payment.date_approved)
      : new Date();
    const paymentEndsAt = addDays(approvedAt, planDays);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("subscription_ends_at, plano_expira_em")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return jsonResponse({ error: "Unable to fetch profile" }, 500);
    }

    const currentEndsAt = profile?.subscription_ends_at || profile?.plano_expira_em;
    const currentEndDate = currentEndsAt ? new Date(currentEndsAt) : null;
    const finalEndsAt =
      currentEndDate && currentEndDate > paymentEndsAt ? currentEndDate : paymentEndsAt;

    const { error: updateError } = await supabaseAdmin
      .from("user_profiles")
      .update({
        plano: "pro",
        subscription_status: "active",
        subscription_ends_at: finalEndsAt.toISOString(),
        plano_expira_em: finalEndsAt.toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Profile update error:", updateError);
      return jsonResponse({ error: "Unable to activate profile" }, 500);
    }

    return jsonResponse({
      received: true,
      payment_id: paymentId,
      user_id: userId,
      plan: "pro",
      subscription_ends_at: finalEndsAt.toISOString(),
    });
  } catch (error) {
    console.error("mercadopago-webhook error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
