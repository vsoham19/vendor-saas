const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  try {
    const { data: customers, error: cErr } = await supabase.from('customers').select('id, name');
    console.log('Customers in DB:', customers, cErr);

    const { data: orders, error: oErr } = await supabase.from('orders').select('id, order_number');
    console.log('Orders in DB:', orders, oErr);

    const { data: appointments, error: aErr } = await supabase.from('appointments').select('id, title');
    console.log('Appointments in DB:', appointments, aErr);
  } catch (err) {
    console.error(err);
  }
}
main();
