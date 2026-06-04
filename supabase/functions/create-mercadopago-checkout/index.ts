import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, requiredEnv } from "../_shared/http.ts";

const MERCADO_PAGO_PREFERENCES_URL =
  "https://api.mercadopago.com/checkout/preferences";

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
    const appBaseUrl = requiredEnv("APP_BASE_URL").replace(/\/$/, "");
    const functionBaseUrl = Deno.env.get("FUNCTION_BASE_URL")?.replace(/\/$/, "") ||
      `${supabaseUrl}/functions/v1`;
    const proPrice = Number(Deno.env.get("PRO_PRICE_BRL") || "19.90");
    const planDays = Number(Deno.env.get("PRO_PLAN_DAYS") || "30");

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
    const successUrl = `${appBaseUrl}/upgrade.html?payment=success`;
    const failureUrl = `${appBaseUrl}/upgrade.html?payment=failure`;
    const pendingUrl = `${appBaseUrl}/upgrade.html?payment=pending`;

    const preference = {
      items: [
        {
          id: "arolix-pro-monthly",
          title: "Arolix PRO - 30 dias",
          description: "Acesso PRO ao Arolix por 30 dias",
          quantity: 1,
          currency_id: "BRL",
          unit_price: proPrice,
        },
      ],
      payer: {
        email: user.email,
      },
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      },
      auto_return: "approved",
      notification_url: `${functionBaseUrl}/mercadopago-webhook`,
      external_reference: user.id,
      metadata: {
        supabase_user_id: user.id,
        plan: "pro",
        plan_days: planDays,
      },
    };

    const mpResponse = await fetch(MERCADO_PAGO_PREFERENCES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mercadoPagoAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    const mpBody = await mpResponse.json();
    if (!mpResponse.ok) {
      console.error("Mercado Pago preference error:", mpBody);
      return jsonResponse(
        { error: "Unable to create Mercado Pago checkout", details: mpBody },
        502,
      );
    }

    return jsonResponse({
      preference_id: mpBody.id,
      init_point: mpBody.init_point,
      sandbox_init_point: mpBody.sandbox_init_point,
    });
  } catch (error) {
    console.error("create-mercadopago-checkout error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
