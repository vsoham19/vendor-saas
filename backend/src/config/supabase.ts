import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Synchronize workspace credentials
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing core Supabase configuration properties inside backend environment container.');
}

/**
 * Administrative Supabase client instance.
 * Operates with service_role permissions to safely bypass Row-Level Security (RLS)
 * on structural validation sweeps and identity lifecycle routing.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});