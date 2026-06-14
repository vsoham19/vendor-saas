const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { supabaseAdmin } = require('../dist/src/config/supabase');

async function cleanup() {
  try {
    // Delete from auth.users (which cascades or we delete from staff first)
    const { data: authUsers, error: getErr } = await supabaseAdmin.auth.admin.listUsers();
    if (getErr) throw getErr;

    const testUser = authUsers.users.find(u => u.email === 'soham_assistant@gmail.com');
    if (testUser) {
      console.log('Found test user, deleting staff record first...');
      await supabaseAdmin.from('staff').delete().eq('auth_user_id', testUser.id);
      
      console.log('Deleting auth user...');
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(testUser.id);
      if (delErr) throw delErr;
      console.log('Cleanup successful.');
    } else {
      console.log('No test user found.');
    }
  } catch (err) {
    console.error('Cleanup failed:', err);
  }
}

cleanup();
