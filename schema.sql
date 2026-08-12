-- =====================================================================
-- VEHICLE RENTAL MANAGEMENT SYSTEM — Supabase Schema
-- Run this entire file once in: Supabase Dashboard -> SQL Editor -> New query
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILES  (extends auth.users with role + name)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('customer','staff','admin')) default 'customer',
  phone text,
  created_at timestamptz not null default now()
);

-- Automatically create a profile row whenever someone signs up.
-- Role + full name are passed in from the sign-up form via `raw_user_meta_data`.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper used inside RLS policies to read the caller's role without recursion.
create or replace function public.current_role()
returns text
language sql
security definer set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 2. CATEGORIES
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null,
  daily_rate numeric(10,2) not null check (daily_rate >= 0),
  description text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. VEHICLES
-- ---------------------------------------------------------------------
create table if not exists public.vehicles (
  id bigint generated always as identity primary key,
  name text not null,
  category_id bigint references public.categories(id) on delete set null,
  plate_number text unique not null,
  status text not null check (status in ('available','rented','maintenance')) default 'available',
  seats int,
  transmission text default 'Automatic',
  image_url text,
  description text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. BOOKINGS
-- ---------------------------------------------------------------------
create table if not exists public.bookings (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id bigint not null references public.vehicles(id),
  start_date date not null,
  end_date date not null,
  status text not null check (
    status in ('pending','approved','rejected','active','completed','cancelled')
  ) default 'pending',
  total_amount numeric(10,2),
  reviewed_by uuid references public.profiles(id),
  review_notes text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ---------------------------------------------------------------------
-- 5. PAYMENTS
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id bigint generated always as identity primary key,
  booking_id bigint not null references public.bookings(id) on delete cascade,
  amount numeric(10,2) not null,
  method text default 'card',
  status text not null check (status in ('pending','successful','failed')) default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. RENTAL RETURNS (inspection / damage)
-- ---------------------------------------------------------------------
create table if not exists public.rental_returns (
  id bigint generated always as identity primary key,
  booking_id bigint not null unique references public.bookings(id) on delete cascade,
  return_date timestamptz not null default now(),
  condition_notes text,
  has_damage boolean not null default false,
  additional_charges numeric(10,2) not null default 0,
  inspected_by uuid references public.profiles(id)
);

-- ---------------------------------------------------------------------
-- 7. RECEIPTS
-- ---------------------------------------------------------------------
create table if not exists public.receipts (
  id bigint generated always as identity primary key,
  booking_id bigint not null unique references public.bookings(id) on delete cascade,
  receipt_number text unique not null,
  total_amount numeric(10,2) not null,
  issued_at timestamptz not null default now()
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.vehicles       enable row level security;
alter table public.bookings       enable row level security;
alter table public.payments       enable row level security;
alter table public.rental_returns enable row level security;
alter table public.receipts       enable row level security;

-- PROFILES ------------------------------------------------------------
create policy "profiles: read own or staff/admin read all"
  on public.profiles for select
  using (id = auth.uid() or public.current_role() in ('staff','admin'));

create policy "profiles: user updates own name/phone"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: admin manages all"
  on public.profiles for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- CATEGORIES ------------------------------------------------------------
create policy "categories: anyone signed in can read"
  on public.categories for select
  using (auth.uid() is not null);

create policy "categories: admin writes"
  on public.categories for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- VEHICLES ------------------------------------------------------------
create policy "vehicles: anyone signed in can read"
  on public.vehicles for select
  using (auth.uid() is not null);

create policy "vehicles: admin manages"
  on public.vehicles for insert
  with check (public.current_role() = 'admin');

create policy "vehicles: admin deletes"
  on public.vehicles for delete
  using (public.current_role() = 'admin');

create policy "vehicles: staff/admin update status"
  on public.vehicles for update
  using (public.current_role() in ('staff','admin'))
  with check (public.current_role() in ('staff','admin'));

-- BOOKINGS ------------------------------------------------------------
create policy "bookings: customer reads own, staff/admin read all"
  on public.bookings for select
  using (customer_id = auth.uid() or public.current_role() in ('staff','admin'));

create policy "bookings: customer creates own request"
  on public.bookings for insert
  with check (customer_id = auth.uid());

create policy "bookings: staff/admin review & update any"
  on public.bookings for update
  using (public.current_role() in ('staff','admin') or customer_id = auth.uid())
  with check (public.current_role() in ('staff','admin') or customer_id = auth.uid());

-- PAYMENTS ------------------------------------------------------------
create policy "payments: staff/admin full access"
  on public.payments for all
  using (public.current_role() in ('staff','admin'))
  with check (public.current_role() in ('staff','admin'));

create policy "payments: customer reads own"
  on public.payments for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id and b.customer_id = auth.uid()
    )
  );

-- RENTAL RETURNS ------------------------------------------------------------
create policy "returns: staff/admin full access"
  on public.rental_returns for all
  using (public.current_role() in ('staff','admin'))
  with check (public.current_role() in ('staff','admin'));

create policy "returns: customer reads own"
  on public.rental_returns for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = rental_returns.booking_id and b.customer_id = auth.uid()
    )
  );

-- RECEIPTS ------------------------------------------------------------
create policy "receipts: staff/admin full access"
  on public.receipts for all
  using (public.current_role() in ('staff','admin'))
  with check (public.current_role() in ('staff','admin'));

create policy "receipts: customer reads own"
  on public.receipts for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = receipts.booking_id and b.customer_id = auth.uid()
    )
  );

-- =====================================================================
-- SEED DATA (safe to skip/edit)
-- =====================================================================
insert into public.categories (name, daily_rate, description) values
  ('Economy',    35.00, 'Compact, fuel-efficient cars for city driving'),
  ('SUV',        65.00, 'Spacious vehicles for families and road trips'),
  ('Luxury',    120.00, 'Premium sedans with top-tier comfort'),
  ('Van',        80.00, 'High-capacity vans for groups and cargo')
on conflict do nothing;

insert into public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
select 'Toyota Corolla', id, 'ECO-1001', 'available', 5, 'Automatic',
  'https://images.unsplash.com/photo-1623869675184-0dea77a51dae?w=600',
  'Reliable and economical, perfect for everyday city trips.'
from public.categories where name = 'Economy'
on conflict (plate_number) do nothing;

insert into public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
select 'Honda Civic', id, 'ECO-1002', 'available', 5, 'Automatic',
  'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=600',
  'A smooth, quiet ride with excellent mileage.'
from public.categories where name = 'Economy'
on conflict (plate_number) do nothing;

insert into public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
select 'Toyota Fortuner', id, 'SUV-2001', 'available', 7, 'Automatic',
  'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=600',
  'A rugged, spacious SUV built for family adventures.'
from public.categories where name = 'SUV'
on conflict (plate_number) do nothing;

insert into public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
select 'Ford Everest', id, 'SUV-2002', 'available', 7, 'Automatic',
  'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600',
  'Powerful and comfortable for long-distance travel.'
from public.categories where name = 'SUV'
on conflict (plate_number) do nothing;

insert into public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
select 'Mercedes-Benz E-Class', id, 'LUX-3001', 'available', 5, 'Automatic',
  'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=600',
  'Executive-class comfort and style for special occasions.'
from public.categories where name = 'Luxury'
on conflict (plate_number) do nothing;

insert into public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
select 'Toyota Hiace', id, 'VAN-4001', 'available', 12, 'Manual',
  'https://images.unsplash.com/photo-1601929889531-6a67a4b2fd39?w=600',
  'Ideal for group trips, events, and cargo hauling.'
from public.categories where name = 'Van'
on conflict (plate_number) do nothing;

-- =====================================================================
-- NOTES
-- =====================================================================
-- * After running this file, create your first accounts through the app's
--   Sign Up screen. The demo sign-up form lets you pick a role (Customer,
--   Staff, or Admin) so you can test all three portals. In a real
--   production deployment you would remove the role selector from sign-up
--   and instead have an Admin promote users from the "Manage Users" panel
--   (RLS already restricts role changes to admins).
-- * Realtime is optional. If you want live updates (e.g. staff sees new
--   booking requests instantly), enable Realtime on the "bookings" table
--   in Database -> Replication.
