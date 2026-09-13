import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL = 'https://uksfvfpglqvcxogtzbnl.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrc2Z2ZnBnbHF2Y3hvZ3R6Ym5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NDcyMTMsImV4cCI6MjEwNDQyMzIxM30.LYeyovNa4LnDf93AET6Qlxg8bh9A2F6XfXbJVVlpHOI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
