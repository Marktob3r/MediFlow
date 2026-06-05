import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import path from 'path';

// Load env from the parent directory where .env is stored
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Configure default superadmin details
const ADMIN_EMAIL = process.argv[2] || "director@spdizon-clinic.ph";
// Generate a strong random password if not provided
const ADMIN_PASSWORD = process.argv[3] || Math.random().toString(36).slice(-10) + "A1!";
const ADMIN_FIRST = "System";
const ADMIN_LAST = "Director";

async function createAdmin() {
  console.log("\n🔧 MediFlow Superadmin Account Seeder\n");
  console.log(`Creating superadmin for: ${ADMIN_EMAIL}`);

  // Step 1: Create user via Supabase Admin API
  console.log("1️⃣  Creating auth user...");
  let { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      first_name: ADMIN_FIRST,
      last_name: ADMIN_LAST,
      role: "admin",
    },
  });

  if (authError) {
    if (authError.message.includes("already been registered")) {
      console.log("   ⚠️  User already exists in auth. Fetching existing user...");
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = listData?.users?.find((u) => u.email === ADMIN_EMAIL);
      if (!existing) {
        console.error("   ❌ Could not find existing user. Please delete them in Dashboard and retry.");
        process.exit(1);
      }
      authData = { user: existing };
    } else {
      console.error("   ❌ Auth creation failed:", authError.message);
      process.exit(1);
    }
  }

  const userId = authData.user.id;
  console.log(`   ✅ Auth user ready  (id: ${userId})`);

  // Step 2: Upsert user_profiles
  console.log("2️⃣  Setting up user_profiles...");
  const { error: profileError } = await supabase.from("user_profiles").upsert(
    { user_id: userId, email: ADMIN_EMAIL, first_name: ADMIN_FIRST, last_name: ADMIN_LAST },
    { onConflict: "user_id" }
  );
  if (profileError) console.error("   ⚠️  user_profiles:", profileError.message);
  else console.log("   ✅ user_profiles OK");

  // Step 3: Upsert user_roles → admin
  console.log("3️⃣  Setting role to admin...");
  const { error: roleError } = await supabase.from("user_roles").upsert(
    { user_id: userId, role: "admin" },
    { onConflict: "user_id" }
  );
  if (roleError) console.error("   ⚠️  user_roles:", roleError.message);
  else console.log("   ✅ user_roles = admin");

  // Step 4: Upsert staff record
  console.log("4️⃣  Creating staff record...");
  const { error: staffError } = await supabase.from("staff").upsert(
    { user_id: userId, employee_id: `ADM-${Date.now().toString().slice(-6)}`, department: "Administration", is_active: true },
    { onConflict: "user_id" }
  );
  if (staffError) console.error("   ⚠️  staff:", staffError.message);
  else console.log("   ✅ staff record OK");

  console.log("\n🎉 Superadmin account is ready!");
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Login at: http://localhost:5173/staff/login`);
  console.log(`\n⚠️  IMPORTANT: Please save this password securely and change it upon logging in.\n`);
}

createAdmin();
