const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  try {
    console.log('=== SEEDING NEW STORE: Sanskriti Couture ===');

    // 1. Reset existing store data if it exists
    const { data: existingVendor } = await supabase
      .from('vendors')
      .select('id')
      .eq('business_name', 'Sanskriti Couture');
      
    if (existingVendor && existingVendor.length > 0) {
      console.log('Cleaning up existing Sanskriti Couture vendor data...');
      await supabase.from('vendors').delete().eq('id', existingVendor[0].id);
    }

    // Reset Auth Users if they exist
    const { data: authUsers, error: listUsersErr } = await supabase.auth.admin.listUsers();
    if (listUsersErr) throw listUsersErr;

    const emailsToDelete = ['sanskriti@gmail.com', 'sanskriti_assistant@gmail.com'];
    for (const email of emailsToDelete) {
      const existingUser = authUsers.users.find(u => u.email === email);
      if (existingUser) {
        console.log(`Cleaning up existing auth user: ${email}...`);
        await supabase.from('staff').delete().eq('auth_user_id', existingUser.id);
        await supabase.auth.admin.deleteUser(existingUser.id);
      }
    }

    // 2. Create Vendor Store
    console.log('Creating Sanskriti Couture vendor profile...');
    const { data: vendor, error: vErr } = await supabase
      .from('vendors')
      .insert([{
        name: 'Sanskriti Couture',
        business_name: 'Sanskriti Couture',
        address: '102, Zari Palace, Ring Road, Surat, Gujarat',
        description: 'Bespoke bridal lehengas, handwoven silk sarees, and designer blouses.'
      }])
      .select()
      .single();

    if (vErr) throw vErr;
    console.log('Vendor created:', vendor.id);

    // 3. Create Auth Users and Staff Members
    console.log('Creating Sanskriti Couture owner auth user (sanskriti@gmail.com)...');
    const { data: ownerAuth, error: ownerAuthErr } = await supabase.auth.admin.createUser({
      email: 'sanskriti@gmail.com',
      password: 'password123',
      email_confirm: true
    });
    if (ownerAuthErr) throw ownerAuthErr;

    console.log('Creating Sanskriti Couture owner staff record...');
    const { error: ownerStaffErr } = await supabase
      .from('staff')
      .insert([{
        vendor_id: vendor.id,
        auth_user_id: ownerAuth.user.id,
        name: 'Sanskriti Shah',
        full_name: 'Sanskriti Shah',
        email: 'sanskriti@gmail.com',
        role: 'owner',
        is_active: true
      }]);
    if (ownerStaffErr) throw ownerStaffErr;

    console.log('Creating Sanskriti Couture assistant auth user (sanskriti_assistant@gmail.com)...');
    const { data: asstAuth, error: asstAuthErr } = await supabase.auth.admin.createUser({
      email: 'sanskriti_assistant@gmail.com',
      password: 'password123',
      email_confirm: true
    });
    if (asstAuthErr) throw asstAuthErr;

    console.log('Creating Sanskriti Couture assistant staff record...');
    const { error: asstStaffErr } = await supabase
      .from('staff')
      .insert([{
        vendor_id: vendor.id,
        auth_user_id: asstAuth.user.id,
        name: 'Amit Patel',
        full_name: 'Amit Patel',
        email: 'sanskriti_assistant@gmail.com',
        role: 'assistant',
        is_active: true
      }]);
    if (asstStaffErr) throw asstStaffErr;

    // 4. Create Custom Measurement Field Templates (Settings)
    console.log('Creating measurement field templates...');
    const fieldsToInsert = [
      { field_name: 'Bust', display_order: 1 },
      { field_name: 'Underbust', display_order: 2 },
      { field_name: 'Waist', display_order: 3 },
      { field_name: 'Hip', display_order: 4 },
      { field_name: 'Shoulder Width', display_order: 5 },
      { field_name: 'Blouse Length', display_order: 6 },
      { field_name: 'Sleeve Length', display_order: 7 },
      { field_name: 'Lehenga Length', display_order: 8 },
      { field_name: 'Front Neck Depth', display_order: 9 },
      { field_name: 'Back Neck Depth', display_order: 10 }
    ].map(f => ({ ...f, vendor_id: vendor.id, unit: 'inches', is_active: true }));

    const { error: fErr } = await supabase.from('measurement_field_templates').insert(fieldsToInsert);
    if (fErr) throw fErr;

    // 5. Create 10 Customers
    console.log('Creating customers...');
    const customerList = [
      { name: 'Priya Sharma', phone: '9876543210', email: 'priya@gmail.com', address: 'B-402, Shivam Heights, Surat' },
      { name: 'Anjali Mehta', phone: '9823456789', email: 'anjali@gmail.com', address: '12, Gokul Row House, Surat' },
      { name: 'Pooja Patel', phone: '9123456780', email: 'pooja@gmail.com', address: 'Flat 5A, Zari Tower, Surat' },
      { name: 'Deepika Rao', phone: '9345678901', email: 'deepika@gmail.com', address: '45, Silk Colony, Surat' },
      { name: 'Kiran Desai', phone: '9456789012', email: 'kiran@gmail.com', address: 'A-10, Garden Apartments, Surat' },
      { name: 'Shruti Iyer', phone: '9567890123', email: 'shruti@gmail.com', address: '78, Temple Road, Surat' },
      { name: 'Ritu Verma', phone: '9678901234', email: 'ritu@gmail.com', address: 'Plot 405, VIP Road, Surat' },
      { name: 'Sneha Gupta', phone: '9789012345', email: 'sneha@gmail.com', address: '501, Raj Palace, Surat' },
      { name: 'Meera Sen', phone: '9890123456', email: 'meera@gmail.com', address: '18, Diamond Park, Surat' },
      { name: 'Neha Nair', phone: '9901234567', email: 'neha@gmail.com', address: 'C-302, Green Avenue, Surat' }
    ].map(c => ({ ...c, full_name: c.name, vendor_id: vendor.id }));

    const { data: customers, error: cErr } = await supabase
      .from('customers')
      .insert(customerList)
      .select();

    if (cErr) throw cErr;
    console.log(`Created ${customers.length} customers.`);

    // 6. Create Customer Measurements Snapshots
    console.log('Seeding customer measurement records...');
    const measurementsToInsert = [];
    customers.forEach(cust => {
      // Lehenga Measurements
      measurementsToInsert.push({
        customer_id: cust.id,
        label: 'Lehenga Measurements',
        values: {
          'Waist': (26 + Math.floor(Math.random() * 8)).toString(),
          'Hip': (34 + Math.floor(Math.random() * 8)).toString(),
          'Lehenga Length': (38 + Math.floor(Math.random() * 5)).toString()
        },
        notes: 'Needs heavy latkans on waist tie.'
      });

      // Blouse Measurements
      measurementsToInsert.push({
        customer_id: cust.id,
        label: 'Saree Blouse Measurements',
        values: {
          'Bust': (32 + Math.floor(Math.random() * 8)).toString(),
          'Underbust': (28 + Math.floor(Math.random() * 6)).toString(),
          'Shoulder Width': (14 + Math.floor(Math.random() * 2)).toString(),
          'Blouse Length': (13 + Math.random() * 2).toFixed(1),
          'Sleeve Length': (10 + Math.floor(Math.random() * 6)).toString(),
          'Front Neck Depth': (7 + Math.random() * 1.5).toFixed(1),
          'Back Neck Depth': (8 + Math.floor(Math.random() * 4)).toString()
        },
        notes: 'Padded blouse, deep back neck with dori.'
      });
    });

    const { error: mErr } = await supabase.from('customer_measurements').insert(measurementsToInsert);
    if (mErr) throw mErr;

    // 7. Seed 18 Orders and Payments
    console.log('Seeding orders, items, and payments...');
    const orderPlans = [
      { cIdx: 0, desc: 'Bridal Crimson Lehenga', items: [{ name: 'Crimson Velvet Lehenga', price: 45000 }], paid: 20000, status: 'in_progress', delivery: 26 }, // June 2026 dates
      { cIdx: 0, desc: 'Banarasi Georgette Saree Blouse', items: [{ name: 'Georgette Designer Blouse', price: 3500 }], paid: 3500, status: 'delivered', delivery: 15 },
      { cIdx: 1, desc: 'Emerald Green Silk Lehenga Set', items: [{ name: 'Emerald Silk Lehenga', price: 32000 }], paid: 15000, status: 'in_progress', delivery: 28 },
      { cIdx: 1, desc: 'Raw Silk Hand-embroidered Blouse', items: [{ name: 'Raw Silk Blouse', price: 4500 }], paid: 0, status: 'pending', delivery: 22 },
      { cIdx: 2, desc: 'Pastel Pink Net Lehenga', items: [{ name: 'Net Lehenga', price: 28000 }], paid: 10000, status: 'in_progress', delivery: 29 },
      { cIdx: 2, desc: 'Kanjivaram Saree Blouse with Zari', items: [{ name: 'Zari Border Blouse', price: 4000 }], paid: 4000, status: 'delivered', delivery: 12 },
      { cIdx: 3, desc: 'Royal Blue Velvet Lehenga', items: [{ name: 'Velvet Lehenga', price: 38000 }], paid: 20000, status: 'ready', delivery: 19 },
      { cIdx: 4, desc: 'Peach Organza Saree Blouse', items: [{ name: 'Organza Blouse', price: 3200 }], paid: 1500, status: 'pending', delivery: 24 },
      { cIdx: 5, desc: 'Golden Brocade Lehenga Blouse', items: [{ name: 'Brocade Blouse', price: 5500 }], paid: 5500, status: 'delivered', delivery: 10 },
      { cIdx: 5, desc: 'Classic Red Banarasi Saree', items: [{ name: 'Banarasi Silk Saree', price: 18000 }], paid: 10000, status: 'in_progress', delivery: 27 },
      { cIdx: 6, desc: 'Handpainted Kalamkari Lehenga Set', items: [{ name: 'Kalamkari Lehenga', price: 22000 }], paid: 10000, status: 'in_progress', delivery: 25 },
      { cIdx: 7, desc: 'Heavy Mirror Work Lehenga', items: [{ name: 'Mirror Work Lehenga', price: 35000 }], paid: 15000, status: 'ready', delivery: 26 },
      { cIdx: 8, desc: 'White Chikankari Lehenga Set', items: [{ name: 'Chikankari Lehenga', price: 24000 }], paid: 12000, status: 'in_progress', delivery: 20 },
      { cIdx: 9, desc: 'Magenta Silk Saree Blouse', items: [{ name: 'Silk Blouse', price: 3800 }], paid: 3800, status: 'delivered', delivery: 11 },
      { cIdx: 0, desc: 'Gold Tissue Saree Blouse', items: [{ name: 'Tissue Blouse', price: 4200 }], paid: 0, status: 'pending', delivery: 23 },
      { cIdx: 1, desc: 'Yellow Mehendi Lehenga', items: [{ name: 'Mehendi Lehenga', price: 18000 }], paid: 9000, status: 'in_progress', delivery: 24 },
      { cIdx: 3, desc: 'Tussar Silk Blouse', items: [{ name: 'Tussar Blouse', price: 3000 }], paid: 3000, status: 'delivered', delivery: 14 },
      { cIdx: 6, desc: 'Cocktail Net Saree Blouse', items: [{ name: 'Net Blouse', price: 12000 }], paid: 6000, status: 'in_progress', delivery: 25 }
    ];

    for (const plan of orderPlans) {
      const customer = customers[plan.cIdx];
      const deliveryDate = new Date(2026, 5, plan.delivery).toISOString(); // June 2026

      const { data: ord, error: ordErr } = await supabase
        .from('orders')
        .insert([{
          vendor_id: vendor.id,
          customer_id: customer.id,
          description: plan.desc,
          total_amount: plan.items.reduce((sum, i) => sum + i.price, 0),
          amount_paid: 0, // Will be updated by payments trigger/repair
          amount_outstanding: 0,
          delivery_date: deliveryDate,
          status: plan.status,
          created_at: new Date(2026, 5, plan.delivery - 5).toISOString() // Created 5 days before delivery
        }])
        .select()
        .single();

      if (ordErr) throw ordErr;

      // Insert Items
      const itemsToInsert = plan.items.map(item => ({
        order_id: ord.id,
        item_name: item.name,
        quantity: 1,
        unit_price: item.price,
        total_price: item.price
      }));
      await supabase.from('order_items').insert(itemsToInsert);

      // Insert Payments if paid > 0
      if (plan.paid > 0) {
        await supabase
          .from('payments')
          .insert([{
            order_id: ord.id,
            customer_id: customer.id,
            amount: plan.paid,
            payment_mode: 'UPI',
            reference_note: 'Advance collection',
            paid_at: new Date(2026, 5, plan.delivery - 5).toISOString(),
            created_at: new Date(2026, 5, plan.delivery - 5).toISOString()
          }]);
      }
    }
    console.log('Orders, items, and payments successfully seeded.');

    // 8. Seed 10 Appointments
    console.log('Seeding appointments...');
    const appointmentPlans = [
      { cIdx: 0, title: 'Bridal Lehenga Fabric Selection', day: 15, slot: '10 AM', status: 'completed' },
      { cIdx: 1, title: 'Mehendi Lehenga First Trial', day: 16, slot: '12 PM', status: 'scheduled' },
      { cIdx: 2, title: 'Saree Blouse Measurements & Fitting', day: 17, slot: '2 PM', status: 'scheduled' },
      { cIdx: 3, title: 'Velvet Lehenga Design Discussion', day: 18, slot: '4 PM', status: 'scheduled' },
      { cIdx: 4, title: 'Blouse Fitting & Adjustment', day: 19, slot: '11 AM', status: 'scheduled' },
      { cIdx: 5, title: 'Banarasi Lehenga Trial & Delivery', day: 20, slot: '10 AM', status: 'completed' },
      { cIdx: 6, title: 'Bridal Lehenga Embroidery Check', day: 21, slot: '3 PM', status: 'scheduled' },
      { cIdx: 7, title: 'Mirror Work Lehenga Measurement Session', day: 22, slot: '12 PM', status: 'scheduled' },
      { cIdx: 8, title: 'Chikankari Lehenga Fit Consultation', day: 23, slot: '2 PM', status: 'scheduled' },
      { cIdx: 9, title: 'Saree Blouse Final Fitting & Delivery', day: 24, slot: '4 PM', status: 'completed' }
    ];

    const appointmentsToInsert = appointmentPlans.map(plan => ({
      vendor_id: vendor.id,
      customer_id: customers[plan.cIdx].id,
      title: plan.title,
      appointment_type: 'walk_in',
      scheduled_date: new Date(2026, 5, plan.day, 10, 0, 0).toISOString(),
      time_slot: plan.slot,
      status: plan.status,
      notes: 'Bridal atelier premium consultation slot.'
    }));

    const { error: apptErr } = await supabase.from('appointments').insert(appointmentsToInsert);
    if (apptErr) throw apptErr;
    console.log('Appointments successfully seeded.');

    // 9. Run database trigger repair sequence to sync outstanding totals and generate order numbers!
    console.log('Running data repair calculations script to sync order numbers and outstanding totals...');
    
    // A. Generate Order Numbers
    const { data: nullOrders } = await supabase
      .from('orders')
      .select('id, created_at')
      .is('order_number', null)
      .order('created_at', { ascending: true });

    if (nullOrders && nullOrders.length > 0) {
      for (let idx = 0; idx < nullOrders.length; idx++) {
        const o = nullOrders[idx];
        const dateStr = new Date(o.created_at).toISOString().substring(0, 7).replace('-', ''); // YYYYMM
        const seq = (idx + 1).toString().padStart(4, '0');
        const orderNum = `ORD-${dateStr}-${seq}`;
        await supabase.from('orders').update({ order_number: orderNum }).eq('id', o.id);
      }
    }

    // B. Calculate paid sum and outstanding
    const { data: allOrders } = await supabase.from('orders').select('id, total_amount').eq('vendor_id', vendor.id);
    for (const o of allOrders) {
      const { data: payments } = await supabase.from('payments').select('amount').eq('order_id', o.id);
      const paid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
      const outstanding = Math.max(0, Number(o.total_amount) - paid);
      await supabase.from('orders').update({ amount_paid: paid, amount_outstanding: outstanding }).eq('id', o.id);
    }

    // C. Calculate customer outstanding balances
    for (const c of customers) {
      const { data: custOrders } = await supabase.from('orders').select('amount_outstanding').eq('customer_id', c.id);
      const totalOutstanding = (custOrders || []).reduce((sum, o) => sum + Number(o.amount_outstanding), 0);
      await supabase.from('customers').update({ total_outstanding: totalOutstanding }).eq('id', c.id);
    }

    console.log('\n=== SEEDING COMPLETED SUCCESSFULLY ===');
    console.log('Owner Login:');
    console.log('  Email: sanskriti@gmail.com');
    console.log('  Password: password123');
    console.log('\nAssistant Login:');
    console.log('  Email: sanskriti_assistant@gmail.com');
    console.log('  Password: password123');

  } catch (err) {
    console.error('Seeding crashed with error:', err);
  }
}

seed();
