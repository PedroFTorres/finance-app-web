import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, requiredEnv } from "../_shared/http.ts";

const MERCADO_PAGO_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";

type CheckPaymentBody = {
  payment_id?: unknown;
};

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
    const mercadoPagoAccessToken = requiredEnv("MERCADO_PAGO_ACCESS_TOKEN");

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

    const body = (await req.json().catch(() => ({}))) as CheckPaymentBody;
    const paymentId = String(body.payment_id || "").trim();

    if (!paymentId) {
      return jsonResponse({ error: "Missing payment id" }, 400);
    }

    const paymentResponse = await fetch(`${MERCADO_PAGO_PAYMENTS_URL}/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${mercadoPagoAccessToken}`,
      },
    });

    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) {
      console.error("Mercado Pago payment status error:", payment);
      return jsonResponse({ error: "Unable to fetch payment status" }, 502);
    }

    const user = userData.user;
    const paymentUserId = payment.external_reference ||
      payment.metadata?.supabase_user_id ||
      payment.metadata?.user_id;

    if (paymentUserId !== user.id) {
      return jsonResponse({ error: "Payment does not belong to current user" }, 403);
    }

    return jsonResponse({
      payment_id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      payment_method_id: payment.payment_method_id,
      payment_type_id: payment.payment_type_id,
    });
  } catch (error) {
    console.error("check-mercadopago-payment error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
