-- =====================================================================
-- FIX PUBLIC ACCESS FOR ONLINE BOOKING WEBSITE
-- Run this in your Supabase Dashboard -> SQL Editor -> Click "Run"
-- This allows unauthenticated visitors to read categories, vehicles, and reviews.
-- =====================================================================

-- 1. Enable Public Read on CATEGORIES
DROP POLICY IF EXISTS "categories: anyone signed in can read" ON public.categories;
DROP POLICY IF EXISTS "categories: public can read" ON public.categories;
CREATE POLICY "categories: public can read" 
  ON public.categories FOR SELECT 
  USING (true);

-- 2. Enable Public Read on VEHICLES
DROP POLICY IF EXISTS "vehicles: anyone signed in can read" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles: public can read" ON public.vehicles;
CREATE POLICY "vehicles: public can read" 
  ON public.vehicles FOR SELECT 
  USING (true);

-- 3. Enable Public Read on REVIEWS
DROP POLICY IF EXISTS "Allow public read reviews" ON public.reviews;
CREATE POLICY "Allow public read reviews" 
  ON public.reviews FOR SELECT 
  USING (true);
