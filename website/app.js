// =====================================================================
// RENTFLOW PUBLIC CUSTOMER WEBSITE — LOGIC & SUPABASE INTEGRATION
// =====================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  user: null,
  profile: null,
  vehicles: [],
  categories: [],
  drivers: [],
  selectedCategory: 'all',
  searchQuery: '',
  maxPrice: 99999,
};

// HELPER FUNCTIONS
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

function fmtMoney(amount) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount || 0);
}

function fmtDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysBetween(start, end) {
  const d1 = new Date(start), d2 = new Date(end);
  const diffTime = d2 - d1;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 1;
}

function maskPlate(plate) {
  if (!plate) return '—';
  const str = String(plate).trim();
  if (str.length <= 3) return str;
  return str.slice(0, 3) + '-***';
}

function toast(msg, type = 'info') {
  let box = $('#toastWrap');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toastWrap';
    box.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  const bg = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#2563eb';
  el.style.cssText = `background:${bg};color:#fff;padding:12px 20px;border-radius:10px;font-size:0.85rem;font-weight:700;box-shadow:0 8px 20px rgba(0,0,0,0.15);font-family:sans-serif;`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function openModal(htmlContent) {
  let overlay = $('#appModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'appModalOverlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<div class="modal">${htmlContent}</div>`;
  setTimeout(() => overlay.classList.add('active'), 10);
  return overlay;
}

function closeModal() {
  const overlay = $('#appModalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 250);
  }
}

// ---------------------------------------------------------------------
// BOOTSTRAP & AUTHENTICATION
// ---------------------------------------------------------------------
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    state.user = session.user;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', state.user.id).single();
    state.profile = prof || { full_name: state.user.email, role: 'customer' };
  }

  updateNavAuth();
  await Promise.all([loadCategories(), loadVehicles(), loadDrivers()]);
  renderCategories();
  renderVehicles();
  attachEventListeners();
}

function updateNavAuth() {
  const box = $('#navAuthBox');
  const myBookingsBtn = $('#navBookings');

  if (state.user) {
    if (myBookingsBtn) myBookingsBtn.style.display = 'block';
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-weight:800;font-size:0.8rem;display:flex;align-items:center;justify-content:center;">
          ${(state.profile?.full_name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <span style="font-weight:700;font-size:0.86rem;color:#0f172a;">${state.profile?.full_name || 'Customer'}</span>
        <button type="button" class="btn btn-ghost btn-sm" id="btnLogout" style="color:#ef4444;"><i class="fa-solid fa-right-from-bracket"></i></button>
      </div>
    `;
    const btnLogout = $('#btnLogout');
    if (btnLogout) btnLogout.addEventListener('click', handleLogout);
  } else {
    if (myBookingsBtn) myBookingsBtn.style.display = 'none';
    box.innerHTML = `
      <button type="button" class="btn btn-outline" id="btnLogin">Log In</button>
      <button type="button" class="btn btn-primary" id="btnRegister">Sign Up</button>
    `;
    $('#btnLogin').addEventListener('click', () => openAuthModal('login'));
    $('#btnRegister').addEventListener('click', () => openAuthModal('signup'));
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
  state.user = null;
  state.profile = null;
  toast('Signed out successfully.', 'info');
  updateNavAuth();
}

function openAuthModal(mode = 'login') {
  const overlay = $('#authModal');
  if (!overlay) return;
  overlay.classList.add('active');

  const tabLogin = $('#tabLoginBtn');
  const tabSignup = $('#tabSignupBtn');
  const formLogin = $('#loginForm');
  const formSignup = $('#signupForm');
  const title = $('#authModalTitle');

  function setMode(m) {
    if (m === 'login') {
      title.textContent = 'Sign In to Your Account';
      tabLogin.className = 'btn btn-block btn-primary';
      tabSignup.className = 'btn btn-block btn-ghost';
      formLogin.style.display = 'block';
      formSignup.style.display = 'none';
    } else {
      title.textContent = 'Create Customer Account';
      tabLogin.className = 'btn btn-block btn-ghost';
      tabSignup.className = 'btn btn-block btn-primary';
      formLogin.style.display = 'none';
      formSignup.style.display = 'block';
    }
  }

  setMode(mode);
  tabLogin.onclick = () => setMode('login');
  tabSignup.onclick = () => setMode('signup');
  $('#authClose').onclick = () => overlay.classList.remove('active');
}

// ---------------------------------------------------------------------
// CUSTOMER SIGNUP (FORCED ROLE: CUSTOMER — NO ROLE SELECTOR)
// ---------------------------------------------------------------------
$('#signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#regName').value.trim();
  const phone = $('#regPhone').value.trim();
  const email = $('#regEmail').value.trim();
  const password = $('#regPassword').value;

  const btn = $('#subSignupBtn');
  btn.disabled = true;
  btn.textContent = 'Creating Customer Account…';

  // Automatically assign role: 'customer'
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        phone: phone,
        role: 'customer' // Mandatory Customer Role
      }
    }
  });

  if (error) {
    toast(error.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Register Customer Account';
    return;
  }

  // Insert or update profile row in public.profiles table
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      full_name: name,
      phone: phone,
      role: 'customer', // Customer Role
    });
  }

  toast('Registration successful! Signing you in…', 'success');
  state.user = data.user;
  state.profile = { full_name: name, phone: phone, role: 'customer' };

  $('#authModal').classList.remove('active');
  updateNavAuth();
});

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#loginEmail').value.trim();
  const password = $('#loginPassword').value;

  const btn = $('#subLoginBtn');
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    toast(error.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Sign In';
    return;
  }

  state.user = data.user;
  const { data: prof } = await supabase.from('profiles').select('*').eq('id', state.user.id).single();
  state.profile = prof || { full_name: email, role: 'customer' };

  toast(`Welcome back, ${state.profile.full_name}!`, 'success');
  $('#authModal').classList.remove('active');
  updateNavAuth();
});

// ---------------------------------------------------------------------
// LOAD DATA FROM DATABASE WITH PUBLIC FALLBACKS
// ---------------------------------------------------------------------
const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Sedans' },
  { id: 2, name: 'MPVs & Crossovers' },
  { id: 3, name: 'SUVs & Pickups' },
  { id: 4, name: 'Motorcycles' },
  { id: 5, name: 'Passenger Vans' }
];

const DEFAULT_VEHICLES = [
  { id: 1, name: 'Toyota Vios 1.3 XLE', category_id: 1, plate_number: 'NGL-8821', status: 'available', seats: 5, transmission: 'Automatic', fuel_type: 'Gasoline', has_ac: true, daily_rate: 2500, image_url: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800&auto=format&fit=crop&q=80' },
  { id: 2, name: 'Toyota Innova 2.8 E Diesel', category_id: 2, plate_number: 'CAK-4019', status: 'available', seats: 7, transmission: 'Automatic', fuel_type: 'Diesel', has_ac: true, daily_rate: 3200, image_url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80' },
  { id: 3, name: 'Toyota Fortuner 2.8 Q 4x2', category_id: 3, plate_number: 'DAN-7712', status: 'available', seats: 7, transmission: 'Automatic', fuel_type: 'Diesel', has_ac: true, daily_rate: 4200, image_url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&auto=format&fit=crop&q=80' },
  { id: 4, name: 'Ford Ranger Raptor 2.0L Bi-Turbo', category_id: 3, plate_number: 'NEO-1092', status: 'available', seats: 5, transmission: 'Automatic', fuel_type: 'Diesel', has_ac: true, daily_rate: 4500, image_url: 'https://images.unsplash.com/photo-1551830820-330a71b99659?w=800&auto=format&fit=crop&q=80' },
  { id: 5, name: 'Yamaha NMAX 155 ABS', category_id: 4, plate_number: 'MC-4821', status: 'available', seats: 2, transmission: 'Automatic', fuel_type: 'Gasoline', has_ac: false, daily_rate: 2000, image_url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80' },
  { id: 6, name: 'Toyota HiAce Commuter Deluxe 3.0L', category_id: 5, plate_number: 'VAN-9081', status: 'available', seats: 14, transmission: 'Manual', fuel_type: 'Diesel', has_ac: true, daily_rate: 5000, image_url: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&auto=format&fit=crop&q=80' }
];

async function loadCategories() {
  try {
    const { data } = await supabase.from('categories').select('*').order('name');
    state.categories = (data && data.length) ? data : DEFAULT_CATEGORIES;
  } catch (e) {
    state.categories = DEFAULT_CATEGORIES;
  }
}

async function loadVehicles() {
  try {
    const { data } = await supabase.from('vehicles').select('*').order('name');
    state.vehicles = (data && data.length) ? data : DEFAULT_VEHICLES;
  } catch (e) {
    state.vehicles = DEFAULT_VEHICLES;
  }
}

async function loadDrivers() {
  try {
    const { data } = await supabase.from('drivers').select('*').order('name');
    state.drivers = (data || []).map(d => ({ ...d, daily_fee: Number(d.daily_fee || 0) < 500 ? 500 : Number(d.daily_fee) }));
  } catch (e) {
    state.drivers = [
      { id: 1, name: 'Ramon Santos', phone: '+63 917 555 1024', license_type: 'Professional', rating: 4.90, daily_fee: 500, status: 'available' },
      { id: 2, name: 'Eduardo Reyes', phone: '+63 918 444 8812', license_type: 'Professional Heavy', rating: 4.85, daily_fee: 500, status: 'available' }
    ];
  }
}

function getVehicleRate(v) {
  if (v.categories?.daily_rate && Number(v.categories.daily_rate) >= 2000) return Number(v.categories.daily_rate);
  if (v.daily_rate && Number(v.daily_rate) >= 2000) return Number(v.daily_rate);
  const name = (v.name || '').toLowerCase();
  if (name.includes('nmax') || name.includes('click') || name.includes('adv')) return 2000;
  if (name.includes('wigo') || name.includes('mirage')) return 2300;
  if (name.includes('vios')) return 2500;
  if (name.includes('innova') || name.includes('xpander')) return 3200;
  if (name.includes('fortuner') || name.includes('montero')) return 4200;
  if (name.includes('ranger') || name.includes('raptor')) return 4500;
  if (name.includes('hiace') || name.includes('van')) return 5000;
  return 2200;
}

function getVehicleCategory(v) {
  if (v.categories?.name) return v.categories.name;
  const name = (v.name || '').toLowerCase();
  if (name.includes('nmax') || name.includes('click') || name.includes('adv')) return 'Motorcycles';
  if (name.includes('wigo') || name.includes('mirage')) return 'Economy & Hatchbacks';
  if (name.includes('vios')) return 'Sedans';
  if (name.includes('innova') || name.includes('xpander')) return 'MPVs & Crossovers';
  if (name.includes('fortuner') || name.includes('montero') || name.includes('ranger')) return 'SUVs & Pickups';
  if (name.includes('hiace') || name.includes('van')) return 'Passenger Vans';
  return 'Standard';
}

function getVehicleImage(v) {
  if (v.image_url && v.image_url.startsWith('http')) return v.image_url;
  const name = (v.name || '').toLowerCase();
  if (name.includes('vios')) return 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800&auto=format&fit=crop&q=80';
  if (name.includes('innova')) return 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80';
  if (name.includes('fortuner')) return 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&auto=format&fit=crop&q=80';
  if (name.includes('nmax')) return 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80';
  return 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&auto=format&fit=crop&q=80';
}

// ---------------------------------------------------------------------
// RENDER VEHICLES & CATEGORIES
// ---------------------------------------------------------------------
function renderCategories() {
  const pillsBox = $('#categoryPills');
  const selCat = $('#searchCategory');

  let catHTML = `<div class="cat-pill ${state.selectedCategory === 'all' ? 'active' : ''}" data-cat="all">All Vehicles</div>`;
  let selHTML = `<option value="all">All Vehicle Types</option>`;

  state.categories.forEach(c => {
    catHTML += `<div class="cat-pill ${state.selectedCategory === String(c.id) ? 'active' : ''}" data-cat="${c.id}">${c.name}</div>`;
    selHTML += `<option value="${c.id}">${c.name}</option>`;
  });

  pillsBox.innerHTML = catHTML;
  selCat.innerHTML = selHTML;

  $$('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      $$('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.selectedCategory = pill.dataset.cat;
      renderVehicles();
    });
  });
}

function renderVehicles() {
  const grid = $('#vehiclesGrid');

  const filtered = state.vehicles.filter(v => {
    const rate = getVehicleRate(v);
    const catName = getVehicleCategory(v);
    const matchesCat = state.selectedCategory === 'all' || String(v.category_id) === state.selectedCategory || catName === state.selectedCategory;
    const matchesQuery = !state.searchQuery || v.name.toLowerCase().includes(state.searchQuery.toLowerCase()) || (v.plate_number && v.plate_number.toLowerCase().includes(state.searchQuery.toLowerCase()));
    const matchesPrice = rate <= state.maxPrice;
    return matchesCat && matchesQuery && matchesPrice;
  });

  if (!filtered.length) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: white; border-radius: 16px; border: 1px solid #e2e8f0;">
        <i class="fa-solid fa-car-side" style="font-size: 40px; color: #94a3b8; margin-bottom: 12px;"></i>
        <h3 style="font-weight: 800; color: #0f172a;">No Vehicles Match Your Search</h3>
        <p style="color: #64748b; font-size: 0.9rem; margin-top: 4px;">Try adjusting your category filter or search keywords.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(v => {
    const rate = getVehicleRate(v);
    const catName = getVehicleCategory(v);
    const imgUrl = getVehicleImage(v);
    const isAvailable = v.status === 'available';

    const statusBadge = isAvailable
      ? `<span class="badge badge-available"><i class="fa-solid fa-circle-check"></i> Available</span>`
      : v.status === 'in_service' || v.status === 'maintenance'
      ? `<span class="badge badge-in_service"><i class="fa-solid fa-wrench"></i> In Service</span>`
      : `<span class="badge badge-rented"><i class="fa-solid fa-car-side"></i> Rented</span>`;

    return `
      <div class="vehicle-card">
        <img class="vehicle-card-img" src="${imgUrl}" alt="${v.name}" />
        <div class="vehicle-card-body">
          <div class="vehicle-card-head">
            <div>
              <div class="vehicle-name">${v.name}</div>
              <div style="font-size: 0.78rem; color: #64748b; font-weight: 600;">${catName} · ${maskPlate(v.plate_number)}</div>
            </div>
            ${statusBadge}
          </div>

          <div class="vehicle-specs">
            <span class="vehicle-spec-item"><i class="fa-solid fa-users" style="color:#0284c7;"></i> ${v.seats ?? 5} Seats</span>
            <span class="vehicle-spec-item"><i class="fa-solid fa-gear" style="color:#2563eb;"></i> ${v.transmission ?? 'Auto'}</span>
            <span class="vehicle-spec-item"><i class="fa-solid fa-gas-pump" style="color:#d97706;"></i> ${v.fuel_type ?? 'Gasoline'}</span>
            <span class="vehicle-spec-item"><i class="fa-solid fa-snowflake" style="color:#0284c7;"></i> ${v.has_ac !== false ? 'AC' : 'Non-AC'}</span>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:12px;">
            <div class="vehicle-rate">${fmtMoney(rate)}<span> / day</span></div>
            <button type="button" class="btn btn-primary btn-sm" data-book-id="${v.id}" ${!isAvailable ? 'disabled' : ''}>
              ${isAvailable ? 'Book & Reserve' : 'Unavailable'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  $$('[data-book-id]').forEach(btn => {
    btn.addEventListener('click', () => openBookingModal(Number(btn.dataset.bookId)));
  });
}

// ---------------------------------------------------------------------
// VEHICLE BOOKING & DEPOSIT RESERVATION MODAL
// ---------------------------------------------------------------------
async function openBookingModal(vehicleId) {
  if (!state.user) {
    toast('Please sign in or create an account to book a vehicle.', 'info');
    openAuthModal('signup');
    return;
  }

  const v = state.vehicles.find(item => item.id === vehicleId);
  if (!v) return;

  const rate = getVehicleRate(v);
  const todayStr = new Date().toISOString().slice(0, 10);

  let selectedPct = 20; // Default 20% downpayment
  let selectedDriverId = '';

  const modal = openModal(`
    <div class="modal-head">
      <div>
        <div class="modal-title">${v.name}</div>
        <div style="font-size:0.8rem;color:#64748b;">${getVehicleCategory(v)} · Daily Rate: <strong>${fmtMoney(rate)}</strong></div>
      </div>
      <div class="modal-close" id="bClose">✕</div>
    </div>

    <!-- Booking Dates -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:16px;">
      <div class="field" style="margin-bottom:10px;">
        <label><i class="fa-solid fa-calendar-days" style="color:#2563eb;"></i> Pickup Date</label>
        <input type="date" id="bStart" min="${todayStr}" value="${todayStr}" />
      </div>
      <div class="field">
        <label><i class="fa-solid fa-calendar-check" style="color:#059669;"></i> Return Date</label>
        <input type="date" id="bEnd" min="${todayStr}" value="${todayStr}" />
      </div>
    </div>

    <!-- Driver Selection -->
    <div class="field" style="margin-bottom:16px;">
      <label><i class="fa-solid fa-id-badge" style="color:#7c3aed;"></i> Driver Add-on (Optional)</label>
      <select id="bDriver">
        <option value="">Self-Drive (No Driver Needed)</option>
        ${state.drivers.map(d => `<option value="${d.id}">${d.name} — Professional Driver (${fmtMoney(d.daily_fee || 500)} / day)</option>`).join('')}
      </select>
    </div>

    <!-- Deposit Tier Selector -->
    <label style="font-size:0.82rem;font-weight:800;color:#0f172a;margin-bottom:8px;display:block;">
      <i class="fa-solid fa-shield-halved" style="color:#059669;"></i> Select Deposit &amp; Payment Option
    </label>

    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px;" id="depositTierGrid">
      <div class="btn btn-outline pay-tier-btn active" data-pct="20" style="padding:10px;text-align:left;flex-direction:column;align-items:flex-start;">
        <span style="font-weight:800;color:#059669;">20% Deposit</span>
        <span style="font-size:0.72rem;color:#64748b;">Reserve &amp; Secure Now</span>
      </div>
      <div class="btn btn-outline pay-tier-btn" data-pct="30" style="padding:10px;text-align:left;flex-direction:column;align-items:flex-start;">
        <span style="font-weight:800;color:#2563eb;">30% Deposit</span>
        <span style="font-size:0.72rem;color:#64748b;">Partial Downpayment</span>
      </div>
      <div class="btn btn-outline pay-tier-btn" data-pct="50" style="padding:10px;text-align:left;flex-direction:column;align-items:flex-start;">
        <span style="font-weight:800;color:#d97706;">50% Deposit</span>
        <span style="font-size:0.72rem;color:#64748b;">Half Payment</span>
      </div>
      <div class="btn btn-outline pay-tier-btn" data-pct="100" style="padding:10px;text-align:left;flex-direction:column;align-items:flex-start;">
        <span style="font-weight:800;color:#0f172a;">100% Full Payment</span>
        <span style="font-size:0.72rem;color:#64748b;">Pay Total Online</span>
      </div>
    </div>

    <!-- Summary Box -->
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px;margin-bottom:18px;" id="bSummaryBox">
      <!-- Calculated dynamically -->
    </div>

    <button type="button" class="btn btn-primary btn-block" id="btnConfirmBooking">
      <i class="fa-solid fa-lock"></i> Submit Reservation Request
    </button>
  `);

  $('#bClose').onclick = closeModal;

  const startInput = $('#bStart');
  const endInput = $('#bEnd');
  const driverInput = $('#bDriver');
  const summaryBox = $('#bSummaryBox');

  function calculateSummary() {
    const days = daysBetween(startInput.value, endInput.value);
    const vehicleCost = days * rate;

    const dId = driverInput.value;
    const selectedDriver = dId ? state.drivers.find(dr => String(dr.id) === dId) : null;
    const driverFee = selectedDriver ? (selectedDriver.daily_fee || 500) * days : 0;

    const totalCost = vehicleCost + driverFee;
    const payNow = selectedPct === 100 ? totalCost : Math.round(totalCost * (selectedPct / 100));
    const balanceDue = totalCost - payNow;

    summaryBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:0.84rem;margin-bottom:4px;color:#334155;">
        <span>Rental Duration</span><span><strong>${days} day(s)</strong> (${fmtMoney(rate)}/day)</span>
      </div>
      ${selectedDriver ? `
        <div style="display:flex;justify-content:space-between;font-size:0.84rem;margin-bottom:4px;color:#334155;">
          <span>Driver Fee</span><span>${selectedDriver.name} (<strong>${fmtMoney(driverFee)}</strong>)</span>
        </div>
      ` : ''}
      <div style="display:flex;justify-content:space-between;font-size:0.88rem;margin-bottom:8px;color:#0f172a;font-weight:700;">
        <span>Total Rental Cost</span><span>${fmtMoney(totalCost)}</span>
      </div>
      <div style="border-top:1px solid #cbd5e1;padding-top:8px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:0.78rem;color:#059669;font-weight:800;text-transform:uppercase;">Amount Payable Now (${selectedPct}%)</div>
          <div style="font-size:1.2rem;font-weight:800;color:#059669;">${fmtMoney(payNow)}</div>
        </div>
        ${balanceDue > 0 ? `
          <div style="text-align:right;">
            <div style="font-size:0.75rem;color:#1e40af;font-weight:700;">Balance at Pickup</div>
            <div style="font-size:0.95rem;font-weight:800;color:#1e40af;">${fmtMoney(balanceDue)}</div>
          </div>
        ` : ''}
      </div>
    `;

    return { days, totalCost, payNow, balanceDue };
  }

  calculateSummary();

  startInput.onchange = calculateSummary;
  endInput.onchange = calculateSummary;
  driverInput.onchange = calculateSummary;

  $$('#depositTierGrid .pay-tier-btn').forEach(btn => {
    btn.onclick = () => {
      $$('#depositTierGrid .pay-tier-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPct = Number(btn.dataset.pct);
      calculateSummary();
    };
  });

  $('#btnConfirmBooking').onclick = async () => {
    const { totalCost, payNow, balanceDue } = calculateSummary();

    const btn = $('#btnConfirmBooking');
    btn.disabled = true;
    btn.textContent = 'Submitting Request…';

    const { data: booking, error } = await supabase.from('bookings').insert({
      customer_id: state.user.id,
      vehicle_id: vehicleId,
      start_date: startInput.value,
      end_date: endInput.value,
      total_amount: totalCost,
      paid_amount: 0,
      balance_due: totalCost,
      payment_type: selectedPct === 100 ? 'full' : 'partial',
      downpayment_percent: selectedPct,
      status: 'pending'
    }).select().single();

    if (error) {
      toast(error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Submit Reservation Request';
      return;
    }

    if (driverInput.value) {
      await supabase.from('driver_assignments').insert({
        booking_id: booking.id,
        driver_id: Number(driverInput.value)
      }).then(() => {}).catch(() => {});
    }

    toast('Booking request submitted! Staff will approve your booking shortly.', 'success');
    closeModal();
    openMyBookingsModal();
  };
}

// ---------------------------------------------------------------------
// CUSTOMER MY BOOKINGS MODAL
// ---------------------------------------------------------------------
async function openMyBookingsModal() {
  if (!state.user) return;

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, vehicles(name, plate_number, image_url)')
    .eq('customer_id', state.user.id)
    .order('created_at', { ascending: false });

  const modalList = (bookings || []).map(b => {
    const v = b.vehicles || {};
    const isPartial = b.balance_due && Number(b.balance_due) > 0 && Number(b.paid_amount || 0) > 0;

    return `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="font-weight:800;color:#0f172a;font-size:0.95rem;">${v.name || 'Rental Vehicle'}</div>
          <span class="badge badge-${b.status}">${b.status.replace('_', ' ')}</span>
        </div>
        <div style="font-size:0.8rem;color:#64748b;margin-bottom:8px;">
          ${fmtDate(b.start_date)} → ${fmtDate(b.end_date)} · Plate: ${maskPlate(v.plate_number)}
        </div>
        <div style="font-size:0.84rem;margin-bottom:8px;">
          Total Cost: <strong>${fmtMoney(b.total_amount)}</strong> 
          ${isPartial ? ` · <span style="color:#059669;font-weight:700;">Paid: ${fmtMoney(b.paid_amount)}</span> | <span style="color:#2563eb;font-weight:700;">Balance: ${fmtMoney(b.balance_due)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('') || `<div style="text-align:center;padding:30px;color:#94a3b8;">No bookings found yet. Browse fleet to reserve a vehicle.</div>`;

  openModal(`
    <div class="modal-head">
      <div class="modal-title"><i class="fa-solid fa-calendar-check" style="color:#059669;margin-right:6px;"></i> My Bookings &amp; Reservations</div>
      <div class="modal-close" id="mbClose">✕</div>
    </div>
    <div style="max-height:60vh;overflow-y:auto;">
      ${modalList}
    </div>
  `);

  $('#mbClose').onclick = closeModal;
}

// ---------------------------------------------------------------------
// ATTACH DOM LISTENERS
// ---------------------------------------------------------------------
function attachEventListeners() {
  $('#brandBtn').onclick = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); };
  $('#navBrowse').onclick = () => { $('#vehiclesGrid').scrollIntoView({ behavior: 'smooth' }); };
  $('#navHow').onclick = () => { toast('Choose dates, pick a vehicle, select a 20% deposit, and get key handover upon approval!', 'info'); };

  const navBookings = $('#navBookings');
  if (navBookings) navBookings.onclick = openMyBookingsModal;

  $('#btnFilterSearch').onclick = () => {
    state.selectedCategory = $('#searchCategory').value;
    state.searchQuery = $('#searchQuery').value.trim();
    state.maxPrice = Number($('#searchMaxPrice').value || 99999);
    renderVehicles();
    $('#vehiclesGrid').scrollIntoView({ behavior: 'smooth' });
  };
}

// INITIALIZE APP ON LOAD
document.addEventListener('DOMContentLoaded', init);
