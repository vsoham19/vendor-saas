-- Enable Row Level Security and enforce tenant isolation at the database layer.
--
-- The frontend talks to Supabase directly with the anon key, so every table must
-- be protected by RLS. Tenant membership is resolved through the caller's row in
-- public.staff (auth_user_id = auth.uid()).
--
-- Apply with: supabase db push (or run this file in the Supabase SQL editor).

-- ---------------------------------------------------------------------------
-- 0. Bootstrap support
-- ---------------------------------------------------------------------------
-- Onboarding creates a vendor BEFORE the owner's staff row exists, so we need a
-- way to recognise the creator of a vendor while RLS is active.
alter table public.vendors
  add column if not exists created_by uuid default auth.uid();

-- ---------------------------------------------------------------------------
-- 1. Tenant helper functions (SECURITY DEFINER so they can read staff safely)
-- ---------------------------------------------------------------------------
create or replace function public.current_vendor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.vendor_id
  from public.staff s
  where s.auth_user_id = auth.uid()
    and s.is_active
  limit 1
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select s.role = 'owner'
      from public.staff s
      where s.auth_user_id = auth.uid()
        and s.is_active
      limit 1
    ),
    false
  )
$$;

create or replace function public.vendor_has_staff(target_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s where s.vendor_id = target_vendor_id
  )
$$;

create or replace function public.can_bootstrap_vendor(target_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vendors v
    where v.id = target_vendor_id
      and v.created_by = auth.uid()
      and not exists (
        select 1 from public.staff s where s.vendor_id = v.id
      )
  )
$$;

revoke all on function public.current_vendor_id() from public, anon;
revoke all on function public.is_owner() from public, anon;
revoke all on function public.vendor_has_staff(uuid) from public, anon;
revoke all on function public.can_bootstrap_vendor(uuid) from public, anon;

grant execute on function public.current_vendor_id() to authenticated, service_role;
grant execute on function public.is_owner() to authenticated, service_role;
grant execute on function public.vendor_has_staff(uuid) to authenticated, service_role;
grant execute on function public.can_bootstrap_vendor(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. vendors
-- ---------------------------------------------------------------------------
alter table public.vendors enable row level security;

drop policy if exists vendors_select on public.vendors;
create policy vendors_select on public.vendors
  for select to authenticated
  using (id = public.current_vendor_id() or created_by = auth.uid());

drop policy if exists vendors_insert on public.vendors;
create policy vendors_insert on public.vendors
  for insert to authenticated
  with check (created_by = auth.uid() and public.current_vendor_id() is null);

drop policy if exists vendors_update on public.vendors;
create policy vendors_update on public.vendors
  for update to authenticated
  using (id = public.current_vendor_id() and public.is_owner())
  with check (id = public.current_vendor_id());

drop policy if exists vendors_delete on public.vendors;
create policy vendors_delete on public.vendors
  for delete to authenticated
  using (created_by = auth.uid() and not public.vendor_has_staff(id));

-- ---------------------------------------------------------------------------
-- 3. staff
-- ---------------------------------------------------------------------------
alter table public.staff enable row level security;

drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff
  for select to authenticated
  using (vendor_id = public.current_vendor_id() or auth_user_id = auth.uid());

-- Only used by the onboarding bootstrap (owner has no staff row yet).
-- Assistants are created server-side with the service role, which bypasses RLS.
drop policy if exists staff_insert on public.staff;
create policy staff_insert on public.staff
  for insert to authenticated
  with check (
    auth_user_id = auth.uid()
    and role = 'owner'
    and public.current_vendor_id() is null
    and public.can_bootstrap_vendor(vendor_id)
  );

drop policy if exists staff_update on public.staff;
create policy staff_update on public.staff
  for update to authenticated
  using (vendor_id = public.current_vendor_id() and public.is_owner())
  with check (vendor_id = public.current_vendor_id());

drop policy if exists staff_delete on public.staff;
create policy staff_delete on public.staff
  for delete to authenticated
  using (
    vendor_id = public.current_vendor_id()
    and public.is_owner()
    and auth_user_id <> auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 4. customers
-- ---------------------------------------------------------------------------
alter table public.customers enable row level security;

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select to authenticated
  using (vendor_id = public.current_vendor_id());

drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers
  for insert to authenticated
  with check (vendor_id = public.current_vendor_id());

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update to authenticated
  using (vendor_id = public.current_vendor_id())
  with check (vendor_id = public.current_vendor_id());

drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers
  for delete to authenticated
  using (vendor_id = public.current_vendor_id());

-- ---------------------------------------------------------------------------
-- 5. orders
-- ---------------------------------------------------------------------------
alter table public.orders enable row level security;

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated
  using (vendor_id = public.current_vendor_id());

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert to authenticated
  with check (
    vendor_id = public.current_vendor_id()
    and exists (
      select 1 from public.customers c
      where c.id = orders.customer_id
        and c.vendor_id = public.current_vendor_id()
    )
  );

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update to authenticated
  using (vendor_id = public.current_vendor_id())
  with check (vendor_id = public.current_vendor_id());

drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders
  for delete to authenticated
  using (vendor_id = public.current_vendor_id());

-- ---------------------------------------------------------------------------
-- 6. order_items (scoped through the parent order)
-- ---------------------------------------------------------------------------
alter table public.order_items enable row level security;

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.vendor_id = public.current_vendor_id()
    )
  );

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.vendor_id = public.current_vendor_id()
    )
  );

drop policy if exists order_items_update on public.order_items;
create policy order_items_update on public.order_items
  for update to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.vendor_id = public.current_vendor_id()
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.vendor_id = public.current_vendor_id()
    )
  );

drop policy if exists order_items_delete on public.order_items;
create policy order_items_delete on public.order_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.vendor_id = public.current_vendor_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 7. payments (scoped through the parent order)
-- ---------------------------------------------------------------------------
alter table public.payments enable row level security;

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and o.vendor_id = public.current_vendor_id()
    )
  );

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and o.vendor_id = public.current_vendor_id()
    )
    and exists (
      select 1 from public.customers c
      where c.id = payments.customer_id
        and c.vendor_id = public.current_vendor_id()
    )
  );

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
  for update to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and o.vendor_id = public.current_vendor_id()
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and o.vendor_id = public.current_vendor_id()
    )
  );

drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments
  for delete to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and o.vendor_id = public.current_vendor_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 8. appointments
-- ---------------------------------------------------------------------------
alter table public.appointments enable row level security;

drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments
  for select to authenticated
  using (vendor_id = public.current_vendor_id());

drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert on public.appointments
  for insert to authenticated
  with check (
    vendor_id = public.current_vendor_id()
    and exists (
      select 1 from public.customers c
      where c.id = appointments.customer_id
        and c.vendor_id = public.current_vendor_id()
    )
  );

drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments
  for update to authenticated
  using (vendor_id = public.current_vendor_id())
  with check (vendor_id = public.current_vendor_id());

drop policy if exists appointments_delete on public.appointments;
create policy appointments_delete on public.appointments
  for delete to authenticated
  using (vendor_id = public.current_vendor_id());

-- ---------------------------------------------------------------------------
-- 9. measurement_templates
-- ---------------------------------------------------------------------------
alter table public.measurement_templates enable row level security;

drop policy if exists measurement_templates_select on public.measurement_templates;
create policy measurement_templates_select on public.measurement_templates
  for select to authenticated
  using (vendor_id = public.current_vendor_id());

drop policy if exists measurement_templates_insert on public.measurement_templates;
create policy measurement_templates_insert on public.measurement_templates
  for insert to authenticated
  with check (vendor_id = public.current_vendor_id());

drop policy if exists measurement_templates_update on public.measurement_templates;
create policy measurement_templates_update on public.measurement_templates
  for update to authenticated
  using (vendor_id = public.current_vendor_id())
  with check (vendor_id = public.current_vendor_id());

drop policy if exists measurement_templates_delete on public.measurement_templates;
create policy measurement_templates_delete on public.measurement_templates
  for delete to authenticated
  using (vendor_id = public.current_vendor_id());

-- ---------------------------------------------------------------------------
-- 10. measurement_field_templates
-- ---------------------------------------------------------------------------
alter table public.measurement_field_templates enable row level security;

drop policy if exists measurement_field_templates_select on public.measurement_field_templates;
create policy measurement_field_templates_select on public.measurement_field_templates
  for select to authenticated
  using (vendor_id = public.current_vendor_id());

drop policy if exists measurement_field_templates_insert on public.measurement_field_templates;
create policy measurement_field_templates_insert on public.measurement_field_templates
  for insert to authenticated
  with check (vendor_id = public.current_vendor_id() and public.is_owner());

drop policy if exists measurement_field_templates_update on public.measurement_field_templates;
create policy measurement_field_templates_update on public.measurement_field_templates
  for update to authenticated
  using (vendor_id = public.current_vendor_id() and public.is_owner())
  with check (vendor_id = public.current_vendor_id());

drop policy if exists measurement_field_templates_delete on public.measurement_field_templates;
create policy measurement_field_templates_delete on public.measurement_field_templates
  for delete to authenticated
  using (vendor_id = public.current_vendor_id() and public.is_owner());

-- ---------------------------------------------------------------------------
-- 11. customer_measurements (scoped through the parent customer)
-- ---------------------------------------------------------------------------
alter table public.customer_measurements enable row level security;

drop policy if exists customer_measurements_select on public.customer_measurements;
create policy customer_measurements_select on public.customer_measurements
  for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_measurements.customer_id
        and c.vendor_id = public.current_vendor_id()
    )
  );

drop policy if exists customer_measurements_insert on public.customer_measurements;
create policy customer_measurements_insert on public.customer_measurements
  for insert to authenticated
  with check (
    exists (
      select 1 from public.customers c
      where c.id = customer_measurements.customer_id
        and c.vendor_id = public.current_vendor_id()
    )
  );

drop policy if exists customer_measurements_update on public.customer_measurements;
create policy customer_measurements_update on public.customer_measurements
  for update to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_measurements.customer_id
        and c.vendor_id = public.current_vendor_id()
    )
  )
  with check (
    exists (
      select 1 from public.customers c
      where c.id = customer_measurements.customer_id
        and c.vendor_id = public.current_vendor_id()
    )
  );

drop policy if exists customer_measurements_delete on public.customer_measurements;
create policy customer_measurements_delete on public.customer_measurements
  for delete to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_measurements.customer_id
        and c.vendor_id = public.current_vendor_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 12. Keep order numbering global while RLS is enabled
-- ---------------------------------------------------------------------------
-- Trigger functions run as the invoking (authenticated) user. With RLS active
-- generate_order_number() would only see the caller's own orders and could
-- emit duplicate order numbers across vendors. SECURITY DEFINER preserves the
-- previous global sequence behaviour.
create or replace function public.generate_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_seq integer;
  v_new_order_number text;
begin
  v_prefix := 'ORD-' || to_char(now(), 'YYYYMM') || '-';

  select coalesce(max(substring(order_number from '\d+$')::integer), 0) + 1
  into v_seq
  from public.orders
  where order_number like v_prefix || '%';

  v_new_order_number := v_prefix || lpad(v_seq::text, 4, '0');
  new.order_number := v_new_order_number;
  return new;
end;
$$;
