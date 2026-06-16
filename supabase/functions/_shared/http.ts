function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getAllowedOrigins() {
  return requiredEnv("APP_ORIGIN")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getCorsOrigin() {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = globalThis.location ? undefined : undefined;

  // Supabase Edge Functions do not expose the Request here, so we use the
  // first configured production origin. Configure APP_ORIGIN with the Arolix
  // production origin first, then optional alternates separated by commas.
  return allowedOrigins[0];
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": getCorsOrigin(),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export { requiredEnv };
