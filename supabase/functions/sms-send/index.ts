import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Kind = "broadcast" | "single" | "feedback_invite";

type Body = {
  action?: "send" | "status";
  kind?: Kind;
  body?: string;
  patientId?: string;
};

const MAX_PARTS = 3;
const BATCH = 500;

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function countParts(text: string): number {
  const gsm =
    /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\r\n]*$/
      .test(text);
  const length = [...text].length;
  if (gsm) return length <= 160 ? 1 : Math.ceil(length / 153);
  return length <= 70 ? 1 : Math.ceil(length / 67);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const atUsername = Deno.env.get("AT_USERNAME") ?? "";
    const atApiKey = Deno.env.get("AT_API_KEY") ?? "";
    const atSender = Deno.env.get("AT_SENDER_ID") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Not authenticated." }, 401);

    const payload = (await req.json()) as Body;
    if (payload.action === "status") {
      return json({ sandbox: atUsername === "sandbox" });
    }
    if (payload.action !== "send") return json({ error: "Unknown action." }, 400);

    if (!atUsername || !atApiKey) {
      return json({ error: "SMS is not configured. Set AT_USERNAME and AT_API_KEY secrets." }, 500);
    }

    const kind = payload.kind;
    const messageBody = (payload.body ?? "").trim();
    if (!kind || !["broadcast", "single", "feedback_invite"].includes(kind)) {
      return json({ error: "Invalid kind." }, 400);
    }
    if (!messageBody) return json({ error: "Message body is required." }, 400);
    if (countParts(messageBody) > MAX_PARTS) {
      return json({ error: "Message exceeds the 3-SMS-part limit." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    type Patient = { id: string; phone: string; do_not_message: boolean };
    let recipients: Patient[] = [];

    if (kind === "single") {
      if (!payload.patientId) return json({ error: "patientId is required for single send." }, 400);
      const { data, error } = await admin
        .from("patients")
        .select("id, phone, do_not_message")
        .eq("id", payload.patientId)
        .maybeSingle();
      if (error || !data) return json({ error: "Patient not found." }, 400);
      if (data.do_not_message) return json({ error: "This patient is marked do not message." }, 400);
      recipients = [data];
    } else {
      const { data, error } = await admin
        .from("patients")
        .select("id, phone, do_not_message")
        .eq("do_not_message", false);
      if (error) return json({ error: error.message }, 400);
      recipients = data ?? [];
    }

    if (!recipients.length) return json({ error: "No recipients to message." }, 400);

    const { data: msg, error: msgError } = await admin
      .from("sms_messages")
      .insert({
        kind,
        body: messageBody,
        recipient_count: recipients.length,
        status: "pending",
        created_by: userData.user.id,
      })
      .select("id")
      .single();
    if (msgError || !msg) return json({ error: msgError?.message ?? "Could not create message." }, 400);

    const host =
      atUsername === "sandbox"
        ? "https://api.sandbox.africastalking.com"
        : "https://api.africastalking.com";

    let sentCount = 0;
    let failedCount = 0;
    const failures: { phone: string; error: string }[] = [];
    const recipientRows: Record<string, unknown>[] = [];

    for (let i = 0; i < recipients.length; i += BATCH) {
      const batch = recipients.slice(i, i + BATCH);
      const form = new URLSearchParams();
      form.set("username", atUsername);
      form.set("to", batch.map((r) => r.phone).join(","));
      form.set("message", messageBody);
      if (atSender) form.set("from", atSender);

      const atRes = await fetch(`${host}/version1/messaging`, {
        method: "POST",
        headers: {
          apiKey: atApiKey,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });

      const atJson = await atRes.json().catch(() => null);
      if (!atRes.ok) {
        const err =
          atJson?.SMSMessageData?.Message ??
          atJson?.message ??
          `Africa's Talking error (${atRes.status})`;
        for (const r of batch) {
          failedCount++;
          failures.push({ phone: r.phone, error: String(err) });
          recipientRows.push({
            message_id: msg.id,
            patient_id: r.id,
            phone: r.phone,
            status: "failed",
            error: String(err),
          });
        }
        continue;
      }

      const recipientsOut = atJson?.SMSMessageData?.Recipients ?? [];
      const byPhone = new Map<string, { statusCode: number; status: string; messageId?: string; cost?: string }>();
      for (const item of recipientsOut) {
        if (item?.number) byPhone.set(String(item.number), item);
      }

      for (const r of batch) {
        const hit = byPhone.get(r.phone);
        const ok = hit && Number(hit.statusCode) === 101;
        if (ok) {
          sentCount++;
          recipientRows.push({
            message_id: msg.id,
            patient_id: r.id,
            phone: r.phone,
            status: "sent",
            provider_message_id: hit?.messageId ?? null,
            cost: hit?.cost ?? null,
          });
        } else {
          failedCount++;
          const err = hit?.status ?? "Delivery rejected";
          failures.push({ phone: r.phone, error: String(err) });
          recipientRows.push({
            message_id: msg.id,
            patient_id: r.id,
            phone: r.phone,
            status: "failed",
            error: String(err),
            provider_message_id: hit?.messageId ?? null,
            cost: hit?.cost ?? null,
          });
        }
      }
    }

    const status =
      failedCount === 0 ? "sent" : sentCount === 0 ? "failed" : "partial";

    await admin.from("sms_recipients").insert(recipientRows);
    await admin
      .from("sms_messages")
      .update({ sent_count: sentCount, failed_count: failedCount, status })
      .eq("id", msg.id);

    return json({
      ok: true,
      messageId: msg.id,
      recipientCount: recipients.length,
      sentCount,
      failedCount,
      status,
      failures: failures.slice(0, 20),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return json({ error: message }, 500);
  }
});
