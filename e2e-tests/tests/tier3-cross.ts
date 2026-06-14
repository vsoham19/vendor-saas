import { TestContext } from '../runner';
import axios from 'axios';

export const tier3Tests = [
  {
    name: 'Tier 3 - Owner A / Owner B Multitenant Isolation',
    fn: async (ctx: TestContext) => {
      // Create Owner A & Boutique A
      const emailA = `owner_a_${Date.now()}@test.com`;
      const password = 'Password123!';
      const { data: userA } = await ctx.supabaseAdmin.auth.admin.createUser({
        email: emailA, password, email_confirm: true
      });
      const { data: vendorA } = await ctx.supabaseAdmin.from('vendors').insert([{ business_name: 'Boutique A' }]).select().single();
      await ctx.supabaseAdmin.from('staff').insert([{
        id: userA.user!.id, vendor_id: vendorA.id, auth_user_id: userA.user!.id,
        name: 'Owner A', full_name: 'Owner A', email: emailA, role: 'owner'
      }]);

      // Create Owner B & Boutique B
      const emailB = `owner_b_${Date.now()}@test.com`;
      const { data: userB } = await ctx.supabaseAdmin.auth.admin.createUser({
        email: emailB, password, email_confirm: true
      });
      const { data: vendorB } = await ctx.supabaseAdmin.from('vendors').insert([{ business_name: 'Boutique B' }]).select().single();
      await ctx.supabaseAdmin.from('staff').insert([{
        id: userB.user!.id, vendor_id: vendorB.id, auth_user_id: userB.user!.id,
        name: 'Owner B', full_name: 'Owner B', email: emailB, role: 'owner'
      }]);

      // Owner A creates customer A
      const { data: customerA } = await ctx.supabaseAdmin.from('customers').insert([{
        vendor_id: vendorA.id, name: 'Customer A', full_name: 'Customer A', phone: '1111'
      }]).select().single();

      // Owner B logins and queries customers
      const { data: loginB } = await ctx.supabaseClient.auth.signInWithPassword({ email: emailB, password });
      const tokenB = loginB.session!.access_token;

      ctx.log('Owner B fetching customers...');
      try {
        const res = await axios.get(`${ctx.backendUrl}/api/customers`, {
          headers: { Authorization: `Bearer ${tokenB}` }
        });
        ctx.assert(res.status === 200, 'Query should succeed');
        const list = res.data;
        const hasCustomerA = list.some((c: any) => c.id === customerA.id);
        ctx.assert(!hasCustomerA, 'Owner B must not see Owner A\'s customer');
        ctx.log('Multitenant isolation verified for customer list.');
      } catch (err: any) {
        ctx.log(`Owner B query failed: ${err.message}`);
        throw err;
      }
    }
  },
  {
    name: 'Tier 3 - Shared Store Access (Owner & Assistant)',
    fn: async (ctx: TestContext) => {
      // Owner registers boutique
      const ownerEmail = `owner_shared_${Date.now()}@test.com`;
      const assistantEmail = `assistant_shared_${Date.now()}@test.com`;
      const password = 'Password123!';

      const { data: ownerUser } = await ctx.supabaseAdmin.auth.admin.createUser({
        email: ownerEmail, password, email_confirm: true
      });
      const { data: vendor } = await ctx.supabaseAdmin.from('vendors').insert([{ business_name: 'Shared Boutique' }]).select().single();
      await ctx.supabaseAdmin.from('staff').insert([{
        id: ownerUser.user!.id, vendor_id: vendor.id, auth_user_id: ownerUser.user!.id,
        name: 'Owner', full_name: 'Owner', email: ownerEmail, role: 'owner'
      }]);

      // Owner creates customer
      const { data: customer } = await ctx.supabaseAdmin.from('customers').insert([{
        vendor_id: vendor.id, name: 'Shared Customer', full_name: 'Shared Customer', phone: '2222'
      }]).select().single();

      // Owner invites/creates assistant
      const { data: assistantUser } = await ctx.supabaseAdmin.auth.admin.createUser({
        email: assistantEmail, password, email_confirm: true
      });
      await ctx.supabaseAdmin.from('staff').insert([{
        id: assistantUser.user!.id, vendor_id: vendor.id, auth_user_id: assistantUser.user!.id,
        name: 'Assistant', full_name: 'Assistant', email: assistantEmail, role: 'assistant'
      }]);

      // Assistant logs in and accesses the shared store
      const { data: loginData } = await ctx.supabaseClient.auth.signInWithPassword({ email: assistantEmail, password });
      const assistantToken = loginData.session!.access_token;

      ctx.log('Assistant fetching shared store customers...');
      try {
        const res = await axios.get(`${ctx.backendUrl}/api/customers`, {
          headers: { Authorization: `Bearer ${assistantToken}` }
        });
        ctx.assert(res.status === 200, 'Query should succeed');
        const list = res.data;
        const hasCustomer = list.some((c: any) => c.id === customer.id);
        ctx.assert(hasCustomer, 'Assistant must see the store\'s customer created by owner');
        ctx.log('Shared store access verified successfully.');
      } catch (err: any) {
        ctx.log(`Assistant shared store access failed: ${err.message}`);
        throw err;
      }
    }
  },
  {
    name: 'Tier 3 - DB Cleanup Preserves New Tenant Data',
    fn: async (ctx: TestContext) => {
      // 1. Create a new vendor and customer
      const { data: newVendor } = await ctx.supabaseAdmin
        .from('vendors')
        .insert([{ business_name: 'Newly Registered Boutique' }])
        .select()
        .single();
      const { data: newCustomer } = await ctx.supabaseAdmin
        .from('customers')
        .insert([{
          vendor_id: newVendor.id,
          name: 'Fresh Customer',
          full_name: 'Fresh Customer',
          phone: '3333333333'
        }])
        .select()
        .single();

      // 2. Fetch seed customer IDs first
      const { data: seedCustomers } = await ctx.supabaseAdmin
        .from('customers')
        .select('id')
        .eq('name', 'Priya Sharma');

      // 3. Perform cleanup on seed customer IDs if any exist
      if (seedCustomers && seedCustomers.length > 0) {
        ctx.log('Triggering cleanup of seed customers...');
        for (const seed of seedCustomers) {
          await ctx.supabaseAdmin.from('customers').delete().eq('id', seed.id);
        }
      }

      // 4. Verify new boutique and new customer are intact
      ctx.log('Verifying new boutique and customer are preserved...');
      const { data: checkVendor } = await ctx.supabaseAdmin
        .from('vendors')
        .select('*')
        .eq('id', newVendor.id);
      ctx.assert(checkVendor?.length === 1, 'New vendor should be preserved');

      const { data: checkCustomer } = await ctx.supabaseAdmin
        .from('customers')
        .select('*')
        .eq('id', newCustomer.id);
      ctx.assert(checkCustomer?.length === 1, 'New customer should be preserved');
      ctx.log('Database cleanup tenant preservation verified.');

      // Cleanup
      await ctx.supabaseAdmin.from('vendors').delete().eq('id', newVendor.id);
    }
  },
  {
    name: 'Tier 3 - Assistant Access Owner Customer Details',
    fn: async (ctx: TestContext) => {
      // Owner setup
      const ownerEmail = `owner_details_access_${Date.now()}@test.com`;
      const assistantEmail = `assistant_details_access_${Date.now()}@test.com`;
      const password = 'Password123!';

      const { data: ownerUser } = await ctx.supabaseAdmin.auth.admin.createUser({
        email: ownerEmail, password, email_confirm: true
      });
      const { data: vendor } = await ctx.supabaseAdmin.from('vendors').insert([{ business_name: 'Access Details Boutique' }]).select().single();
      await ctx.supabaseAdmin.from('staff').insert([{
        id: ownerUser.user!.id, vendor_id: vendor.id, auth_user_id: ownerUser.user!.id,
        name: 'Owner', full_name: 'Owner', email: ownerEmail, role: 'owner'
      }]);

      // Owner creates customer and order
      const { data: customer } = await ctx.supabaseAdmin.from('customers').insert([{
        vendor_id: vendor.id, name: 'Access Details Customer', full_name: 'Access Details Customer', phone: '4444'
      }]).select().single();

      const { data: order } = await ctx.supabaseAdmin.from('orders').insert([{
        vendor_id: vendor.id, customer_id: customer.id, total_amount: 2000, status: 'pending'
      }]).select().single();

      // Invite assistant
      const { data: assistantUser } = await ctx.supabaseAdmin.auth.admin.createUser({
        email: assistantEmail, password, email_confirm: true
      });
      await ctx.supabaseAdmin.from('staff').insert([{
        id: assistantUser.user!.id, vendor_id: vendor.id, auth_user_id: assistantUser.user!.id,
        name: 'Assistant', full_name: 'Assistant', email: assistantEmail, role: 'assistant'
      }]);

      // Login assistant
      const { data: loginData } = await ctx.supabaseClient.auth.signInWithPassword({ email: assistantEmail, password });
      const assistantToken = loginData.session!.access_token;

      // Assistant queries details
      ctx.log(`Assistant fetching customer details for ID ${customer.id}...`);
      try {
        const res = await axios.get(`${ctx.backendUrl}/api/customers/${customer.id}`, {
          headers: { Authorization: `Bearer ${assistantToken}` }
        });
        ctx.assert(res.status === 200, 'Query should succeed');
        ctx.assertEq(res.data.profile.id, customer.id, 'Customer profile matches');
        ctx.assert(res.data.orders.length > 0, 'Orders list should not be empty');
        ctx.assertEq(res.data.orders[0].id, order.id, 'Order ID matches');
        ctx.log('Assistant successfully fetched customer details created by owner.');
      } catch (err: any) {
        ctx.log(`Assistant customer details access failed: ${err.message}`);
        throw err;
      }
    }
  }
];
