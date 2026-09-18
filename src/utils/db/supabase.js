const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidos no .env para acessar o banco.",
  );
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});

module.exports = supabase;
