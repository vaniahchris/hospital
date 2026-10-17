import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  currentPassword?: string;
  email?: string;
  password?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Server configuration error" }, 500);
    }

    const body = (await req.json()) as Body;
    const currentPassword = body.currentPassword?.trim() ?? "";
    const nextEmail = body.email?.trim().toLowerCase() ?? "";
    const nextPassword = body.password ?? "";

    if (!currentPassword) {
      return json({ error: "Current password is required." }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user?.email) {
      return json({ error: "Not authenticated." }, 401);
    }

    const emailChanged = !!nextEmail && nextEmail !== user.email.toLowerCase();
    const passwordChanged = !!nextPassword;

    if (!emailChanged && !passwordChanged) {
      return json({ error: "Update your email, password, or both before saving." }, 400);
    }

    if (emailChanged && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return json({ error: "Enter a valid email address." }, 400);
    }

    if (passwordChanged) {
      if (nextPassword.length < 8) {
        return json({ error: "New password must be at least 8 characters." }, 400);
      }
      if (nextPassword === currentPassword) {
        return json({ error: "New password must be different from the current password." }, 400);
      }
    }

    const { error: verifyError } = await userClient.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) {
      return json({ error: "Current password is incorrect." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const updates: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (emailChanged) {
      updates.email = nextEmail;
      updates.email_confirm = true;
    }
    if (passwordChanged) updates.password = nextPassword;

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, updates);
    if (updateError) {
      return json({ error: updateError.message }, 400);
    }

    return json({
      ok: true,
      email: emailChanged ? nextEmail : user.email,
      passwordUpdated: passwordChanged,
      emailUpdated: emailChanged,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return json({ error: message }, 500);
  }
});

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
