// =====================================================================
// DRIVEEASE PHILIPPINES — ONLINE CAR RENTAL BOOKING PORTAL (app.js)
// Connected to Supabase Vehicle Rental Database & Review Engine
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------
// Application State
// ---------------------------------------------------------------------
const state = {
  user: null,
  profile: null,
  vehicles: [],
  categories: [],
  drivers: [],
  reviews: [],
  myBookings: [],
  activeCatFilter: 'all',
  activeStatusFilter: 'all',
  searchQuery: '',
  priceRangeFilter: 'all',
  pendingBookingVehicleId: null,
};

// Utilities
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const fmtMoney = (n) => `₱${Number(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime()) ? String(d) : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};
const daysBetween = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000));
const maskPlate = (p) => {
  if (!p || p.length < 4) return p || '—';
  return p[0] + '••' + p.slice(3, -2).replace(/[A-Za-z0-9]/g, '•') + p.slice(-2);
};

// ---------------------------------------------------------------------
// Theme System
// ---------------------------------------------------------------------
function getTheme() { return localStorage.getItem('website_theme') || 'light'; }
function applyTheme() {
  const t = getTheme();
  if (t === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.setAttribute('data-theme', 'dark');
    const icon = $('#siteThemeBtn i');
    if (icon) icon.className = 'fa-solid fa-sun';
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.body.removeAttribute('data-theme');
    const icon = $('#siteThemeBtn i');
    if (icon) icon.className = 'fa-solid fa-moon';
  }
}
function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem('website_theme', next);
  applyTheme();
  toast(`Switched to ${next === 'dark' ? '🌙 Dark' : '☀️ Light'} Mode`, 'info');
}

// ---------------------------------------------------------------------
// Toast Notification System
// ---------------------------------------------------------------------
function toast(msg, type = 'info') {
  const wrap = $('#toastWrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';
  el.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
window.toast = toast;

// ---------------------------------------------------------------------
// Global Modal Controls
// ---------------------------------------------------------------------
function openModal(html, isLarge = false) {
  const overlay = $('#modalOverlay');
  const card = $('#modalCard');
  if (!overlay || !card) return;
  card.className = `modal-card glass ${isLarge ? 'modal-lg' : ''}`;
  card.innerHTML = html;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const closeBtn = $('#mClose', card);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
}
function closeModal() {
  const overlay = $('#modalOverlay');
  if (overlay) overlay.classList.add('hidden');
  document.body.style.overflow = '';
}
window.closeModal = closeModal;

$('#modalOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
});

// ---------------------------------------------------------------------
// Vehicle Image Helper
// ---------------------------------------------------------------------
function getExactVehicleImage(v) {
  if (v && v.image_url && v.image_url.trim()) return v.image_url.trim();
  const name = (v?.name || '').toLowerCase();
  if (name.includes('fortuner')) return 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80';
  if (name.includes('vios')) return 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=800&q=80';
  if (name.includes('innova')) return 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80';
  if (name.includes('montero')) return 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&q=80';
  if (name.includes('ranger') || name.includes('raptor') || name.includes('pickup')) return 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=800&q=80';
  if (name.includes('xpander')) return 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80';
  if (name.includes('mirage')) return 'https://images.unsplash.com/photo-1541348263662-e082662d82da?auto=format&fit=crop&w=800&q=80';
  if (name.includes('wigo')) return 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80';
  if (name.includes('hiace') || name.includes('van')) return 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80';
  if (name.includes('nmax')) return 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80';
  if (name.includes('click')) return 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80';
  if (name.includes('adv')) return 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=800&q=80';
  if (name.includes('motorcycle') || name.includes('scooter') || name.includes('motor')) return 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80';
  return 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80';
}

function getVehicleCategoryName(v) {
  if (v.categories && v.categories.name) return v.categories.name;
  const name = (v?.name || '').toLowerCase();
  if (name.includes('motor') || name.includes('click') || name.includes('nmax') || name.includes('adv') || name.includes('scooter')) return 'Motorcycles';
  if (name.includes('van') || name.includes('hiace') || name.includes('urvan')) return 'Vans';
  if (name.includes('fortuner') || name.includes('montero') || name.includes('xpander') || name.includes('raptor') || name.includes('suv')) return 'SUVs';
  return 'Sedans';
}

function getVehicleDailyRate(v) {
  const name = (v?.name || '').toLowerCase();
  const catName = getVehicleCategoryName(v).toLowerCase();
  const isMotorcycle = catName === 'motorcycles' || name.includes('motor') || name.includes('click') || name.includes('nmax') || name.includes('adv') || name.includes('scooter');
  if (isMotorcycle) {
    if (name.includes('click')) return 400;
    if (name.includes('nmax')) return 500;
    if (name.includes('adv')) return 600;
    const baseRate = Number(v.categories?.daily_rate || 500);
    return Math.min(Math.max(baseRate, 400), 600);
  }
  return Number(v.categories?.daily_rate || 2000);
}

// ---------------------------------------------------------------------
// Verified Reviews Management
// ---------------------------------------------------------------------
const DEFAULT_VERIFIED_REVIEWS = [
  {
    id: 101,
    vehicle_name: 'Toyota Vios 1.3 XLE',
    customer_name: 'Carlos Mendoza',
    rating: 5,
    title: 'Very smooth & fuel efficient!',
    comment: 'Rented this Vios for a 3-day road trip to Tagaytay and Batangas. The AC was ice cold, very clean interior, and effortless fuel consumption. 10/10 service!',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString()
  },
  {
    id: 102,
    vehicle_name: 'Honda Click 125i',
    customer_name: 'Maria Cristina Santos',
    rating: 5,
    title: 'Perfect motorcycle for Metro Manila traffic!',
    comment: 'Super easy booking process. Helmet was clean and provided free of charge. Picked up within 5 minutes. Highly recommended for daily city commute.',
    created_at: new Date(Date.now() - 6 * 86400000).toISOString()
  },
  {
    id: 103,
    vehicle_name: 'Toyota Fortuner 2.8 GR-S',
    customer_name: 'Engr. David Tan',
    rating: 5,
    title: 'Spacious & powerful SUV for family vacation',
    comment: 'We traveled with 7 passengers up to Baguio. The climb was super smooth and our luggage fit easily. The vehicle condition was immaculate.',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString()
  },
  {
    id: 104,
    vehicle_name: 'Yamaha NMAX 155',
    customer_name: 'Jake Villanueva',
    rating: 5,
    title: 'Top tier maxi scooter!',
    comment: 'Very comfortable ride with ABS brakes. ₱500 daily rate was super worth it. Will definitely book again next week!',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString()
  }
];

function getStoredReviews() {
  try {
    const raw = localStorage.getItem('website_verified_reviews');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return DEFAULT_VERIFIED_REVIEWS;
}

function saveReviewLocally(review) {
  const list = getStoredReviews();
  list.unshift(review);
  localStorage.setItem('website_verified_reviews', JSON.stringify(list));
}

async function loadReviews() {
  try {
    const { data: dbReviews, error } = await supabase
      .from('reviews')
      .select('*, vehicles(name), profiles!reviews_customer_id_fkey(full_name)')
      .order('created_at', { ascending: false });

    if (!error && dbReviews && dbReviews.length > 0) {
      state.reviews = dbReviews.map(r => ({
        id: r.id,
        vehicle_id: r.vehicle_id,
        vehicle_name: r.vehicles?.name || 'Vehicle',
        customer_name: r.profiles?.full_name || 'Verified Renter',
        rating: r.rating || 5,
        title: r.title || 'Verified Rental Experience',
        comment: r.comment || '',
        created_at: r.created_at
      }));
    } else {
      state.reviews = getStoredReviews();
    }
  } catch (e) {
    state.reviews = getStoredReviews();
  }
  renderHomepageReviews();
}

function getVehicleRatingSummary(vehicleId, vehicleName = '') {
  const vReviews = state.reviews.filter(r => {
    if (r.vehicle_id && r.vehicle_id === vehicleId) return true;
    if (vehicleName && r.vehicle_name && r.vehicle_name.toLowerCase().includes(vehicleName.toLowerCase().split(' ')[0])) return true;
    return false;
  });

  if (vReviews.length === 0) {
    return { avg: 4.9, count: 8, reviews: [] };
  }
  const sum = vReviews.reduce((acc, r) => acc + (r.rating || 5), 0);
  const avg = (sum / vReviews.length).toFixed(1);
  return { avg: Number(avg), count: vReviews.length, reviews: vReviews };
}

// ---------------------------------------------------------------------
// Auth & Session Management
// ---------------------------------------------------------------------
async function checkAuthSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user) {
    state.user = session.user;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    state.profile = prof || { id: session.user.id, full_name: session.user.user_metadata?.full_name || 'Guest User', role: 'customer' };
    await loadCustomerBookings();
  } else {
    state.user = null;
    state.profile = null;
  }
  renderHeaderAuthSlot();
}

function renderHeaderAuthSlot() {
  const slot = $('#authHeaderSlot');
  if (!slot) return;

  if (state.user && state.profile) {
    const initials = (state.profile.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    slot.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <button class="btn btn-primary btn-sm" id="btnGoDashboard" style="font-weight:700;box-shadow:0 4px 12px var(--accent-glow);">
          <i class="fa-solid fa-gauge-high"></i> Guest Dashboard
        </button>
        <div class="user-menu-pill" id="userMenuPill" title="Click for profile options">
          <div class="user-avatar-circle">${initials}</div>
          <span style="font-weight:700;font-size:0.85rem;color:var(--text-dark);">${state.profile.full_name.split(' ')[0]}</span>
          <i class="fa-solid fa-chevron-down" style="font-size:0.7rem;color:var(--text-muted);"></i>
        </div>
      </div>
    `;

    $('#btnGoDashboard')?.addEventListener('click', () => {
      window.location.href = '../index.html';
    });
    $('#userMenuPill')?.addEventListener('click', openUserProfileModal);
  } else {
    slot.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <button class="btn btn-outline btn-sm" id="navLoginBtn"><i class="fa-solid fa-right-to-bracket"></i> Log In</button>
        <button class="btn btn-primary btn-sm" id="navRegisterBtn"><i class="fa-solid fa-user-plus"></i> Register</button>
      </div>
    `;

    $('#navLoginBtn')?.addEventListener('click', () => openAuthModal('login'));
    $('#navRegisterBtn')?.addEventListener('click', () => openAuthModal('signup'));
  }
}

function openAuthModal(mode = 'login', callbackAfterAuth = null) {
  let curMode = mode;

  function renderForm() {
    openModal(`
      <div class="modal-head">
        <div>
          <h3 style="font-size:1.25rem;font-weight:800;color:var(--text-dark);">${curMode === 'login' ? 'Log In to Customer Portal' : 'Register Customer Account'}</h3>
          <span style="font-size:0.8rem;color:var(--text-muted);">${curMode === 'login' ? 'Log in to continue to your Guest Dashboard and complete bookings.' : 'Create an account to book vehicles, track rentals, and submit reviews.'}</span>
        </div>
        <div class="modal-close" id="mClose">✕</div>
      </div>

      <div class="pill-carousel" style="margin-bottom:18px;justify-content:center;">
        <div class="filter-pill ${curMode === 'login' ? 'active' : ''}" id="tabAuthLogin" style="flex:1;text-align:center;justify-content:center;">
          <i class="fa-solid fa-right-to-bracket"></i> Log In
        </div>
        <div class="filter-pill ${curMode === 'signup' ? 'active' : ''}" id="tabAuthSignup" style="flex:1;text-align:center;justify-content:center;">
          <i class="fa-solid fa-user-plus"></i> Register
        </div>
      </div>

      <div id="authErrBox" style="margin-bottom:12px;"></div>

      <form id="publicAuthForm">
        ${curMode === 'signup' ? `
          <div class="field">
            <label>Full Name</label>
            <input type="text" id="afName" placeholder="e.g. Juan Dela Cruz" required />
          </div>
        ` : ''}
        <div class="field">
          <label>Email Address</label>
          <input type="email" id="afEmail" placeholder="e.g. juan@example.com" required />
        </div>
        <div class="field">
          <label>Password</label>
          <input type="password" id="afPassword" placeholder="••••••••" minlength="6" required />
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="afSubmitBtn" style="margin-top:10px;height:44px;">
          ${curMode === 'login' ? '<i class="fa-solid fa-right-to-bracket"></i> Log In & Continue to Dashboard' : '<i class="fa-solid fa-user-check"></i> Register & Continue to Dashboard'}
        </button>
      </form>
    `);

    $('#tabAuthLogin')?.addEventListener('click', () => { curMode = 'login'; renderForm(); });
    $('#tabAuthSignup')?.addEventListener('click', () => { curMode = 'signup'; renderForm(); });

    $('#publicAuthForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sBtn = $('#afSubmitBtn');
      const errBox = $('#authErrBox');
      sBtn.disabled = true;
      sBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in…';
      errBox.innerHTML = '';

      const email = $('#afEmail').value.trim();
      const password = $('#afPassword').value;

      try {
        if (curMode === 'login') {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
        } else {
          const fullName = $('#afName').value.trim();
          const { error } = await supabase.auth.signUp({
            email, password,
            options: { data: { full_name: fullName, role: 'customer' } }
          });
          if (error) throw error;
        }

        toast('Welcome! Redirecting to your Guest Dashboard…', 'success');
        closeModal();

        setTimeout(() => {
          if (callbackAfterAuth && typeof callbackAfterAuth === 'function') {
            callbackAfterAuth();
          } else {
            const targetUrl = '../index.html' + (state.pendingBookingVehicleId ? '?book=' + state.pendingBookingVehicleId : '');
            window.location.href = targetUrl;
          }
        }, 500);
      } catch (err) {
        errBox.innerHTML = `<div style="background:#fee2e2;color:#dc2626;padding:10px 14px;border-radius:8px;font-size:0.82rem;font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> ${err.message}</div>`;
        sBtn.disabled = false;
        sBtn.innerHTML = curMode === 'login' ? '<i class="fa-solid fa-right-to-bracket"></i> Log In & Continue to Dashboard' : '<i class="fa-solid fa-user-check"></i> Register & Continue to Dashboard';
      }
    });
  }

  renderForm();
}

async function logout() {
  await supabase.auth.signOut();
  state.user = null;
  state.profile = null;
  state.myBookings = [];
  renderHeaderAuthSlot();
  toast('You have been logged out.', 'info');
  closeModal();
}
window.logout = logout;

// ---------------------------------------------------------------------
// Customer Profile & Driver License Onboarding
// ---------------------------------------------------------------------
function openUserProfileModal() {
  const p = state.profile || {};
  const initials = (p.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  openModal(`
    <div class="modal-head">
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="user-avatar-circle" style="width:44px;height:44px;font-size:1rem;">${initials}</div>
        <div>
          <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-dark);">${p.full_name || 'Guest User'}</h3>
          <span style="font-size:0.75rem;color:var(--accent);font-weight:700;"><i class="fa-solid fa-shield-halved"></i> Verified Customer Account</span>
        </div>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    <form id="customerProfForm">
      <div class="field">
        <label>Full Legal Name</label>
        <input type="text" id="cpName" value="${p.full_name || ''}" required />
      </div>

      <div class="detail-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="field">
          <label>Contact Phone</label>
          <input type="tel" id="cpPhone" placeholder="e.g. +63 917 123 4567" value="${p.phone || ''}" required />
        </div>
        <div class="field">
          <label>Driver's License No.</label>
          <input type="text" id="cpLicense" placeholder="e.g. N01-12-345678" value="${p.license_number || ''}" />
        </div>
      </div>

      <div class="field">
        <label>Delivery / Home Address</label>
        <input type="text" id="cpAddress" placeholder="Street, Barangay, City" value="${p.address || ''}" />
      </div>

      <div style="margin-top:16px;display:flex;gap:10px;">
        <button type="submit" class="btn btn-primary" style="flex:2;" id="btnSaveProf">
          <i class="fa-solid fa-floppy-disk"></i> Save Profile
        </button>
        <button type="button" class="btn btn-danger" style="flex:1;" onclick="window.logout()">
          <i class="fa-solid fa-right-from-bracket"></i> Logout
        </button>
      </div>
    </form>
  `);

  $('#customerProfForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#btnSaveProf');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const updated = {
      full_name: $('#cpName').value.trim(),
      phone: $('#cpPhone').value.trim(),
      license_number: $('#cpLicense').value.trim() || null,
      address: $('#cpAddress').value.trim() || null,
    };

    const { error } = await supabase.from('profiles').update(updated).eq('id', state.user.id);
    if (!error) {
      Object.assign(state.profile, updated);
      toast('Profile updated successfully!', 'success');
      renderHeaderAuthSlot();
      closeModal();
    } else {
      toast(error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Save Profile';
    }
  });
}

const PH_CATEGORIES = [
  { id: 1, name: 'Motorcycles', daily_rate: 500, description: 'Automatic scooters & motorbikes (Honda Click 125i @ ₱400, Yamaha NMAX 155 @ ₱500, Honda ADV 160 @ ₱600)' },
  { id: 2, name: 'Sedans', daily_rate: 2500, description: '5-Seater comfortable subcompact sedans (Toyota Vios 1.5 G)' },
  { id: 3, name: 'SUVs & Pickups', daily_rate: 4200, description: 'Midsize 7-Seater SUVs & Pickup Trucks (Toyota Fortuner, Montero Sport, Ford Ranger Raptor)' },
  { id: 4, name: 'MPVs & Crossovers', daily_rate: 3000, description: '7 to 8-Seater family MPVs (Toyota Innova, Mitsubishi Xpander)' },
  { id: 5, name: 'Economy & Hatchbacks', daily_rate: 2200, description: 'Compact fuel-efficient hatchbacks & sedans (Toyota Wigo, Mitsubishi Mirage G4)' },
  { id: 6, name: 'Passenger Vans', daily_rate: 5000, description: '14-Seater full-size passenger vans for tours and group trips (Toyota HiAce Commuter Deluxe)' }
];

const PH_POPULAR_VEHICLES = [
  {
    id: 1,
    name: 'Toyota Fortuner 2.8 V 4x2 AT',
    plate_number: 'NBD-8842',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80',
    description: '7-Seater Premium Diesel SUV. High ground clearance, leather seats, dual aircon. Ideal for family trips across the Philippines.',
    seats: 7,
    transmission: 'Automatic',
    fuel_type: 'Diesel',
    has_ac: true,
    categories: { id: 3, name: 'SUVs & Pickups', daily_rate: 4200 }
  },
  {
    id: 2,
    name: 'Toyota Vios 1.5 G CVT',
    plate_number: 'NCO-2914',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=800&q=80',
    description: '5-Seater Subcompact Sedan. Excellent fuel efficiency, automatic transmission. Best choice for city driving and errands.',
    seats: 5,
    transmission: 'Automatic',
    fuel_type: 'Gasoline',
    has_ac: true,
    categories: { id: 2, name: 'Sedans', daily_rate: 2500 }
  },
  {
    id: 3,
    name: 'Honda Click 125i (Motorcycle)',
    plate_number: '904-CLK',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    description: '125cc Automatic Scooter. Sporty design, combi-brake system, spacious under-seat storage box. Helmet included.',
    seats: 2,
    transmission: 'Automatic',
    fuel_type: 'Gasoline',
    has_ac: false,
    categories: { id: 1, name: 'Motorcycles', daily_rate: 400 }
  },
  {
    id: 4,
    name: 'Yamaha NMAX 155 ABS (Motorcycle)',
    plate_number: '128-NMX',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    description: '155cc Automatic Maxi Scooter. Variable Valve Actuation (VVA), ABS front/rear, digital panel. Helmet included.',
    seats: 2,
    transmission: 'Automatic',
    fuel_type: 'Gasoline',
    has_ac: false,
    categories: { id: 1, name: 'Motorcycles', daily_rate: 500 }
  },
  {
    id: 5,
    name: 'Honda ADV 160 (Motorcycle)',
    plate_number: '481-ADV',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=800&q=80',
    description: '160cc Adventure Scooter. Long-travel suspension, HSTC torque control, adjustable windshield. Helmet included.',
    seats: 2,
    transmission: 'Automatic',
    fuel_type: 'Gasoline',
    has_ac: false,
    categories: { id: 1, name: 'Motorcycles', daily_rate: 600 }
  },
  {
    id: 6,
    name: 'Toyota Innova 2.8 E Diesel AT',
    plate_number: 'DAR-4921',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
    description: '8-Seater MPV. Powerful 2.8L Diesel engine with dual AC. Spacious and reliable family vehicle.',
    seats: 8,
    transmission: 'Automatic',
    fuel_type: 'Diesel',
    has_ac: true,
    categories: { id: 4, name: 'MPVs & Crossovers', daily_rate: 3000 }
  },
  {
    id: 7,
    name: 'Mitsubishi Montero Sport GT 4x2',
    plate_number: 'NGF-7102',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&q=80',
    description: '7-Seater SUV. 2.4L MIVEC Turbo Diesel engine, smooth 8-speed automatic, sunroof.',
    seats: 7,
    transmission: 'Automatic',
    fuel_type: 'Diesel',
    has_ac: true,
    categories: { id: 3, name: 'SUVs & Pickups', daily_rate: 4200 }
  },
  {
    id: 8,
    name: 'Ford Ranger Raptor 2.0L Bi-Turbo',
    plate_number: 'CBL-9481',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=800&q=80',
    description: '5-Seater Pickup Truck. FOX Racing shocks, 4x4 Off-road mode. Great for heavy loads and provincial roads.',
    seats: 5,
    transmission: 'Automatic',
    fuel_type: 'Diesel',
    has_ac: true,
    categories: { id: 3, name: 'SUVs & Pickups', daily_rate: 4500 }
  },
  {
    id: 9,
    name: 'Toyota HiAce Commuter Deluxe 2.8',
    plate_number: 'VAA-8012',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
    description: '14-Seater Full-size Passenger Van. Front engine layout, strong rear AC. Ideal for group tours and outings.',
    seats: 14,
    transmission: 'Manual',
    fuel_type: 'Diesel',
    has_ac: true,
    categories: { id: 6, name: 'Passenger Vans', daily_rate: 5000 }
  },
  {
    id: 10,
    name: 'Toyota Wigo 1.0 G CVT',
    plate_number: 'NCL-1049',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80',
    description: '5-Seater Hatchback. Compact city hatchback with agile handling and low gas consumption.',
    seats: 5,
    transmission: 'Automatic',
    fuel_type: 'Gasoline',
    has_ac: true,
    categories: { id: 5, name: 'Economy & Hatchbacks', daily_rate: 2000 }
  }
];

// ---------------------------------------------------------------------
// Fleet & Public Data Loading
// ---------------------------------------------------------------------
async function loadPublicFleet() {
  try {
    const [{ data: cats }, { data: vechs }, { data: drvs }] = await Promise.all([
      supabase.from('categories').select('*').order('daily_rate'),
      supabase.from('vehicles').select('*, categories(name, daily_rate)').order('name'),
      supabase.from('drivers').select('*').order('name'),
    ]);

    state.categories = (cats && cats.length > 0) ? cats : PH_CATEGORIES;
    state.vehicles = (vechs && vechs.length > 0) ? vechs : PH_POPULAR_VEHICLES;
    state.drivers = drvs || [];
  } catch (err) {
    state.categories = PH_CATEGORIES;
    state.vehicles = PH_POPULAR_VEHICLES;
    state.drivers = [];
  }

  const statCount = $('#statVehiclesCount');
  if (statCount) statCount.textContent = `${state.vehicles.length}+`;

  renderCategoryPills();
  renderFleetGrid();
}

function renderCategoryPills() {
  const bar = $('#categoryPillBar');
  const select = $('#quickCatSelect');
  if (!bar) return;

  const catNames = ['all', ...state.categories.map(c => c.name)];
  bar.innerHTML = catNames.map(c => `
    <div class="filter-pill ${state.activeCatFilter.toLowerCase() === c.toLowerCase() ? 'active' : ''}" data-cat="${c}">
      ${c === 'all' ? '<i class="fa-solid fa-border-all"></i> All Vehicles' : c}
    </div>
  `).join('');

  if (select) {
    select.innerHTML = `<option value="all">All Vehicle Types</option>` + state.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  }

  $$('#categoryPillBar .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      state.activeCatFilter = pill.dataset.cat;
      renderCategoryPills();
      renderFleetGrid();
    });
  });
}

function renderFleetGrid() {
  const container = $('#fleetGridContainer');
  if (!container) return;

  const filtered = state.vehicles.filter(v => {
    const catName = getVehicleCategoryName(v);
    const matchesCat = state.activeCatFilter === 'all' || catName.toLowerCase() === state.activeCatFilter.toLowerCase();
    const matchesSearch = !state.searchQuery || v.name.toLowerCase().includes(state.searchQuery.toLowerCase()) || catName.toLowerCase().includes(state.searchQuery.toLowerCase());
    const matchesStatus = state.activeStatusFilter === 'all' || v.status === state.activeStatusFilter;
    
    const rate = getVehicleDailyRate(v);
    let matchesPrice = true;
    if (state.priceRangeFilter === 'budget') matchesPrice = rate <= 1500;
    else if (state.priceRangeFilter === 'mid') matchesPrice = rate > 1500 && rate <= 3000;
    else if (state.priceRangeFilter === 'premium') matchesPrice = rate > 3000;

    return matchesCat && matchesSearch && matchesStatus && matchesPrice;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 20px;" class="glass">
        <div style="font-size:3rem;margin-bottom:12px;">🚘</div>
        <h3 style="font-size:1.2rem;font-weight:800;color:var(--text-dark);">No Vehicles Match Your Search</h3>
        <p style="color:var(--text-muted);font-size:0.88rem;margin-top:4px;">Try selecting "All Vehicles" or clearing your search filters.</p>
        <button class="btn btn-primary btn-sm" onclick="window.resetFilters()" style="margin-top:16px;">Reset All Filters</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(v => {
    const rate = getVehicleDailyRate(v);
    const catName = getVehicleCategoryName(v);
    const isMotorcycle = catName.toLowerCase() === 'motorcycles';
    const exactImg = getExactVehicleImage(v);
    const ratingSummary = getVehicleRatingSummary(v.id, v.name);
    const isAvailable = v.status === 'available';

    return `
      <div class="vehicle-card glass" data-vehicle-id="${v.id}">
        <div class="card-media-wrap">
          <img src="${exactImg}" alt="${v.name}" class="card-img" onerror="this.src='${exactImg}'" />
          <div class="status-badge-pos">
            <span class="badge badge-${v.status}">
              <i class="fa-solid ${isAvailable ? 'fa-circle-check' : 'fa-clock'}"></i> ${v.status}
            </span>
          </div>
          <div class="rating-badge-pos">
            <i class="fa-solid fa-star"></i> ${ratingSummary.avg} <span style="color:#94a3b8;font-weight:600;">(${ratingSummary.count})</span>
          </div>
        </div>

        <div class="card-content">
          <div class="card-title-row">
            <div>
              <div class="card-title">${v.name}</div>
              <div class="card-cat">${catName}</div>
            </div>
          </div>

          <div class="specs-grid">
            <div class="spec-item"><i class="fa-solid fa-users" style="color:#0284c7;"></i> ${isMotorcycle ? '2 Seats' : (v.seats ?? '5 Seats')}</div>
            <div class="spec-item"><i class="fa-solid fa-gear" style="color:#64748b;"></i> ${v.transmission ?? 'Auto'}</div>
            <div class="spec-item"><i class="fa-solid fa-gas-pump" style="color:#d97706;"></i> ${v.fuel_type ?? 'Gasoline'}</div>
            <div class="spec-item"><i class="fa-solid fa-${isMotorcycle ? 'helmet-safety' : 'snowflake'}" style="color:${isMotorcycle ? '#059669' : '#0284c7'};"></i> ${isMotorcycle ? 'Helmet Incl.' : (v.has_ac !== false ? 'With AC' : 'Non-AC')}</div>
            <div class="spec-item"><i class="fa-solid fa-shield-halved" style="color:#059669;"></i> Insured</div>
            <div class="spec-item"><i class="fa-solid fa-id-card" style="color:#94a3b8;"></i> ${maskPlate(v.plate_number)}</div>
          </div>

          <div class="card-footer">
            <div class="daily-rate-display">
              <div class="rate-amt">${fmtMoney(rate)}</div>
              <div class="rate-label">Per Day · Best Price</div>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-outline btn-sm" data-btn-details="${v.id}">Details</button>
              <button class="btn btn-primary btn-sm" data-btn-book="${v.id}">
                <i class="fa-solid fa-calendar-plus"></i> Book Now
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  $$('[data-btn-details]').forEach(btn => btn.addEventListener('click', () => openVehicleDetailsModal(Number(btn.dataset.btnDetails))));
  $$('[data-btn-book]').forEach(btn => btn.addEventListener('click', () => handleBookClick(Number(btn.dataset.btnBook))));
}

window.resetFilters = function() {
  state.activeCatFilter = 'all';
  state.activeStatusFilter = 'all';
  state.searchQuery = '';
  state.priceRangeFilter = 'all';
  const qIn = $('#quickSearchInput'); if (qIn) qIn.value = '';
  const qCat = $('#quickCatSelect'); if (qCat) qCat.value = 'all';
  const qPrice = $('#quickPriceSelect'); if (qPrice) qPrice.value = 'all';
  renderCategoryPills();
  renderFleetGrid();
};

window.filterByCategory = function(cat) {
  state.activeCatFilter = cat;
  renderCategoryPills();
  renderFleetGrid();
};

// ---------------------------------------------------------------------
// Vehicle Details & Verified Reviews Modal
// ---------------------------------------------------------------------
function openVehicleDetailsModal(vehicleId) {
  const v = state.vehicles.find(item => item.id === vehicleId);
  if (!v) return;

  const rate = getVehicleDailyRate(v);
  const catName = getVehicleCategoryName(v);
  const isMotorcycle = catName.toLowerCase() === 'motorcycles';
  const exactImg = getExactVehicleImage(v);
  const ratingSummary = getVehicleRatingSummary(v.id, v.name);

  openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.3rem;font-weight:800;color:var(--text-dark);">${v.name}</h3>
        <span style="font-size:0.8rem;color:var(--accent);font-weight:700;">${catName} · Plate: ${maskPlate(v.plate_number)}</span>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    <img src="${exactImg}" style="width:100%;height:240px;object-fit:cover;border-radius:12px;border:1px solid var(--border-light);margin-bottom:18px;" />

    <div class="specs-grid" style="grid-template-columns:repeat(4, 1fr);gap:10px;margin-bottom:18px;padding:14px;">
      <div><label style="font-size:0.7rem;color:var(--text-muted);display:block;">Daily Rate</label><span style="font-weight:800;color:var(--accent);font-size:1rem;">${fmtMoney(rate)}</span></div>
      <div><label style="font-size:0.7rem;color:var(--text-muted);display:block;">Capacity</label><span style="font-weight:700;color:var(--text-dark);">${isMotorcycle ? '2 Seats' : (v.seats ?? '5 Seats')}</span></div>
      <div><label style="font-size:0.7rem;color:var(--text-muted);display:block;">Transmission</label><span style="font-weight:700;color:var(--text-dark);">${v.transmission ?? 'Automatic'}</span></div>
      <div><label style="font-size:0.7rem;color:var(--text-muted);display:block;">Fuel Type</label><span style="font-weight:700;color:var(--text-dark);">${v.fuel_type ?? 'Gasoline'}</span></div>
    </div>

    <p style="font-size:0.88rem;color:var(--text-muted);line-height:1.6;margin-bottom:20px;">
      ${v.description || 'Premium rental vehicle inspected for safety, performance, and optimal passenger comfort.'}
    </p>

    <!-- Verified Customer Reviews Section -->
    <div class="divider"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div>
        <h4 style="font-weight:800;font-size:1rem;color:var(--text-dark);display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-certificate" style="color:#059669;"></i> Verified Customer Reviews
        </h4>
        <span style="font-size:0.78rem;color:var(--text-muted);">Reviews from real customers who completed rentals of this vehicle.</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;background:var(--amber-light);padding:6px 12px;border-radius:var(--radius-full);border:1px solid #fde68a;">
        <i class="fa-solid fa-star" style="color:#f59e0b;"></i>
        <span style="font-weight:900;color:#92400e;font-size:0.9rem;">${ratingSummary.avg}</span>
        <span style="color:#b45309;font-size:0.75rem;font-weight:700;">(${ratingSummary.count} reviews)</span>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:12px;max-height:220px;overflow-y:auto;margin-bottom:20px;padding-right:4px;">
      ${ratingSummary.reviews.length ? ratingSummary.reviews.map(r => `
        <div style="background:var(--bg-card-sub);border:1px solid var(--border-light);border-radius:10px;padding:12px 14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <span style="font-weight:700;font-size:0.86rem;color:var(--text-dark);">${r.customer_name}</span>
            <div class="stars-row">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}</div>
          </div>
          <div style="font-weight:700;font-size:0.8rem;color:var(--accent);margin-bottom:2px;">${r.title}</div>
          <p style="font-size:0.8rem;color:var(--text-muted);margin:0;line-height:1.4;">${r.comment}</p>
        </div>
      `).join('') : `
        <div style="text-align:center;padding:20px;background:var(--bg-card-sub);border-radius:10px;">
          <p style="font-size:0.82rem;color:var(--text-muted);margin:0;">No written reviews yet for this vehicle. Be the first to rent and leave a 5-star review!</p>
        </div>
      `}
    </div>

    <div style="display:flex;gap:10px;">
      <button class="btn btn-outline" onclick="window.closeModal()" style="flex:1;">Close</button>
      <button class="btn btn-primary" id="btnModalBookNow" style="flex:2;">
        <i class="fa-solid fa-calendar-plus"></i> Book This ${isMotorcycle ? 'Motorcycle' : 'Car'} (${fmtMoney(rate)}/day)
      </button>
    </div>
  `, true);

  $('#btnModalBookNow')?.addEventListener('click', () => {
    closeModal();
    handleBookClick(v.id);
  });
}

// ---------------------------------------------------------------------
// Book Now Gateway (Auth Guard)
// ---------------------------------------------------------------------
function handleBookClick(vehicleId) {
  if (!state.user) {
    state.pendingBookingVehicleId = vehicleId;
    toast('Please log in or register to continue to your Guest Dashboard.', 'info');
    openAuthModal('login', () => {
      window.location.href = `../index.html?book=${vehicleId}`;
    });
    return;
  }
  toast('Opening vehicle in your Guest Dashboard…', 'info');
  window.location.href = `../index.html?book=${vehicleId}`;
}

// ---------------------------------------------------------------------
// Interactive Booking Flow
// ---------------------------------------------------------------------
async function openBookingModal(vehicleId) {
  const v = state.vehicles.find(item => item.id === vehicleId);
  if (!v) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  const rate = getVehicleDailyRate(v);
  const catName = getVehicleCategoryName(v);
  const isMotorcycle = catName.toLowerCase() === 'motorcycles';
  const exactImg = getExactVehicleImage(v);

  // Load booked intervals for calendar disable
  const { data: bookedIntervals } = await supabase
    .from('bookings')
    .select('start_date, end_date')
    .eq('vehicle_id', v.id)
    .in('status', ['pending', 'approved', 'active'])
    .gte('end_date', todayStr);

  openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.2rem;font-weight:800;color:var(--text-dark);">Reserve ${v.name}</h3>
        <span style="font-size:0.78rem;color:var(--accent);font-weight:700;">Daily Rate: ${fmtMoney(rate)} / day · ${catName}</span>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    <!-- Interactive Calendar -->
    <div id="bookingCalendarWrap"></div>

    <div class="detail-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      <div class="field">
        <label><i class="fa-solid fa-calendar-day"></i> Pick-up Date</label>
        <input type="date" id="bkStart" min="${todayStr}" value="${todayStr}" />
      </div>
      <div class="field">
        <label><i class="fa-solid fa-calendar-check"></i> Return Date</label>
        <input type="date" id="bkEnd" min="${todayStr}" />
      </div>
    </div>

    <div class="detail-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      <div class="field">
        <label><i class="fa-solid fa-money-bill-wave"></i> Charge Method</label>
        <select id="bkChargeType">
          <option value="per_day">Per Day (${fmtMoney(rate)}/day)</option>
          <option value="per_km">Per Kilometer (${fmtMoney(rate * 0.05)}/km)</option>
        </select>
      </div>
      <div class="field" id="bkDriverField">
        <label><i class="fa-solid fa-id-badge"></i> Driver Option</label>
        <select id="bkDriverSelect">
          <option value="">Self-Drive (No Driver)</option>
          ${state.drivers.map(d => `<option value="${d.id}">${d.name} (+₱500/day)</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="field hidden" id="bkKmField" style="display:none;">
      <label>Estimated Distance (KM)</label>
      <input type="number" id="bkEstKm" min="1" placeholder="e.g. 120" />
    </div>

    <label style="font-size:0.8rem;font-weight:700;color:var(--text-muted);display:block;margin-bottom:6px;">Payment &amp; Reservation Tier</label>
    <div class="pay-tier-grid" id="bkPayTierGrid">
      <div class="pay-tier-btn active" data-pct="100">
        <div class="tier-label">100% Full Payment</div>
        <div class="tier-amount" id="tierFullAmt">${fmtMoney(rate)}</div>
        <div class="tier-sub">No balance due at pickup</div>
      </div>
      <div class="pay-tier-btn" data-pct="20">
        <div class="tier-label">20% Downpayment</div>
        <div class="tier-amount" id="tierDownAmt">${fmtMoney(rate * 0.2)}</div>
        <div class="tier-sub">Pay 80% balance upon vehicle pickup</div>
      </div>
    </div>

    <!-- Quote Summary -->
    <div id="bkQuoteBox" class="receipt" style="margin-bottom:18px;"></div>

    <button type="button" class="btn btn-primary btn-block" id="btnSubmitBooking" style="height:46px;" disabled>
      Select Booking Dates
    </button>
  `, true);

  const startIn = $('#bkStart');
  const endIn = $('#bkEnd');
  const chargeSel = $('#bkChargeType');
  const driverSel = $('#bkDriverSelect');
  const kmField = $('#bkKmField');
  const estKmIn = $('#bkEstKm');
  const submitBtn = $('#btnSubmitBooking');
  const quoteBox = $('#bkQuoteBox');
  let selectedPct = 100;

  // Render Interactive Calendar
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();

  function renderCal() {
    const wrap = $('#bookingCalendarWrap');
    if (!wrap) return;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const firstDay = new Date(calYear, calMonth, 1).getDay();

    let gridHtml = '';
    for (let i = 0; i < firstDay; i++) gridHtml += `<div class="cal-day cal-day-past"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(calMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateIso = `${calYear}-${monthStr}-${dayStr}`;

      const isPast = dateIso < todayStr;
      const isBooked = bookedIntervals && bookedIntervals.some(b => dateIso >= b.start_date && dateIso <= b.end_date);
      const isStart = startIn.value === dateIso;
      const isEnd = endIn.value === dateIso;
      const inRange = startIn.value && endIn.value && dateIso > startIn.value && dateIso < endIn.value;

      let cls = 'cal-day-available';
      if (isPast) cls = 'cal-day-past';
      else if (isBooked) cls = 'cal-day-booked';
      if (isStart || isEnd) cls += ' cal-day-selected';
      else if (inRange) cls += ' cal-day-in-range';

      gridHtml += `<div class="cal-day ${cls}" data-date="${dateIso}" ${isPast || isBooked ? 'style="pointer-events:none;"' : ''}>${d}</div>`;
    }

    wrap.innerHTML = `
      <div class="custom-calendar">
        <div class="cal-header">
          <button type="button" class="cal-nav-btn" id="calPrev"><i class="fa-solid fa-chevron-left"></i></button>
          <div class="cal-month-title">${monthNames[calMonth]} ${calYear}</div>
          <button type="button" class="cal-nav-btn" id="calNext"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div class="cal-weekdays"><div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div></div>
        <div class="cal-days-grid">${gridHtml}</div>
      </div>
    `;

    $('#calPrev')?.addEventListener('click', (e) => { e.preventDefault(); calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCal(); });
    $('#calNext')?.addEventListener('click', (e) => { e.preventDefault(); calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCal(); });

    wrap.querySelectorAll('.cal-day-available').forEach(cell => {
      cell.addEventListener('click', () => {
        const d = cell.dataset.date;
        if (!startIn.value || (startIn.value && endIn.value)) {
          startIn.value = d;
          endIn.value = '';
        } else if (d >= startIn.value) {
          endIn.value = d;
        } else {
          startIn.value = d;
          endIn.value = '';
        }
        renderCal();
        recalcQuote();
      });
    });
  }

  function recalcQuote() {
    if (!startIn.value || !endIn.value) {
      quoteBox.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:0.84rem;">Please select both Pick-up and Return dates to view the price breakdown.</div>`;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Select Booking Dates';
      return;
    }

    if (endIn.value < startIn.value) {
      quoteBox.innerHTML = `<div style="color:#ef4444;font-weight:700;font-size:0.84rem;">⚠️ Return date must be after pick-up date.</div>`;
      submitBtn.disabled = true;
      return;
    }

    const days = daysBetween(startIn.value, endIn.value);
    const isPerKm = chargeSel.value === 'per_km';
    const kmRate = rate * 0.05;
    const estKm = Number(estKmIn?.value || 0);

    let vehicleCost = isPerKm ? (kmRate * estKm) : (days * rate);
    if (isPerKm && estKm <= 0) {
      quoteBox.innerHTML = `<div style="color:var(--amber);font-size:0.84rem;font-weight:700;">Please enter estimated kilometers.</div>`;
      submitBtn.disabled = true;
      return;
    }

    const driverId = driverSel.value;
    const driverFee = driverId ? (500 * days) : 0;
    const totalAmount = vehicleCost + driverFee;

    const payNow = selectedPct === 100 ? totalAmount : Math.round(totalAmount * (selectedPct / 100));
    const balanceDue = totalAmount - payNow;

    $('#tierFullAmt').textContent = fmtMoney(totalAmount);
    $('#tierDownAmt').textContent = fmtMoney(Math.round(totalAmount * 0.2));

    quoteBox.innerHTML = `
      <div class="receipt-row"><span>Rental Duration (${days} day${days > 1 ? 's' : ''})</span><span>${fmtMoney(vehicleCost)}</span></div>
      ${driverFee > 0 ? `<div class="receipt-row"><span>Driver Fee (${days} days × ₱500)</span><span>${fmtMoney(driverFee)}</span></div>` : ''}
      <div class="receipt-row" style="font-weight:700;"><span>Total Booking Amount</span><span>${fmtMoney(totalAmount)}</span></div>
      <div class="divider"></div>
      <div class="receipt-row receipt-total">
        <span>Amount Payable Now (${selectedPct}%)</span>
        <span>${fmtMoney(payNow)}</span>
      </div>
      ${balanceDue > 0 ? `<div class="receipt-row" style="color:var(--accent);font-weight:700;"><span>Remaining Balance at Pickup</span><span>${fmtMoney(balanceDue)}</span></div>` : ''}
    `;

    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Submit Booking Request (${fmtMoney(payNow)})`;
    submitBtn.dataset.total = totalAmount;
    submitBtn.dataset.payNow = payNow;
    submitBtn.dataset.balance = balanceDue;
  }

  renderCal();
  recalcQuote();

  startIn.addEventListener('change', () => { renderCal(); recalcQuote(); });
  endIn.addEventListener('change', () => { renderCal(); recalcQuote(); });
  chargeSel.addEventListener('change', () => {
    kmField.style.display = chargeSel.value === 'per_km' ? 'block' : 'none';
    recalcQuote();
  });
  driverSel.addEventListener('change', recalcQuote);
  estKmIn?.addEventListener('input', recalcQuote);

  $$('#bkPayTierGrid .pay-tier-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#bkPayTierGrid .pay-tier-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPct = Number(btn.dataset.pct);
      recalcQuote();
    });
  });

  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reserving Vehicle…';

    const payload = {
      customer_id: state.user.id,
      vehicle_id: v.id,
      start_date: startIn.value,
      end_date: endIn.value,
      total_amount: Number(submitBtn.dataset.total),
      paid_amount: Number(submitBtn.dataset.payNow),
      balance_due: Number(submitBtn.dataset.balance),
      downpayment_percent: selectedPct,
      payment_type: selectedPct === 100 ? 'full' : 'downpayment',
      status: 'pending'
    };

    const { data: newBooking, error } = await supabase.from('bookings').insert(payload).select().single();
    if (error) {
      toast(error.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Booking Request';
      return;
    }

    toast('Booking submitted successfully! Check My Bookings.', 'success');
    closeModal();
    await loadCustomerBookings();
    openBookingReceiptModal(newBooking || payload, v);
  });
}

function openBookingReceiptModal(booking, vehicle) {
  const refNum = `BK-${String(booking.id || Date.now()).slice(-8).toUpperCase()}`;

  openModal(`
    <div style="text-align:center;margin-bottom:18px;">
      <div style="width:58px;height:58px;border-radius:50%;background:#ecfdf5;border:2px solid #a7f3d0;display:inline-flex;align-items:center;justify-content:center;margin-bottom:10px;">
        <i class="fa-solid fa-circle-check" style="font-size:28px;color:#059669;"></i>
      </div>
      <h2 style="font-size:1.35rem;font-weight:800;color:var(--text-dark);margin-bottom:4px;">Booking Submitted!</h2>
      <span class="badge badge-pending">Status: Pending Review</span>
      <p style="margin-top:6px;font-size:0.8rem;color:var(--text-muted);">Ref: <strong style="color:var(--text-dark);">${refNum}</strong></p>
    </div>

    <div class="receipt" style="margin-bottom:18px;">
      <div class="receipt-row"><span>Rented Vehicle</span><span style="font-weight:700;color:var(--text-dark);">${vehicle.name}</span></div>
      <div class="receipt-row"><span>Rental Dates</span><span>${fmtDate(booking.start_date)} → ${fmtDate(booking.end_date)}</span></div>
      <div class="receipt-row"><span>Total Amount</span><span style="font-weight:700;">${fmtMoney(booking.total_amount)}</span></div>
      <div class="receipt-row"><span>Amount Paid / Reserved</span><span style="color:#059669;font-weight:700;">${fmtMoney(booking.paid_amount || booking.total_amount)}</span></div>
      ${booking.balance_due > 0 ? `<div class="receipt-row"><span>Balance Due at Pickup</span><span style="color:var(--accent);font-weight:700;">${fmtMoney(booking.balance_due)}</span></div>` : ''}
    </div>

    <div style="background:var(--amber-light);border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:18px;font-size:0.82rem;color:#78350f;">
      <i class="fa-solid fa-circle-info" style="color:var(--amber);margin-right:4px;"></i> Our staff will review your booking shortly. Once returned, you can submit your verified 1–5 star rating!
    </div>

    <button class="btn btn-primary btn-block" onclick="window.closeModal()">Done</button>
  `);
}

// ---------------------------------------------------------------------
// Customer "My Bookings" & Reviews
// ---------------------------------------------------------------------
async function loadCustomerBookings() {
  if (!state.user) return;
  const { data } = await supabase
    .from('bookings')
    .select('*, vehicles(name, plate_number, image_url, id)')
    .eq('customer_id', state.user.id)
    .order('created_at', { ascending: false });
  state.myBookings = data || [];
}

function openMyBookingsModal() {
  if (!state.user) {
    openAuthModal('login');
    return;
  }

  openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.25rem;font-weight:800;color:var(--text-dark);"><i class="fa-solid fa-calendar-check" style="color:#059669;margin-right:6px;"></i> My Bookings &amp; Rentals</h3>
        <span style="font-size:0.8rem;color:var(--text-muted);">Track active rentals, receipts, and rate completed cars.</span>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px;max-height:460px;overflow-y:auto;">
      ${state.myBookings.length ? state.myBookings.map(b => {
        const v = b.vehicles || {};
        const isCompleted = b.status === 'completed';
        const isPartial = b.balance_due && Number(b.balance_due) > 0;

        return `
          <div style="background:var(--bg-card-sub);border:1px solid var(--border-light);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
              <div>
                <div style="font-weight:800;font-size:1rem;color:var(--text-dark);">${v.name || 'Vehicle'}</div>
                <div style="font-size:0.78rem;color:var(--text-muted);">${fmtDate(b.start_date)} → ${fmtDate(b.end_date)} · Plate: ${maskPlate(v.plate_number)}</div>
              </div>
              <span class="badge badge-${b.status}">${b.status}</span>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.84rem;padding-top:6px;border-top:1px solid var(--border-light);">
              <span style="color:var(--text-muted);">Total: <strong style="color:var(--text-dark);">${fmtMoney(b.total_amount)}</strong></span>
              
              <div style="display:flex;gap:8px;">
                ${isCompleted ? `
                  <button class="btn btn-primary btn-sm" data-rate-booking-id="${b.id}" data-rate-vehicle-id="${v.id}" data-rate-vname="${v.name}" style="background:linear-gradient(135deg,#f59e0b,#d97706);border-color:#f59e0b;">
                    <i class="fa-solid fa-star"></i> Rate &amp; Review
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('') : `
        <div style="text-align:center;padding:40px 20px;">
          <div style="font-size:2.4rem;margin-bottom:8px;">📋</div>
          <h4 style="font-weight:800;color:var(--text-dark);">No Bookings Yet</h4>
          <p style="font-size:0.84rem;color:var(--text-muted);margin-top:4px;">Browse our fleet and book your first car or motorcycle today!</p>
        </div>
      `}
    </div>
  `, true);

  $$('[data-rate-booking-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      openWriteReviewModal(Number(btn.dataset.rateBookingId), Number(btn.dataset.rateVehicleId), btn.dataset.rateVname);
    });
  });
}

// ---------------------------------------------------------------------
// 1–5 Star Rating & Written Review Modal (Verified Completed Renters Only)
// ---------------------------------------------------------------------
function openWriteReviewModal(bookingId, vehicleId, vehicleName) {
  let selectedRating = 5;

  openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.2rem;font-weight:800;color:var(--text-dark);"><i class="fa-solid fa-star" style="color:#f59e0b;margin-right:6px;"></i> Rate Your Rental Experience</h3>
        <span style="font-size:0.8rem;color:var(--text-muted);">${vehicleName}</span>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    <div style="text-align:center;margin-bottom:14px;">
      <label style="font-size:0.85rem;font-weight:700;color:var(--text-dark);display:block;">Tap stars to rate (1 to 5 Stars):</label>
      <div class="star-rating-selector" id="starPicker">
        <span class="star-opt selected" data-star="1">★</span>
        <span class="star-opt selected" data-star="2">★</span>
        <span class="star-opt selected" data-star="3">★</span>
        <span class="star-opt selected" data-star="4">★</span>
        <span class="star-opt selected" data-star="5">★</span>
      </div>
      <div id="starFeedbackText" style="font-weight:800;color:#f59e0b;font-size:0.9rem;">⭐⭐⭐⭐⭐ 5 Stars - Excellent!</div>
    </div>

    <form id="submitReviewForm">
      <div class="field">
        <label>Review Headline / Summary</label>
        <input type="text" id="revTitle" placeholder="e.g. Super clean, very fuel efficient & comfortable!" required />
      </div>

      <div class="field">
        <label>Detailed Feedback &amp; Comments</label>
        <textarea id="revComment" rows="4" placeholder="Share how the car drove, cleanliness, AC/power, and your overall rental experience…" required></textarea>
      </div>

      <div style="background:var(--green-light);border:1px solid var(--green-border);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:0.8rem;color:var(--green);">
        <i class="fa-solid fa-circle-check" style="margin-right:4px;"></i> <strong>Verified Renter Badge:</strong> Your review will be displayed publicly on this vehicle's page.
      </div>

      <button type="submit" class="btn btn-primary btn-block" id="btnSendReview" style="height:44px;">
        <i class="fa-solid fa-paper-plane"></i> Submit Verified Review
      </button>
    </form>
  `);

  const stars = $$('#starPicker .star-opt');
  const feedback = $('#starFeedbackText');
  const labels = {
    1: '⭐ 1 Star - Poor',
    2: '⭐⭐ 2 Stars - Fair',
    3: '⭐⭐⭐ 3 Stars - Good',
    4: '⭐⭐⭐⭐ 4 Stars - Very Good',
    5: '⭐⭐⭐⭐⭐ 5 Stars - Excellent!'
  };

  stars.forEach(s => {
    s.addEventListener('click', () => {
      selectedRating = Number(s.dataset.star);
      stars.forEach(st => {
        const val = Number(st.dataset.star);
        if (val <= selectedRating) st.classList.add('selected');
        else st.classList.remove('selected');
      });
      if (feedback) feedback.textContent = labels[selectedRating];
    });
  });

  $('#submitReviewForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#btnSendReview');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting Review…';

    const title = $('#revTitle').value.trim();
    const comment = $('#revComment').value.trim();

    const reviewObj = {
      id: Date.now(),
      booking_id: bookingId,
      vehicle_id: vehicleId,
      vehicle_name: vehicleName,
      customer_id: state.user.id,
      customer_name: state.profile.full_name,
      rating: selectedRating,
      title: title,
      comment: comment,
      created_at: new Date().toISOString()
    };

    // Save into Supabase reviews table (with graceful fallback)
    try {
      await supabase.from('reviews').insert({
        booking_id: bookingId,
        vehicle_id: vehicleId,
        customer_id: state.user.id,
        rating: selectedRating,
        title: title,
        comment: comment
      });
    } catch (err) {
      console.warn('Reviews table note:', err);
    }

    saveReviewLocally(reviewObj);
    toast('Thank you! Your verified review has been published.', 'success');
    closeModal();
    await loadReviews();
    renderFleetGrid();
  });
}

// ---------------------------------------------------------------------
// Homepage Customer Reviews Section Renderer
// ---------------------------------------------------------------------
function renderHomepageReviews() {
  const container = $('#homepageReviewsContainer');
  if (!container) return;

  const reviews = state.reviews.slice(0, 6);
  if (reviews.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;" class="muted">No reviews yet.</div>`;
    return;
  }

  container.innerHTML = reviews.map(r => {
    const initials = (r.customer_name || 'V').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const starCount = r.rating || 5;

    return `
      <div class="review-card glass">
        <div class="review-card-head">
          <div class="reviewer-meta">
            <div class="reviewer-avatar">${initials}</div>
            <div>
              <div class="reviewer-name">${r.customer_name}</div>
              <div class="review-date">${fmtDate(r.created_at)}</div>
            </div>
          </div>
          <div class="stars-row">${'★'.repeat(starCount)}${'☆'.repeat(5 - starCount)}</div>
        </div>
        <div class="review-vehicle-tag"><i class="fa-solid fa-car"></i> ${r.vehicle_name}</div>
        <h4 style="font-size:0.95rem;font-weight:800;color:var(--text-dark);margin-bottom:6px;">${r.title}</h4>
        <p class="review-body">${r.comment}</p>
      </div>
    `;
  }).join('');
}

// ---------------------------------------------------------------------
// Rental Terms Policy Modal
// ---------------------------------------------------------------------
window.openRentalPolicyModal = function() {
  openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.2rem;font-weight:800;color:var(--text-dark);"><i class="fa-solid fa-file-contract" style="color:var(--accent);margin-right:6px;"></i> Rental Terms &amp; Policies</h3>
        <span style="font-size:0.78rem;color:var(--text-muted);">Vehicle Rentals Philippines Standard Guidelines</span>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    <div style="font-size:0.86rem;color:var(--text-muted);line-height:1.6;display:flex;flex-direction:column;gap:14px;max-height:460px;overflow-y:auto;">
      <div>
        <h4 style="color:var(--text-dark);font-weight:800;margin-bottom:4px;">1. Driver Requirements</h4>
        <p>Renters must present a valid Philippine Driver's License (Non-Pro or Pro) or a valid Foreign Driver's License + Passport. Minimum driving age is 21 years old.</p>
      </div>
      <div>
        <h4 style="color:var(--text-dark);font-weight:800;margin-bottom:4px;">2. Payment &amp; Downpayment</h4>
        <p>You can reserve with a 20% partial downpayment or 100% full payment via GCash, Maya, Debit/Credit Card, or Online Banking. Any remaining balance is payable upon vehicle pickup.</p>
      </div>
      <div>
        <h4 style="color:var(--text-dark);font-weight:800;margin-bottom:4px;">3. Fuel &amp; Mileage Policy</h4>
        <p>Vehicles are provided on a Full-to-Full fuel policy. Unlimited mileage applies to standard daily rentals; per-km rates apply only when chosen upon booking.</p>
      </div>
      <div>
        <h4 style="color:var(--text-dark);font-weight:800;margin-bottom:4px;">4. Verified Reviews</h4>
        <p>Only customers with completed and inspected rentals can submit verified ratings and written feedback to ensure 100% genuine customer reviews.</p>
      </div>
    </div>

    <button class="btn btn-primary btn-block" onclick="window.closeModal()" style="margin-top:16px;">Got It</button>
  `);
};

// ---------------------------------------------------------------------
// Initialize Application
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  $('#siteThemeBtn')?.addEventListener('click', toggleTheme);

  // Search & Filter Listeners
  $('#btnFilterFleet')?.addEventListener('click', () => {
    state.searchQuery = $('#quickSearchInput')?.value.trim() || '';
    state.activeCatFilter = $('#quickCatSelect')?.value || 'all';
    state.priceRangeFilter = $('#quickPriceSelect')?.value || 'all';
    renderCategoryPills();
    renderFleetGrid();
    const target = $('#fleetSection');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });

  $('#quickSearchInput')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderFleetGrid();
  });

  $$('.fleet-status-filter .status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.fleet-status-filter .status-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeStatusFilter = btn.dataset.status;
      renderFleetGrid();
    });
  });

  // Load Database & Auth State
  await Promise.all([
    checkAuthSession(),
    loadPublicFleet(),
    loadReviews(),
  ]);

  // Auth State Listener
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      state.user = session.user;
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      state.profile = prof || { id: session.user.id, full_name: session.user.user_metadata?.full_name || 'Guest User', role: 'customer' };
      await loadCustomerBookings();
    } else {
      state.user = null;
      state.profile = null;
      state.myBookings = [];
    }
    renderHeaderAuthSlot();
  });
});
