const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  try {
    console.log('--- Checking Database Triggers ---');
    
    const { data: triggers, error: tErr } = await supabase.rpc('get_triggers');
    
    // If RPC doesn't exist, we can run a direct SQL query via a select, or call pg_catalog.
    // Since Supabase JS client doesn't support raw SQL query execution unless using RPC,
    // let's try to querypg_catalog using a custom query if possible, or try a common view.
    // Wait, the client cannot run raw SQL directly unless we define an RPC function.
    // Let's see if we can query pg_trigger through a common table or if there is another way.
    // Wait, is pg_catalog tables exposed? By default, Supabase does not expose pg_catalog via PostgREST API.
    // But wait! We can inspect the error of the triggers, or check if we can call pg_catalog by exposing it, 
    // or we can write a test query.
    // Wait, let's look at why order_number is null.
    // If order_number is null, it means trg_generate_order_number did NOT run!
    // Why did it not run?
    // Let's check seed_database.sql:
    // CREATE TRIGGER trg_generate_order_number
    // BEFORE INSERT ON orders
    // FOR EACH ROW
    // WHEN (NEW.order_number IS NULL)
    // EXECUTE FUNCTION generate_order_number();
    // 
    // Wait! Let's check if the trigger and its function are in seed_database.sql. Yes.
    // Did the user run seed_database.sql in their Supabase editor?
    // Wait, if they did run seed_database.sql, then the trigger was created.
    // What if they ran seed_database.sql but it failed on some line, so the rest of the file (including triggers) was not executed?
    // Let's check: in seed_database.sql, did the table creation or data insertion fail?
    // Wait! The mock data inserts in seed_database.sql insert hardcoded values like:
    // INSERT INTO vendors (id, name, business_name, ...) VALUES ('d290f1ee-6c54-4b01-90e6-d701748f0851', ...);
    // If RLS was enabled, or if they had some primary key conflicts, the whole transaction might have failed or aborted!
    // And if they ran cleanup_mock_data.sql:
    // In cleanup_mock_data.sql:
    // DELETE FROM customer_measurements;
    // ...
    // It doesn't recreate triggers, it just cleans data and adds columns.
    // Wait, if the triggers were never created because the initial run failed or because they didn't run the seed_database.sql triggers section, then the triggers wouldn't exist!
    
    console.log('Let\'s check if we can query the trigger information using a RPC if it exists.');
    // Let's check if we can fetch trigger info by writing a script that creates a temporary function to list them, or if we can run it.
    // Wait, since we are using service_role, we don't have direct SQL command execution from JS.
    // But we can check if the triggers run by creating a new order programmatically from the script and seeing if it gets a number!
    console.log('\n--- Creating a Test Order to check if triggers run ---');
    const { data: newOrder, error: oErr } = await supabase
      .from('orders')
      .insert([{
        vendor_id: 'be1fcfab-75cb-4825-aaa1-04b6af7f130c',
        customer_id: 'e2459a43-7ecd-4728-96e4-95a044bd6e00',
        description: 'test trigger order',
        total_amount: 5000
      }])
      .select()
      .single();

    if (oErr) {
      console.error('Test order creation failed:', oErr);
    } else {
      console.log('Created Test Order:', newOrder);
      // Let's delete it immediately
      await supabase.from('orders').delete().eq('id', newOrder.id);
    }
  } catch (err) {
    console.error('Script error:', err);
  }
}

run();
