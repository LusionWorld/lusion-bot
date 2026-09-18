import { createClient } from "@supabase/supabase-js";

// Client server-side usando a service_role key. NUNCA importar este arquivo
// em código que roda no navegador (client components) — só em Server
// Components / Route Handlers, depois de já ter validado que o usuário logado
// tem permissão de admin na guild consultada (ver lib/discord.ts `canManage`).
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
