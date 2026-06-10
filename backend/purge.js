const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

const mockCustomerIds = [
  'c1100000-0000-0000-0000-000000000001',
  'c1100000-0000-0000-0000-000000000002',
  'c1100000-0000-0000-0000-000000000003',
  'c1100000-0000-0000-0000-000000000004',
  'c1100000-0000-0000-0000-000000000005'
];

const mockOrderIds = [
  'o1100000-0000-0000-0000-000000000001',
  'o1100000-0000-0000-0000-000000000002',
  'o1100000-0000-0000-0000-000000000003',
  'o1100000-0000-0000-0000-000000000004',
  'o1100000-0000-0000-0000-000000000005',
  'o1100000-0000-0000-0000-000000000006'
];

const mockAppointmentIds = [
  'a1100000-0000-0000-0000-000000000001',
  'a1100000-0000-0000-0000-000000000002',
  'a1100000-0000-0000-0000-000000000003'
];

function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

const targetCustomerIds = mockCustomerIds.filter(isValidUUID);
const targetOrderIds = mockOrderIds.filter(isValidUUID);
const targetAppointmentIds = mockAppointmentIds.filter(isValidUUID);

async function getMockDataDetails() {
  const details = {
    customers: [],
    orders: [],
    appointments: [],
    payments: [],
    orderItems: [],
    customerMeasurements: []
  };

  // Customers
  if (targetCustomerIds.length > 0) {
    const { data: custData, error: errCust } = await supabase
      .from('customers')
      .select('id')
      .in('id', targetCustomerIds);
    if (errCust) throw errCust;
    details.customers = (custData || []).map(c => c.id);
  }

  // Orders
  const orderIdsSet = new Set();
  if (targetCustomerIds.length > 0) {
    const { data: ordCustData, error: errOrdCust } = await supabase
      .from('orders')
      .select('id')
      .in('customer_id', targetCustomerIds);
    if (errOrdCust) throw errOrdCust;
    (ordCustData || []).forEach(o => orderIdsSet.add(o.id));
  }
  if (targetOrderIds.length > 0) {
    const { data: ordIdData, error: errOrdId } = await supabase
      .from('orders')
      .select('id')
      .in('id', targetOrderIds);
    if (errOrdId) throw errOrdId;
    (ordIdData || []).forEach(o => orderIdsSet.add(o.id));
  }
  details.orders = Array.from(orderIdsSet);

  // Appointments
  const apptIdsSet = new Set();
  if (targetCustomerIds.length > 0) {
    const { data: apptCustData, error: errApptCust } = await supabase
      .from('appointments')
      .select('id')
      .in('customer_id', targetCustomerIds);
    if (errApptCust) throw errApptCust;
    (apptCustData || []).forEach(a => apptIdsSet.add(a.id));
  }
  if (details.orders.length > 0) {
    const { data: apptOrdData, error: errApptOrd } = await supabase
      .from('appointments')
      .select('id')
      .in('order_id', details.orders);
    if (errApptOrd) throw errApptOrd;
    (apptOrdData || []).forEach(a => apptIdsSet.add(a.id));
  }
  if (targetAppointmentIds.length > 0) {
    const { data: apptIdData, error: errApptId } = await supabase
      .from('appointments')
      .select('id')
      .in('id', targetAppointmentIds);
    if (errApptId) throw errApptId;
    (apptIdData || []).forEach(a => apptIdsSet.add(a.id));
  }
  details.appointments = Array.from(apptIdsSet);

  // Payments
  const payIdsSet = new Set();
  if (targetCustomerIds.length > 0) {
    const { data: payCustData, error: errPayCust } = await supabase
      .from('payments')
      .select('id')
      .in('customer_id', targetCustomerIds);
    if (errPayCust) throw errPayCust;
    (payCustData || []).forEach(p => payIdsSet.add(p.id));
  }
  if (details.orders.length > 0) {
    const { data: payOrdData, error: errPayOrd } = await supabase
      .from('payments')
      .select('id')
      .in('order_id', details.orders);
    if (errPayOrd) throw errPayOrd;
    (payOrdData || []).forEach(p => payIdsSet.add(p.id));
  }
  details.payments = Array.from(payIdsSet);

  // Order Items
  if (details.orders.length > 0) {
    const { data: itemsData, error: errItems } = await supabase
      .from('order_items')
      .select('id')
      .in('order_id', details.orders);
    if (errItems) throw errItems;
    details.orderItems = (itemsData || []).map(i => i.id);
  }

  // Customer Measurements
  if (targetCustomerIds.length > 0) {
    const { data: measData, error: errMeas } = await supabase
      .from('customer_measurements')
      .select('id')
      .in('customer_id', targetCustomerIds);
    if (errMeas) throw errMeas;
    details.customerMeasurements = (measData || []).map(m => m.id);
  }

  return details;
}

async function main() {
  console.log('--- Database Pre-purge Check ---');
  try {
    const preDetails = await getMockDataDetails();
    console.log('Pre-purge Mock Record Counts:', {
      mockCustomers: preDetails.customers.length,
      mockOrders: preDetails.orders.length,
      mockAppointments: preDetails.appointments.length,
      mockPayments: preDetails.payments.length,
      mockOrderItems: preDetails.orderItems.length,
      mockCustomerMeasurements: preDetails.customerMeasurements.length
    });

    console.log('\n--- Purging Mock Records in logical sequence ---');

    // 1. Delete payments
    console.log(`Deleting ${preDetails.payments.length} mock payments...`);
    if (preDetails.payments.length > 0) {
      const { error: delPayErr } = await supabase
        .from('payments')
        .delete()
        .in('id', preDetails.payments);
      if (delPayErr) throw delPayErr;
    }

    // 2. Delete order items
    console.log(`Deleting ${preDetails.orderItems.length} mock order items...`);
    if (preDetails.orderItems.length > 0) {
      const { error: delItemsErr } = await supabase
        .from('order_items')
        .delete()
        .in('id', preDetails.orderItems);
      if (delItemsErr) throw delItemsErr;
    }

    // 3. Delete appointments
    console.log(`Deleting ${preDetails.appointments.length} mock appointments...`);
    if (preDetails.appointments.length > 0) {
      const { error: delApptErr } = await supabase
        .from('appointments')
        .delete()
        .in('id', preDetails.appointments);
      if (delApptErr) throw delApptErr;
    }

    // 4. Delete customer measurements
    console.log(`Deleting ${preDetails.customerMeasurements.length} mock customer measurements...`);
    if (preDetails.customerMeasurements.length > 0) {
      const { error: delMeasErr } = await supabase
        .from('customer_measurements')
        .delete()
        .in('id', preDetails.customerMeasurements);
      if (delMeasErr) throw delMeasErr;
    }

    // 5. Delete orders
    console.log(`Deleting ${preDetails.orders.length} mock orders...`);
    if (preDetails.orders.length > 0) {
      const { error: delOrdErr } = await supabase
        .from('orders')
        .delete()
        .in('id', preDetails.orders);
      if (delOrdErr) throw delOrdErr;
    }

    // 6. Delete customers
    console.log(`Deleting ${preDetails.customers.length} mock customers...`);
    if (preDetails.customers.length > 0) {
      const { error: delCustErr } = await supabase
        .from('customers')
        .delete()
        .in('id', preDetails.customers);
      if (delCustErr) throw delCustErr;
    }

    console.log('\n--- Database Post-purge Check ---');
    const postDetails = await getMockDataDetails();
    console.log('Post-purge Mock Record Counts:', {
      mockCustomers: postDetails.customers.length,
      mockOrders: postDetails.orders.length,
      mockAppointments: postDetails.appointments.length,
      mockPayments: postDetails.payments.length,
      mockOrderItems: postDetails.orderItems.length,
      mockCustomerMeasurements: postDetails.customerMeasurements.length
    });

    const postCounts = [
      postDetails.customers.length,
      postDetails.orders.length,
      postDetails.appointments.length,
      postDetails.payments.length,
      postDetails.orderItems.length,
      postDetails.customerMeasurements.length
    ];

    const allZero = postCounts.every(count => count === 0);
    if (allZero) {
      console.log('\nSUCCESS: All mock records successfully wiped!');
    } else {
      console.error('\nFAILURE: Some mock records could not be wiped.');
      process.exit(1);
    }

    // Verify critical data preservation
    console.log('\n--- Critical Data Preservation Checks ---');
    const { count: vendorCount, error: vErr } = await supabase
      .from('vendors')
      .select('*', { count: 'exact', head: true })
      .eq('id', 'd290f1ee-6c54-4b01-90e6-d701748f0851');
    if (vErr) throw vErr;
    console.log(`Vendor d290f1ee-6c54-4b01-90e6-d701748f0851 count: ${vendorCount} (Expected: 1)`);

    const { count: staffCount, error: sErr } = await supabase
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .eq('id', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d');
    if (sErr) throw sErr;
    console.log(`Staff a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d count: ${staffCount} (Expected: 1)`);

    if (vendorCount === 1 && staffCount === 1) {
      console.log('SUCCESS: Primary tenant and admin staff account are intact.');
    } else {
      console.error('WARNING: Primary tenant or admin staff account might be compromised!');
      process.exit(1);
    }
  } catch (error) {
    console.error('An error occurred during the purge process:', error);
    process.exit(1);
  }
}

main();
