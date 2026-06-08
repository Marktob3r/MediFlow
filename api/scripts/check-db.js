import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log("Fetching user_roles...");
  const { data: roles, error: err1 } = await supabase.from('user_roles').select('*');
  console.log("Roles:", roles?.length, "Error:", err1?.message);

  console.log("Fetching staff...");
  const { data: staff, error: err2 } = await supabase.from('staff').select('*');
  console.log("Staff:", staff?.length, "Error:", err2?.message);

  console.log("Fetching auth.users via Admin API...");
  const { data: users, error: err3 } = await supabase.auth.admin.listUsers();
  console.log("Auth Users:", users?.users?.length, "Error:", err3?.message);
}

run();
