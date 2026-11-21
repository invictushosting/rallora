import { createClient } from "@supabase/supabase-js";
import { twilioSignatureMatches, whatsappCommand, whatsappConfig } from "@/lib/whatsapp";

export async function POST(request: Request) {
  const config = whatsappConfig();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !url || !key) return new Response(null, { status: 503 });
  const signature = request.headers.get("x-twilio-signature");
  if (!signature || !request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
    return new Response(null, { status: 403 });
  }
  const input = new URLSearchParams(await request.text());
  if (!twilioSignatureMatches(config.webhookUrl, input, config.authToken, signature)) {
    return new Response(null, { status: 403 });
  }
  const action = whatsappCommand(input, config.account, config.sender);
  if (action) {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await db.rpc("rallora_whatsapp_inbound", {
      p_sid: action.sid, p_phone: action.phone, p_command: action.command,
    });
    if (error) return new Response(null, { status: 503 });
  }
  return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
}
