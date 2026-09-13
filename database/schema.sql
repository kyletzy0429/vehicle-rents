-- =====================================================================
-- COMPLETE DATABASE SCHEMA & RESET SCRIPT (VEHICLE RENTALS)
-- =====================================================================

-- 1. CLEAN RESET (Drop dependent objects in correct order)
DROP TABLE IF EXISTS public.service_history CASCADE;
DROP TABLE IF EXISTS public.driver_assignments CASCADE;
DROP TABLE IF EXISTS public.drivers CASCADE;
DROP TABLE IF EXISTS public.receipts CASCADE;
DROP TABLE IF EXISTS public.rental_returns CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.current_role() CASCADE;

-- 2. CORE AUTH & PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'staff', 'admin')) DEFAULT 'customer',
  phone TEXT,
  license_number TEXT,
  license_expiry DATE,
  license_id_url TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(new.raw_user_meta_data->>'role', 'customer'),
    new.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 3. VEHICLE CATEGORIES
CREATE TABLE public.categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  daily_rate NUMERIC(10,2) NOT NULL CHECK (daily_rate >= 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. VEHICLES
CREATE TABLE public.vehicles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  category_id BIGINT REFERENCES public.categories(id) ON DELETE SET NULL,
  plate_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('available', 'rented', 'maintenance', 'in_service', 'scheduled_maint', 'off_the_road')
  ) DEFAULT 'available',
  seats INT DEFAULT 5,
  transmission TEXT DEFAULT 'Automatic',
  fuel_type TEXT DEFAULT 'Gasoline',
  has_ac BOOLEAN DEFAULT TRUE,
  maintenance_days INT,
  maintenance_until TIMESTAMPTZ,
  image_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. BOOKINGS
CREATE TABLE public.bookings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_id BIGINT NOT NULL REFERENCES public.vehicles(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'approved', 'rejected', 'active', 'completed', 'cancelled', 'refund_requested', 'refunded')
  ) DEFAULT 'pending',
  total_amount NUMERIC(10,2),
  paid_amount NUMERIC(10,2) DEFAULT 0,
  balance_due NUMERIC(10,2) DEFAULT 0,
  payment_type TEXT DEFAULT 'full',
  downpayment_percent INT DEFAULT 100,
  reviewed_by UUID REFERENCES public.profiles(id),
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

-- 6. PAYMENTS
CREATE TABLE public.payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  method TEXT DEFAULT 'card',
  status TEXT NOT NULL CHECK (status IN ('pending', 'successful', 'failed')) DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. RENTAL RETURNS
CREATE TABLE public.rental_returns (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  return_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  condition_notes TEXT,
  has_damage BOOLEAN NOT NULL DEFAULT FALSE,
  additional_charges NUMERIC(10,2) NOT NULL DEFAULT 0,
  inspected_by UUID REFERENCES public.profiles(id)
);

-- 8. RECEIPTS
CREATE TABLE public.receipts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  receipt_number TEXT UNIQUE NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. DRIVERS & DRIVER ASSIGNMENTS
CREATE TABLE public.drivers (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  license_type TEXT DEFAULT 'Professional',
  experience_years INT DEFAULT 3,
  rating NUMERIC(3,2) DEFAULT 4.80,
  daily_fee NUMERIC(10,2) DEFAULT 500.00,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'unavailable')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.driver_assignments (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  booking_id BIGINT REFERENCES public.bookings(id) ON DELETE CASCADE,
  driver_id BIGINT REFERENCES public.drivers(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. SERVICE HISTORY
CREATE TABLE public.service_history (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  vehicle_id BIGINT REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  service_status TEXT DEFAULT 'in_service' CHECK (service_status IN ('in_service', 'scheduled', 'completed')),
  description TEXT,
  cost NUMERIC(10,2) DEFAULT 0.00,
  serviced_by TEXT,
  start_date DATE DEFAULT CURRENT_DATE,
  completion_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_returns    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_history   ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "profiles: viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles: users can update own, staff/admin update any"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.current_role() IN ('staff', 'admin'))
  WITH CHECK (
    (public.current_role() IN ('staff', 'admin'))
    OR
    (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
  );

CREATE POLICY "profiles: insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Categories Policies
CREATE POLICY "categories: viewable by everyone"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "categories: admin can insert/update/delete"
  ON public.categories FOR ALL
  USING (public.current_role() = 'admin')
  WITH CHECK (public.current_role() = 'admin');

-- Vehicles Policies
CREATE POLICY "vehicles: viewable by everyone"
  ON public.vehicles FOR SELECT
  USING (true);

CREATE POLICY "vehicles: staff/admin manage"
  ON public.vehicles FOR ALL
  USING (public.current_role() IN ('staff', 'admin'))
  WITH CHECK (public.current_role() IN ('staff', 'admin'));

-- Bookings Policies
CREATE POLICY "bookings: staff/admin full access"
  ON public.bookings FOR ALL
  USING (public.current_role() IN ('staff', 'admin'))
  WITH CHECK (public.current_role() IN ('staff', 'admin'));

CREATE POLICY "bookings: customer reads own"
  ON public.bookings FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "bookings: customer creates own pending booking"
  ON public.bookings FOR INSERT
  WITH CHECK (customer_id = auth.uid() AND status = 'pending');

CREATE POLICY "bookings: customer updates status"
  ON public.bookings FOR UPDATE
  USING (public.current_role() IN ('staff', 'admin') OR customer_id = auth.uid())
  WITH CHECK (public.current_role() IN ('staff', 'admin') OR customer_id = auth.uid());

-- Payments Policies
CREATE POLICY "payments: staff/admin full access"
  ON public.payments FOR ALL
  USING (public.current_role() IN ('staff', 'admin'))
  WITH CHECK (public.current_role() IN ('staff', 'admin'));

CREATE POLICY "payments: customer reads own"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = payments.booking_id AND b.customer_id = auth.uid()
    )
  );

CREATE POLICY "payments: customer can insert"
  ON public.payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = payments.booking_id AND b.customer_id = auth.uid()
    )
  );

-- Returns Policies
CREATE POLICY "returns: staff/admin full access"
  ON public.rental_returns FOR ALL
  USING (public.current_role() IN ('staff', 'admin'))
  WITH CHECK (public.current_role() IN ('staff', 'admin'));

CREATE POLICY "returns: customer reads own"
  ON public.rental_returns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = rental_returns.booking_id AND b.customer_id = auth.uid()
    )
  );

-- Receipts Policies
CREATE POLICY "receipts: staff/admin full access"
  ON public.receipts FOR ALL
  USING (public.current_role() IN ('staff', 'admin'))
  WITH CHECK (public.current_role() IN ('staff', 'admin'));

CREATE POLICY "receipts: customer reads own"
  ON public.receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = receipts.booking_id AND b.customer_id = auth.uid()
    )
  );

CREATE POLICY "receipts: customer can insert"
  ON public.receipts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = receipts.booking_id AND b.customer_id = auth.uid()
    )
  );

-- Drivers Policies
CREATE POLICY "Allow read access on drivers" ON public.drivers FOR SELECT USING (true);
CREATE POLICY "Allow write access on drivers" ON public.drivers FOR ALL USING (true);

-- Driver Assignments Policies
CREATE POLICY "Allow read access on driver_assignments" ON public.driver_assignments FOR SELECT USING (true);
CREATE POLICY "Allow write access on driver_assignments" ON public.driver_assignments FOR ALL USING (true);

-- Service History Policies
CREATE POLICY "Allow read access on service_history" ON public.service_history FOR SELECT USING (true);
CREATE POLICY "Allow write access on service_history" ON public.service_history FOR ALL USING (true);

-- =====================================================================
-- SEED DATA (CATEGORIES, VEHICLES, DRIVERS)
-- =====================================================================

-- Seed existing auth users into profiles if re-running
INSERT INTO public.profiles (id, full_name, role, phone)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', 'User'), COALESCE(raw_user_meta_data->>'role', 'customer'), raw_user_meta_data->>'phone'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Seed Categories
INSERT INTO public.categories (name, daily_rate, description) VALUES
  ('Motorcycles', 500.00, 'Automatic scooters & motorbikes (Honda Click 125i @ ₱400, Yamaha NMAX 155 @ ₱500, Honda ADV 160 @ ₱600)'),
  ('Economy & Hatchbacks', 2200.00, 'Compact fuel-efficient hatchbacks & sedans (Toyota Wigo, Mitsubishi Mirage G4)'),
  ('Sedans', 2500.00, '5-Seater comfortable subcompact sedans (Toyota Vios 1.5 G)'),
  ('MPVs & Crossovers', 3000.00, '7 to 8-Seater family MPVs (Toyota Innova, Mitsubishi Xpander)'),
  ('SUVs & Pickups', 4200.00, 'Midsize 7-Seater SUVs & Pickup Trucks (Toyota Fortuner, Montero Sport, Ford Ranger Raptor)'),
  ('Passenger Vans', 5000.00, '14-Seater full-size passenger vans for tours and group trips (Toyota HiAce Commuter Deluxe)')
ON CONFLICT (name) DO NOTHING;

-- Seed Vehicles
INSERT INTO public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
SELECT 'Toyota Fortuner 2.8 V 4x2 AT', id, 'NBD-8842', 'available', 7, 'Automatic', 'images/fortuner.webp', '7-Seater Premium Diesel SUV. High ground clearance, leather seats, dual aircon. Ideal for family trips across the Philippines.'
FROM public.categories WHERE name = 'SUVs & Pickups'
ON CONFLICT (plate_number) DO NOTHING;

INSERT INTO public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
SELECT 'Toyota Vios 1.5 G CVT', id, 'NCO-2914', 'available', 5, 'Automatic', 'images/vios.webp', '5-Seater Subcompact Sedan. Excellent fuel efficiency, automatic transmission. Best choice for city driving and errands.'
FROM public.categories WHERE name = 'Sedans'
ON CONFLICT (plate_number) DO NOTHING;

INSERT INTO public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
SELECT 'Toyota Innova 2.8 E Diesel AT', id, 'DAR-4921', 'available', 8, 'Automatic', 'images/innova.webp', '8-Seater MPV. Powerful 2.8L Diesel engine with dual AC. Spacious and reliable family vehicle.'
FROM public.categories WHERE name = 'MPVs & Crossovers'
ON CONFLICT (plate_number) DO NOTHING;

INSERT INTO public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
SELECT 'Mitsubishi Montero Sport GT 4x2', id, 'NGF-7102', 'available', 7, 'Automatic', 'images/montero.webp', '7-Seater SUV. 2.4L MIVEC Turbo Diesel engine, smooth 8-speed automatic, sunroof.'
FROM public.categories WHERE name = 'SUVs & Pickups'
ON CONFLICT (plate_number) DO NOTHING;

INSERT INTO public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
SELECT 'Ford Ranger Raptor 2.0L Bi-Turbo', id, 'CBL-9481', 'available', 5, 'Automatic', 'images/raptor.webp', '5-Seater Pickup Truck. FOX Racing shocks, 4x4 Off-road mode. Great for heavy loads and provincial roads.'
FROM public.categories WHERE name = 'SUVs & Pickups'
ON CONFLICT (plate_number) DO NOTHING;

INSERT INTO public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
SELECT 'Mitsubishi Xpander GLS 1.5 AT', id, 'NBF-3910', 'available', 7, 'Automatic', 'images/xpander.webp', '7-Seater Modern Crossover MPV. Spacious 3-row seating, flexible cargo space, high ground clearance.'
FROM public.categories WHERE name = 'MPVs & Crossovers'
ON CONFLICT (plate_number) DO NOTHING;

INSERT INTO public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
SELECT 'Mitsubishi Mirage G4 GLX AT', id, 'NDB-5012', 'available', 5, 'Automatic', 'images/mirage.webp', '5-Seater Economy Sedan. Highly fuel-efficient 1.2L engine. Compact and easy to drive in city traffic.'
FROM public.categories WHERE name = 'Economy & Hatchbacks'
ON CONFLICT (plate_number) DO NOTHING;

INSERT INTO public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
SELECT 'Toyota Wigo 1.0 G CVT', id, 'NCL-1049', 'available', 5, 'Automatic', 'images/wigo.webp', '5-Seater Hatchback. Compact city hatchback with agile handling and low gas consumption.'
FROM public.categories WHERE name = 'Economy & Hatchbacks'
ON CONFLICT (plate_number) DO NOTHING;

INSERT INTO public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
SELECT 'Toyota HiAce Commuter Deluxe 2.8', id, 'VAA-8012', 'available', 14, 'Manual', 'images/hiace.webp', '14-Seater Full-size Passenger Van. Front engine layout, strong rear AC. Ideal for group tours and outings.'
FROM public.categories WHERE name = 'Passenger Vans'
ON CONFLICT (plate_number) DO NOTHING;

INSERT INTO public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
SELECT 'Yamaha NMAX 155 ABS (Motorcycle)', id, '128-NMX', 'available', 2, 'Automatic', 'images/nmax.webp', '155cc Automatic Maxi Scooter. Variable Valve Actuation (VVA), ABS front/rear, digital panel. Premium scooter.'
FROM public.categories WHERE name = 'Motorcycles'
ON CONFLICT (plate_number) DO NOTHING;

INSERT INTO public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
SELECT 'Honda Click 125i (Motorcycle)', id, '904-CLK', 'available', 2, 'Automatic', 'images/click.webp', '125cc Automatic Scooter. Sporty design, combi-brake system, spacious under-seat storage box.'
FROM public.categories WHERE name = 'Motorcycles'
ON CONFLICT (plate_number) DO NOTHING;

INSERT INTO public.vehicles (name, category_id, plate_number, status, seats, transmission, image_url, description)
SELECT 'Honda ADV 160 (Motorcycle)', id, '481-ADV', 'available', 2, 'Automatic', 'images/adv.webp', '160cc Adventure Scooter. Long-travel suspension, HSTC torque control, adjustable windshield.'
FROM public.categories WHERE name = 'Motorcycles'
ON CONFLICT (plate_number) DO NOTHING;

-- Seed Drivers
INSERT INTO public.drivers (name, phone, license_type, experience_years, rating, daily_fee, status)
SELECT 'Ramon Santos', '+63 917 555 1024', 'Professional (Rest. 1,2,3)', 6, 4.90, 500.00, 'available'
WHERE NOT EXISTS (SELECT 1 FROM public.drivers WHERE name = 'Ramon Santos');

INSERT INTO public.drivers (name, phone, license_type, experience_years, rating, daily_fee, status)
SELECT 'Eduardo Reyes', '+63 918 444 8812', 'Professional Heavy', 8, 4.85, 500.00, 'available'
WHERE NOT EXISTS (SELECT 1 FROM public.drivers WHERE name = 'Eduardo Reyes');

-- 11. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
