import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const stripeAccountPattern = /^acct_[a-zA-Z0-9]+$/;
export const checkoutSessionPattern = /^cs_test_[a-zA-Z0-9]+$/;
export const clubSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const stripeCallbackPath = "/api/integrations/stripe/callback";
export const stripeReturnPath = "/account#league-payments";

export function stripeSandbox() {
  const key = process.env.RALLORA_STRIPE_SANDBOX_SECRET_KEY;
  const clientId = process.env.RALLORA_STRIPE_SANDBOX_CLIENT_ID;
  const webhookSecret = process.env.RALLORA_STRIPE_SANDBOX_WEBHOOK_SECRET;
  const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origin = process.env.RALLORA_STRIPE_SANDBOX_ORIGIN;
  if (process.env.VERCEL_ENV === "production" || !key?.startsWith("sk_test_")
      || !clientId?.startsWith("ca_") || !webhookSecret?.startsWith("whsec_")
      || !dbUrl || dbUrl !== process.env.RALLORA_STRIPE_SANDBOX_SUPABASE_URL
      || !publicKey || !serviceKey || !origin) return null;

  const url = URL.parse(origin);
  if (!url || url.origin !== origin || /(^|\.)rallora\.app$/i.test(url.hostname)
      || (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost"))) return null;

  const stripe = new Stripe(key, { timeout: 10_000, maxNetworkRetries: 1 });
  const db = createClient(dbUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { stripe, db, dbUrl, publicKey, origin, clientId, webhookSecret };
}

export type StripeSandbox = NonNullable<ReturnType<typeof stripeSandbox>>;

export async function stripeViewer(settings: StripeSandbox) {
  const jar = await cookies();
  const userClient = createServerClient(settings.dbUrl, settings.publicKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: updates => { for (const { name, value, options } of updates) jar.set(name, value, options); },
    },
  });
  const { data, error } = await userClient.auth.getUser();
  return error ? null : data.user;
}

export function stripeReply(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function stripeAuthorisationUrl(settings: StripeSandbox, state: string) {
  const url = new URL("https://connect.stripe.com/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: settings.clientId, response_type: "code", scope: "read_write",
    redirect_uri: settings.origin + stripeCallbackPath, state,
  }).toString();
  return url.href;
}
