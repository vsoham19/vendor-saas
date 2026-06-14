import { TestContext } from '../runner';
import axios from 'axios';

export const tier4Tests = [
  {
    name: 'Tier 4 - Scenario 1: New Boutique Setup & Custom Measurement Logging',
    fn: async (ctx: TestContext) => {
      // Setup owner & boutique
      const email = `boutique_owner_${Date.now()}@test.com`;
      const password = 'Password123!';
      const { data: user } = await ctx.supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true
      });
      const { data: vendor } = await ctx.supabaseAdmin.from('vendors').insert([{ business_name: 'Bespoke Atelier' }]).select().single();
      await ctx.supabaseAdmin.from('staff').insert([{
        id: user.user!.id, vendor_id: vendor.id, auth_user_id: user.user!.id,
        name: 'Bespoke Owner', full_name: 'Bespoke Owner', email, role: 'owner'
      }]);

      const { data: loginData } = await ctx.supabaseClient.auth.signInWithPassword({ email, password });
      const token = loginData.session!.access_token;

      // 1. Owner defines custom measurement template
      ctx.log('Creating custom measurement template...');
      const { data: template, error: tempErr } = await ctx.supabaseAdmin
        .from('measurement_templates')
        .insert([{
          vendor_id: vendor.id,
          name: 'Bridal Wear Template',
          columns: ['Waist', 'Bust', 'Length', 'Shoulder']
        }])
        .select()
        .single();
      ctx.assert(!tempErr, `Template creation failed: ${tempErr?.message}`);

      // 2. Owner creates customer
      ctx.log('Creating customer...');
      const { data: customer } = await ctx.supabaseAdmin
        .from('customers')
        .insert([{
          vendor_id: vendor.id,
          name: 'Ananya Roy',
          full_name: 'Ananya Roy',
          phone: '9820098200'
        }])
        .select()
        .single();

      // 3. Owner logs customer measurements
      ctx.log('Logging customer measurements...');
      const { data: measurement, error: measErr } = await ctx.supabaseAdmin
        .from('customer_measurements')
        .insert([{
          customer_id: customer.id,
          template_id: template.id,
          label: 'Bridal Fitting Dec',
          values: { Waist: '28', Bust: '34', Length: '58', Shoulder: '14' },
          notes: 'Snug fit requested'
        }])
        .select()
        .single();
      ctx.assert(!measErr, `Measurement log failed: ${measErr?.message}`);

      // 4. Retrieve and verify
      ctx.log('Retrieving customer details to verify...');
      try {
        const res = await axios.get(`${ctx.backendUrl}/api/customers/${customer.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        ctx.assertEq(res.status, 200, 'Fetch should succeed');
        ctx.assert(res.data.measurements.length > 0, 'Should have measurement snapshot');
        ctx.assertEq(res.data.measurements[0].values.Waist, '28', 'Waist should match');
        ctx.assertEq(res.data.measurements[0].values.Bust, '34', 'Bust should match');
        ctx.log('Boutique setup and custom measurements logged successfully.');
      } catch (err: any) {
        ctx.log(`Fetch verification failed: ${err.message}`);
        throw err;
      }
    }
  },
  {
    name: 'Tier 4 - Scenario 2: Team Collaboration on Custom Order & Payment',
    fn: async (ctx: TestContext) => {
      // Setup owner & boutique
      const ownerEmail = `collab_owner_${Date.now()}@test.com`;
      const assistantEmail = `collab_assistant_${Date.now()}@test.com`;
      const password = 'Password123!';

      const { data: ownerUser } = await ctx.supabaseAdmin.auth.admin.createUser({
        email: ownerEmail, password, email_confirm: true
      });
      const { data: vendor } = await ctx.supabaseAdmin.from('vendors').insert([{ business_name: 'Collab Boutique' }]).select().single();
      await ctx.supabaseAdmin.from('staff').insert([{
        id: ownerUser.user!.id, vendor_id: vendor.id, auth_user_id: ownerUser.user!.id,
        name: 'Collab Owner', full_name: 'Collab Owner', email: ownerEmail, role: 'owner'
      }]);

      // Invite/create assistant
      const { data: assistantUser } = await ctx.supabaseAdmin.auth.admin.createUser({
        email: assistantEmail, password, email_confirm: true
      });
      await ctx.supabaseAdmin.from('staff').insert([{
        id: assistantUser.user!.id, vendor_id: vendor.id, auth_user_id: assistantUser.user!.id,
        name: 'Collab Assistant', full_name: 'Collab Assistant', email: assistantEmail, role: 'assistant'
      }]);

      // Owner creates customer
      const { data: customer } = await ctx.supabaseAdmin.from('customers').insert([{
        vendor_id: vendor.id, name: 'Collab Customer', full_name: 'Collab Customer', phone: '5555'
      }]).select().single();

      // Owner creates order ($1000)
      ctx.log('Owner creating order for $1000...');
      const { data: order, error: orderErr } = await ctx.supabaseAdmin
        .from('orders')
        .insert([{
          vendor_id: vendor.id,
          customer_id: customer.id,
          total_amount: 1000,
          status: 'pending'
        }])
        .select()
        .single();
      ctx.assert(!orderErr, 'Order creation failed');

      // Assistant logs in and creates payment ($400)
      const { data: loginData } = await ctx.supabaseClient.auth.signInWithPassword({ email: assistantEmail, password });
      const assistantToken = loginData.session!.access_token;

      ctx.log('Assistant logging payment of $400...');
      // In a real app we hit the endpoint: POST /api/orders/:id/payments
      try {
        const payRes = await axios.post(`${ctx.backendUrl}/api/orders/${order.id}/payments`, {
          amount: 400,
          payment_method: 'Card'
        }, {
          headers: { Authorization: `Bearer ${assistantToken}` }
        });
        ctx.assert(payRes.status === 201 || payRes.status === 200, 'Payment logging should return 201/200');

        // Owner fetches the order to verify balances
        const { data: loginOwner } = await ctx.supabaseClient.auth.signInWithPassword({ email: ownerEmail, password });
        const ownerToken = loginOwner.session!.access_token;

        ctx.log('Owner verifying order details...');
        const orderRes = await axios.get(`${ctx.backendUrl}/api/orders/${order.id}`, {
          headers: { Authorization: `Bearer={${ownerToken}}` }
        });
        
        ctx.assertEq(Number(orderRes.data.order.amount_paid), 400, 'Amount paid should be 400');
        ctx.assertEq(Number(orderRes.data.order.amount_outstanding), 600, 'Amount outstanding should be 600');
        ctx.log('Team collaboration and order balance tracking verified.');
      } catch (err: any) {
        ctx.log(`Collaboration test failed: ${err.message}`);
        throw err;
      }
    }
  },
  {
    name: 'Tier 4 - Scenario 3: Ledger Outstanding Calculation Flow',
    fn: async (ctx: TestContext) => {
      // Setup boutique
      const email = `ledger_owner_${Date.now()}@test.com`;
      const password = 'Password123!';
      const { data: user } = await ctx.supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true
      });
      const { data: vendor } = await ctx.supabaseAdmin.from('vendors').insert([{ business_name: 'Ledger Boutique' }]).select().single();
      await ctx.supabaseAdmin.from('staff').insert([{
        id: user.user!.id, vendor_id: vendor.id, auth_user_id: user.user!.id,
        name: 'Ledger Owner', full_name: 'Ledger Owner', email, role: 'owner'
      }]);

      const { data: loginData } = await ctx.supabaseClient.auth.signInWithPassword({ email, password });
      const token = loginData.session!.access_token;

      // 1. Create customer
      ctx.log('Creating customer...');
      const { data: customer } = await ctx.supabaseAdmin
        .from('customers')
        .insert([{
          vendor_id: vendor.id,
          name: 'Ledger Cust',
          full_name: 'Ledger Cust',
          phone: '9991234567'
        }])
        .select()
        .single();

      // 2. Create Order 1 ($500)
      ctx.log('Creating Order 1 for $500...');
      const { data: order1 } = await ctx.supabaseAdmin
        .from('orders')
        .insert([{
          vendor_id: vendor.id,
          customer_id: customer.id,
          total_amount: 500,
          status: 'pending'
        }])
        .select()
        .single();

      // 3. Create Order 2 ($300)
      ctx.log('Creating Order 2 for $300...');
      const { data: order2 } = await ctx.supabaseAdmin
        .from('orders')
        .insert([{
          vendor_id: vendor.id,
          customer_id: customer.id,
          total_amount: 300,
          status: 'pending'
        }])
        .select()
        .single();

      // Verify customer total outstanding is $800
      ctx.log('Verifying initial outstanding balance is $800...');
      let { data: checkCust1 } = await ctx.supabaseAdmin
        .from('customers')
        .select('total_outstanding')
        .eq('id', customer.id)
        .single();
      ctx.assertEq(Number(checkCust1!.total_outstanding), 800, 'Customer total outstanding must be 800');

      // 4. Log payment of $200 for Order 1
      ctx.log('Logging $200 payment for Order 1...');
      try {
        await axios.post(`${ctx.backendUrl}/api/orders/${order1.id}/payments`, {
          amount: 200,
          payment_method: 'UPI'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err: any) {
        ctx.log(`Order 1 payment logging failed: ${err.message}`);
      }

      // 5. Log payment of $300 for Order 2
      ctx.log('Logging $300 payment for Order 2...');
      try {
        await axios.post(`${ctx.backendUrl}/api/orders/${order2.id}/payments`, {
          amount: 300,
          payment_method: 'Cash'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err: any) {
        ctx.log(`Order 2 payment logging failed: ${err.message}`);
      }

      // Verify updated balances (Order 1 outstanding should be $300, Order 2 outstanding should be $0, Customer total outstanding should be $300)
      ctx.log('Querying updated ledger balances...');
      const { data: finalOrder1 } = await ctx.supabaseAdmin.from('orders').select('*').eq('id', order1.id).single();
      const { data: finalOrder2 } = await ctx.supabaseAdmin.from('orders').select('*').eq('id', order2.id).single();
      const { data: finalCustomer } = await ctx.supabaseAdmin.from('customers').select('*').eq('id', customer.id).single();

      ctx.log(`Order 1 outstanding: ${finalOrder1.amount_outstanding} (expected 300)`);
      ctx.log(`Order 2 outstanding: ${finalOrder2.amount_outstanding} (expected 0)`);
      ctx.log(`Customer total outstanding: ${finalCustomer.total_outstanding} (expected 300)`);

      ctx.assertEq(Number(finalOrder1.amount_outstanding), 300, 'Order 1 outstanding should be 300');
      ctx.assertEq(Number(finalOrder2.amount_outstanding), 0, 'Order 2 outstanding should be 0');
      ctx.assertEq(Number(finalCustomer.total_outstanding), 300, 'Customer total outstanding should be 300');
      ctx.log('Ledger outstanding balance calculations verified.');
    }
  },
  {
    name: 'Tier 4 - Scenario 4: Appointment Scheduling & Trial Fitting Flow',
    fn: async (ctx: TestContext) => {
      // Setup boutique
      const email = `appt_owner_${Date.now()}@test.com`;
      const password = 'Password123!';
      const { data: user } = await ctx.supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true
      });
      const { data: vendor } = await ctx.supabaseAdmin.from('vendors').insert([{ business_name: 'Fitting Boutique' }]).select().single();
      await ctx.supabaseAdmin.from('staff').insert([{
        id: user.user!.id, vendor_id: vendor.id, auth_user_id: user.user!.id,
        name: 'Fitting Owner', full_name: 'Fitting Owner', email, role: 'owner'
      }]);

      const { data: loginData } = await ctx.supabaseClient.auth.signInWithPassword({ email, password });
      const token = loginData.session!.access_token;

      // Create customer & order
      const { data: customer } = await ctx.supabaseAdmin.from('customers').insert([{
        vendor_id: vendor.id, name: 'Surbhi Gupta', full_name: 'Surbhi Gupta', phone: '9000120002'
      }]).select().single();

      const { data: order } = await ctx.supabaseAdmin.from('orders').insert([{
        vendor_id: vendor.id, customer_id: customer.id, total_amount: 1500, status: 'in_progress'
      }]).select().single();

      // 1. Schedule "Trial Fitting 1"
      ctx.log('Scheduling Trial Fitting 1 appointment...');
      const { data: appt1, error: apptErr1 } = await ctx.supabaseAdmin
        .from('appointments')
        .insert([{
          vendor_id: vendor.id,
          customer_id: customer.id,
          order_id: order.id,
          title: 'Trial Fitting 1',
          appointment_type: 'linked_to_order',
          stage: 'trial_1',
          scheduled_date: new Date().toISOString(),
          status: 'scheduled',
          notes: 'Verify sleeve fit'
        }])
        .select()
        .single();
      ctx.assert(!apptErr1, 'Appointment 1 scheduling failed');

      // 2. Update status to "completed" and update notes
      ctx.log('Updating Appointment 1 to completed...');
      const { error: updateErr } = await ctx.supabaseAdmin
        .from('appointments')
        .update({
          status: 'completed',
          notes: 'Sleeves fit perfectly. Proceeding to final stitch.'
        })
        .eq('id', appt1.id);
      ctx.assert(!updateErr, 'Appointment update failed');

      // 3. Schedule "Final Fitting"
      ctx.log('Scheduling Final Fitting appointment...');
      const { data: appt2, error: apptErr2 } = await ctx.supabaseAdmin
        .from('appointments')
        .insert([{
          vendor_id: vendor.id,
          customer_id: customer.id,
          order_id: order.id,
          title: 'Final Fitting',
          appointment_type: 'linked_to_order',
          stage: 'final_fitting',
          scheduled_date: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days later
          status: 'scheduled'
        }])
        .select()
        .single();
      ctx.assert(!apptErr2, 'Appointment 2 scheduling failed');

      // 4. Fetch details to verify
      ctx.log('Fetching customer details to verify appointments...');
      try {
        const res = await axios.get(`${ctx.backendUrl}/api/customers/${customer.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        ctx.assertEq(res.status, 200, 'Fetch should succeed');
        const appointments = res.data.appointments;
        ctx.assertEq(appointments.length, 2, 'Should have exactly 2 appointments');
        
        const a1 = appointments.find((a: any) => a.id === appt1.id);
        const a2 = appointments.find((a: any) => a.id === appt2.id);
        
        ctx.assertEq(a1.status, 'completed', 'Appointment 1 should be completed');
        ctx.assertEq(a1.notes, 'Sleeves fit perfectly. Proceeding to final stitch.', 'Appointment 1 notes should match');
        ctx.assertEq(a2.status, 'scheduled', 'Appointment 2 should be scheduled');
        ctx.log('Appointment scheduling and trial fitting flow verified.');
      } catch (err: any) {
        ctx.log(`Fetch verification failed: ${err.message}`);
        throw err;
      }
    }
  },
  {
    name: 'Tier 4 - Scenario 5: System Reset (DB Clean-up) Preserves Active Data',
    fn: async (ctx: TestContext) => {
      // 1. Create new active data (new owner, new boutique, new customer, new order)
      ctx.log('Creating active data for new owner...');
      const email = `active_owner_${Date.now()}@test.com`;
      const password = 'Password123!';
      
      const { data: user } = await ctx.supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true
      });
      const { data: vendor } = await ctx.supabaseAdmin.from('vendors').insert([{ business_name: 'Active Boutique' }]).select().single();
      await ctx.supabaseAdmin.from('staff').insert([{
        id: user.user!.id, vendor_id: vendor.id, auth_user_id: user.user!.id,
        name: 'Active Owner', full_name: 'Active Owner', email, role: 'owner'
      }]);

      const { data: customer } = await ctx.supabaseAdmin.from('customers').insert([{
        vendor_id: vendor.id, name: 'Active Customer', full_name: 'Active Customer', phone: '1010101010'
      }]).select().single();

      const { data: order } = await ctx.supabaseAdmin.from('orders').insert([{
        vendor_id: vendor.id, customer_id: customer.id, total_amount: 5000, status: 'pending'
      }]).select().single();

      // 2. Perform DB Clean-up of seed customers (e.g. Priya Sharma, Kabir Singh, Arjun Kapoor, Meera Nair, Ananya Desai)
      ctx.log('Triggering cleanup of original seed customers...');
      const seedNames = ['Priya Sharma', 'Kabir Singh', 'Arjun Kapoor', 'Meera Nair', 'Ananya Desai'];
      
      const { data: seedCustomers } = await ctx.supabaseAdmin
        .from('customers')
        .select('id, name')
        .in('name', seedNames);

      if (seedCustomers && seedCustomers.length > 0) {
        ctx.log(`Found ${seedCustomers.length} seed customers to delete.`);
        for (const seed of seedCustomers) {
          ctx.log(`Deleting seed customer: ${seed.name}`);
          await ctx.supabaseAdmin.from('customers').delete().eq('id', seed.id);
        }
      }

      // 3. Verify seed customers gone
      ctx.log('Verifying seed customers are gone...');
      const { data: checkSeedsGone } = await ctx.supabaseAdmin
        .from('customers')
        .select('*')
        .in('name', seedNames);
      ctx.assert(checkSeedsGone?.length === 0, 'Seed customers must be gone');

      // 4. Verify new active data is preserved
      ctx.log('Verifying new owner\'s active data remains intact...');
      const { data: checkVendor } = await ctx.supabaseAdmin.from('vendors').select('*').eq('id', vendor.id);
      ctx.assert(checkVendor?.length === 1, 'Active vendor should be preserved');

      const { data: checkCustomer } = await ctx.supabaseAdmin.from('customers').select('*').eq('id', customer.id);
      ctx.assert(checkCustomer?.length === 1, 'Active customer should be preserved');

      const { data: checkOrder } = await ctx.supabaseAdmin.from('orders').select('*').eq('id', order.id);
      ctx.assert(checkOrder?.length === 1, 'Active order should be preserved');

      ctx.log('System reset (DB clean-up) preserves new tenant active data successfully.');
    }
  }
];
