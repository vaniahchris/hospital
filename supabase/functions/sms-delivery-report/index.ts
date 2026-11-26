import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Africa's Talking SMS delivery reports webhook.
 * Dashboard: SMS → SMS Callback URLs → Delivery Reports
 * URL: https://<project>.supabase.co/functions/v1/sms-delivery-report?token=<AT_DELIVERY_WEBHOOK_SECRET>
 *
 * AT POSTs application/x-www-form-urlencoded with:
 * id, status, phoneNumber, networkCode, optional failureReason
 * Docs: https://developers.africastalking.com/docs/sms/notifications
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FINAL_SUCCESS = new Set(["Success"]);
const FINAL_FAILURE = new Set([
  "Rejected",
  "Failed",
  "AbsentSubscriber",
  "Expired",
]);

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ok() {
  // AT expects a fast 200; body is ignored.
  return new Response("ok", { status: 200, headers: corsHeaders });
}

function messageStatus(sent: number, failed: number, total: number) {
  if (failed === 0) return "sent";
  if (sent === 0) return "failed";
  if (sent + failed < total) return "partial";
  return "partial";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const expected = Deno.env.get("AT_DELIVERY_WEBHOOK_SECRET") ?? "";
    if (!expected) {
      return json(
        {
          error:
            "Delivery webhook is not configured. Set AT_DELIVERY_WEBHOOK_SECRET.",
        },
        503
      );
    }

    const url = new URL(req.url);
    const token =
      url.searchParams.get("token") ??
      req.headers.get("x-webhook-token") ??
      "";
    if (token !== expected) return json({ error: "Unauthorized" }, 401);

    const contentType = req.headers.get("content-type") ?? "";
    let id = "";
    let status = "";
    let phoneNumber = "";
    let failureReason = "";

    if (contentType.includes("application/json")) {
      const body = (await req.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      id = String(body?.id ?? body?.messageId ?? "");
      status = String(body?.status ?? "");
      phoneNumber = String(body?.phoneNumber ?? body?.phone ?? "");
      failureReason = String(body?.failureReason ?? "");
    } else {
      const form = await req.formData();
      id = String(form.get("id") ?? "");
      status = String(form.get("status") ?? "");
      phoneNumber = String(form.get("phoneNumber") ?? "");
      failureReason = String(form.get("failureReason") ?? "");
    }

    if (!id || !status) return ok();

    // Intermediate carrier states — keep API-time "sent" until a final report.
    if (!FINAL_SUCCESS.has(status) && !FINAL_FAILURE.has(status)) {
      return ok();
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: recipient, error: findError } = await admin
      .from("sms_recipients")
      .select("id, message_id, status")
      .eq("provider_message_id", id)
      .maybeSingle();

    if (findError || !recipient) {
      // Unknown id — ignore (unsigned webhook; only act on ids we issued).
      return ok();
    }

    const nextStatus = FINAL_SUCCESS.has(status) ? "sent" : "failed";
    const nextError = FINAL_SUCCESS.has(status)
      ? null
      : failureReason || status;

    if (recipient.status !== nextStatus || nextError) {
      const { error: updateError } = await admin
        .from("sms_recipients")
        .update({
          status: nextStatus,
          error: nextError,
        })
        .eq("id", recipient.id);
      if (updateError) {
        console.error("delivery update failed", updateError.message, {
          id,
          phoneNumber,
          status,
        });
        return json({ error: "Could not update recipient" }, 500);
      }
    }

    const { data: siblings, error: siblingsError } = await admin
      .from("sms_recipients")
      .select("status")
      .eq("message_id", recipient.message_id);

    if (!siblingsError && siblings) {
      const sentCount = siblings.filter((row) => row.status === "sent").length;
      const failedCount = siblings.filter((row) => row.status === "failed").length;
      const total = siblings.length;
      await admin
        .from("sms_messages")
        .update({
          sent_count: sentCount,
          failed_count: failedCount,
          status: messageStatus(sentCount, failedCount, total),
        })
        .eq("id", recipient.message_id);
    }

    return ok();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("delivery webhook error", message);
    return json({ error: message }, 500);
  }
});
