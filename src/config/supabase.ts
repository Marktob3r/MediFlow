import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// ============================================================
// DEBUG: Check if environment variables are loaded
// ============================================================
console.log('🔍 Environment Variables Check:');
console.log('  VITE_SUPABASE_URL:', supabaseUrl ? '✅ Loaded' : '❌ MISSING');
console.log('  VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Loaded' : '❌ MISSING');
console.log('  VITE_SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? '✅ Loaded' : '❌ MISSING');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ ERROR: Environment variables are missing!");
  console.error("   Please make sure .env file exists in the root directory with:");
  console.error("   VITE_SUPABASE_URL=your_url");
  console.error("   VITE_SUPABASE_ANON_KEY=your_anon_key");
}

// Regular client for standard operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client with service role key - bypasses RLS
// If service role key is missing, fall back to anon key
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey || supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

console.log('✅ Service Role Key loaded:', !!supabaseServiceRoleKey);

// ============================================================
// ✅ FIXED: Use the correct way to check client status
// ============================================================
console.log('🔑 Supabase Client Created:');
console.log('  URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('  Has Key:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
console.log('  Admin Client Created:', !!supabaseAdmin);
