const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  try {
    console.log('--- Checking Vendors ---');
    const { data: vendors, error: vErr } = await supabase.from('vendors').select('*');
    if (vErr) console.error('Vendor error:', vErr);
    else console.log('Vendors in DB:', vendors);

    console.log('\n--- Checking Staff ---');
    const { data: staff, error: sErr } = await supabase.from('staff').select('*');
    if (sErr) console.error('Staff error:', sErr);
    else console.log('Staff in DB:', staff);

    if (vendors && vendors.length > 0) {
      const vendorId = vendors[0].id;
      console.log(`\n--- Running Analytics queries for Vendor ID: ${vendorId} ---`);

      const [ordersRes, paymentsRes, customersRes, appointmentsRes, orderItemsRes] = await Promise.all([
        supabase.from('orders').select('*').eq('vendor_id', vendorId),
        supabase.from('payments').select('*, customers!inner(vendor_id)').eq('customers.vendor_id', vendorId),
        supabase.from('customers').select('*').eq('vendor_id', vendorId),
        supabase.from('appointments').select('*').eq('vendor_id', vendorId),
        supabase.from('order_items').select('*, orders!inner(vendor_id)').eq('orders.vendor_id', vendorId)
      ]);

      console.log('\nOrders query result:', {
        dataLength: ordersRes.data?.length,
        error: ordersRes.error,
        data: ordersRes.data
      });

      console.log('\nPayments query result:', {
        dataLength: paymentsRes.data?.length,
        error: paymentsRes.error,
        data: paymentsRes.data
      });

      console.log('\nCustomers query result:', {
        dataLength: customersRes.data?.length,
        error: customersRes.error,
        data: customersRes.data
      });

      console.log('\nAppointments query result:', {
        dataLength: appointmentsRes.data?.length,
        error: appointmentsRes.error,
        data: appointmentsRes.data
      });

      console.log('\nOrder Items query result:', {
        dataLength: orderItemsRes.data?.length,
        error: orderItemsRes.error,
        data: orderItemsRes.data
      });
    } else {
      console.log('No vendors found to run analytics queries for.');
    }
  } catch (err) {
    console.error('Unhandled script error:', err);
  }
}

run();
