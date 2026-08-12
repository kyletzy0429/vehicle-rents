// =====================================================================
// VEHICLE RENTAL MANAGEMENT SYSTEM — app.js
// =====================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------
const state = {
  user: null,          // auth user
  profile: null,        // { id, full_name, role, phone }
  categories: [],
  vehicles: [],
  drivers: [],          // { id, name, phone, license_type, experience_years, rating, daily_fee, status }
  portal: null,         // 'customer' | 'staff' | 'admin'
  tab: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const fmtMoney = (n) => `₱${Number(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => { if (!d) return '—'; const date = new Date(d); return isNaN(date.getTime()) ? String(d) : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }); };
const daysBetween = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000));
const maskPlate = (p) => { if (!p || p.length < 4) return p || '—'; return p[0] + '••' + p.slice(3, -2).replace(/[A-Za-z0-9]/g, '•') + p.slice(-2); };

// =====================================================================
// THEME, LANGUAGE & NOTIFICATIONS SYSTEM
// =====================================================================
function getTheme() { return localStorage.getItem('rentflow_theme') || 'light'; }
function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('rentflow_theme', next);
  applyTheme();
  toast(`Switched to ${next === 'dark' ? '🌙 Dark' : '☀️ Light'} Mode`, 'info');
}
function applyTheme() {
  const theme = getTheme();
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.body.removeAttribute('data-theme');
  }
}
applyTheme();

function getLang() { return localStorage.getItem('rentflow_lang') || 'en'; }
function setLang(lang) {
  localStorage.setItem('rentflow_lang', lang);
  const langNames = { en: '🇺🇸 English', tl: '🇵🇭 Tagalog', ceb: '🇵🇭 Cebuano (Bisaya)' };
  toast(`Language set to ${langNames[lang] || lang}`, 'success');
  renderShell();
}

const DEFAULT_NOTIFS = [
  { id: 1, title: '🟢 Booking Request Approved!', time: '10 mins ago', desc: 'Your Toyota Fortuner 2.8 V reservation (BK-88421094) has been approved by staff.', read: false },
  { id: 2, title: '🚗 Vehicle Pickup Reminder', time: '1 hour ago', desc: 'Pickup location: VEHICLE RENTALS MAIN BRANCH. Please arrive 15 minutes early with your driver license.', read: false },
  { id: 3, title: '💳 System Alert', time: 'Yesterday', desc: 'Free cancellation is available up to 24 hours prior to vehicle pickup date.', read: true }
];

function getNotifications() {
  try {
    const raw = localStorage.getItem(`rentflow_notifs_${state.user?.id || 'guest'}`);
    return raw ? JSON.parse(raw) : DEFAULT_NOTIFS;
  } catch (e) { return DEFAULT_NOTIFS; }
}

function openNotificationsModal() {
  const notifs = getNotifications();
  openModal(`
    <div class="modal-head">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:38px;height:38px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;color:#2563eb;font-size:1.1rem;">
          <i class="fa-solid fa-bell"></i>
        </div>
        <div>
          <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:0;">Notifications &amp; Alerts</h3>
          <span style="font-size:0.75rem;color:#64748b;">Live system updates &amp; rental alerts</span>
        </div>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;max-height:360px;overflow-y:auto;">
      ${notifs.map(n => `
        <div style="background:${n.read ? '#f8fafc' : '#eff6ff'};border:1px solid ${n.read ? '#e2e8f0' : '#bfdbfe'};border-radius:10px;padding:12px 14px;">
          <div style="display:flex;align-items:center;justify-content:between;margin-bottom:4px;">
            <span style="font-weight:700;font-size:0.88rem;color:#0f172a;">${n.title}</span>
            <span style="font-size:0.72rem;color:#64748b;">${n.time}</span>
          </div>
          <p style="font-size:0.8rem;color:#475569;margin:0;line-height:1.4;">${n.desc}</p>
        </div>
      `).join('')}
    </div>

    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost btn-sm btn-block" id="clearNotifsBtn" style="border:1px solid #cbd5e1;"><i class="fa-solid fa-check-double"></i> Mark All as Read</button>
    </div>
  `);

  $('#mClose').addEventListener('click', closeModal);
  $('#clearNotifsBtn').addEventListener('click', () => {
    const updated = notifs.map(n => ({ ...n, read: true }));
    try { localStorage.setItem(`rentflow_notifs_${state.user?.id || 'guest'}`, JSON.stringify(updated)); } catch (e) {}
    toast('Notifications marked as read.', 'success');
    closeModal();
    renderShell();
  });
}

function getVehicleDailyRate(v) {
  if (v.categories?.daily_rate && Number(v.categories.daily_rate) >= 2000) {
    return Number(v.categories.daily_rate);
  }
  if (v.daily_rate && Number(v.daily_rate) >= 2000) {
    return Number(v.daily_rate);
  }

  const name = (v.name || '').toLowerCase();
  if (name.includes('nmax') || name.includes('click') || name.includes('adv') || name.includes('motor')) return 2000;
  if (name.includes('wigo')) return 2200;
  if (name.includes('mirage')) return 2300;
  if (name.includes('vios')) return 2500;
  if (name.includes('innova')) return 3200;
  if (name.includes('xpander')) return 3000;
  if (name.includes('fortuner')) return 4200;
  if (name.includes('montero')) return 4300;
  if (name.includes('ranger') || name.includes('raptor')) return 4500;
  if (name.includes('hiace') || name.includes('van')) return 5000;

  return 2000;
}

function getVehicleCategoryName(v) {
  if (v.categories?.name) return v.categories.name;
  const name = (v.name || '').toLowerCase();
  if (name.includes('nmax') || name.includes('click') || name.includes('adv') || name.includes('motor')) return 'Motorcycles';
  if (name.includes('wigo') || name.includes('mirage')) return 'Economy & Hatchbacks';
  if (name.includes('vios')) return 'Sedans';
  if (name.includes('innova') || name.includes('xpander')) return 'MPVs & Crossovers';
  if (name.includes('fortuner') || name.includes('montero')) return 'SUVs & Pickups';
  if (name.includes('ranger') || name.includes('raptor')) return 'SUVs & Pickups';
  if (name.includes('hiace') || name.includes('van')) return 'Passenger Vans';
  return 'Standard';
}

function getExactVehicleImage(v) {
  if (v && v.image_url && v.image_url.trim()) {
    return v.image_url.trim();
  }
  const name = (v?.name || '').toLowerCase();
  
  if (name.includes('fortuner')) {
    return 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80';
  }
  if (name.includes('vios')) {
    return 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=800&q=80';
  }
  if (name.includes('innova')) {
    return 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80';
  }
  if (name.includes('montero')) {
    return 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&q=80';
  }
  if (name.includes('ranger') || name.includes('raptor') || name.includes('tacoma') || name.includes('pickup')) {
    return 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=800&q=80';
  }
  if (name.includes('xpander')) {
    return 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80';
  }
  if (name.includes('mirage')) {
    return 'https://images.unsplash.com/photo-1541348263662-e082662d82da?auto=format&fit=crop&w=800&q=80';
  }
  if (name.includes('wigo')) {
    return 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80';
  }
  if (name.includes('hiace') || name.includes('van')) {
    return 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80';
  }
  if (name.includes('nmax')) {
    return 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80';
  }
  if (name.includes('click')) {
    return 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80';
  }
  if (name.includes('adv')) {
    return 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=800&q=80';
  }
  if (name.includes('motorcycle') || name.includes('scooter') || name.includes('motor')) {
    return 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80';
  }

  return 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80';
}

function toast(msg, type = 'info') {
  const wrap = $('#toastWrap');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function openModal(html, wide = false) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'activeModal';
  overlay.innerHTML = `<div class="glass modal ${wide ? 'modal-wide' : ''}">${html}</div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  return overlay;
}
function closeModal() {
  const overlays = document.querySelectorAll('.modal-overlay');
  overlays.forEach(m => m.remove());
}
window.closeModal = closeModal;

// ---------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------
let authMode = 'login';

function renderAuth() {
  $('#app').innerHTML = `
    <div class="auth-wrap">
      <div class="glass auth-card">
        <div class="brand">
          <img src="logo.png" style="width:44px;height:44px;border-radius:10px;object-fit:cover;border:1px solid rgba(255,255,255,0.2);" />
          <div>
            <div class="brand-title" style="font-size:1.15rem;line-height:1.2;">Vehicle Rental Management System</div>
          </div>
        </div>
        <div class="auth-tabs">
          <div class="auth-tab ${authMode === 'login' ? 'active' : ''}" data-mode="login">
            <i class="fa-solid fa-right-to-bracket" style="margin-right:6px;"></i>Log In
          </div>
          <div class="auth-tab ${authMode === 'signup' ? 'active' : ''}" data-mode="signup">
            <i class="fa-solid fa-user-plus" style="margin-right:6px;"></i>Create Account
          </div>
        </div>
        <div id="authError"></div>
        <form id="authForm">
          ${authMode === 'signup' ? `
            <div class="field">
              <label>Full name</label>
              <input type="text" id="fullName" placeholder="e.g. Juan Dela Cruz" required />
            </div>
          ` : ''}
          <div class="field">
            <label>Email address</label>
            <input type="email" id="email" placeholder="e.g. juan@example.com" required />
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" id="password" placeholder="••••••••" minlength="6" required />
          </div>
          ${authMode === 'signup' ? `
            <div class="field">
              <label>Sign up as</label>
              <div class="role-picker" id="rolePicker">
                <div class="role-opt selected" data-role="customer"><i class="fa-solid fa-user" style="margin-right:4px;"></i> Customer</div>
                <div class="role-opt" data-role="staff"><i class="fa-solid fa-user-tie" style="margin-right:4px;"></i> Staff</div>
                <div class="role-opt" data-role="admin"><i class="fa-solid fa-shield-halved" style="margin-right:4px;"></i> Admin</div>
              </div>
            </div>
          ` : ''}
          <button type="submit" class="btn btn-primary btn-block" id="authSubmit" style="margin-top:8px;">
            ${authMode === 'login' ? '<i class="fa-solid fa-right-to-bracket"></i> Log In' : '<i class="fa-solid fa-user-check"></i> Create Account'}
          </button>
        </form>
      </div>
    </div>
  `;

  $$('.auth-tab').forEach(t => t.addEventListener('click', () => { authMode = t.dataset.mode; renderAuth(); }));

  if (authMode === 'signup') {
    $$('.role-opt').forEach(opt => opt.addEventListener('click', () => {
      $$('.role-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    }));
  }

  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = $('#authSubmit');
    submitBtn.disabled = true;
    $('#authError').innerHTML = '';
    const email = $('#email').value.trim();
    const password = $('#password').value;
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const fullName = $('#fullName').value.trim();
        const role = $('#rolePicker .selected').dataset.role;
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, role } },
        });
        if (error) throw error;
        toast('Account created! Logging you in…', 'success');
      }
      await bootstrapSession();
    } catch (err) {
      $('#authError').innerHTML = `<div class="auth-error">${err.message}</div>`;
      submitBtn.disabled = false;
    }
  });
}

async function logout() {
  await supabase.auth.signOut();
  state.user = null;
  state.profile = null;
  renderAuth();
}

// ---------------------------------------------------------------------
// BOOTSTRAP
// ---------------------------------------------------------------------
async function bootstrapSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { renderAuth(); return; }
  state.user = session.user;

  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', state.user.id).single();
  if (error || !profile) {
    console.error(error);
    toast('Could not load your profile. Try logging in again.', 'error');
    renderAuth();
    return;
  }
  
  // Merge custom local profile data if present
  try {
    const savedExtra = localStorage.getItem(`rentflow_prof_${state.user.id}`);
    if (savedExtra) Object.assign(profile, JSON.parse(savedExtra));
  } catch (e) {}

  state.profile = profile;
  state.portal = profile.role;
  await Promise.all([loadCategories(), loadVehicles()]);
  renderShell();
}

const PH_POPULAR_VEHICLES = [
  {
    name: 'Toyota Fortuner 2.8 V 4x2 AT',
    plate_number: 'NBD-8842',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80',
    description: '7-Seater Premium Diesel SUV. High ground clearance, leather seats, dual aircon. Ideal for family trips across the Philippines.'
  },
  {
    name: 'Toyota Vios 1.5 G CVT',
    plate_number: 'NCO-2914',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=800&q=80',
    description: '5-Seater Subcompact Sedan. Excellent fuel efficiency, automatic transmission. Best choice for city driving and errands.'
  },
  {
    name: 'Toyota Innova 2.8 E Diesel AT',
    plate_number: 'DAR-4921',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
    description: '8-Seater MPV. Powerful 2.8L Diesel engine with dual AC. Spacious and reliable family vehicle.'
  },
  {
    name: 'Mitsubishi Montero Sport GT 4x2',
    plate_number: 'NGF-7102',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&q=80',
    description: '7-Seater SUV. 2.4L MIVEC Turbo Diesel engine, smooth 8-speed automatic, sunroof.'
  },
  {
    name: 'Ford Ranger Raptor 2.0L Bi-Turbo',
    plate_number: 'CBL-9481',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=800&q=80',
    description: '5-Seater Pickup Truck. FOX Racing shocks, 4x4 Off-road mode. Great for heavy loads and provincial roads.'
  },
  {
    name: 'Mitsubishi Xpander GLS 1.5 AT',
    plate_number: 'NBF-3910',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80',
    description: '7-Seater Modern Crossover MPV. Spacious 3-row seating, flexible cargo space, high ground clearance.'
  },
  {
    name: 'Mitsubishi Mirage G4 GLX AT',
    plate_number: 'NDB-5012',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1541348263662-e082662d82da?auto=format&fit=crop&w=800&q=80',
    description: '5-Seater Economy Sedan. Highly fuel-efficient 1.2L engine. Compact and easy to drive in city traffic.'
  },
  {
    name: 'Toyota Wigo 1.0 G CVT',
    plate_number: 'NCL-1049',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80',
    description: '5-Seater Hatchback. Compact city hatchback with agile handling and low gas consumption.'
  },
  {
    name: 'Toyota HiAce Commuter Deluxe 2.8',
    plate_number: 'VAA-8012',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
    description: '14-Seater Full-size Passenger Van. Front engine layout, strong rear AC. Ideal for group tours and outings.'
  },
  {
    name: 'Yamaha NMAX 155 ABS (Motorcycle)',
    plate_number: '128-NMX',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80',
    description: '155cc Automatic Maxi Scooter. Variable Valve Actuation (VVA), ABS front/rear, digital panel. Premium scooter.'
  },
  {
    name: 'Honda Click 125i (Motorcycle)',
    plate_number: '904-CLK',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
    description: '125cc Automatic Scooter. Sporty design, combi-brake system, spacious under-seat storage box.'
  },
  {
    name: 'Honda ADV 160 (Motorcycle)',
    plate_number: '481-ADV',
    status: 'available',
    image_url: 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=800&q=80',
    description: '160cc Adventure Scooter. Long-travel suspension, HSTC torque control, adjustable windshield.'
  }
];

const PH_CATEGORIES = [
  { name: 'Motorcycles', daily_rate: 2000, description: 'Automatic scooters & motorbikes (Yamaha NMAX 155, Honda Click 125i, Honda ADV 160)' },
  { name: 'Economy & Hatchbacks', daily_rate: 2200, description: 'Compact fuel-efficient hatchbacks & sedans (Toyota Wigo, Mitsubishi Mirage G4)' },
  { name: 'Sedans', daily_rate: 2500, description: '5-Seater comfortable subcompact sedans (Toyota Vios 1.5 G)' },
  { name: 'MPVs & Crossovers', daily_rate: 3000, description: '7 to 8-Seater family MPVs (Toyota Innova, Mitsubishi Xpander)' },
  { name: 'SUVs & Pickups', daily_rate: 4200, description: 'Midsize 7-Seater SUVs & Pickup Trucks (Toyota Fortuner, Montero Sport, Ford Ranger Raptor)' },
  { name: 'Passenger Vans', daily_rate: 5000, description: '14-Seater full-size passenger vans for tours and group trips (Toyota HiAce Commuter Deluxe)' }
];

async function loadCategories() {
  let { data } = await supabase.from('categories').select('*').order('daily_rate');

  if (!data || data.length < 4) {
    for (const cat of PH_CATEGORIES) {
      await supabase.from('categories').upsert({
        name: cat.name,
        daily_rate: cat.daily_rate,
        description: cat.description
      }, { onConflict: 'name' }).then(() => {}).catch(async () => {
        await supabase.from('categories').insert({
          name: cat.name,
          daily_rate: cat.daily_rate,
          description: cat.description
        }).then(() => {}).catch(() => {});
      });
    }
    const reFetch = await supabase.from('categories').select('*').order('daily_rate');
    data = reFetch.data || data;
  }

  if (!data || data.length === 0) {
    data = PH_CATEGORIES.map((c, i) => ({ id: i + 1, ...c }));
  }

  state.categories = data || [];
}

async function loadVehicles() {
  let { data } = await supabase.from('vehicles').select('*, categories(name, daily_rate)').order('name');

  // Auto-seed PH vehicles if database doesn't have at least 8 vehicles
  if (!data || data.length < 8) {
    let catList = state.categories;
    if (!catList.length) {
      await loadCategories();
      catList = state.categories;
    }
    const defaultCatId = catList[0]?.id || null;

    for (const v of PH_POPULAR_VEHICLES) {
      const vNameLower = v.name.toLowerCase();
      let targetCatName = 'Sedans';

      if (vNameLower.includes('nmax') || vNameLower.includes('click') || vNameLower.includes('adv') || vNameLower.includes('motorcycle')) {
        targetCatName = 'Motorcycles';
      } else if (vNameLower.includes('wigo') || vNameLower.includes('mirage')) {
        targetCatName = 'Economy & Hatchbacks';
      } else if (vNameLower.includes('vios')) {
        targetCatName = 'Sedans';
      } else if (vNameLower.includes('innova') || vNameLower.includes('xpander')) {
        targetCatName = 'MPVs & Crossovers';
      } else if (vNameLower.includes('fortuner') || vNameLower.includes('montero') || vNameLower.includes('ranger')) {
        targetCatName = 'SUVs & Pickups';
      } else if (vNameLower.includes('hiace') || vNameLower.includes('van')) {
        targetCatName = 'Passenger Vans';
      }

      const catMatch = catList.find(c => c.name.toLowerCase().includes(targetCatName.toLowerCase())) || catList[0];

      await supabase.from('vehicles').upsert({
        name: v.name,
        plate_number: v.plate_number,
        status: v.status,
        image_url: v.image_url,
        description: v.description,
        category_id: catMatch?.id || defaultCatId
      }, { onConflict: 'plate_number' }).then(() => {}).catch(() => {});
    }

    const reFetch = await supabase.from('vehicles').select('*, categories(name, daily_rate)').order('name');
    data = reFetch.data || data;
  }

  state.vehicles = data || [];
}

// ---------------------------------------------------------------------
// SHELL (topbar + portal nav + main)
// ---------------------------------------------------------------------
const PORTAL_TABS = {
  customer: [
    { id: 'browse', label: '<i class="fa-solid fa-car"></i> Browse Vehicles' },
    { id: 'bookings', label: '<i class="fa-solid fa-calendar-check" style="color:#059669;"></i> My Bookings' },
    { id: 'favorites', label: '<i class="fa-solid fa-heart" style="color:#e11d48;"></i> My Favorites' },
    { id: 'profile', label: '<i class="fa-solid fa-id-card"></i> My Profile' },
  ],
  staff: [
    { id: 'requests', label: '<i class="fa-solid fa-clipboard-question"></i> Booking Requests' },
    { id: 'active', label: '<i class="fa-solid fa-key"></i> Active Rentals' },
    { id: 'returns', label: '<i class="fa-solid fa-rotate-left"></i> Returns' },
    { id: 'refunds', label: '<i class="fa-solid fa-hand-holding-dollar"></i> Refunds & Claims' },
    { id: 'history', label: '<i class="fa-solid fa-clock-rotate-left"></i> History' },
  ],
  admin: [
    { id: 'dashboard', label: '<i class="fa-solid fa-chart-pie"></i> Dashboard' },
    { id: 'customers', label: '<i class="fa-solid fa-users"></i> Customers' },
    { id: 'vehicles', label: '<i class="fa-solid fa-car-side"></i> Vehicles' },
    { id: 'categories', label: '<i class="fa-solid fa-tags"></i> Categories & Rates' },
    { id: 'users', label: '<i class="fa-solid fa-user-gear"></i> System Roles' },
    { id: 'rentals', label: '<i class="fa-solid fa-list-check"></i> Rentals & Transactions' },
    { id: 'reports', label: '<i class="fa-solid fa-file-invoice-dollar"></i> Reports' },
    { id: 'settings', label: '<i class="fa-solid fa-gear"></i> System Settings' },
  ],
};

function openUserMenuModal() {
  const p = state.profile || {};
  const initials = (p.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const roleTitle = p.role ? p.role.charAt(0).toUpperCase() + p.role.slice(1) : 'User';

  openModal(`
    <div class="modal-head">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-weight:800;font-size:1.1rem;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(37,99,235,0.25);">${initials}</div>
        <div>
          <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:0;">${p.full_name || 'User Account'}</h3>
          <span style="font-size:0.78rem;color:#2563eb;font-weight:700;"><i class="fa-solid fa-shield-halved" style="margin-right:3px;"></i> ${roleTitle} Account</span>
        </div>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:16px;">
      <div class="receipt-row"><span style="color:#64748b;"><i class="fa-solid fa-envelope" style="margin-right:5px;"></i> Email</span><span style="font-weight:600;color:#0f172a;">${state.user?.email || '—'}</span></div>
      <div class="receipt-row"><span style="color:#64748b;"><i class="fa-solid fa-phone" style="margin-right:5px;"></i> Phone</span><span style="font-weight:600;color:#0f172a;">${p.phone || 'Not set'}</span></div>
      <div class="receipt-row"><span style="color:#64748b;"><i class="fa-solid fa-id-card" style="margin-right:5px;"></i> Driver License</span><span style="font-weight:600;color:#0f172a;">${p.license_number || '—'}</span></div>
    </div>

    <h4 style="font-size:0.88rem;font-weight:700;color:#0f172a;margin-bottom:10px;"><i class="fa-solid fa-bars-staggered" style="color:#2563eb;margin-right:6px;"></i> User Menu &amp; Quick Actions</h4>
    
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
      <button class="btn btn-ghost" id="umProfile" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
        <i class="fa-solid fa-user-gear" style="color:#2563eb;font-size:1.1rem;margin-right:10px;width:20px;"></i>
        <div>
          <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">My Profile &amp; Driver Details</div>
          <div style="font-size:0.75rem;color:#64748b;">View &amp; update personal info, phone, and license ID photo</div>
        </div>
      </button>

      ${state.portal === 'customer' ? `
        <button class="btn btn-ghost" id="umFavorites" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <i class="fa-solid fa-heart" style="color:#e11d48;font-size:1.1rem;margin-right:10px;width:20px;"></i>
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">My Favorites</div>
            <div style="font-size:0.75rem;color:#64748b;">View your saved cars &amp; motorcycles</div>
          </div>
        </button>
        <button class="btn btn-ghost" id="umBookings" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <i class="fa-solid fa-calendar-check" style="color:#059669;font-size:1.1rem;margin-right:10px;width:20px;"></i>
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">My Reservations &amp; Rentals</div>
            <div style="font-size:0.75rem;color:#64748b;">View active reservations, receipts, and refund requests</div>
          </div>
        </button>
      ` : ''}

      <button class="btn btn-ghost" id="umSupport" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
        <i class="fa-solid fa-headset" style="color:#0284c7;font-size:1.1rem;margin-right:10px;width:20px;"></i>
        <div>
          <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">Support Contact</div>
          <div style="font-size:0.75rem;color:#64748b;">Hotline: +63 (2) 8888-RENT | Email: vehiclerental@gmail.com</div>
        </div>
      </button>
    </div>

    <div style="padding-top:14px;border-top:1px solid #e2e8f0;display:flex;gap:10px;">
      <button class="btn btn-danger btn-block" id="umLogout" style="padding:10px;"><i class="fa-solid fa-right-from-bracket" style="margin-right:6px;"></i> Log Out of Account</button>
    </div>
  `);

  $('#mClose').addEventListener('click', closeModal);
  $('#umLogout').addEventListener('click', () => { closeModal(); logout(); });

  const pBtn = $('#umProfile');
  if (pBtn) {
    pBtn.addEventListener('click', () => {
      closeModal();
      if (state.portal === 'customer') {
        state.tab = 'profile';
        renderShell();
      } else {
        toast(`Profile info for ${state.profile.full_name}`, 'info');
      }
    });
  }

  const fBtn = $('#umFavorites');
  if (fBtn) {
    fBtn.addEventListener('click', () => {
      closeModal();
      state.tab = 'favorites';
      renderShell();
    });
  }

  const bBtn = $('#umBookings');
  if (bBtn) {
    bBtn.addEventListener('click', () => {
      closeModal();
      state.tab = 'bookings';
      renderShell();
    });
  }

  const sBtn = $('#umSupport');
  if (sBtn) {
    sBtn.addEventListener('click', () => {
      toast('Support Hotline: +63 (2) 8888-RENT | Email: vehiclerental@gmail.com', 'info');
    });
  }
}

function renderShell() {
  const tabs = PORTAL_TABS[state.portal] || [];
  if (!state.tab || !tabs.find(t => t.id === state.tab)) state.tab = tabs[0]?.id;

  const initials = (state.profile.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const roleTitle = state.portal ? state.portal.charAt(0).toUpperCase() + state.portal.slice(1) : 'User';
  const activeTabObj = tabs.find(t => t.id === state.tab);

  const isDark = getTheme() === 'dark';
  const currentLang = getLang();
  const unreadNotifs = getNotifications().filter(n => !n.read).length;

  // Full-width layout for Customer Portal (No sidebar)
  if (state.portal === 'customer') {
    $('#app').innerHTML = `
      <div style="min-height:100vh;background:var(--bg-dark);">
        <header style="background:#ffffff;border-bottom:1px solid #e2e8f0;padding:12px 32px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;box-shadow:0 2px 10px rgba(0,0,0,0.03);">
          <div style="display:flex;align-items:center;gap:28px;">
            <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" id="brandHomeBtn">
              <img src="logo.png" style="width:40px;height:40px;border-radius:10px;object-fit:cover;border:1px solid #cbd5e1;" />
              <div>
                <div style="font-weight:800;font-size:0.95rem;line-height:1.2;color:#0f172a;">Vehicle Rental Management System</div>
                <div style="font-size:0.7rem;color:#2563eb;font-weight:700;">Customer Portal</div>
              </div>
            </div>

            <nav style="display:flex;align-items:center;gap:6px;">
              ${tabs.filter(t => t.id === 'browse' || t.id === 'bookings').map(t => `
                <button type="button" class="btn nav-tab-btn ${t.id === state.tab ? 'btn-primary' : 'btn-ghost'}" data-tab="${t.id}" style="font-size:0.85rem;padding:8px 16px;border-radius:99px;font-weight:700;">
                  ${t.label}
                </button>
              `).join('')}
            </nav>
          </div>

          <div style="display:flex;align-items:center;gap:10px;">
            <!-- Language Selector -->
            <select id="topLangSelect" style="height:38px;padding:0 12px;font-size:0.82rem;border-radius:99px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;font-weight:700;color:#0f172a;outline:none;">
              <option value="en" ${currentLang === 'en' ? 'selected' : ''}>🇺🇸 EN</option>
              <option value="tl" ${currentLang === 'tl' ? 'selected' : ''}>🇵🇭 Tagalog</option>
              <option value="ceb" ${currentLang === 'ceb' ? 'selected' : ''}>🇵🇭 Bisaya</option>
            </select>

            <!-- Light/Dark Mode Switcher -->
            <button type="button" id="topThemeBtn" title="Toggle Light/Dark Mode" style="width:38px;height:38px;min-width:38px;min-height:38px;border-radius:50%;padding:0;border:1px solid #cbd5e1;background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:border-box;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <i class="fa-solid fa-${isDark ? 'sun' : 'moon'}" style="color:${isDark ? '#f59e0b' : '#2563eb'};font-size:1rem;"></i>
            </button>

            <!-- Notification Bell Icon -->
            <button type="button" id="topNotifBtn" title="View Notifications" style="position:relative;width:38px;height:38px;min-width:38px;min-height:38px;border-radius:50%;padding:0;border:1px solid #cbd5e1;background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:border-box;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <i class="fa-solid fa-bell" style="color:#475569;font-size:1rem;"></i>
              ${unreadNotifs > 0 ? `<div class="notif-badge">${unreadNotifs}</div>` : ''}
            </button>

            <div class="sys-status-pill" style="margin-left:2px;"><i class="fa-solid fa-circle-check" style="color:#059669;"></i> Live</div>

            <!-- User Menu Pill -->
            <button type="button" id="topUserMenuBtn" style="height:38px;border:1px solid #cbd5e1;background:#fff;display:flex;align-items:center;gap:8px;padding:0 14px;border-radius:99px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-weight:800;font-size:0.72rem;display:flex;align-items:center;justify-content:center;">${initials}</div>
              <span style="font-weight:700;font-size:0.85rem;color:#0f172a;">${state.profile.full_name || 'User'}</span>
              <i class="fa-solid fa-chevron-down" style="font-size:0.72rem;color:#64748b;"></i>
            </button>
          </div>
        </header>

        <main id="mainView" style="padding:36px 48px 80px 48px;max-width:1440px;margin:0 auto;"><div class="loading-spin"></div></main>
      </div>
    `;

    $('#brandHomeBtn').addEventListener('click', () => { state.tab = 'browse'; renderShell(); });
    $$('.nav-tab-btn').forEach(btn => btn.addEventListener('click', () => { state.tab = btn.dataset.tab; renderShell(); }));
    $('#topThemeBtn').addEventListener('click', toggleTheme);
    $('#topNotifBtn').addEventListener('click', openNotificationsModal);
    $('#topLangSelect').addEventListener('change', (e) => setLang(e.target.value));
    $('#topUserMenuBtn').addEventListener('click', openUserMenuModal);

    renderTab();
    return;
  }

  // Sidebar Layout for Staff & Admin Portals
  $('#app').innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <img src="logo.png" style="width:40px;height:40px;border-radius:10px;object-fit:cover;border:1px solid #cbd5e1;" />
          <div>
            <div style="font-weight:800;font-size:0.92rem;line-height:1.2;color:#0f172a;">Vehicle Rental Management System</div>
            <div style="font-size:0.7rem;color:#64748b;font-weight:600;margin-top:2px;">${roleTitle} Portal</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          ${tabs.map(t => `<div class="sidebar-nav-btn ${t.id === state.tab ? 'active' : ''}" data-tab="${t.id}">${t.label}</div>`).join('')}
        </nav>

        <div class="sidebar-footer">
          <div class="user-chip" id="userProfileChip" title="Click for User Menu" style="width:100%;cursor:pointer;">
            <div class="user-avatar">${initials}</div>
            <div class="user-meta" style="flex:1;">
              <div class="user-name">${state.profile.full_name}</div>
              <div class="user-role"><i class="fa-solid fa-id-card" style="color:#2563eb;margin-right:2px;"></i> ${state.profile.role} · Menu</div>
            </div>
            <i class="fa-solid fa-ellipsis-vertical" style="color:#94a3b8;font-size:0.9rem;"></i>
          </div>
          <button class="btn btn-ghost btn-sm btn-block" id="logoutBtn" style="color:#dc2626;"><i class="fa-solid fa-right-from-bracket"></i> Log Out</button>
        </div>
      </aside>

      <div class="main-wrapper">
        <div class="main-topbar">
          <div style="font-weight:800;font-size:1.05rem;color:#0f172a;display:flex;align-items:center;gap:10px;">
            ${activeTabObj?.label ?? 'Dashboard'}
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <!-- Language Selector -->
            <select id="topLangSelect" style="height:38px;padding:0 12px;font-size:0.82rem;border-radius:99px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;font-weight:700;color:#0f172a;outline:none;">
              <option value="en" ${currentLang === 'en' ? 'selected' : ''}>🇺🇸 EN</option>
              <option value="tl" ${currentLang === 'tl' ? 'selected' : ''}>🇵🇭 Tagalog</option>
              <option value="ceb" ${currentLang === 'ceb' ? 'selected' : ''}>🇵🇭 Bisaya</option>
            </select>

            <!-- Light/Dark Mode Switcher -->
            <button type="button" id="topThemeBtn" title="Toggle Light/Dark Mode" style="width:38px;height:38px;min-width:38px;min-height:38px;border-radius:50%;padding:0;border:1px solid #cbd5e1;background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:border-box;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <i class="fa-solid fa-${isDark ? 'sun' : 'moon'}" style="color:${isDark ? '#f59e0b' : '#2563eb'};font-size:1rem;"></i>
            </button>

            <!-- Notification Bell Icon -->
            <button type="button" id="topNotifBtn" title="View Notifications" style="position:relative;width:38px;height:38px;min-width:38px;min-height:38px;border-radius:50%;padding:0;border:1px solid #cbd5e1;background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:border-box;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <i class="fa-solid fa-bell" style="color:#475569;font-size:1rem;"></i>
              ${unreadNotifs > 0 ? `<div class="notif-badge">${unreadNotifs}</div>` : ''}
            </button>

            <div class="sys-status-pill" style="margin-left:2px;"><i class="fa-solid fa-circle-check" style="color:#059669;"></i> Live</div>

            <!-- User Menu Pill -->
            <button type="button" id="topUserMenuBtn" style="height:38px;border:1px solid #cbd5e1;background:#fff;display:flex;align-items:center;gap:8px;padding:0 14px;border-radius:99px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-weight:800;font-size:0.72rem;display:flex;align-items:center;justify-content:center;">${initials}</div>
              <span style="font-weight:700;font-size:0.85rem;color:#0f172a;">${state.profile.full_name || 'User'}</span>
              <i class="fa-solid fa-chevron-down" style="font-size:0.72rem;color:#64748b;"></i>
            </button>
          </div>
        </div>
        <main id="mainView" style="padding:28px 32px 60px 32px;"><div class="loading-spin"></div></main>
      </div>
    </div>
  `;

  $('#logoutBtn').addEventListener('click', logout);
  $('#topThemeBtn').addEventListener('click', toggleTheme);
  $('#topNotifBtn').addEventListener('click', openNotificationsModal);
  $('#topLangSelect').addEventListener('change', (e) => setLang(e.target.value));
  $('#topUserMenuBtn').addEventListener('click', openUserMenuModal);
  const uChip = $('#userProfileChip');
  if (uChip) uChip.addEventListener('click', openUserMenuModal);
  $$('.sidebar-nav-btn').forEach(btn => btn.addEventListener('click', () => { state.tab = btn.dataset.tab; renderShell(); }));

  renderTab();
}

async function renderTab() {
  const view = $('#mainView');
  if (!view) return;
  view.innerHTML = '<div class="loading-spin"></div>';
  try {
    if (state.portal === 'customer') await renderCustomer(state.tab, view);
    else if (state.portal === 'staff') await renderStaff(state.tab, view);
    else if (state.portal === 'admin') await renderAdmin(state.tab, view);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

// =====================================================================
// CUSTOMER PORTAL
// =====================================================================
function getFavorites() {
  try {
    const raw = localStorage.getItem(`rentflow_favs_${state.user?.id || 'guest'}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function toggleFavorite(id) {
  let favs = getFavorites();
  if (favs.includes(id)) {
    favs = favs.filter(fId => fId !== id);
    toast('Removed from your Favorites.', 'info');
  } else {
    favs.push(id);
    toast('Saved to your Favorites! ❤️', 'success');
  }
  try {
    localStorage.setItem(`rentflow_favs_${state.user?.id || 'guest'}`, JSON.stringify(favs));
  } catch (e) {}
  renderTab();
}

async function renderCustomer(tab, view) {
  if (tab === 'browse') return renderBrowse(view);
  if (tab === 'favorites') return renderCustomerFavorites(view);
  if (tab === 'bookings') return renderMyBookings(view);
  if (tab === 'profile') return renderCustomerProfile(view);
}

async function renderCustomerFavorites(view) {
  const favIds = getFavorites();
  const favVehicles = state.vehicles.filter(v => favIds.includes(v.id));

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2><i class="fa-solid fa-heart" style="color:#e11d48;margin-right:6px;"></i> My Saved Favorites</h2>
          <p>Your bookmarked cars and motorcycles for fast reservation.</p>
        </div>
      </div>
      <div class="grid grid-vehicles" id="favGrid">
        ${favVehicles.length ? favVehicles.map(vehicleCardHTML).join('') : emptyState('❤️', 'No favorite vehicles saved yet. Click the heart icon on any vehicle to save it here!')}
      </div>
    </div>
  `;

  $$('#favGrid .vehicle-card').forEach(card => card.addEventListener('click', () => openVehicleDetail(Number(card.dataset.id))));
  $$('#favGrid .fav-heart-btn').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(Number(btn.dataset.favid));
  }));
}

async function renderCustomerProfile(view) {
  const p = state.profile || {};
  const initials = (p.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  view.innerHTML = `
    <div class="view" style="max-width:750px;margin:0 auto;">
      <div class="section-head">
        <div>
          <h2>Customer Profile &amp; Driver Details</h2>
          <p>Manage your account info, phone number, and driver's license for fast booking verification.</p>
        </div>
      </div>

      <div class="glass card" style="margin-bottom:20px;padding:24px;">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid #e2e8f0;">
          <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:800;box-shadow:0 4px 12px rgba(37,99,235,0.25);">
            ${initials}
          </div>
          <div>
            <h3 style="font-size:1.25rem;font-weight:800;color:#0f172a;margin-bottom:2px;">${p.full_name || 'Customer Account'}</h3>
            <div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;color:#64748b;">
              <span><i class="fa-solid fa-envelope" style="color:#2563eb;"></i> ${state.user?.email || '—'}</span>
              <span>·</span>
              <span class="badge badge-${p.license_number ? 'completed' : 'pending'}">${p.license_number ? '✓ License Verified' : 'License Required'}</span>
            </div>
          </div>
        </div>

        <form id="profileForm">
          <h4 style="font-size:0.95rem;font-weight:700;color:#0f172a;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-user-gear" style="color:#2563eb;"></i> Personal Information
          </h4>
          <div class="detail-grid" style="margin-bottom:18px;">
            <div class="field">
              <label>Full Name</label>
              <input type="text" id="profName" value="${p.full_name ?? ''}" placeholder="Juan Dela Cruz" required />
            </div>
            <div class="field">
              <label>Phone Number</label>
              <input type="text" id="profPhone" value="${p.phone ?? ''}" placeholder="+63 917 123 4567" required />
            </div>
          </div>

          <h4 style="font-size:0.95rem;font-weight:700;color:#0f172a;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-id-card" style="color:#059669;"></i> Driver's License Information
          </h4>
          <div class="detail-grid" style="margin-bottom:18px;">
            <div class="field">
              <label>Driver's License Number</label>
              <input type="text" id="profLicense" value="${p.license_number ?? ''}" placeholder="N02-18-984012" required />
            </div>
            <div class="field">
              <label>License Expiry Date</label>
              <input type="date" id="profLicenseExpiry" value="${p.license_expiry ?? ''}" />
            </div>
          </div>

          <h4 style="font-size:0.95rem;font-weight:700;color:#0f172a;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-id-card-clip" style="color:#2563eb;"></i> Driver's License ID Card Photo / Document
          </h4>
          <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;">
            <div id="licensePreviewBox" style="margin-bottom:12px;">
              ${p.license_id_url ? `
                <div style="position:relative;display:inline-block;">
                  <img src="${p.license_id_url}" id="licenseImgPreview" style="max-width:100%;max-height:190px;border-radius:10px;border:2px solid #2563eb;box-shadow:0 4px 12px rgba(0,0,0,0.1);" />
                  <div style="position:absolute;top:6px;right:6px;background:#059669;color:#fff;font-size:0.72rem;font-weight:700;padding:3px 10px;border-radius:99px;"><i class="fa-solid fa-shield-check"></i> ID Photo Uploaded</div>
                </div>
              ` : `
                <div style="padding:16px 10px;">
                  <i class="fa-solid fa-cloud-arrow-up" style="font-size:2.5rem;color:#94a3b8;margin-bottom:8px;"></i>
                  <div style="font-size:0.88rem;font-weight:700;color:#334155;">Upload Driver's License Card Photo</div>
                  <div style="font-size:0.75rem;color:#64748b;margin-top:2px;">Select clear photo of your Driver's License ID (JPG, PNG, WEBP)</div>
                </div>
              `}
            </div>
            <input type="file" id="licenseFileInput" accept="image/*" style="display:none;" />
            <input type="hidden" id="licenseIdUrl" value="${p.license_id_url ?? ''}" />
            <button type="button" class="btn btn-ghost btn-sm" id="uploadLicenseBtn" style="border:1px solid #cbd5e1;background:#ffffff;">
              <i class="fa-solid fa-arrow-up-from-bracket"></i> ${p.license_id_url ? 'Change License Photo' : 'Choose License Photo'}
            </button>
          </div>

          <div class="field" style="margin-bottom:22px;">
            <label>Complete Address</label>
            <input type="text" id="profAddress" value="${p.address ?? ''}" placeholder="123 Sampaguita St, Barangay San Antonio, Makati City" />
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="saveProfBtn" style="padding:14px;">
            <i class="fa-solid fa-floppy-disk"></i> Save Profile Details
          </button>
        </form>
      </div>
    </div>
  `;

  // Attach license photo picker events
  const uploadBtn = $('#uploadLicenseBtn');
  const fileInput = $('#licenseFileInput');
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target.result;
        $('#licenseIdUrl').value = dataUrl;
        $('#licensePreviewBox').innerHTML = `
          <div style="position:relative;display:inline-block;">
            <img src="${dataUrl}" id="licenseImgPreview" style="max-width:100%;max-height:190px;border-radius:10px;border:2px solid #2563eb;box-shadow:0 4px 12px rgba(0,0,0,0.1);" />
            <div style="position:absolute;top:6px;right:6px;background:#059669;color:#fff;font-size:0.72rem;font-weight:700;padding:3px 10px;border-radius:99px;"><i class="fa-solid fa-shield-check"></i> Photo Ready</div>
          </div>
        `;
        toast('Driver License photo selected! Click Save Profile Details to submit.', 'info');
      };
      reader.readAsDataURL(file);
    });
  }

  $('#profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = $('#saveProfBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving Changes…';

    const updated = {
      full_name: $('#profName').value.trim(),
      phone: $('#profPhone').value.trim(),
      license_number: $('#profLicense').value.trim(),
      license_expiry: $('#profLicenseExpiry').value || null,
      license_id_url: $('#licenseIdUrl').value,
      address: $('#profAddress').value.trim(),
    };

    let { error } = await supabase.from('profiles').update(updated).eq('id', state.user.id);

    if (error) {
      // Graceful fallback for custom schema columns (address, license_number, etc.)
      const standardPayload = { full_name: updated.full_name, phone: updated.phone };
      const { error: fbErr } = await supabase.from('profiles').update(standardPayload).eq('id', state.user.id);
      if (fbErr) {
        toast(fbErr.message, 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Profile Details';
        return;
      }
    }

    // Save locally for smooth persistence
    try {
      localStorage.setItem(`rentflow_prof_${state.user.id}`, JSON.stringify(updated));
    } catch (e) {}

    Object.assign(state.profile, updated);
    toast('Profile & License details saved successfully!', 'success');
    renderShell();
  });
}

let browseFilter = 'all';
let browseStatusFilter = 'all';
let browseSearch = '';

function renderBrowse(view) {
  const cats = ['all', ...state.categories.map(c => c.name)];
  const availableCount = state.vehicles.filter(v => v.status === 'available').length;
  const filtered = state.vehicles.filter(v => {
    const vCat = getVehicleCategoryName(v);
    const matchesCat = browseFilter === 'all' || 
                       vCat.toLowerCase() === browseFilter.toLowerCase() || 
                       (v.categories?.name && v.categories.name.toLowerCase() === browseFilter.toLowerCase());
    const matchesSearch = v.name.toLowerCase().includes(browseSearch.toLowerCase());
    const matchesStatus = browseStatusFilter === 'all' || v.status === browseStatusFilter;
    return matchesCat && matchesSearch && matchesStatus;
  });

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2>Available Vehicles</h2>
          <p>Find the perfect vehicle for your trip, check dates, and request a booking online.</p>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="badge badge-available" style="padding:6px 14px;font-size:0.82rem;box-shadow:0 2px 8px rgba(5,150,105,0.15);">
            <i class="fa-solid fa-circle-check" style="color:#059669;"></i> ${availableCount} Ready &amp; Available
          </span>
        </div>
      </div>
      <div class="search-bar">
        <div style="position:relative;flex:1;">
          <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8;"></i>
          <input type="text" id="vSearch" style="padding-left:40px;" placeholder="Search by model, brand, or features…" value="${browseSearch}" />
        </div>
      </div>
      <div class="pill-row" style="margin-bottom:8px;">
        <div class="pill ${browseStatusFilter === 'all' ? 'active' : ''}" data-status="all">All Vehicles</div>
        <div class="pill ${browseStatusFilter === 'available' ? 'active' : ''}" data-status="available" style="${browseStatusFilter === 'available' ? 'background:#059669;color:#fff;font-weight:700;' : 'border-color:#a7f3d0;color:#047857;background:#ecfdf5;font-weight:600;'}">
          <i class="fa-solid fa-circle-check"></i> Available Only (${availableCount})
        </div>
      </div>
      <div class="pill-row" id="catPills">
        ${cats.map(c => `<div class="pill ${browseFilter === c ? 'active' : ''}" data-cat="${c}">${c === 'all' ? 'All Categories' : c}</div>`).join('')}
      </div>
      <div class="grid grid-vehicles" id="vehicleGrid">
        ${filtered.length ? filtered.map(vehicleCardHTML).join('') : emptyState('🚘', 'No vehicles match your search or filter.')}
      </div>
    </div>
  `;

  $('#vSearch').addEventListener('input', (e) => { browseSearch = e.target.value; renderBrowse(view); });
  $$('[data-status]').forEach(p => p.addEventListener('click', () => { browseStatusFilter = p.dataset.status; renderBrowse(view); }));
  $$('#catPills .pill').forEach(p => p.addEventListener('click', () => { browseFilter = p.dataset.cat; renderBrowse(view); }));
  $$('#vehicleGrid .vehicle-card').forEach(card => card.addEventListener('click', () => openVehicleDetail(Number(card.dataset.id))));
  $$('#vehicleGrid .fav-heart-btn').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(Number(btn.dataset.favid));
  }));
}

function vehicleCardHTML(v) {
  const statusClass = `badge-${v.status}`;
  const exactImg = getExactVehicleImage(v);
  const fuelType = v.fuel_type ?? 'Gasoline';
  const hasAC = v.has_ac !== undefined ? v.has_ac : true;
  const rate = getVehicleDailyRate(v);
  const catName = getVehicleCategoryName(v);

  const favs = getFavorites();
  const isFav = favs.includes(v.id);

  const isAvailable = v.status === 'available';
  const badgeContent = isAvailable 
    ? `<i class="fa-solid fa-circle-check" style="color:#059669;"></i> Available`
    : (v.status === 'maintenance' && v.maintenance_days ? `<i class="fa-solid fa-wrench"></i> maintenance (${v.maintenance_days}d)` : `<i class="fa-solid fa-car-side"></i> ${v.status}`);

  return `
    <div class="glass vehicle-card" data-id="${v.id}" style="${isAvailable ? 'border-top:3px solid #10b981;' : ''}">
      <div class="vehicle-img-wrapper">
        <img class="vehicle-img" src="${exactImg}" alt="${v.name}" onerror="this.src='${exactImg}'" />
        <div class="fav-heart-btn ${isFav ? 'active' : ''}" data-favid="${v.id}" title="${isFav ? 'Remove from Favorites' : 'Save to Favorites'}">
          <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart" style="color:${isFav ? '#e11d48' : '#fff'};font-size:0.95rem;"></i>
        </div>
        <div class="vehicle-badge-pos">
          <span class="badge ${statusClass}" style="box-shadow:0 2px 8px rgba(0,0,0,0.12);">${badgeContent}</span>
        </div>
      </div>
      <div class="vehicle-body">
        <div class="vehicle-name">${v.name}</div>
        <div class="vehicle-meta">
          <span><i class="fa-solid fa-layer-group" style="color:#2563eb;"></i> ${catName}</span>
          <span><i class="fa-solid fa-users" style="color:#0284c7;"></i> ${v.seats ?? (catName === 'Motorcycles' ? '2' : '5')} seats</span>
          <span><i class="fa-solid fa-gear" style="color:#64748b;"></i> ${v.transmission ?? 'Automatic'}</span>
        </div>
        <div class="vehicle-meta" style="margin-top:-4px;">
          <span><i class="fa-solid fa-gas-pump" style="color:#d97706;"></i> ${fuelType}</span>
          <span><i class="fa-solid fa-${hasAC ? 'snowflake' : 'fan'}" style="color:${hasAC ? '#0284c7' : '#94a3b8'};"></i> ${hasAC ? 'AC' : 'Non-AC'}</span>
          <span style="color:#94a3b8;"><i class="fa-solid fa-id-card"></i> ${maskPlate(v.plate_number)}</span>
        </div>
        <div class="vehicle-foot">
          <div class="rate">${fmtMoney(rate)} <span>/ day</span></div>
          <button class="btn btn-sm ${isAvailable ? 'btn-primary' : 'btn-ghost'}" style="${isAvailable ? 'background:#059669;border-color:#059669;color:#fff;' : 'opacity:0.75;'}">
            ${isAvailable ? '<i class="fa-solid fa-calendar-plus"></i> Rent Now' : 'View Details'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function emptyState(icon, text) {
  return `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">${icon}</div><p>${text}</p></div>`;
}

async function openVehicleDetail(id) {
  const v = state.vehicles.find(v => v.id === id);
  if (!v) return;
  const fuelType = v.fuel_type ?? 'Gasoline';
  const hasAC = v.has_ac !== undefined ? v.has_ac : true;
  const todayStr = new Date().toISOString().slice(0, 10);

  // Load available drivers & existing booked date intervals
  let drivers = state.drivers || [];
  const [{ data: fetchedDrivers }, { data: bookedIntervals }] = await Promise.all([
    drivers.length ? Promise.resolve({ data: drivers }) : supabase.from('drivers').select('*').order('name'),
    supabase.from('bookings').select('start_date, end_date').eq('vehicle_id', v.id).in('status', ['pending', 'approved', 'active']).gte('end_date', todayStr).order('start_date'),
  ]);
  drivers = (fetchedDrivers || []).map(d => ({ ...d, daily_fee: Number(d.daily_fee || 0) < 500 ? 500 : Number(d.daily_fee) }));
  state.drivers = drivers;

  const rate = getVehicleDailyRate(v);
  const catName = getVehicleCategoryName(v);
  const exactImg = getExactVehicleImage(v);

  const modal = openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.2rem;font-weight:800;color:#0f172a;">${v.name}</h3>
        <span class="muted" style="font-size:0.78rem;"><i class="fa-solid fa-layer-group"></i> ${catName} · Plate: ${maskPlate(v.plate_number)}</span>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>
    <img src="${exactImg}" style="width:100%;border-radius:12px;height:190px;object-fit:cover;margin-bottom:14px;border:1px solid #e2e8f0;" />
    <p class="muted" style="margin-bottom:16px;line-height:1.5;color:#475569;">${v.description ?? 'Comfortable and well-maintained rental vehicle.'}</p>
    <div class="detail-grid" style="margin-bottom:16px;background:#f8fafc;padding:12px 16px;border-radius:10px;border:1px solid #e2e8f0;">
      <div><label>Capacity</label><div style="font-weight:700;font-size:0.9rem;color:#0f172a;"><i class="fa-solid fa-users" style="color:#0284c7;"></i> ${v.seats ?? (catName === 'Motorcycles' ? '2' : '5')} Passengers</div></div>
      <div><label>Transmission</label><div style="font-weight:700;font-size:0.9rem;color:#0f172a;"><i class="fa-solid fa-gear" style="color:#2563eb;"></i> ${v.transmission ?? 'Automatic'}</div></div>
      <div><label>Fuel Type</label><div style="font-weight:700;font-size:0.9rem;color:#0f172a;"><i class="fa-solid fa-gas-pump" style="color:#d97706;"></i> ${fuelType}</div></div>
      <div><label>Air Conditioning</label><div style="font-weight:700;font-size:0.9rem;color:#0f172a;"><i class="fa-solid fa-${hasAC ? 'snowflake' : 'fan'}" style="color:${hasAC ? '#0284c7' : '#94a3b8'};"></i> ${hasAC ? 'With AC' : 'Non-AC'}</div></div>
      <div><label>Daily Rate</label><div style="font-weight:800;font-size:0.95rem;color:#2563eb;">${fmtMoney(rate)}</div></div>
      <div><label>Status</label><div><span class="badge badge-${v.status}">${v.status}</span> ${v.status === 'maintenance' && v.maintenance_days ? `<span style="font-size:0.75rem;color:#dc2626;font-weight:700;">(${v.maintenance_days} days)</span>` : ''}</div></div>
    </div>

    <div class="divider"></div>
    <h4 style="margin-bottom:12px;display:flex;align-items:center;gap:6px;color:#0f172a;"><i class="fa-solid fa-money-bill-wave" style="color:#059669;"></i> Charge Type</h4>
    <div class="detail-grid" style="margin-bottom:16px;">
      <div class="field">
        <label>Billing Method</label>
        <select id="chargeType">
          <option value="per_day">Per Day (${fmtMoney(rate)} / day)</option>
          <option value="per_km">Per Kilometer (${fmtMoney(rate * 0.05)} / km)</option>
        </select>
      </div>
      <div class="field hidden" id="kmField">
        <label>Estimated Kilometers</label>
        <input type="number" id="estKm" min="1" placeholder="e.g. 150" />
      </div>
    </div>

    <div class="divider"></div>
    <h4 style="margin-bottom:12px;display:flex;align-items:center;gap:6px;color:#0f172a;"><i class="fa-solid fa-id-badge" style="color:#7c3aed;"></i> Driver Selection <span style="font-weight:500;font-size:0.78rem;color:#94a3b8;">(optional)</span></h4>
    <div class="field">
      <select id="driverSelect" style="font-size:0.88rem;">
        <option value="">Self-drive (No driver needed)</option>
        ${drivers.map(d => `<option value="${d.id}" ${d.status !== 'available' ? 'disabled' : ''}>${d.name} — ${d.license_type ?? 'Pro'} License${d.status !== 'available' ? ' (Unavailable)' : ''}</option>`).join('')}
      </select>
    </div>
    <div id="driverInfo"></div>

    <div class="divider"></div>
    <h4 style="margin-bottom:12px;display:flex;align-items:center;gap:6px;color:#0f172a;"><i class="fa-solid fa-calendar-days" style="color:#2563eb;"></i> Select Booking Dates</h4>
    <div id="calWidgetContainer"></div>
    <div class="detail-grid">
      <div class="field"><label>Start Date</label><input type="date" id="bStart" min="${todayStr}" /></div>
      <div class="field"><label>End Date</label><input type="date" id="bEnd" min="${todayStr}" /></div>
    </div>
    <div id="availabilityMsg" class="muted" style="margin-top:4px;"></div>
    <div id="quoteBox"></div>
    <button class="btn btn-primary btn-block" id="submitBooking" style="margin-top:16px;" disabled>Select Dates to Book</button>
  `, false);

  $('#mClose').addEventListener('click', closeModal);

  // Charge type toggle
  const chargeType = $('#chargeType'), kmField = $('#kmField'), estKmInput = $('#estKm');
  chargeType.addEventListener('change', () => {
    kmField.classList.toggle('hidden', chargeType.value !== 'per_km');
    checkAvailability();
  });
  if (estKmInput) estKmInput.addEventListener('input', checkAvailability);

  // Driver selection
  const driverSelect = $('#driverSelect'), driverInfo = $('#driverInfo');
  driverSelect.addEventListener('change', () => {
    const dId = driverSelect.value;
    if (!dId) { driverInfo.innerHTML = ''; return; }
    const d = drivers.find(dr => String(dr.id) === dId);
    if (!d) return;
    driverInfo.innerHTML = `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-top:8px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#5b21b6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.9rem;">${(d.name || '?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}</div>
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.95rem;">${d.name}</div>
            <div style="font-size:0.78rem;color:#64748b;">${d.phone ?? 'No phone listed'}</div>
          </div>
          <span class="badge badge-${d.status === 'available' ? 'available' : 'rented'}" style="margin-left:auto;">${d.status}</span>
        </div>
        <div class="detail-grid" style="gap:8px;">
          <div><label style="font-size:0.68rem;">License Type</label><div style="font-weight:600;font-size:0.84rem;color:#0f172a;">${d.license_type ?? 'Professional'}</div></div>
          <div><label style="font-size:0.68rem;">Experience</label><div style="font-weight:600;font-size:0.84rem;color:#0f172a;">${d.experience_years ?? '3'}+ years</div></div>
          <div><label style="font-size:0.68rem;">Rating</label><div style="font-weight:600;font-size:0.84rem;color:#d97706;">⭐ ${d.rating ?? '4.5'} / 5.0</div></div>
          <div><label style="font-size:0.68rem;">Driver Fee</label><div style="font-weight:700;font-size:0.84rem;color:#059669;">${fmtMoney(d.daily_fee ?? 500)} / day</div></div>
        </div>
      </div>
    `;
    checkAvailability();
  });

  const start = $('#bStart'), end = $('#bEnd'), submitBtn = $('#submitBooking'), availMsg = $('#availabilityMsg'), quoteBox = $('#quoteBox');

  // --- Custom Interactive Calendar Builder ---
  let calViewYear = new Date().getFullYear();
  let calViewMonth = new Date().getMonth(); // 0-11

  function renderInteractiveCalendar() {
    const calContainer = $('#calWidgetContainer');
    if (!calContainer) return;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
    const firstDayIndex = new Date(calViewYear, calViewMonth, 1).getDay();

    const selectedStartVal = start.value;
    const selectedEndVal = end.value;

    let daysHTML = '';
    for (let i = 0; i < firstDayIndex; i++) {
      daysHTML += `<div class="cal-day cal-day-past"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(calViewMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateIso = `${calViewYear}-${monthStr}-${dayStr}`;

      const isPast = dateIso < todayStr;
      const isBooked = bookedIntervals && bookedIntervals.some(b => dateIso >= b.start_date && dateIso <= b.end_date);
      const isStart = selectedStartVal === dateIso;
      const isEnd = selectedEndVal === dateIso;
      const isInRange = selectedStartVal && selectedEndVal && dateIso > selectedStartVal && dateIso < selectedEndVal;

      let dayClass = 'cal-day-available';
      if (isPast) dayClass = 'cal-day-past';
      else if (isBooked) dayClass = 'cal-day-booked';
      
      if (isStart || isEnd) dayClass += ' cal-day-selected';
      else if (isInRange) dayClass += ' cal-day-in-range';

      daysHTML += `
        <div class="cal-day ${dayClass}" data-date="${dateIso}" ${isPast || isBooked ? 'style="pointer-events:none;"' : ''}>
          ${d}
        </div>
      `;
    }

    calContainer.innerHTML = `
      <div class="custom-calendar">
        <div class="cal-header">
          <button class="cal-nav-btn" id="calPrevMonth"><i class="fa-solid fa-chevron-left"></i></button>
          <div class="cal-month-title">${monthNames[calViewMonth]} ${calViewYear}</div>
          <button class="cal-nav-btn" id="calNextMonth"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div class="cal-weekdays">
          <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
        </div>
        <div class="cal-days-grid">${daysHTML}</div>
        <div class="cal-legend">
          <div><span class="cal-legend-dot" style="background:#10b981;"></span> Available for Rent</div>
          <div><span class="cal-legend-dot" style="background:#ef4444;"></span> Booked (Disabled)</div>
          <div><span class="cal-legend-dot" style="background:#2563eb;"></span> Selected</div>
        </div>
      </div>
    `;

    $('#calPrevMonth').addEventListener('click', (e) => {
      e.preventDefault();
      calViewMonth--;
      if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
      renderInteractiveCalendar();
    });

    $('#calNextMonth').addEventListener('click', (e) => {
      e.preventDefault();
      calViewMonth++;
      if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
      renderInteractiveCalendar();
    });

    calContainer.querySelectorAll('.cal-day-available').forEach(cell => {
      cell.addEventListener('click', () => {
        const clickedDate = cell.dataset.date;
        if (!start.value || (start.value && end.value)) {
          start.value = clickedDate;
          end.value = '';
        } else if (clickedDate > start.value) {
          const hasBookedInside = bookedIntervals && bookedIntervals.some(b => b.start_date > start.value && b.start_date < clickedDate);
          if (hasBookedInside) {
            toast('Cannot select range across already booked dates.', 'error');
            start.value = clickedDate;
            end.value = '';
          } else {
            end.value = clickedDate;
          }
        } else {
          start.value = clickedDate;
          end.value = '';
        }
        renderInteractiveCalendar();
        checkAvailability();
      });
    });
  }

  renderInteractiveCalendar();

  // Dynamic max date bounds calculation
  start.addEventListener('change', () => {
    if (!start.value) return;
    end.min = start.value;
    
    // Find next booked interval after selected start date
    if (bookedIntervals && bookedIntervals.length) {
      const nextBooked = bookedIntervals.find(b => b.start_date >= start.value);
      if (nextBooked) {
        // Cap max end date to day before next booked start date
        const prevDay = new Date(new Date(nextBooked.start_date).getTime() - 86400000).toISOString().slice(0, 10);
        end.max = prevDay >= start.value ? prevDay : start.value;
      } else {
        end.removeAttribute('max');
      }
    }
    renderInteractiveCalendar();
    checkAvailability();
  });
  end.addEventListener('change', () => {
    renderInteractiveCalendar();
    checkAvailability();
  });

  async function checkAvailability() {
    if (!start.value || !end.value) return;

    if (new Date(end.value) < new Date(start.value)) {
      availMsg.innerHTML = `<span style="color:var(--coral);font-weight:600;">⚠️ End date must be after start date.</span>`;
      submitBtn.disabled = true;
      return;
    }
    if (v.status === 'maintenance') {
      availMsg.innerHTML = `<span style="color:var(--coral);font-weight:600;">⚠️ This vehicle is currently in maintenance.</span>`;
      submitBtn.disabled = true;
      return;
    }

    // Check conflict against known booked intervals
    if (bookedIntervals && bookedIntervals.length) {
      const conflict = bookedIntervals.find(b => {
        return (start.value <= b.end_date && end.value >= b.start_date);
      });

      if (conflict) {
        availMsg.innerHTML = `<span style="color:#e11d48;font-weight:700;">❌ Date Conflict! Vehicle is ALREADY BOOKED from ${fmtDate(conflict.start_date)} to ${fmtDate(conflict.end_date)}. Please pick different dates.</span>`;
        submitBtn.disabled = true;
        quoteBox.innerHTML = '';
        return;
      }
    }

    availMsg.textContent = 'Checking availability…';
    const { data: overlaps, error } = await supabase
      .from('bookings')
      .select('id, start_date, end_date')
      .eq('vehicle_id', v.id)
      .in('status', ['pending', 'approved', 'active'])
      .lte('start_date', end.value)
      .gte('end_date', start.value);

    if (error) { availMsg.textContent = 'Could not check availability.'; return; }
    if (overlaps && overlaps.length) {
      availMsg.innerHTML = `<span style="color:#e11d48;font-weight:700;">❌ Dates already booked. Please choose available dates above.</span>`;
      submitBtn.disabled = true;
      quoteBox.innerHTML = '';
      return;
    }

    const days = daysBetween(start.value, end.value);
    const rate = getVehicleDailyRate(v);
    const isPerKm = chargeType.value === 'per_km';
    const kmRate = rate * 0.05;
    const estKm = Number(estKmInput?.value || 0);
    let vehicleCost = isPerKm ? (kmRate * estKm) : (days * rate);
    if (isPerKm && estKm <= 0) {
      availMsg.innerHTML = `<span style="color:var(--green)">✓ Available. Enter estimated kilometers for price.</span>`;
      submitBtn.disabled = true;
      quoteBox.innerHTML = '';
      return;
    }

    // Driver fee
    const dId = driverSelect.value;
    const selectedDriver = dId ? drivers.find(dr => String(dr.id) === dId) : null;
    const driverFee = selectedDriver ? (selectedDriver.daily_fee ?? 500) * days : 0;
    const total = vehicleCost + driverFee;

    availMsg.innerHTML = `<span style="color:var(--green);font-weight:700;">✓ Dates available for booking!</span>`;
    quoteBox.innerHTML = `
      <div class="receipt" style="margin-top:12px;">
        <div class="receipt-row"><span>${isPerKm ? `${estKm} km × ${fmtMoney(kmRate)}/km` : `${days} day(s) × ${fmtMoney(rate)}/day`}</span><span>${fmtMoney(vehicleCost)}</span></div>
        <div class="receipt-row"><span>Charge type</span><span style="font-weight:600;">${isPerKm ? 'Per Kilometer' : 'Per Day'}</span></div>
        ${selectedDriver ? `<div class="receipt-row"><span>Driver: ${selectedDriver.name} (${days} days × ${fmtMoney(selectedDriver.daily_fee ?? 500)})</span><span>${fmtMoney(driverFee)}</span></div>` : ''}
        <div class="divider"></div>
        <div class="receipt-row receipt-total"><span>Estimated total</span><span>${fmtMoney(total)}</span></div>
      </div>
    `;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Booking Request';
    submitBtn.dataset.total = total;
    submitBtn.dataset.chargeType = chargeType.value;
    submitBtn.dataset.driverId = dId || '';
    if (isPerKm) submitBtn.dataset.estKm = estKm;
  }

  start.addEventListener('change', checkAvailability);
  end.addEventListener('change', checkAvailability);

  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';
    const totalAmount = Number(submitBtn.dataset.total);
    const selectedChargeType = submitBtn.dataset.chargeType;
    const selectedDriverId = submitBtn.dataset.driverId || null;
    const selectedDriver = selectedDriverId ? drivers.find(dr => String(dr.id) === selectedDriverId) : null;

    const bookingPayload = {
      customer_id: state.user.id,
      vehicle_id: v.id,
      start_date: start.value,
      end_date: end.value,
      total_amount: totalAmount,
      status: 'pending',
    };
    const { data: newBooking, error } = await supabase.from('bookings').insert(bookingPayload).select().single();
    if (error) {
      toast(error.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Booking Request';
      return;
    }

    // If driver selected, mark in driver_assignments (or just store in-memory for display)
    if (selectedDriverId) {
      await supabase.from('driver_assignments').insert({
        booking_id: newBooking?.id ?? null,
        driver_id: Number(selectedDriverId),
      }).then(() => {}).catch(() => {});
    }

    closeModal();

    // === Show Booking Confirmation Receipt ===
    const days = daysBetween(start.value, end.value);
    const rate = v.categories?.daily_rate ?? 0;
    const isPerKm = selectedChargeType === 'per_km';
    const kmRate = rate * 0.05;
    const estKm = Number(submitBtn.dataset.estKm || 0);
    const vehicleCost = isPerKm ? (kmRate * estKm) : (days * rate);
    const driverFee = selectedDriver ? (selectedDriver.daily_fee ?? 500) * days : 0;
    const refNum = `BK-${Date.now().toString().slice(-8)}`;

    openModal(`
      <div style="text-align:center;margin-bottom:18px;">
        <div style="width:56px;height:56px;border-radius:50%;background:#ecfdf5;border:2px solid #a7f3d0;display:inline-flex;align-items:center;justify-content:center;margin-bottom:10px;">
          <i class="fa-solid fa-circle-check" style="font-size:28px;color:#059669;"></i>
        </div>
        <h2 style="font-size:1.3rem;font-weight:800;color:#0f172a;margin-bottom:4px;">Booking Submitted!</h2>
        <span class="badge badge-pending" style="font-size:0.75rem;">Pending Review</span>
        <p class="muted" style="margin-top:8px;font-size:0.82rem;color:#64748b;">Reference: <strong style="color:#0f172a;">${refNum}</strong></p>
      </div>

      <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-car" style="color:#2563eb;"></i> Booking Information</h4>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;">
        <div class="receipt-row"><span style="color:#64748b;">Vehicle</span><span style="font-weight:700;color:#0f172a;">${v.name}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Category</span><span style="color:#0f172a;">${v.categories?.name ?? 'Standard'}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Plate Number</span><span style="color:#0f172a;">${maskPlate(v.plate_number)}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Pickup Date</span><span style="color:#0f172a;">${fmtDate(start.value)}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Return Date</span><span style="color:#0f172a;">${fmtDate(end.value)}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Duration</span><span style="color:#0f172a;">${days} day(s)</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Charge Type</span><span style="font-weight:600;color:#0f172a;">${isPerKm ? `Per Kilometer (est. ${estKm} km)` : 'Per Day'}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Fuel / AC</span><span style="color:#0f172a;">${fuelType} · ${hasAC ? 'With AC' : 'Non-AC'}</span></div>
      </div>

      ${selectedDriver ? `
        <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-id-badge" style="color:#7c3aed;"></i> Driver Information</h4>
        <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:14px;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#5b21b6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.82rem;">${(selectedDriver.name || '?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}</div>
            <div>
              <div style="font-weight:700;color:#0f172a;">${selectedDriver.name}</div>
              <div style="font-size:0.75rem;color:#7c3aed;">${selectedDriver.license_type ?? 'Professional'} License · ⭐ ${selectedDriver.rating ?? '4.5'}</div>
            </div>
          </div>
          <div class="receipt-row"><span style="color:#6b7280;">Phone</span><span style="color:#0f172a;">${selectedDriver.phone ?? 'Contact via office'}</span></div>
          <div class="receipt-row"><span style="color:#6b7280;">Experience</span><span style="color:#0f172a;">${selectedDriver.experience_years ?? '3'}+ years</span></div>
          <div class="receipt-row"><span style="color:#6b7280;">Driver Fee</span><span style="font-weight:600;color:#059669;">${fmtMoney(selectedDriver.daily_fee ?? 500)} × ${days} days = ${fmtMoney(driverFee)}</span></div>
        </div>
      ` : `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px;">
          <i class="fa-solid fa-steering-wheel" style="color:#64748b;font-size:1.1rem;"></i>
          <span style="font-size:0.85rem;color:#475569;font-weight:600;">Self-Drive — No driver assigned</span>
        </div>
      `}

      <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-receipt" style="color:#059669;"></i> Cost Breakdown</h4>
      <div class="receipt" style="margin-bottom:16px;">
        <div class="receipt-row"><span>Vehicle (${isPerKm ? `${estKm} km × ${fmtMoney(kmRate)}` : `${days} days × ${fmtMoney(rate)}`})</span><span>${fmtMoney(vehicleCost)}</span></div>
        ${selectedDriver ? `<div class="receipt-row"><span>Driver Fee</span><span>${fmtMoney(driverFee)}</span></div>` : ''}
        <div class="divider"></div>
        <div class="receipt-row receipt-total"><span>Total Amount</span><span>${fmtMoney(totalAmount)}</span></div>
      </div>

      <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-clipboard-list" style="color:#0284c7;"></i> Rental Details</h4>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px;margin-bottom:14px;">
        <div class="receipt-row"><span style="color:#0369a1;">Pickup Location</span><span style="color:#0f172a;font-weight:600;">VEHICLE RENTALS MAIN BRANCH</span></div>
        <div class="receipt-row"><span style="color:#0369a1;">Return Location</span><span style="color:#0f172a;font-weight:600;">VEHICLE RENTALS MAIN BRANCH</span></div>
        <div class="receipt-row"><span style="color:#0369a1;">Fuel Policy</span><span style="color:#0f172a;">Full-to-Full</span></div>
        <div class="receipt-row"><span style="color:#0369a1;">Mileage</span><span style="color:#0f172a;">${isPerKm ? 'Charged per km' : 'Unlimited'}</span></div>
        <div class="receipt-row"><span style="color:#0369a1;">Insurance</span><span style="color:#0f172a;">Basic coverage included</span></div>
        <div class="receipt-row"><span style="color:#0369a1;">Late Return Fee</span><span style="color:#0f172a;">${fmtMoney(rate * 0.5)} / hour</span></div>
        <div class="receipt-row"><span style="color:#0369a1;">Cancellation</span><span style="color:#0f172a;">Free up to 24hrs before pickup</span></div>
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid #bae6fd;">
          <p style="font-size:0.75rem;color:#0369a1;line-height:1.5;margin:0;"><i class="fa-solid fa-circle-info" style="margin-right:4px;"></i> Please bring a valid ID and driver's license upon vehicle pickup. A security deposit may be required.</p>
        </div>
      </div>

      <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-headset" style="color:#059669;"></i> Support Contact</h4>
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#059669,#047857);display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-headset" style="color:#fff;font-size:1rem;"></i></div>
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.95rem;">Rental Support</div>
            <div style="font-size:0.75rem;color:#059669;font-weight:600;">Available 24/7</div>
          </div>
        </div>
        <div class="receipt-row"><span style="color:#065f46;"><i class="fa-solid fa-phone" style="margin-right:5px;"></i> Hotline</span><span style="font-weight:700;color:#0f172a;">+63 (2) 8888-RENT</span></div>
        <div class="receipt-row"><span style="color:#065f46;"><i class="fa-solid fa-mobile-screen" style="margin-right:5px;"></i> Mobile</span><span style="font-weight:700;color:#0f172a;">+63 917 123 4567</span></div>
        <div class="receipt-row"><span style="color:#065f46;"><i class="fa-solid fa-envelope" style="margin-right:5px;"></i> Email</span><span style="font-weight:600;color:#0f172a;">vehiclerental@gmail.com</span></div>
        <div class="receipt-row"><span style="color:#065f46;"><i class="fa-solid fa-location-dot" style="margin-right:5px;"></i> Address</span><span style="color:#0f172a;">123 Main Ave, Makati City</span></div>
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid #a7f3d0;">
          <p style="font-size:0.75rem;color:#065f46;line-height:1.5;margin:0;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:4px;color:#d97706;"></i> For roadside emergencies, call our 24/7 hotline immediately. We'll dispatch assistance to your location.</p>
        </div>
      </div>

      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-bottom:16px;">
        <h4 style="margin:0 0 8px 0;display:flex;align-items:center;gap:6px;color:#92400e;font-size:0.88rem;"><i class="fa-solid fa-triangle-exclamation" style="color:#d97706;"></i> Important Information</h4>
        <p style="font-size:0.82rem;color:#78350f;line-height:1.6;margin:0;">Please arrive at least <strong>15 minutes before</strong> your scheduled pickup time. Don't forget to bring your <strong>driving license</strong> and a <strong>valid ID</strong> for verification.</p>
      </div>

      <div style="text-align:center;margin-bottom:6px;">
        <p class="muted" style="font-size:0.78rem;color:#94a3b8;">Staff will review your booking request and notify you when approved. Once approved, you can complete payment and print your official receipt.</p>
      </div>
      <button class="btn btn-primary btn-block" id="confirmClose">Done</button>
    `);
    $('#confirmClose').addEventListener('click', () => {
      closeModal();
      state.tab = 'bookings';
      renderShell();
    });
  });
}

async function renderMyBookings(view) {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, vehicles(name, plate_number, image_url)')
    .eq('customer_id', state.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div><h2><i class="fa-solid fa-calendar-check" style="color:#059669;margin-right:8px;"></i> My Bookings &amp; Rentals</h2><p>Track your requests, active rentals, receipts, and rental history.</p></div>
      </div>
      <div class="row-list" id="bookingList">
        ${bookings.length ? bookings.map(b => customerBookingRow(b)).join('') : emptyState('📄', 'No bookings yet — browse vehicles to get started.')}
      </div>
    </div>
  `;

  $$('[data-pay-id]').forEach(btn => btn.addEventListener('click', () => openPaymentModal(Number(btn.dataset.payId))));
  $$('[data-pay-balance-id]').forEach(btn => btn.addEventListener('click', () => openPaymentModal(Number(btn.dataset.payBalanceId), true)));
  $$('[data-receipt-id]').forEach(btn => btn.addEventListener('click', () => openReceiptModal(Number(btn.dataset.receiptId))));
  $$('[data-refund-req-id]').forEach(btn => btn.addEventListener('click', () => openRefundRequestModal(Number(btn.dataset.refundReqId))));
  $$('[data-refund-voucher-id]').forEach(btn => btn.addEventListener('click', () => openRefundVoucherModal(Number(btn.dataset.refundVoucherId))));
  $$('[data-cancel-id]').forEach(btn => btn.addEventListener('click', async () => {
    const bookingId = Number(btn.dataset.cancelId);
    if (!confirm('Are you sure you want to cancel this booking request?')) return;
    
    btn.disabled = true;
    btn.textContent = 'Cancelling…';

    const { data: b } = await supabase.from('bookings').select('vehicle_id, status').eq('id', bookingId).single();
    
    const { error } = await supabase.from('bookings').update({
      status: 'cancelled',
      review_notes: 'Cancelled by customer.'
    }).eq('id', bookingId);

    if (error) {
      toast(error.message, 'error');
      renderTab();
      return;
    }

    // Release vehicle back to available if it was reserved
    if (b && b.vehicle_id) {
      await supabase.from('vehicles').update({ status: 'available' }).eq('id', b.vehicle_id).then(() => {}).catch(() => {});
    }

    toast('Booking request has been cancelled.', 'info');
    await loadVehicles();
    renderTab();
  }));
}

function customerBookingRow(b) {
  const v = b.vehicles;
  const isPartial = b.balance_due && Number(b.balance_due) > 0 && Number(b.paid_amount || 0) > 0;
  let actions = '';
  if (b.status === 'pending') {
    actions = `<button class="btn btn-danger btn-sm" data-cancel-id="${b.id}"><i class="fa-solid fa-xmark"></i> Cancel Request</button>`;
  } else if (b.status === 'approved') {
    actions = `
      <button class="btn btn-primary btn-sm" data-pay-id="${b.id}"><i class="fa-solid fa-credit-card"></i> Pay / Reserve</button>
      <button class="btn btn-danger btn-sm" data-cancel-id="${b.id}"><i class="fa-solid fa-xmark"></i> Cancel</button>
    `;
  } else if (b.status === 'active' || b.status === 'completed') {
    actions = `
      ${isPartial ? `<button class="btn btn-primary btn-sm" data-pay-balance-id="${b.id}" style="background:#2563eb;border-color:#2563eb;"><i class="fa-solid fa-wallet"></i> Pay Balance (${fmtMoney(b.balance_due)})</button>` : ''}
      <button class="btn btn-ghost btn-sm" data-receipt-id="${b.id}"><i class="fa-solid fa-print"></i> Receipt</button>
      <button class="btn btn-warning btn-sm" data-refund-req-id="${b.id}" style="color:#b45309;background:#fef3c7;border:1px solid #fde68a;"><i class="fa-solid fa-hand-holding-dollar"></i> Request Refund</button>
    `;
  } else if (b.status === 'cancelled' || b.status === 'rejected') {
    actions = `
      <button class="btn btn-warning btn-sm" data-refund-req-id="${b.id}" style="color:#b45309;background:#fef3c7;border:1px solid #fde68a;"><i class="fa-solid fa-hand-holding-dollar"></i> Request Refund</button>
    `;
  } else if (b.status === 'refund_requested') {
    actions = `<span class="muted" style="font-size:0.78rem;color:#b45309;font-weight:600;"><i class="fa-solid fa-clock"></i> Refund Pending</span>`;
  } else if (b.status === 'refunded') {
    actions = `<button class="btn btn-ghost btn-sm" data-refund-voucher-id="${b.id}"><i class="fa-solid fa-receipt"></i> Refund Voucher</button>`;
  }

  const badgeHTML = isPartial 
    ? `<span class="badge badge-reserved"><i class="fa-solid fa-bookmark"></i> Reserved (${b.downpayment_percent || 20}% Paid)</span>`
    : `<span class="badge badge-${b.status}">${b.status.replace('_', ' ')}</span>`;

  return `
    <div class="glass item-row">
      <img src="${getExactVehicleImage(v || {})}" style="width:84px;height:60px;object-fit:cover;border-radius:10px;" />
      <div class="item-main">
        <div class="item-title">${v?.name ?? 'Vehicle'} <span class="muted">(${maskPlate(v?.plate_number ?? '')})</span></div>
        <div class="item-sub">
          ${fmtDate(b.start_date)} → ${fmtDate(b.end_date)} · 
          ${isPartial 
            ? `<span style="font-weight:700;color:#0f172a;">Total: ${fmtMoney(b.total_amount)}</span> (<span style="color:#059669;font-weight:600;">Paid: ${fmtMoney(b.paid_amount)}</span> | <span style="color:#2563eb;font-weight:700;">Balance Due at Pickup: ${fmtMoney(b.balance_due)}</span>)`
            : `Total: ${fmtMoney(b.total_amount)}`
          }
        </div>
        ${b.review_notes ? `<div class="item-sub" style="color:var(--coral);margin-top:2px;">${b.review_notes}</div>` : ''}
      </div>
      ${badgeHTML}
      <div class="item-actions">${actions}</div>
    </div>
  `;
}

async function openPaymentModal(bookingId, isPayingBalance = false) {
  const { data: b } = await supabase.from('bookings').select('*, vehicles(name)').eq('id', bookingId).single();
  let selectedMethod = 'gcash'; // 'gcash' | 'bank_qr' | 'card'
  let selectedPct = isPayingBalance ? 100 : (b.downpayment_percent || 100);

  const totalAmount = Number(b.total_amount || 0);
  const currentPaid = Number(b.paid_amount || 0);
  const currentBalance = Number(b.balance_due || (totalAmount - currentPaid));

  function getCalculatedPayNow(pct) {
    if (isPayingBalance) return currentBalance;
    if (pct === 100) return totalAmount;
    return Math.round(totalAmount * (pct / 100));
  }

  function getCalculatedBalance(pct) {
    if (isPayingBalance) return 0;
    return totalAmount - getCalculatedPayNow(pct);
  }

  let payNow = getCalculatedPayNow(selectedPct);
  let balanceDue = getCalculatedBalance(selectedPct);

  const modal = openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.15rem;font-weight:800;color:#0f172a;">${isPayingBalance ? 'Pay Remaining Balance' : 'Pay / Reserve Booking'}</h3>
        <span class="muted" style="font-size:0.78rem;">${b.vehicles.name} · ${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</span>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    ${!isPayingBalance ? `
      <label style="font-size:0.8rem;font-weight:700;color:#0f172a;margin-bottom:6px;display:block;">Choose Payment Option</label>
      <div class="pay-tier-grid" id="tierGrid">
        <div class="pay-tier-btn ${selectedPct === 100 ? 'active' : ''}" data-pct="100">
          <div class="tier-label">100% Full Payment</div>
          <div class="tier-amount">${fmtMoney(totalAmount)}</div>
          <div class="tier-sub">No balance at pickup</div>
        </div>
        <div class="pay-tier-btn ${selectedPct === 20 ? 'active' : ''}" data-pct="20">
          <div class="tier-label">20% Deposit (Reserve)</div>
          <div class="tier-amount">${fmtMoney(getCalculatedPayNow(20))}</div>
          <div class="tier-sub">Balance ${fmtMoney(getCalculatedBalance(20))}</div>
        </div>
        <div class="pay-tier-btn ${selectedPct === 30 ? 'active' : ''}" data-pct="30">
          <div class="tier-label">30% Deposit</div>
          <div class="tier-amount">${fmtMoney(getCalculatedPayNow(30))}</div>
          <div class="tier-sub">Balance ${fmtMoney(getCalculatedBalance(30))}</div>
        </div>
        <div class="pay-tier-btn ${selectedPct === 50 ? 'active' : ''}" data-pct="50">
          <div class="tier-label">50% Deposit</div>
          <div class="tier-amount">${fmtMoney(getCalculatedPayNow(50))}</div>
          <div class="tier-sub">Balance ${fmtMoney(getCalculatedBalance(50))}</div>
        </div>
      </div>
    ` : ''}

    <div class="receipt" id="paymentSummaryBox" style="margin-bottom:16px;">
      <div class="receipt-row"><span>Total Rental Cost</span><span>${fmtMoney(totalAmount)}</span></div>
      ${isPayingBalance ? `
        <div class="receipt-row"><span>Already Paid (Deposit)</span><span style="color:#059669;font-weight:700;">${fmtMoney(currentPaid)}</span></div>
        <div class="receipt-row receipt-total"><span>Remaining Balance Due Now</span><span style="color:#2563eb;">${fmtMoney(currentBalance)}</span></div>
      ` : `
        <div class="receipt-row"><span>Reservation Option</span><span id="summaryTierLabel" style="font-weight:700;">${selectedPct === 100 ? 'Full Payment (100%)' : `${selectedPct}% Partial Downpayment`}</span></div>
        <div class="receipt-row"><span>Balance Due at Pickup</span><span id="summaryBalance" style="color:#64748b;">${fmtMoney(balanceDue)}</span></div>
        <div class="receipt-row receipt-total"><span>Amount Payable Now</span><span id="summaryPayNow" style="color:#2563eb;">${fmtMoney(payNow)}</span></div>
      `}
    </div>

    <div class="auth-tabs" style="margin-bottom:16px;">
      <div class="auth-tab active" data-pay-method="gcash">
        <i class="fa-solid fa-qrcode" style="color:#2563eb;margin-right:4px;"></i> GCash QR
      </div>
      <div class="auth-tab" data-pay-method="bank_qr">
        <i class="fa-solid fa-building-columns" style="color:#059669;margin-right:4px;"></i> Bank QR
      </div>
      <div class="auth-tab" data-pay-method="card">
        <i class="fa-solid fa-credit-card" style="color:#d97706;margin-right:4px;"></i> Card
      </div>
    </div>

    <div id="payContent"></div>

    <button class="btn btn-primary btn-block" id="payBtn" style="margin-top:16px;">Confirm Payment of ${fmtMoney(payNow)}</button>
  `, false);

  $('#mClose').addEventListener('click', closeModal);

  if (!isPayingBalance) {
    $$('#tierGrid .pay-tier-btn', modal).forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#tierGrid .pay-tier-btn', modal).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPct = Number(btn.dataset.pct);
        payNow = getCalculatedPayNow(selectedPct);
        balanceDue = getCalculatedBalance(selectedPct);

        const lbl = $('#summaryTierLabel', modal);
        if (lbl) lbl.textContent = selectedPct === 100 ? 'Full Payment (100%)' : `${selectedPct}% Partial Downpayment`;
        const balEl = $('#summaryBalance', modal);
        if (balEl) balEl.textContent = fmtMoney(balanceDue);
        const payEl = $('#summaryPayNow', modal);
        if (payEl) payEl.textContent = fmtMoney(payNow);

        const pBtn = $('#payBtn', modal);
        if (pBtn) pBtn.textContent = `Confirm Payment of ${fmtMoney(payNow)}`;

        renderPaymentMethodContent();
      });
    });
  }

  function renderPaymentMethodContent() {
    const container = $('#payContent');
    if (selectedMethod === 'gcash') {
      container.innerHTML = `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;text-align:center;margin-bottom:14px;">
          <div style="font-size:0.8rem;font-weight:700;color:#1e40af;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">
            <i class="fa-solid fa-mobile-screen" style="margin-right:4px;"></i> Scan to Pay via GCash
          </div>
          <div style="width:170px;height:170px;background:#ffffff;border:3px solid #2563eb;border-radius:12px;margin:0 auto 12px auto;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(37,99,235,0.15);position:relative;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=GCASH-RENTFLOW-${b.id}-${payNow}" alt="GCash QR Code" style="width:100%;height:100%;object-fit:contain;" />
          </div>
          <div style="font-weight:700;font-size:0.9rem;color:#0f172a;margin-bottom:2px;">RentFlow Vehicles Inc.</div>
          <div style="font-size:0.78rem;color:#475569;font-weight:600;"><i class="fa-solid fa-shield-halved" style="color:#2563eb;margin-right:4px;"></i> Account No: <span style="font-family:monospace;">0917 •••• 4567</span></div>
          <div style="font-size:0.72rem;color:#64748b;margin-top:4px;">Official GCash Express Merchant (Privacy Protected)</div>
        </div>
        <div class="field">
          <label>GCash Reference Number</label>
          <input type="text" id="payRefNo" placeholder="e.g. 1002 9482 1102" required />
        </div>
        <p class="muted" style="font-size:0.76rem;color:#64748b;line-height:1.4;">
          <i class="fa-solid fa-circle-info" style="color:#2563eb;margin-right:4px;"></i> Open your GCash App &gt; QR &gt; Scan QR code. Enter the Reference Number after payment.
        </p>
      `;
    } else if (selectedMethod === 'bank_qr') {
      container.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;text-align:center;margin-bottom:14px;">
          <div style="font-size:0.8rem;font-weight:700;color:#166534;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">
            <i class="fa-solid fa-qrcode" style="margin-right:4px;"></i> InstaPay / QR Ph Payment
          </div>
          <div style="margin-bottom:10px;">
            <label style="font-size:0.7rem;color:#166534;">Select your bank app</label>
            <select id="bankSelect" style="font-size:0.82rem;padding:6px 10px;margin-top:2px;">
              <option value="Maya">Maya / Smart Padala</option>
              <option value="BDO">BDO Unibank</option>
              <option value="BPI">BPI Online</option>
              <option value="UnionBank">UnionBank of the Philippines</option>
              <option value="Metrobank">Metrobank Direct</option>
            </select>
          </div>
          <div style="width:170px;height:170px;background:#ffffff;border:3px solid #059669;border-radius:12px;margin:0 auto 12px auto;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(5,150,105,0.15);">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=INSTAPAY-RENTFLOW-${b.id}-${payNow}" alt="Bank QR Code" style="width:100%;height:100%;object-fit:contain;" />
          </div>
          <div style="font-weight:700;font-size:0.9rem;color:#0f172a;margin-bottom:2px;">RentFlow Corporate Fleet</div>
          <div style="font-size:0.78rem;color:#475569;font-weight:600;"><i class="fa-solid fa-lock" style="color:#059669;margin-right:4px;"></i> Account: <span style="font-family:monospace;">0012 •••• 8899</span></div>
          <div style="font-size:0.72rem;color:#64748b;margin-top:4px;">Secured by QR Ph & InstaPay Philippines</div>
        </div>
        <div class="field">
          <label>Bank Reference / Transaction ID</label>
          <input type="text" id="payRefNo" placeholder="e.g. TXN-99482019" required />
        </div>
        <p class="muted" style="font-size:0.76rem;color:#64748b;line-height:1.4;">
          <i class="fa-solid fa-shield-check" style="color:#059669;margin-right:4px;"></i> Scan with any QR Ph compliant PH Bank app (BDO, BPI, Maya, UnionBank).
        </p>
      `;
    } else {
      container.innerHTML = `
        <div class="field"><label>Cardholder Name</label><input type="text" placeholder="Juan Dela Cruz" /></div>
        <div class="field"><label>Card Number</label><input type="text" placeholder="4242 •••• •••• 4242" maxlength="19" /></div>
        <div class="detail-grid">
          <div class="field"><label>Expiry Date</label><input type="text" placeholder="MM/YY" /></div>
          <div class="field"><label>CVC / CVV</label><input type="password" placeholder="•••" maxlength="4" /></div>
        </div>
        <p class="muted" style="font-size:0.76rem;color:#64748b;">
          <i class="fa-solid fa-lock" style="color:#d97706;margin-right:4px;"></i> Encrypted 256-bit SSL Card Payment.
        </p>
      `;
    }
  }

  renderPaymentMethodContent();

  $$('.auth-tab', modal).forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.auth-tab', modal).forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedMethod = tab.dataset.payMethod;
      renderPaymentMethodContent();
    });
  });

  const payBtn = modal.querySelector('#payBtn');
  if (payBtn) {
    payBtn.addEventListener('click', async () => {
      const refInput = modal.querySelector('#payRefNo');
      const refNo = refInput ? refInput.value.trim() : null;

      if ((selectedMethod === 'gcash' || selectedMethod === 'bank_qr') && !refNo) {
        toast('Please enter your payment Reference Number.', 'error');
        if (refInput) refInput.focus();
        return;
      }

      payBtn.disabled = true;
      payBtn.textContent = 'Verifying Payment…';

      const methodName = selectedMethod === 'gcash' ? 'GCash QR' : selectedMethod === 'bank_qr' ? 'Bank QR Ph' : 'Card';
      const newTotalPaid = currentPaid + payNow;
      const newBalance = Math.max(0, totalAmount - newTotalPaid);
      const newPaymentType = newBalance === 0 ? 'full' : 'partial';

      await supabase.from('payments').insert({
        booking_id: bookingId,
        amount: payNow,
        status: 'successful',
        method: methodName,
        paid_at: new Date().toISOString(),
      });

      let updatePayload = {
        status: 'active',
        paid_amount: newTotalPaid,
        balance_due: newBalance,
        payment_type: newPaymentType,
        downpayment_percent: selectedPct
      };

      let { error: updateErr } = await supabase.from('bookings').update(updatePayload).eq('id', bookingId);
      if (updateErr) {
        // Fallback if DB columns paid_amount/balance_due not yet added in Supabase
        delete updatePayload.paid_amount;
        delete updatePayload.balance_due;
        delete updatePayload.payment_type;
        delete updatePayload.downpayment_percent;
        await supabase.from('bookings').update(updatePayload).eq('id', bookingId);
      }

      await supabase.from('vehicles').update({ status: 'rented' }).eq('id', b.vehicle_id);

      const rcptNo = `RCPT-${bookingId}-${Date.now().toString().slice(-5)}`;
      await supabase.from('receipts').insert({
        booking_id: bookingId,
        receipt_number: rcptNo,
        total_amount: payNow,
      }).then(() => {}).catch(() => {});

      toast(newBalance > 0 
        ? `Reservation secured with ${selectedPct}% Deposit (${fmtMoney(payNow)})!`
        : `Payment verified via ${methodName}! Booking fully paid.`, 
        'success'
      );
      closeModal();
      await loadVehicles();
      await openPaidReceiptModal(bookingId, methodName, refNo || rcptNo);
      renderTab();
    });
  }
}

async function openPaidReceiptModal(bookingId, payMethod = 'Online Payment', refNo = '') {
  let b = null;
  try {
    const res = await supabase
      .from('bookings')
      .select('*, vehicles(*, categories(name, daily_rate))')
      .eq('id', bookingId)
      .single();
    b = res.data;
  } catch (err) {
    console.warn('Booking fetch notice:', err);
  }

  if (!b) {
    b = {
      id: bookingId,
      start_date: new Date().toISOString(),
      end_date: new Date().toISOString(),
      total_amount: 0,
      vehicles: state.vehicles[0] || {}
    };
  }

  const v = b.vehicles || {};
  const fuelType = v.fuel_type ?? 'Gasoline';
  const hasAC = v.has_ac !== undefined ? v.has_ac : true;
  const days = daysBetween(b.start_date, b.end_date);
  const refCode = refNo || `REF-${Date.now().toString().slice(-6)}`;

  const modal = openModal(`
    <div class="modal-head" style="margin-bottom:12px;padding-bottom:8px;">
      <div style="font-weight:700;font-size:0.9rem;color:#64748b;">Official Payment Receipt</div>
      <div class="modal-close" id="mClose" onclick="window.closeModal()">✕</div>
    </div>
    <div style="text-align:center;margin-bottom:18px;">
      <div style="width:58px;height:58px;border-radius:50%;background:#ecfdf5;border:2px solid #a7f3d0;display:inline-flex;align-items:center;justify-content:center;margin-bottom:10px;">
        <i class="fa-solid fa-check" style="font-size:28px;color:#059669;"></i>
      </div>
      <h2 style="font-size:1.35rem;font-weight:800;color:#0f172a;margin-bottom:4px;">Payment Successful!</h2>
      <span class="badge badge-completed" style="font-size:0.75rem;"><i class="fa-solid fa-shield-check"></i> Paid via ${payMethod}</span>
      <p class="muted" style="margin-top:8px;font-size:0.82rem;color:#64748b;">Ref / Transaction No: <strong style="color:#0f172a;font-family:monospace;">${refCode}</strong></p>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-car" style="color:#2563eb;"></i> Rental Information</h4>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;">
      <div class="receipt-row"><span style="color:#64748b;">Customer</span><span style="font-weight:700;color:#0f172a;">${state.profile?.full_name ?? 'Customer'}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Driver's License</span><span style="font-weight:700;color:#0f172a;font-family:monospace;">${state.profile?.license_number ? `✓ ${state.profile.license_number}` : 'Attached to Profile'}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Vehicle</span><span style="font-weight:700;color:#0f172a;">${v.name ?? 'Rental Vehicle'}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Category</span><span style="color:#0f172a;">${v.categories?.name ?? 'Standard'}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Plate Number</span><span style="color:#0f172a;">${maskPlate(v.plate_number)}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Pickup Date</span><span style="color:#0f172a;">${fmtDate(b.start_date)}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Return Date</span><span style="color:#0f172a;">${fmtDate(b.end_date)}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Rental Period</span><span style="color:#0f172a;">${days} day(s)</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Fuel / AC</span><span style="color:#0f172a;">${fuelType} · ${hasAC ? 'With AC' : 'Non-AC'}</span></div>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-receipt" style="color:#059669;"></i> Payment &amp; Receipt Summary</h4>
    <div class="receipt" style="margin-bottom:16px;">
      <div class="receipt-row"><span>Payment Method</span><span style="font-weight:700;color:#059669;">${payMethod}</span></div>
      <div class="receipt-row"><span>Total Rental Cost</span><span style="font-weight:700;color:#0f172a;">${fmtMoney(b.total_amount)}</span></div>
      <div class="receipt-row"><span>Amount Paid Now</span><span style="font-weight:700;color:#059669;">${fmtMoney(b.paid_amount || b.total_amount)}</span></div>
      ${b.balance_due && Number(b.balance_due) > 0 ? `
        <div class="receipt-row" style="background:#eff6ff;padding:6px 8px;border-radius:6px;margin:4px 0;">
          <span style="color:#1d4ed8;font-weight:600;">Remaining Balance Due at Pickup</span>
          <span style="font-weight:800;color:#1d4ed8;">${fmtMoney(b.balance_due)}</span>
        </div>
      ` : ''}
      <div class="divider"></div>
      <div class="receipt-row receipt-total"><span>Payment Status</span><span class="badge ${b.balance_due && Number(b.balance_due) > 0 ? 'badge-reserved' : 'badge-completed'}">${b.balance_due && Number(b.balance_due) > 0 ? 'RESERVED (PARTIAL)' : 'FULL PAYMENT'}</span></div>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-clipboard-list" style="color:#0284c7;"></i> Rental Details</h4>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px;margin-bottom:14px;">
      <div class="receipt-row"><span style="color:#0369a1;">Pickup Location</span><span style="color:#0f172a;font-weight:600;">RentFlow Main Office</span></div>
      <div class="receipt-row"><span style="color:#0369a1;">Return Location</span><span style="color:#0f172a;font-weight:600;">RentFlow Main Office</span></div>
      <div class="receipt-row"><span style="color:#0369a1;">Fuel Policy</span><span style="color:#0f172a;">Full-to-Full</span></div>
      <div class="receipt-row"><span style="color:#0369a1;">Insurance</span><span style="color:#0f172a;">Basic coverage included</span></div>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-headset" style="color:#059669;"></i> Support Contact</h4>
    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px;margin-bottom:16px;">
      <div class="receipt-row"><span style="color:#065f46;"><i class="fa-solid fa-phone" style="margin-right:5px;"></i> Hotline</span><span style="font-weight:700;color:#0f172a;">+63 (2) 8888-RENT</span></div>
      <div class="receipt-row"><span style="color:#065f46;"><i class="fa-solid fa-mobile-screen" style="margin-right:5px;"></i> Mobile</span><span style="font-weight:700;color:#0f172a;">+63 917 123 4567</span></div>
      <div class="receipt-row"><span style="color:#065f46;"><i class="fa-solid fa-envelope" style="margin-right:5px;"></i> Email</span><span style="font-weight:600;color:#0f172a;">support@rentflow.ph</span></div>
    </div>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-bottom:16px;">
      <h4 style="margin:0 0 8px 0;display:flex;align-items:center;gap:6px;color:#92400e;font-size:0.88rem;"><i class="fa-solid fa-triangle-exclamation" style="color:#d97706;"></i> Important Information</h4>
      <p style="font-size:0.82rem;color:#78350f;line-height:1.6;margin:0;">Please arrive at least <strong>15 minutes before</strong> your scheduled pickup time. Don't forget to bring your <strong>driving license</strong> and a <strong>valid ID</strong> for verification.</p>
    </div>

    <div style="display:flex;gap:10px;margin-top:16px;">
      <button type="button" class="btn btn-ghost btn-block" id="printPaidReceiptBtn" onclick="window.print()"><i class="fa-solid fa-print"></i> Print Official Receipt</button>
      <button type="button" class="btn btn-primary btn-block" id="closePaidReceiptBtn" onclick="window.closeModal()"><i class="fa-solid fa-check"></i> Done</button>
    </div>
  `);

  const mClose = modal.querySelector('#mClose');
  const closeBtn = modal.querySelector('#closePaidReceiptBtn');
  const printBtn = modal.querySelector('#printPaidReceiptBtn');

  if (mClose) mClose.addEventListener('click', closeModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }
}

async function openRefundRequestModal(bookingId) {
  const { data: b } = await supabase.from('bookings').select('*, vehicles(name, plate_number)').eq('id', bookingId).single();
  if (!b) return;

  const modal = openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.15rem;font-weight:800;color:#0f172a;">Request Refund</h3>
        <span class="muted" style="font-size:0.78rem;">Booking #${b.id} · ${b.vehicles?.name ?? 'Vehicle'}</span>
      </div>
      <div class="modal-close" id="mClose" onclick="window.closeModal()">✕</div>
    </div>

    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:16px;">
      <div style="font-size:0.82rem;color:#b45309;font-weight:700;display:flex;align-items:center;gap:6px;">
        <i class="fa-solid fa-shield-halved"></i> Refund Policy & Guarantee
      </div>
      <div style="font-size:0.78rem;color:#78350f;margin-top:4px;line-height:1.5;">
        Submit your GCash or Bank details. Approved refunds are transferred within 24 hours.
      </div>
    </div>

    <div class="receipt" style="margin-bottom:16px;">
      <div class="receipt-row receipt-total"><span>Total Paid Amount</span><span>${fmtMoney(b.total_amount)}</span></div>
    </div>

    <form id="refundReqForm">
      <div class="field" style="margin-bottom:12px;">
        <label>Refund Transfer Method</label>
        <select id="refMethod" style="font-size:0.88rem;">
          <option value="GCash">GCash</option>
          <option value="Maya">Maya</option>
          <option value="BDO">BDO Unibank</option>
          <option value="BPI">BPI</option>
          <option value="UnionBank">UnionBank</option>
          <option value="Cash">Office Cash Pick-up</option>
        </select>
      </div>

      <div class="field" style="margin-bottom:12px;">
        <label>Account Name / Recipient Name</label>
        <input type="text" id="refAccName" value="${state.profile?.full_name ?? ''}" placeholder="Juan Dela Cruz" required />
      </div>

      <div class="field" style="margin-bottom:12px;">
        <label>Account Number / Mobile Number</label>
        <input type="text" id="refAccNo" value="${state.profile?.phone ?? ''}" placeholder="0917 123 4567" required />
      </div>

      <div class="field" style="margin-bottom:18px;">
        <label>Reason for Refund</label>
        <textarea id="refReason" rows="2" placeholder="e.g. Flight cancelled, change of travel dates..." required></textarea>
      </div>

      <button type="submit" class="btn btn-primary btn-block" id="subRefBtn" style="padding:13px;">
        <i class="fa-solid fa-paper-plane"></i> Submit Refund Request
      </button>
    </form>
  `);

  $('#refundReqForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#subRefBtn');
    btn.disabled = true;
    btn.textContent = 'Submitting Request…';

    const method = $('#refMethod').value;
    const accName = $('#refAccName').value.trim();
    const accNo = $('#refAccNo').value.trim();
    const reason = $('#refReason').value.trim();
    const notes = `Refund Request: ${method} (${accNo} - ${accName}). Reason: ${reason}`;

    const { error } = await supabase.from('bookings').update({
      status: 'refund_requested',
      review_notes: notes,
    }).eq('id', bookingId);

    if (error) {
      toast(error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Submit Refund Request';
      return;
    }

    toast('Refund request submitted! Staff will review and process your transfer.', 'success');
    closeModal();
    renderTab();
  });
}

async function openRefundVoucherModal(bookingId) {
  const { data: b } = await supabase.from('bookings').select('*, vehicles(name, plate_number), profiles!bookings_customer_id_fkey(full_name, phone)').eq('id', bookingId).single();
  if (!b) return;

  const v = b.vehicles || {};
  const cName = b.profiles?.full_name ?? state.profile?.full_name ?? 'Customer';
  const refCode = `RFND-${bookingId}-${Date.now().toString().slice(-4)}`;

  openModal(`
    <div class="modal-head" style="margin-bottom:12px;padding-bottom:8px;">
      <div style="font-weight:700;font-size:0.9rem;color:#64748b;">Official Refund Voucher</div>
      <div class="modal-close" onclick="window.closeModal()">✕</div>
    </div>

    <div style="text-align:center;margin-bottom:18px;">
      <div style="width:58px;height:58px;border-radius:50%;background:#ecfdf5;border:2px solid #a7f3d0;display:inline-flex;align-items:center;justify-content:center;margin-bottom:10px;">
        <i class="fa-solid fa-hand-holding-dollar" style="font-size:26px;color:#059669;"></i>
      </div>
      <h2 style="font-size:1.35rem;font-weight:800;color:#0f172a;margin-bottom:4px;">Refund Disbursed</h2>
      <span class="badge badge-completed" style="font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> Transfer Completed</span>
      <p class="muted" style="margin-top:8px;font-size:0.82rem;color:#64748b;">Voucher No: <strong style="color:#0f172a;font-family:monospace;">${refCode}</strong></p>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-file-invoice-dollar" style="color:#2563eb;"></i> Refund Summary</h4>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;">
      <div class="receipt-row"><span style="color:#64748b;">Customer</span><span style="font-weight:700;color:#0f172a;">${cName}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Vehicle</span><span style="font-weight:700;color:#0f172a;">${v.name ?? 'Rental Vehicle'}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Rental Dates</span><span style="color:#0f172a;">${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Transfer Details</span><span style="color:#0f172a;font-size:0.8rem;">${b.review_notes ?? 'Refunded to customer'}</span></div>
      <div class="divider"></div>
      <div class="receipt-row receipt-total"><span>Total Amount Refunded</span><span style="color:#059669;">${fmtMoney(b.total_amount)}</span></div>
    </div>

    <div style="display:flex;gap:10px;margin-top:16px;" class="no-print">
      <button class="btn btn-ghost btn-block" onclick="window.print()" style="border:1px solid #cbd5e1;"><i class="fa-solid fa-print"></i> Print Voucher</button>
      <button class="btn btn-primary btn-block" onclick="window.closeModal()">Done</button>
    </div>
  `);
}

// =====================================================================
// STAFF PORTAL
// =====================================================================
async function renderStaff(tab, view) {
  if (tab === 'requests') return renderStaffRequests(view);
  if (tab === 'active') return renderStaffActive(view);
  if (tab === 'returns') return renderStaffReturns(view);
  if (tab === 'refunds') return renderStaffRefunds(view);
  if (tab === 'history') return renderStaffHistory(view);
}

async function renderStaffRefunds(view) {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, vehicles(name, plate_number), profiles!bookings_customer_id_fkey(full_name, phone)')
    .in('status', ['refund_requested', 'refunded'])
    .order('created_at', { ascending: false });

  if (error) throw error;

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2>Refunds & Claims</h2>
          <p>Review customer refund claims and disburse digital transfers.</p>
        </div>
      </div>
      <div class="row-list">
        ${bookings.length ? bookings.map(b => `
          <div class="glass item-row">
            <div class="item-main">
              <div class="item-title">${b.vehicles?.name ?? 'Vehicle'} <span class="muted">(${maskPlate(b.vehicles?.plate_number ?? '')})</span></div>
              <div class="item-sub">Customer: <strong>${b.profiles?.full_name ?? 'Customer'}</strong> ${b.profiles?.phone ? '· ' + b.profiles.phone : ''}</div>
              <div class="item-sub">${fmtDate(b.start_date)} → ${fmtDate(b.end_date)} · <strong style="color:#059669;">${fmtMoney(b.total_amount)}</strong></div>
              ${b.review_notes ? `<div class="item-sub" style="color:#b45309;margin-top:4px;font-size:0.8rem;"><i class="fa-solid fa-comment-dots"></i> ${b.review_notes}</div>` : ''}
            </div>
            <span class="badge badge-${b.status}">${b.status.replace('_', ' ')}</span>
            <div class="item-actions">
              ${b.status === 'refund_requested' ? `
                <button class="btn btn-primary btn-sm" data-disburse-id="${b.id}"><i class="fa-solid fa-hand-holding-dollar"></i> Disburse Refund</button>
              ` : `
                <button class="btn btn-ghost btn-sm" data-refund-voucher-id="${b.id}"><i class="fa-solid fa-receipt"></i> Voucher</button>
              `}
            </div>
          </div>
        `).join('') : emptyState('💵', 'No active refund requests.')}
      </div>
    </div>
  `;

  $$('[data-disburse-id]').forEach(btn => btn.addEventListener('click', async () => {
    const id = Number(btn.dataset.disburseId);
    if (!confirm('Confirm disbursement of this refund to the customer?')) return;
    
    btn.disabled = true;
    btn.textContent = 'Processing…';

    const { error } = await supabase.from('bookings').update({
      status: 'refunded',
      reviewed_by: state.user.id,
    }).eq('id', id);

    if (error) { toast(error.message, 'error'); return; }

    toast('Refund disbursed successfully!', 'success');
    await openRefundVoucherModal(id);
    renderTab();
  }));

  $$('[data-refund-voucher-id]').forEach(btn => btn.addEventListener('click', () => openRefundVoucherModal(Number(btn.dataset.refundVoucherId))));
}

async function renderStaffRequests(view) {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, vehicles(name, plate_number, status), profiles!bookings_customer_id_fkey(full_name, phone)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;

  view.innerHTML = `
    <div class="view">
      <div class="section-head"><div><h2>Booking Requests</h2><p>Review requirements and approve or reject incoming requests.</p></div></div>
      <div class="row-list">
        ${bookings.length ? bookings.map(b => `
          <div class="glass item-row">
            <div class="item-main">
              <div class="item-title">${b.vehicles.name} <span class="muted">(${b.vehicles.plate_number})</span></div>
              <div class="item-sub">Requested by ${b.profiles?.full_name ?? 'Customer'} ${b.profiles?.phone ? '· ' + b.profiles.phone : ''}</div>
              <div class="item-sub">${fmtDate(b.start_date)} → ${fmtDate(b.end_date)} · ${fmtMoney(b.total_amount)}</div>
              ${b.vehicles.status !== 'available' ? `<div class="item-sub" style="color:var(--coral);">⚠ Vehicle currently ${b.vehicles.status}</div>` : ''}
            </div>
            <span class="badge badge-pending">pending</span>
            <div class="item-actions">
              <button class="btn btn-primary btn-sm" data-approve="${b.id}">Approve</button>
              <button class="btn btn-danger btn-sm" data-reject="${b.id}">Reject</button>
            </div>
          </div>
        `).join('') : emptyState('📭', 'No pending requests right now.')}
      </div>
    </div>
  `;

  $$('[data-approve]').forEach(btn => btn.addEventListener('click', async () => {
    const id = Number(btn.dataset.approve);
    btn.disabled = true;
    const { error } = await supabase.from('bookings').update({
      status: 'approved', reviewed_by: state.user.id, review_notes: null,
    }).eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Booking approved. Customer notified to pay.', 'success');
    renderTab();
  }));

  $$('[data-reject]').forEach(btn => btn.addEventListener('click', async () => {
    const id = Number(btn.dataset.reject);
    const reason = prompt('Reason for rejecting this request (shown to the customer):', 'Vehicle unavailable for the requested dates.');
    if (reason === null) return;
    const { error } = await supabase.from('bookings').update({
      status: 'rejected', reviewed_by: state.user.id, review_notes: reason,
    }).eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Request rejected. Customer notified.', 'info');
    renderTab();
  }));
}

async function renderStaffActive(view) {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, vehicles(name, plate_number), profiles!bookings_customer_id_fkey(full_name)')
    .in('status', ['approved', 'active'])
    .order('created_at', { ascending: false });
  if (error) throw error;

  view.innerHTML = `
    <div class="view">
      <div class="section-head"><div><h2>Active Rentals &amp; Reservations</h2><p>Approved bookings, partial reservations, and vehicles currently out.</p></div></div>
      <div class="row-list">
        ${bookings.length ? bookings.map(b => {
          const isPartial = b.balance_due && Number(b.balance_due) > 0 && Number(b.paid_amount || 0) > 0;
          const badgeHTML = isPartial
            ? `<span class="badge badge-reserved"><i class="fa-solid fa-bookmark"></i> Reserved (${fmtMoney(b.paid_amount)} Paid)</span>`
            : `<span class="badge badge-${b.status}">${b.status}</span>`;

          let actionBtn = '';
          if (b.status === 'approved') {
            actionBtn = `<button class="btn btn-amber btn-sm" data-record-payment="${b.id}">Record Payment (${fmtMoney(b.total_amount)})</button>`;
          } else if (isPartial) {
            actionBtn = `<button class="btn btn-amber btn-sm" data-record-payment="${b.id}"><i class="fa-solid fa-hand-holding-dollar"></i> Collect Balance (${fmtMoney(b.balance_due)})</button>`;
          } else {
            actionBtn = `<span class="muted"><i class="fa-solid fa-circle-check" style="color:#059669;"></i> Fully Paid &amp; Active</span>`;
          }

          return `
            <div class="glass item-row">
              <div class="item-main">
                <div class="item-title">${b.vehicles.name} <span class="muted">(${b.vehicles.plate_number})</span></div>
                <div class="item-sub">
                  ${b.profiles?.full_name ?? 'Customer'} · ${fmtDate(b.start_date)} → ${fmtDate(b.end_date)} · Total: ${fmtMoney(b.total_amount)}
                  ${isPartial ? ` · <span style="color:#2563eb;font-weight:700;">Balance Due at Pickup: ${fmtMoney(b.balance_due)}</span>` : ''}
                </div>
              </div>
              ${badgeHTML}
              <div class="item-actions">${actionBtn}</div>
            </div>
          `;
        }).join('') : emptyState('🔑', 'No approved or active rentals.')}
      </div>
    </div>
  `;

  $$('[data-record-payment]').forEach(btn => btn.addEventListener('click', () => openStaffPaymentModal(Number(btn.dataset.recordPayment))));
}

async function openStaffPaymentModal(bookingId) {
  const { data: b } = await supabase.from('bookings').select('*, vehicles(name)').eq('id', bookingId).single();
  const isPartial = b.balance_due && Number(b.balance_due) > 0;
  const amountDue = isPartial ? Number(b.balance_due) : Number(b.total_amount);

  openModal(`
    <div class="modal-head"><h3>${isPartial ? 'Collect Remaining Balance' : 'Record Payment'}</h3><div class="modal-close" id="mClose">✕</div></div>
    <p class="muted" style="margin-bottom:14px;">
      ${b.vehicles.name} · ${isPartial ? `Remaining balance due: <strong style="color:#2563eb;">${fmtMoney(amountDue)}</strong>` : `Total amount due: <strong>${fmtMoney(amountDue)}</strong>`}
    </p>
    <div class="field"><label>Method</label>
      <select id="payMethod"><option value="cash">Cash</option><option value="card">Card Terminal / POS</option><option value="bank_transfer">Bank Transfer / QR</option></select>
    </div>
    <div style="display:flex;gap:10px;margin-top:8px;">
      <button class="btn btn-primary btn-block" id="markSuccess">${isPartial ? `Mark Balance Paid (${fmtMoney(amountDue)})` : 'Mark Successful'}</button>
      <button class="btn btn-danger btn-block" id="markFailed">Cancel / Failed</button>
    </div>
  `);
  $('#mClose').addEventListener('click', closeModal);

  $('#markSuccess').addEventListener('click', async () => {
    const methodVal = $('#payMethod').value;
    const methodName = methodVal === 'cash' ? 'Cash at Counter' : methodVal === 'card' ? 'Card Terminal' : 'Bank Transfer';

    await supabase.from('payments').insert({
      booking_id: bookingId, amount: amountDue, method: methodName, status: 'successful', paid_at: new Date().toISOString(),
    });

    let updatePayload = {
      status: 'active',
      paid_amount: Number(b.total_amount || 0),
      balance_due: 0,
      payment_type: 'full'
    };

    let { error: updateErr } = await supabase.from('bookings').update(updatePayload).eq('id', bookingId);
    if (updateErr) {
      delete updatePayload.paid_amount;
      delete updatePayload.balance_due;
      delete updatePayload.payment_type;
      await supabase.from('bookings').update(updatePayload).eq('id', bookingId);
    }

    await supabase.from('vehicles').update({ status: 'rented' }).eq('id', b.vehicle_id);
    toast(isPartial ? `Balance of ${fmtMoney(amountDue)} collected! Booking fully paid.` : 'Payment recorded — vehicle confirmed & released.', 'success');
    closeModal();
    await loadVehicles();
    renderTab();
  });

  $('#markFailed').addEventListener('click', async () => {
    await supabase.from('payments').insert({
      booking_id: bookingId, amount: amountDue, method: $('#payMethod').value, status: 'failed',
    });
    toast('Payment marked failed.', 'error');
    closeModal();
    renderTab();
  });
}

async function renderStaffReturns(view) {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, vehicles(name, plate_number), profiles!bookings_customer_id_fkey(full_name)')
    .eq('status', 'active')
    .order('start_date');
  if (error) throw error;

  view.innerHTML = `
    <div class="view">
      <div class="section-head"><div><h2>Return Process</h2><p>Inspect returned vehicles, record damage, and finalize the rental.</p></div></div>
      <div class="row-list">
        ${bookings.length ? bookings.map(b => `
          <div class="glass item-row">
            <div class="item-main">
              <div class="item-title">${b.vehicles.name} <span class="muted">(${b.vehicles.plate_number})</span></div>
              <div class="item-sub">${b.profiles?.full_name ?? 'Customer'} · Due back ${fmtDate(b.end_date)}</div>
            </div>
            <div class="item-actions"><button class="btn btn-primary btn-sm" data-return="${b.id}">Process Return</button></div>
          </div>
        `).join('') : emptyState('🚗', 'No vehicles currently out for rental.')}
      </div>
    </div>
  `;
  $$('[data-return]').forEach(btn => btn.addEventListener('click', () => openReturnModal(Number(btn.dataset.return))));
}

async function openReturnModal(bookingId) {
  const { data: b } = await supabase.from('bookings').select('*, vehicles(name)').eq('id', bookingId).single();
  openModal(`
    <div class="modal-head"><h3>Inspect Vehicle Condition</h3><div class="modal-close" id="mClose">✕</div></div>
    <p class="muted" style="margin-bottom:14px;">${b.vehicles.name}</p>
    <div class="field"><label>Condition notes</label><textarea id="condNotes" rows="3" placeholder="General condition, mileage, fuel level…"></textarea></div>
    <div class="field">
      <label>Any damage or issue?</label>
      <div class="role-picker" id="damagePicker">
        <div class="role-opt selected" data-damage="no">No</div>
        <div class="role-opt" data-damage="yes">Yes</div>
      </div>
    </div>
    <div class="field hidden" id="chargeField"><label>Additional charges</label><input type="number" id="chargeAmt" min="0" step="0.01" placeholder="0.00" /></div>
    <div class="field hidden" id="maintDaysField"><label>Maintenance Duration (Days)</label><input type="number" id="maintDays" min="1" max="90" value="3" placeholder="e.g. 3 days" /></div>
    <button class="btn btn-primary btn-block" id="finalizeBtn">Finalize Return &amp; Generate Receipt</button>
  `);
  $('#mClose').addEventListener('click', closeModal);
  $$('#damagePicker .role-opt').forEach(opt => opt.addEventListener('click', () => {
    $$('#damagePicker .role-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    const isDamaged = opt.dataset.damage === 'yes';
    $('#chargeField').classList.toggle('hidden', !isDamaged);
    $('#maintDaysField').classList.toggle('hidden', !isDamaged);
  }));

  $('#finalizeBtn').addEventListener('click', async () => {
    const hasDamage = $('#damagePicker .selected').dataset.damage === 'yes';
    const charges = hasDamage ? Number($('#chargeAmt').value || 0) : 0;
    const maintDays = hasDamage ? Math.max(1, Number($('#maintDays').value || 3)) : 0;
    const maintUntil = hasDamage ? new Date(Date.now() + maintDays * 86400000).toISOString() : null;

    const btn = $('#finalizeBtn');
    btn.disabled = true; btn.textContent = 'Processing…';

    await supabase.from('rental_returns').insert({
      booking_id: bookingId,
      condition_notes: $('#condNotes').value,
      has_damage: hasDamage,
      additional_charges: charges,
      inspected_by: state.user.id,
    });

    if (charges > 0) {
      await supabase.from('payments').insert({
        booking_id: bookingId, amount: charges, method: 'card', status: 'successful',
        paid_at: new Date().toISOString(),
      });
    }

    await supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingId);
    
    const nextVehicleStatus = hasDamage ? 'maintenance' : 'available';
    const vehicleUpdatePayload = {
      status: nextVehicleStatus,
      maintenance_days: hasDamage ? maintDays : null,
      maintenance_until: maintUntil,
    };

    const { error: vErr } = await supabase.from('vehicles').update(vehicleUpdatePayload).eq('id', b.vehicle_id);
    if (vErr) {
      // Graceful fallback if database schema columns aren't created yet
      await supabase.from('vehicles').update({ status: nextVehicleStatus }).eq('id', b.vehicle_id);
    }

    const receiptNumber = `RCPT-${bookingId}-${Date.now().toString().slice(-5)}`;
    await supabase.from('receipts').insert({
      booking_id: bookingId,
      receipt_number: receiptNumber,
      total_amount: Number(b.total_amount) + charges,
    });

    toast(`Return finalized. Vehicle set to ${nextVehicleStatus.toUpperCase()}${hasDamage ? ` (${maintDays} days maintenance)` : '.'}`, hasDamage ? 'info' : 'success');
    closeModal();
    await loadVehicles();
    renderTab();
  });
}

async function renderStaffHistory(view) {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, vehicles(name, plate_number), profiles!bookings_customer_id_fkey(full_name)')
    .in('status', ['completed', 'rejected', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  view.innerHTML = `
    <div class="view">
      <div class="section-head"><div><h2>History</h2><p>Completed and closed bookings.</p></div></div>
      <div class="glass" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Vehicle</th><th>Customer</th><th>Dates</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            ${bookings.map(b => `
              <tr>
                <td>${b.vehicles.name} <span class="muted">(${b.vehicles.plate_number})</span></td>
                <td>${b.profiles?.full_name ?? '—'}</td>
                <td>${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</td>
                <td>${fmtMoney(b.total_amount)}</td>
                <td><span class="badge badge-${b.status}">${b.status}</span></td>
              </tr>
            `).join('') || `<tr><td colspan="5" class="center muted">No history yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// =====================================================================
// ADMIN PORTAL
// =====================================================================
async function renderAdmin(tab, view) {
  if (tab === 'dashboard') return renderAdminDashboard(view);
  if (tab === 'customers') return renderAdminCustomers(view);
  if (tab === 'vehicles') return renderAdminVehicles(view);
  if (tab === 'categories') return renderAdminCategories(view);
  if (tab === 'users') return renderAdminUsers(view);
  if (tab === 'rentals') return renderAdminRentals(view);
  if (tab === 'reports') return renderAdminReports(view);
  if (tab === 'settings') return renderAdminSettings(view);
}

async function renderAdminDashboard(view) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: allBookings }, { data: monthPayments }] = await Promise.all([
    supabase.from('bookings').select('*, vehicles(name, plate_number, image_url, categories(name)), profiles!bookings_customer_id_fkey(full_name, phone)').order('created_at', { ascending: false }),
    supabase.from('payments').select('amount, created_at').eq('status', 'successful').gte('created_at', startOfMonth),
  ]);

  const bookingsList = allBookings || [];

  // Stat metrics
  const totalVehiclesCount = state.vehicles.length;
  const activeRentalsCount = state.vehicles.filter(v => v.status === 'rented').length || bookingsList.filter(b => b.status === 'active').length;
  const availableRentalsCount = state.vehicles.filter(v => v.status === 'available').length;
  const revenueThisMonth = (monthPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0) ||
    bookingsList.filter(b => b.created_at >= startOfMonth && ['active', 'completed', 'approved'].includes(b.status)).reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

  // Top Earner Vehicles
  const vehicleStatsMap = {};
  state.vehicles.forEach(v => {
    vehicleStatsMap[v.id] = { vehicle: v, totalEarnings: 0, rentalCount: 0 };
  });

  bookingsList.forEach(b => {
    if (b.vehicle_id && vehicleStatsMap[b.vehicle_id] && ['active', 'completed', 'approved'].includes(b.status)) {
      vehicleStatsMap[b.vehicle_id].totalEarnings += Number(b.total_amount || 0);
      vehicleStatsMap[b.vehicle_id].rentalCount += 1;
    }
  });

  const topEarners = Object.values(vehicleStatsMap)
    .sort((a, b) => b.totalEarnings - a.totalEarnings)
    .slice(0, 4);

  // Recent Customer Activity
  const recentActivities = bookingsList.slice(0, 6);

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2>Dashboard</h2>
          <p>Fleet metrics, monthly revenue, top performing vehicles, and customer activity.</p>
        </div>
      </div>

      <!-- Top Metrics Row -->
      <div class="grid grid-stats" style="margin-bottom:24px;">
        <div class="glass stat-card">
          <div class="stat-label">Total Vehicle Fleet</div>
          <div class="stat-value">${totalVehiclesCount}</div>
          <div class="stat-sub">Registered vehicles</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Active Rentals</div>
          <div class="stat-value" style="color:#059669;">${activeRentalsCount}</div>
          <div class="stat-sub">Currently on road</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Available Rentals</div>
          <div class="stat-value" style="color:#2563eb;">${availableRentalsCount}</div>
          <div class="stat-sub">Ready for booking</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Revenue This Month</div>
          <div class="stat-value" style="color:#059669;">${fmtMoney(revenueThisMonth)}</div>
          <div class="stat-sub">${now.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
        </div>
      </div>

      <!-- Content Grid: Top Earning Vehicles & Recent Activity -->
      <div class="grid grid-2" style="gap:20px;">
        <!-- Top Earning Vehicles -->
        <div class="glass card" style="padding:20px;">
          <h3 style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:14px;">Top Earning Vehicles</h3>
          <div style="overflow-x:auto;">
            <table style="width:100%;font-size:0.85rem;border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:1px solid #e2e8f0;text-align:left;">
                  <th style="padding:8px 0;color:#64748b;font-weight:600;">Vehicle</th>
                  <th style="padding:8px 0;color:#64748b;font-weight:600;">Category</th>
                  <th style="padding:8px 0;color:#64748b;font-weight:600;text-align:center;">Rentals</th>
                  <th style="padding:8px 0;color:#64748b;font-weight:600;text-align:right;">Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${topEarners.map(({ vehicle: v, totalEarnings, rentalCount }) => `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px 0;font-weight:700;color:#0f172a;">${v.name}</td>
                    <td style="padding:10px 0;color:#64748b;">${v.categories?.name ?? 'Standard'}</td>
                    <td style="padding:10px 0;text-align:center;font-weight:600;">${rentalCount}</td>
                    <td style="padding:10px 0;text-align:right;font-weight:700;color:#059669;">${fmtMoney(totalEarnings)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Recent Customer Activity -->
        <div class="glass card" style="padding:20px;">
          <h3 style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:14px;">Recent Customer Activity</h3>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${recentActivities.length ? recentActivities.map(b => {
              const cName = b.profiles?.full_name ?? 'Customer';
              const vName = b.vehicles?.name ?? 'Vehicle';
              let actionText = `Requested ${vName}`;
              if (b.status === 'active') actionText = `Renting ${vName}`;
              else if (b.status === 'completed') actionText = `Returned ${vName}`;
              else if (b.status === 'approved') actionText = `Approved for ${vName}`;
              else if (b.status === 'cancelled') actionText = `Cancelled ${vName}`;

              return `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:0.85rem;">
                  <div>
                    <div style="font-weight:700;color:#0f172a;">${cName}</div>
                    <div style="color:#64748b;font-size:0.8rem;">${actionText} · <span style="color:#94a3b8;">${fmtDate(b.created_at)}</span></div>
                  </div>
                  <span class="badge badge-${b.status}" style="font-size:0.7rem;">${b.status}</span>
                </div>
              `;
            }).join('') : emptyState('⏱️', 'No recent activity.')}
          </div>
        </div>
      </div>
    </div>
  `;
}

async function renderAdminVehicles(view) {
  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div><h2>Manage Fleet &amp; Maintenance</h2><p>Add, edit, or track vehicle service history and fleet availability.</p></div>
        <button class="btn btn-primary" id="addVehicleBtn">+ Add Vehicle</button>
      </div>
      <div class="grid grid-vehicles" id="adminVehicleGrid">
        ${state.vehicles.map(v => {
          const statusBadge = v.status === 'available'
            ? `<span class="badge badge-available"><i class="fa-solid fa-circle-check"></i> Available</span>`
            : v.status === 'in_service' || v.status === 'maintenance'
            ? `<span class="badge badge-in_service"><i class="fa-solid fa-wrench"></i> In Service</span>`
            : v.status === 'scheduled_maint'
            ? `<span class="badge badge-scheduled_maint"><i class="fa-solid fa-calendar-day"></i> Scheduled Maint</span>`
            : v.status === 'off_the_road'
            ? `<span class="badge badge-off_the_road"><i class="fa-solid fa-ban"></i> Off the Road</span>`
            : `<span class="badge badge-${v.status}">${v.status}</span>`;

          return `
            <div class="glass vehicle-card" style="cursor:default;">
              <img class="vehicle-img" src="${getExactVehicleImage(v)}" />
              <div class="vehicle-body">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div class="vehicle-name">${v.name}</div>
                  ${statusBadge}
                </div>
                <div class="vehicle-meta"><span>${getVehicleCategoryName(v)}</span><span>·</span><span>${maskPlate(v.plate_number)}</span></div>
                <div class="item-actions" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;">
                  <button class="btn btn-ghost btn-sm" data-edit="${v.id}"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                  <button class="btn btn-primary btn-sm" data-service-history="${v.id}" style="background:#0284c7;border-color:#0284c7;color:#fff;"><i class="fa-solid fa-screwdriver-wrench"></i> Service History</button>
                  <button class="btn btn-warning btn-sm" data-log-service="${v.id}" style="background:#f59e0b;border-color:#f59e0b;color:#fff;"><i class="fa-solid fa-plus"></i> Work Order</button>
                  <button class="btn btn-danger btn-sm" data-del="${v.id}"><i class="fa-solid fa-trash"></i> Delete</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  $('#addVehicleBtn').addEventListener('click', () => openVehicleForm());
  $$('[data-edit]').forEach(b => b.addEventListener('click', () => openVehicleForm(Number(b.dataset.edit))));
  $$('[data-service-history]').forEach(b => b.addEventListener('click', () => openServiceHistoryModal(Number(b.dataset.serviceHistory))));
  $$('[data-log-service]').forEach(b => b.addEventListener('click', () => openLogServiceModal(Number(b.dataset.logService))));
  $$('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this vehicle? This cannot be undone.')) return;
    const { error } = await supabase.from('vehicles').delete().eq('id', Number(b.dataset.del));
    if (error) { toast(error.message, 'error'); return; }
    toast('Vehicle deleted.', 'success');
    await loadVehicles();
    renderTab();
  }));
}

function openVehicleForm(id) {
  const v = id ? state.vehicles.find(v => v.id === id) : null;
  const hasAC = v?.has_ac !== undefined ? v.has_ac : true;
  openModal(`
    <div class="modal-head"><h3>${v ? 'Edit' : 'Add'} Vehicle</h3><div class="modal-close" id="mClose">✕</div></div>
    <div class="field"><label>Name</label><input id="fName" value="${v?.name ?? ''}" placeholder="Toyota Corolla" /></div>
    <div class="detail-grid">
      <div class="field"><label>Plate number</label><input id="fPlate" value="${v?.plate_number ?? ''}" placeholder="ABC-1234" /></div>
      <div class="field"><label>Category</label>
        <select id="fCat">${state.categories.map(c => `<option value="${c.id}" ${v?.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Seats</label><input id="fSeats" type="number" value="${v?.seats ?? 5}" /></div>
      <div class="field"><label>Transmission</label>
        <select id="fTrans"><option ${v?.transmission==='Automatic'?'selected':''}>Automatic</option><option ${v?.transmission==='Manual'?'selected':''}>Manual</option></select>
      </div>
      <div class="field"><label>Fuel Type</label>
        <select id="fFuel"><option ${v?.fuel_type==='Gasoline'?'selected':''}>Gasoline</option><option ${v?.fuel_type==='Diesel'?'selected':''}>Diesel</option><option ${v?.fuel_type==='Hybrid'?'selected':''}>Hybrid</option><option ${v?.fuel_type==='Electric'?'selected':''}>Electric</option><option ${v?.fuel_type==='LPG'?'selected':''}>LPG</option></select>
      </div>
      <div class="field"><label>Air Conditioning</label>
        <select id="fAC"><option value="true" ${hasAC ? 'selected' : ''}>With AC</option><option value="false" ${!hasAC ? 'selected' : ''}>Non-AC</option></select>
      </div>
      <div class="field"><label>Status</label>
        <select id="fStatus">
          <option value="available" ${v?.status==='available'?'selected':''}>🟢 Available</option>
          <option value="rented" ${v?.status==='rented'?'selected':''}>🔑 Rented</option>
          <option value="in_service" ${v?.status==='in_service' || v?.status==='maintenance' ?'selected':''}>🔧 In Service (Repairs)</option>
          <option value="scheduled_maint" ${v?.status==='scheduled_maint'?'selected':''}>🗓️ Scheduled Maintenance</option>
          <option value="off_the_road" ${v?.status==='off_the_road'?'selected':''}>🚫 Off the Road / Decommissioned</option>
        </select>
      </div>
      <div class="field" id="fMaintDaysBox" style="${(v?.status === 'in_service' || v?.status === 'maintenance' || v?.status === 'scheduled_maint') ? '' : 'display:none;'}">
        <label>Maintenance Duration (Days)</label>
        <input id="fMaintDays" type="number" min="1" max="90" value="${v?.maintenance_days ?? 3}" />
      </div>
    </div>
    <div class="field">
      <label style="font-weight:700;color:#0f172a;"><i class="fa-solid fa-image" style="color:#2563eb;margin-right:4px;"></i> Vehicle Photo</label>
      <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;margin-top:4px;">
        <div id="vImgPreviewBox" style="margin-bottom:10px;">
          ${(v?.image_url || getExactVehicleImage(v || {})) ? `
            <img src="${v?.image_url || getExactVehicleImage(v || {})}" id="vImgPreview" style="max-width:100%;max-height:160px;border-radius:10px;border:1px solid #cbd5e1;object-fit:cover;" />
          ` : `
            <div style="padding:12px 6px;">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size:2rem;color:#94a3b8;margin-bottom:6px;"></i>
              <div style="font-size:0.85rem;font-weight:700;color:#334155;">Upload Vehicle Photo</div>
              <div style="font-size:0.75rem;color:#64748b;">Select image file from your computer (JPG, PNG, WEBP)</div>
            </div>
          `}
        </div>
        <input type="file" id="vFileInput" accept="image/*" style="display:none;" />
        <input type="hidden" id="fImg" value="${v?.image_url ?? ''}" />
        <button type="button" class="btn btn-ghost btn-sm" id="uploadVImgBtn" style="border:1px solid #cbd5e1;background:#ffffff;">
          <i class="fa-solid fa-file-image" style="margin-right:5px;color:#2563eb;"></i> Choose Image File
        </button>
      </div>
    </div>
    <div class="field"><label>Description</label><textarea id="fDesc" rows="2">${v?.description ?? ''}</textarea></div>
    <button class="btn btn-primary btn-block" id="saveVehicle">${v ? 'Save Changes' : 'Add Vehicle'}</button>
  `);
  $('#mClose').addEventListener('click', closeModal);

  $('#uploadVImgBtn').addEventListener('click', () => $('#vFileInput').click());
  $('#vFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast('Image file is too large (max 8MB).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target.result;
      $('#fImg').value = dataUrl;
      $('#vImgPreviewBox').innerHTML = `<img src="${dataUrl}" id="vImgPreview" style="max-width:100%;max-height:160px;border-radius:10px;border:2px solid #2563eb;object-fit:cover;" />`;
      toast('Photo selected! Click Save to apply.', 'info');
    };
    reader.readAsDataURL(file);
  });

  $('#fStatus').addEventListener('change', (e) => {
    $('#fMaintDaysBox').style.display = e.target.value === 'maintenance' ? 'block' : 'none';
  });

  $('#saveVehicle').addEventListener('click', async () => {
    const selectedStatus = $('#fStatus').value;
    const maintDays = selectedStatus === 'maintenance' ? Math.max(1, Number($('#fMaintDays').value || 3)) : null;
    const maintUntil = selectedStatus === 'maintenance' ? new Date(Date.now() + maintDays * 86400000).toISOString() : null;

    const payload = {
      name: $('#fName').value.trim(),
      plate_number: $('#fPlate').value.trim(),
      category_id: Number($('#fCat').value),
      seats: Number($('#fSeats').value),
      transmission: $('#fTrans').value,
      fuel_type: $('#fFuel').value,
      has_ac: $('#fAC').value === 'true',
      status: selectedStatus,
      maintenance_days: maintDays,
      maintenance_until: maintUntil,
      image_url: $('#fImg').value.trim(),
      description: $('#fDesc').value.trim(),
    };
    if (!payload.name || !payload.plate_number) { toast('Name and plate number are required.', 'error'); return; }
    
    let { error } = v
      ? await supabase.from('vehicles').update(payload).eq('id', v.id)
      : await supabase.from('vehicles').insert(payload);
    
    if (error && (error.message.includes('vehicles_category_id_fkey') || error.message.includes('foreign key constraint'))) {
      // Fallback if category_id does not exist in remote Supabase categories table
      delete payload.category_id;
      const res = v
        ? await supabase.from('vehicles').update(payload).eq('id', v.id)
        : await supabase.from('vehicles').insert(payload);
      error = res.error;
    }

    if (error && error.message.includes('maintenance')) {
      // Fallback if DB column not added yet
      delete payload.maintenance_days;
      delete payload.maintenance_until;
      const res = v
        ? await supabase.from('vehicles').update(payload).eq('id', v.id)
        : await supabase.from('vehicles').insert(payload);
      error = res.error;
    }

    if (error) { toast(error.message, 'error'); return; }
    toast(`Vehicle ${v ? 'updated' : 'added'}.`, 'success');
    closeModal();
    await loadVehicles();
    renderTab();
  });
}

async function renderAdminCategories(view) {
  if (!state.categories || state.categories.length === 0) {
    await loadCategories();
  }
  const displayCats = (state.categories && state.categories.length) ? state.categories : PH_CATEGORIES.map((c, i) => ({ id: i + 1, ...c }));

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div><h2>Categories &amp; Rates</h2><p>Manage vehicle categories and daily rental rates.</p></div>
        <button class="btn btn-primary" id="addCatBtn">+ Add Category</button>
      </div>
      <div class="row-list">
        ${displayCats.map(c => `
          <div class="glass item-row">
            <div class="item-main">
              <div class="item-title">${c.name}</div>
              <div class="item-sub">${c.description ?? ''}</div>
            </div>
            <div class="rate">${fmtMoney(c.daily_rate)} <span>/ day</span></div>
            <div class="item-actions">
              <button class="btn btn-ghost btn-sm" data-editcat="${c.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-delcat="${c.id}">Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  $('#addCatBtn').addEventListener('click', () => openCategoryForm());
  $$('[data-editcat]').forEach(b => b.addEventListener('click', () => openCategoryForm(Number(b.dataset.editcat))));
  $$('[data-delcat]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this category?')) return;
    const { error } = await supabase.from('categories').delete().eq('id', Number(b.dataset.delcat));
    if (error) { toast(error.message, 'error'); return; }
    toast('Category deleted.', 'success');
    await loadCategories();
    renderTab();
  }));
}

function openCategoryForm(id) {
  const c = id ? state.categories.find(c => c.id === id) : null;
  openModal(`
    <div class="modal-head"><h3>${c ? 'Edit' : 'Add'} Category</h3><div class="modal-close" id="mClose">✕</div></div>
    <div class="field"><label>Name</label><input id="cName" value="${c?.name ?? ''}" placeholder="Economy" /></div>
    <div class="field"><label>Daily rate</label><input id="cRate" type="number" step="0.01" value="${c?.daily_rate ?? ''}" placeholder="35.00" /></div>
    <div class="field"><label>Description</label><textarea id="cDesc" rows="2">${c?.description ?? ''}</textarea></div>
    <button class="btn btn-primary btn-block" id="saveCat">${c ? 'Save Changes' : 'Add Category'}</button>
  `);
  $('#mClose').addEventListener('click', closeModal);
  $('#saveCat').addEventListener('click', async () => {
    const payload = { name: $('#cName').value.trim(), daily_rate: Number($('#cRate').value), description: $('#cDesc').value.trim() };
    if (!payload.name || !(payload.daily_rate >= 0)) { toast('Valid name and rate required.', 'error'); return; }
    const { error } = c
      ? await supabase.from('categories').update(payload).eq('id', c.id)
      : await supabase.from('categories').insert(payload);
    if (error) { toast(error.message, 'error'); return; }
    toast(`Category ${c ? 'updated' : 'added'}.`, 'success');
    closeModal();
    await loadCategories();
    renderTab();
  });
}

let customerStatusFilter = 'all'; // 'all' | 'active_renter' | 'pending' | 'idle'
let customerSearchQuery = '';

async function renderAdminCustomers(view) {
  const [{ data: customers, error: profErr }, { data: bookings, error: bookErr }] = await Promise.all([
    supabase.from('profiles').select('*').eq('role', 'customer').order('created_at', { ascending: false }),
    supabase.from('bookings').select('*, vehicles(name, plate_number)').order('created_at', { ascending: false }),
  ]);

  if (profErr) throw profErr;

  const customerList = (customers || []).map(c => {
    const cBookings = (bookings || []).filter(b => b.customer_id === c.id);
    const activeRental = cBookings.find(b => b.status === 'active');
    const pendingBooking = cBookings.find(b => b.status === 'pending');
    const approvedBooking = cBookings.find(b => b.status === 'approved');
    const totalSpent = cBookings
      .filter(b => ['active', 'completed', 'approved'].includes(b.status))
      .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

    let liveStatus = 'idle';
    if (activeRental) liveStatus = 'active_renter';
    else if (approvedBooking) liveStatus = 'approved';
    else if (pendingBooking) liveStatus = 'pending';

    return {
      ...c,
      bookings: cBookings,
      totalBookings: cBookings.length,
      totalSpent,
      activeRental,
      pendingBooking,
      approvedBooking,
      liveStatus,
    };
  });

  const activeRentersCount = customerList.filter(c => c.liveStatus === 'active_renter').length;
  const pendingCount = customerList.filter(c => c.liveStatus === 'pending').length;
  const verifiedLicenseCount = customerList.filter(c => c.license_number).length;

  const filteredCustomers = customerList.filter(c => {
    const matchesFilter = customerStatusFilter === 'all' || c.liveStatus === customerStatusFilter;
    const searchLower = customerSearchQuery.toLowerCase();
    const matchesSearch =
      (c.full_name || '').toLowerCase().includes(searchLower) ||
      (c.phone || '').toLowerCase().includes(searchLower) ||
      (c.license_number || '').toLowerCase().includes(searchLower) ||
      (c.address || '').toLowerCase().includes(searchLower);
    return matchesFilter && matchesSearch;
  });

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2>Customers</h2>
          <p>List of registered customers and their current rental status.</p>
        </div>
      </div>

      <div class="grid grid-stats" style="margin-bottom:22px;">
        <div class="glass stat-card">
          <div class="stat-label">Total Customers</div>
          <div class="stat-value">${customerList.length}</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Active Renters</div>
          <div class="stat-value" style="color:#059669;">${activeRentersCount}</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Pending Requests</div>
          <div class="stat-value" style="color:#d97706;">${pendingCount}</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Verified Licenses</div>
          <div class="stat-value" style="color:#2563eb;">${verifiedLicenseCount}</div>
        </div>
      </div>

      <div class="search-bar" style="margin-bottom:14px;">
        <div style="position:relative;flex:1;">
          <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8;"></i>
          <input type="text" id="custSearchInput" style="padding-left:40px;" placeholder="Search by name, phone, or license number..." value="${customerSearchQuery}" />
        </div>
      </div>

      <div class="pill-row" id="custFilterPills" style="margin-bottom:18px;">
        <div class="pill ${customerStatusFilter === 'all' ? 'active' : ''}" data-cfilter="all">All (${customerList.length})</div>
        <div class="pill ${customerStatusFilter === 'active_renter' ? 'active' : ''}" data-cfilter="active_renter">Active Renters (${activeRentersCount})</div>
        <div class="pill ${customerStatusFilter === 'pending' ? 'active' : ''}" data-cfilter="pending">Pending (${pendingCount})</div>
        <div class="pill ${customerStatusFilter === 'idle' ? 'active' : ''}" data-cfilter="idle">Idle</div>
      </div>

      <div class="row-list">
        ${filteredCustomers.length ? filteredCustomers.map(c => {
          let badgeHTML = '<span class="badge badge-available">Idle</span>';
          if (c.liveStatus === 'active_renter') badgeHTML = '<span class="badge badge-completed"><i class="fa-solid fa-car-side"></i> Active Renter</span>';
          else if (c.liveStatus === 'approved') badgeHTML = '<span class="badge badge-approved">Approved</span>';
          else if (c.liveStatus === 'pending') badgeHTML = '<span class="badge badge-pending">Pending Request</span>';

          const initials = (c.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

          return `
            <div class="glass item-row" style="padding:16px 20px;">
              <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;flex-shrink:0;">
                ${initials}
              </div>
              <div class="item-main">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                  <div class="item-title" style="font-size:1rem;">${c.full_name}</div>
                  ${badgeHTML}
                </div>
                <div class="item-sub" style="margin-top:2px;">
                  <span><i class="fa-solid fa-phone" style="color:#059669;margin-right:4px;"></i> ${c.phone ?? 'No phone'}</span>
                  <span style="margin:0 6px;">·</span>
                  <span><i class="fa-solid fa-location-dot" style="color:#64748b;margin-right:4px;"></i> ${c.address ?? 'No address'}</span>
                </div>
                <div class="item-sub" style="margin-top:2px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                  <span>License: <strong>${c.license_number ?? 'Not provided'}</strong></span>
                  <span>Total Bookings: <strong>${c.totalBookings}</strong></span>
                  <span>Total Spent: <strong>${fmtMoney(c.totalSpent)}</strong></span>
                </div>
                ${c.activeRental ? `
                  <div style="margin-top:4px;font-size:0.78rem;color:#047857;font-weight:600;">
                    <i class="fa-solid fa-key" style="margin-right:4px;"></i> Current Vehicle: <strong>${c.activeRental.vehicles?.name ?? 'Vehicle'}</strong> (${maskPlate(c.activeRental.vehicles?.plate_number ?? '')}) · ${fmtDate(c.activeRental.start_date)} → ${fmtDate(c.activeRental.end_date)}
                  </div>
                ` : ''}
              </div>
              <div class="item-actions">
                ${c.license_id_url ? `
                  <button class="btn btn-ghost btn-sm" data-cust-view-id="${c.id}" style="color:#2563eb;">
                    <i class="fa-solid fa-id-card"></i> View License
                  </button>
                ` : '<span class="muted" style="font-size:0.75rem;">No License ID</span>'}
              </div>
            </div>
          `;
        }).join('') : emptyState('👥', 'No customers found.')}
      </div>
    </div>
  `;

  $('#custSearchInput').addEventListener('input', (e) => {
    customerSearchQuery = e.target.value;
    renderAdminCustomers(view);
  });

  $$('#custFilterPills .pill').forEach(p => p.addEventListener('click', () => {
    customerStatusFilter = p.dataset.cfilter;
    renderAdminCustomers(view);
  }));

  $$('[data-cust-view-id]').forEach(btn => btn.addEventListener('click', () => {
    const c = customerList.find(usr => usr.id === btn.dataset.custViewId);
    if (!c || !c.license_id_url) return;
    openModal(`
      <div class="modal-head">
        <div>
          <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;">Driver's License Photo</h3>
          <span class="muted" style="font-size:0.78rem;">Customer: ${c.full_name} · License No: ${c.license_number ?? 'N/A'}</span>
        </div>
        <div class="modal-close" onclick="window.closeModal()">✕</div>
      </div>
      <div style="text-align:center;padding:10px 0;">
        <img src="${c.license_id_url}" style="max-width:100%;max-height:360px;border-radius:10px;border:1px solid #e2e8f0;" />
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-top:12px;" class="detail-grid">
        <div><label>Customer Name</label><div style="font-weight:700;color:#0f172a;">${c.full_name}</div></div>
        <div><label>Phone Number</label><div style="font-weight:600;color:#0f172a;">${c.phone ?? '—'}</div></div>
        <div><label>License No.</label><div style="font-weight:700;font-family:monospace;color:#2563eb;">${c.license_number ?? '—'}</div></div>
        <div><label>Expiry Date</label><div style="font-weight:600;color:#0f172a;">${c.license_expiry ? fmtDate(c.license_expiry) : '—'}</div></div>
        <div><label>Total Bookings</label><div style="font-weight:700;color:#0f172a;">${c.totalBookings}</div></div>
        <div><label>Total Spent</label><div style="font-weight:700;color:#059669;">${fmtMoney(c.totalSpent)}</div></div>
        <div style="grid-column:1/-1;"><label>Address</label><div style="font-weight:600;color:#0f172a;">${c.address ?? '—'}</div></div>
      </div>
      <button class="btn btn-primary btn-block" onclick="window.closeModal()" style="margin-top:14px;">Close</button>
    `);
  }));
}

let userRoleFilter = 'all';
let userSearchQuery = '';

async function renderAdminUsers(view) {
  const { data: users, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;

  const customersCount = users.filter(u => u.role === 'customer').length;
  const staffCount = users.filter(u => u.role === 'staff').length;
  const adminCount = users.filter(u => u.role === 'admin').length;

  const filteredUsers = users.filter(u => {
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const nameStr = (u.full_name || '').toLowerCase();
    const phoneStr = (u.phone || '').toLowerCase();
    const licenseStr = (u.license_number || '').toLowerCase();
    const searchLower = userSearchQuery.toLowerCase();
    const matchesSearch = nameStr.includes(searchLower) || phoneStr.includes(searchLower) || licenseStr.includes(searchLower);
    return matchesRole && matchesSearch;
  });

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2>Customers &amp; User Management</h2>
          <p>View registered customers, inspect driver's licenses, and manage staff/admin access.</p>
        </div>
      </div>

      <div class="search-bar" style="margin-bottom:14px;">
        <div style="position:relative;flex:1;">
          <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8;"></i>
          <input type="text" id="userSearchInput" style="padding-left:40px;" placeholder="Search customers by name, phone, or license number…" value="${userSearchQuery}" />
        </div>
      </div>

      <div class="pill-row" id="userRolePills" style="margin-bottom:18px;">
        <div class="pill ${userRoleFilter === 'all' ? 'active' : ''}" data-role="all">All Users (${users.length})</div>
        <div class="pill ${userRoleFilter === 'customer' ? 'active' : ''}" data-role="customer">Customers (${customersCount})</div>
        <div class="pill ${userRoleFilter === 'staff' ? 'active' : ''}" data-role="staff">Staff (${staffCount})</div>
        <div class="pill ${userRoleFilter === 'admin' ? 'active' : ''}" data-role="admin">Admins (${adminCount})</div>
      </div>

      <div class="glass" style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Customer / User</th>
              <th>Contact Phone</th>
              <th>Driver's License</th>
              <th>Address</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${filteredUsers.length ? filteredUsers.map(u => `
              <tr>
                <td>
                  <div style="font-weight:700;color:#0f172a;">${u.full_name}${u.id === state.user.id ? ' <span class="muted">(you)</span>' : ''}</div>
                </td>
                <td>${u.phone ? `<span style="font-weight:600;"><i class="fa-solid fa-phone" style="color:#059669;font-size:0.75rem;margin-right:4px;"></i> ${u.phone}</span>` : '<span class="muted">—</span>'}</td>
                <td>
                  ${u.license_number ? `
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span class="badge badge-completed" style="font-size:0.74rem;font-family:monospace;"><i class="fa-solid fa-id-card"></i> ${u.license_number}</span>
                      ${u.license_id_url ? `
                        <button class="btn btn-ghost btn-sm" data-view-id="${u.id}" style="padding:2px 8px;font-size:0.72rem;color:#2563eb;">
                          <i class="fa-solid fa-eye"></i> View ID
                        </button>
                      ` : ''}
                    </div>
                  ` : '<span class="muted">—</span>'}
                </td>
                <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.8rem;color:#475569;">${u.address ?? '—'}</td>
                <td><span class="badge badge-${u.role === 'admin' ? 'approved' : u.role === 'staff' ? 'pending' : 'available'}">${u.role}</span></td>
                <td style="font-size:0.8rem;color:#64748b;">${fmtDate(u.created_at)}</td>
                <td>
                  <select data-role-select="${u.id}" ${u.id === state.user.id ? 'disabled' : ''} style="font-size:0.8rem;padding:4px 8px;">
                    <option value="customer" ${u.role==='customer'?'selected':''}>customer</option>
                    <option value="staff" ${u.role==='staff'?'selected':''}>staff</option>
                    <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
                  </select>
                </td>
              </tr>
            `).join('') : `<tr><td colspan="7">${emptyState('👥', 'No users found matching your search.')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#userSearchInput').addEventListener('input', (e) => {
    userSearchQuery = e.target.value;
    renderAdminUsers(view);
  });

  $$('#userRolePills .pill').forEach(p => p.addEventListener('click', () => {
    userRoleFilter = p.dataset.role;
    renderAdminUsers(view);
  }));

  $$('[data-role-select]').forEach(sel => sel.addEventListener('change', async () => {
    const { error } = await supabase.from('profiles').update({ role: sel.value }).eq('id', sel.dataset.roleSelect);
    if (error) { toast(error.message, 'error'); return; }
    toast('User role updated.', 'success');
  }));

  $$('[data-view-id]').forEach(btn => btn.addEventListener('click', () => {
    const u = users.find(usr => usr.id === btn.dataset.viewId);
    if (!u || !u.license_id_url) return;
    openModal(`
      <div class="modal-head">
        <div>
          <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;">Driver's License Photo Verification</h3>
          <span class="muted" style="font-size:0.78rem;">Customer: ${u.full_name} · License: ${u.license_number ?? 'N/A'}</span>
        </div>
        <div class="modal-close" onclick="window.closeModal()">✕</div>
      </div>
      <div style="text-align:center;padding:10px 0;">
        <img src="${u.license_id_url}" style="max-width:100%;max-height:360px;border-radius:12px;border:2px solid #2563eb;box-shadow:0 8px 24px rgba(0,0,0,0.15);" />
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-top:12px;" class="detail-grid">
        <div><label>Customer Name</label><div style="font-weight:700;color:#0f172a;">${u.full_name}</div></div>
        <div><label>Contact Phone</label><div style="font-weight:600;color:#0f172a;">${u.phone ?? '—'}</div></div>
        <div><label>License No.</label><div style="font-weight:700;font-family:monospace;color:#2563eb;">${u.license_number ?? '—'}</div></div>
        <div><label>Expiry Date</label><div style="font-weight:600;color:#0f172a;">${u.license_expiry ? fmtDate(u.license_expiry) : '—'}</div></div>
        <div style="grid-column:1/-1;"><label>Address</label><div style="font-weight:600;color:#0f172a;">${u.address ?? '—'}</div></div>
      </div>
      <button class="btn btn-primary btn-block" onclick="window.closeModal()" style="margin-top:14px;">Done</button>
    `);
  }));
}

async function renderAdminRentals(view) {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, vehicles(name, plate_number), profiles!bookings_customer_id_fkey(full_name), payments(amount, status, method)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  view.innerHTML = `
    <div class="view">
      <div class="section-head"><div><h2>Rentals &amp; Transactions</h2><p>Every booking and its payment status.</p></div></div>
      <div class="glass" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Vehicle</th><th>Customer</th><th>Dates</th><th>Amount</th><th>Status</th><th>Payments</th></tr></thead>
          <tbody>
            ${bookings.map(b => `
              <tr>
                <td>${b.vehicles.name} <span class="muted">(${b.vehicles.plate_number})</span></td>
                <td>${b.profiles?.full_name ?? '—'}</td>
                <td>${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</td>
                <td>${fmtMoney(b.total_amount)}</td>
                <td><span class="badge badge-${b.status}">${b.status}</span></td>
                <td>${(b.payments || []).map(p => `<span class="badge badge-${p.status}" style="margin-right:4px;">${fmtMoney(p.amount)}</span>`).join('') || '—'}</td>
              </tr>
            `).join('') || `<tr><td colspan="6" class="center muted">No bookings yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function renderAdminReports(view) {
  const [{ data: payments }, { data: bookings }] = await Promise.all([
    supabase.from('payments').select('amount, status, created_at').eq('status', 'successful'),
    supabase.from('bookings').select('*, vehicles(name, plate_number, categories(name))'),
  ]);

  const bookingsList = bookings || [];
  const revenue = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

  // Fleet Utilization calculation
  const totalFleet = state.vehicles.length;
  const rentedCount = state.vehicles.filter(v => v.status === 'rented').length;
  const availableCount = state.vehicles.filter(v => v.status === 'available').length;
  const maintenanceCount = state.vehicles.filter(v => v.status === 'maintenance').length;
  const utilizationPercent = totalFleet > 0 ? Math.round((rentedCount / totalFleet) * 100) : 0;

  // Top Earning Vehicles calculation
  const vehicleEarningsMap = {};
  state.vehicles.forEach(v => {
    vehicleEarningsMap[v.id] = {
      name: v.name,
      plate: v.plate_number,
      category: v.categories?.name ?? 'Standard',
      rentals: 0,
      revenue: 0,
      status: v.status
    };
  });

  bookingsList.forEach(b => {
    if (b.vehicle_id && vehicleEarningsMap[b.vehicle_id] && ['active', 'completed', 'approved'].includes(b.status)) {
      vehicleEarningsMap[b.vehicle_id].revenue += Number(b.total_amount || 0);
      vehicleEarningsMap[b.vehicle_id].rentals += 1;
    }
  });

  const topVehicles = Object.values(vehicleEarningsMap)
    .sort((a, b) => b.revenue - a.revenue);

  const statusCounts = ['pending','approved','active','completed','rejected','cancelled'].map(s => ({
    status: s, count: bookingsList.filter(b => b.status === s).length,
  }));

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2>Analytics &amp; Reports</h2>
          <p>Fleet utilization, revenue metrics, and vehicle performance reports.</p>
        </div>
      </div>

      <!-- Overview Metric Cards -->
      <div class="grid grid-stats" style="margin-bottom:22px;">
        <div class="glass stat-card">
          <div class="stat-label">Fleet Utilization Rate</div>
          <div class="stat-value" style="color:#2563eb;">${utilizationPercent}%</div>
          <div class="stat-sub">${rentedCount} of ${totalFleet} vehicles currently out</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Net Realized Revenue</div>
          <div class="stat-value" style="color:#059669;">${fmtMoney(revenue)}</div>
          <div class="stat-sub">Verified payments</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Available Fleet</div>
          <div class="stat-value" style="color:#059669;">${availableCount}</div>
          <div class="stat-sub">Ready for rental</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Vehicles in Maintenance</div>
          <div class="stat-value" style="color:#d97706;">${maintenanceCount}</div>
          <div class="stat-sub">Under repair/service</div>
        </div>
      </div>

      <div class="grid grid-2" style="gap:20px;margin-bottom:22px;">
        <!-- Fleet Utilization Progress Panel -->
        <div class="glass card">
          <h3 style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:14px;">Fleet Utilization Breakdown</h3>
          <div style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:6px;">
              <span style="font-weight:600;color:#0f172a;">Active Rental Utilization</span>
              <span style="font-weight:700;color:#2563eb;">${utilizationPercent}%</span>
            </div>
            <div style="background:#e2e8f0;border-radius:6px;height:12px;overflow:hidden;">
              <div style="width:${utilizationPercent}%;height:100%;background:linear-gradient(90deg, #2563eb, #1d4ed8);border-radius:6px;"></div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.85rem;padding:6px 0;border-bottom:1px solid #f1f5f9;">
              <span>Rented Vehicles (Active)</span>
              <span class="badge badge-completed" style="font-weight:700;">${rentedCount}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.85rem;padding:6px 0;border-bottom:1px solid #f1f5f9;">
              <span>Available Vehicles</span>
              <span class="badge badge-available" style="font-weight:700;">${availableCount}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.85rem;padding:6px 0;">
              <span>Under Maintenance</span>
              <span class="badge badge-pending" style="font-weight:700;color:#b45309;">${maintenanceCount}</span>
            </div>
          </div>
        </div>

        <!-- Reservation Status Breakdown -->
        <div class="glass card">
          <h3 style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:14px;">Reservation Breakdown</h3>
          ${statusCounts.map(s => `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
              <span class="badge badge-${s.status}" style="width:90px;justify-content:center;font-size:0.7rem;">${s.status}</span>
              <div style="flex:1;background:#e2e8f0;border-radius:6px;height:8px;overflow:hidden;">
                <div style="width:${Math.min(100, s.count * 15)}%;height:100%;background:#2563eb;border-radius:6px;"></div>
              </div>
              <span style="width:24px;text-align:right;font-weight:700;font-size:0.85rem;color:#0f172a;">${s.count}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Top Earning Vehicles Report Table -->
      <div class="glass card">
        <h3 style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:14px;">Top Earning Vehicles Report</h3>
        <div style="overflow-x:auto;">
          <table style="width:100%;font-size:0.85rem;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid #e2e8f0;text-align:left;">
                <th style="padding:8px 0;color:#64748b;font-weight:600;">Vehicle Name</th>
                <th style="padding:8px 0;color:#64748b;font-weight:600;">Category</th>
                <th style="padding:8px 0;color:#64748b;font-weight:600;">Plate No.</th>
                <th style="padding:8px 0;color:#64748b;font-weight:600;text-align:center;">Total Rentals</th>
                <th style="padding:8px 0;color:#64748b;font-weight:600;">Fleet Status</th>
                <th style="padding:8px 0;color:#64748b;font-weight:600;text-align:right;">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${topVehicles.length ? topVehicles.map(v => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:10px 0;font-weight:700;color:#0f172a;">${v.name}</td>
                  <td style="padding:10px 0;color:#64748b;">${v.category}</td>
                  <td style="padding:10px 0;color:#64748b;font-family:monospace;">${maskPlate(v.plate)}</td>
                  <td style="padding:10px 0;text-align:center;font-weight:600;">${v.rentals}</td>
                  <td style="padding:10px 0;"><span class="badge badge-${v.status}">${v.status}</span></td>
                  <td style="padding:10px 0;text-align:right;font-weight:700;color:#059669;">${fmtMoney(v.revenue)}</td>
                </tr>
              `).join('') : `<tr><td colspan="6" class="center muted">No vehicle data available.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------
// FLEET MAINTENANCE & SERVICE HISTORY MODALS
// ---------------------------------------------------------------------
async function openLogServiceModal(vehicleId) {
  const v = state.vehicles.find(item => item.id === vehicleId) || { id: vehicleId, name: 'Vehicle' };

  openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;"><i class="fa-solid fa-wrench" style="color:#0284c7;margin-right:6px;"></i> Log Maintenance Work Order</h3>
        <span class="muted" style="font-size:0.78rem;">${v.name} · Plate: ${v.plate_number || '—'}</span>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    <div class="field">
      <label>Service Type / Category</label>
      <select id="srvType">
        <option value="Routine Oil & Filter Change">Routine Oil &amp; Filter Change</option>
        <option value="Brake System Service & Pads">Brake System Service &amp; Pads</option>
        <option value="Tire Replacement & Alignment">Tire Replacement &amp; Alignment</option>
        <option value="Engine Repair & Tune-up">Engine Repair &amp; Tune-up</option>
        <option value="Air Conditioning Overhaul">Air Conditioning Overhaul</option>
        <option value="Transmission Service">Transmission Service</option>
        <option value="Bodywork & Paint Touch-up">Bodywork &amp; Paint Touch-up</option>
        <option value="Comprehensive Safety Inspection">Comprehensive Safety Inspection</option>
      </select>
    </div>

    <div class="detail-grid">
      <div class="field">
        <label>Service Status</label>
        <select id="srvStatus">
          <option value="in_service">🔧 In Service (Currently in shop)</option>
          <option value="scheduled">🗓️ Scheduled Maintenance (Upcoming)</option>
        </select>
      </div>
      <div class="field">
        <label>Estimated Cost (₱)</label>
        <input type="number" id="srvCost" placeholder="e.g. 4500" value="3500" />
      </div>
      <div class="field">
        <label>Mechanic / Auto Shop Name</label>
        <input type="text" id="srvShop" placeholder="e.g. Toyota Casa Service Center" value="Toyota Casa Service Center" />
      </div>
      <div class="field">
        <label>Start Date</label>
        <input type="date" id="srvStartDate" value="${new Date().toISOString().slice(0,10)}" />
      </div>
    </div>

    <div class="field">
      <label>Service Details / Work Order Description</label>
      <textarea id="srvDesc" rows="3" placeholder="Specify parts replaced, issues inspected, or technician recommendations…">Replaced engine oil, oil filter, and performed 10,000 km multi-point safety inspection.</textarea>
    </div>

    <button class="btn btn-primary btn-block" id="saveSrvBtn" style="background:#0284c7;border-color:#0284c7;margin-top:8px;">
      <i class="fa-solid fa-floppy-disk"></i> Log Work Order &amp; Update Status
    </button>
  `);

  $('#mClose').addEventListener('click', closeModal);

  $('#saveSrvBtn').addEventListener('click', async () => {
    const srvType = $('#srvType').value;
    const srvStatus = $('#srvStatus').value;
    const srvCost = Number($('#srvCost').value || 0);
    const srvShop = $('#srvShop').value.trim();
    const startDate = $('#srvStartDate').value;
    const desc = $('#srvDesc').value.trim();

    const saveBtn = $('#saveSrvBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving Work Order…';

    const { error: insErr } = await supabase.from('service_history').insert({
      vehicle_id: vehicleId,
      service_type: srvType,
      service_status: srvStatus,
      cost: srvCost,
      serviced_by: srvShop,
      start_date: startDate,
      description: desc
    });

    if (insErr) {
      console.warn('Service history table notice:', insErr);
    }

    const vehicleNextStatus = srvStatus === 'in_service' ? 'in_service' : 'scheduled_maint';
    await supabase.from('vehicles').update({ status: vehicleNextStatus }).eq('id', vehicleId);

    toast(`Work order logged for ${v.name}. Vehicle set to ${vehicleNextStatus.replace('_', ' ')}.`, 'success');
    closeModal();
    await loadVehicles();
    renderTab();
  });
}

async function openServiceHistoryModal(vehicleId) {
  const v = state.vehicles.find(item => item.id === vehicleId) || { id: vehicleId, name: 'Vehicle' };

  let historyLogs = [];
  try {
    const { data } = await supabase
      .from('service_history')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });
    historyLogs = data || [];
  } catch (e) {
    historyLogs = [];
  }

  const activeOrders = historyLogs.filter(h => h.service_status === 'in_service' || h.service_status === 'scheduled');
  const completedOrders = historyLogs.filter(h => h.service_status === 'completed');
  const totalCostSpent = historyLogs.reduce((sum, h) => sum + Number(h.cost || 0), 0);

  const statusBadge = v.status === 'available'
    ? `<span class="badge badge-available"><i class="fa-solid fa-circle-check"></i> Available</span>`
    : v.status === 'in_service'
    ? `<span class="badge badge-in_service"><i class="fa-solid fa-wrench"></i> In Service</span>`
    : v.status === 'scheduled_maint'
    ? `<span class="badge badge-scheduled_maint"><i class="fa-solid fa-calendar-day"></i> Scheduled Maint</span>`
    : v.status === 'off_the_road'
    ? `<span class="badge badge-off_the_road"><i class="fa-solid fa-ban"></i> Off the Road</span>`
    : `<span class="badge badge-${v.status}">${v.status}</span>`;

  const modal = openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.15rem;font-weight:800;color:#0f172a;"><i class="fa-solid fa-screwdriver-wrench" style="color:#2563eb;margin-right:6px;"></i> Maintenance &amp; Complete Works</h3>
        <span class="muted" style="font-size:0.78rem;">${v.name} · Plate: ${v.plate_number || '—'}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        ${statusBadge}
        <div class="modal-close" id="mClose">✕</div>
      </div>
    </div>

    <div class="receipt" style="margin-bottom:16px;background:#f8fafc;">
      <div class="receipt-row"><span>Active Work Orders</span><span style="font-weight:700;color:#0f172a;">${activeOrders.length} order(s)</span></div>
      <div class="receipt-row"><span>Completed Work Orders</span><span style="font-weight:700;color:#059669;">${completedOrders.length} finished job(s)</span></div>
      <div class="receipt-row receipt-total"><span>Total Maintenance Invested</span><span style="color:#2563eb;">${fmtMoney(totalCostSpent)}</span></div>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;color:#0f172a;font-size:0.92rem;">
      <span><i class="fa-solid fa-wrench" style="color:#c2410c;margin-right:4px;"></i> Active Maintenance Work Orders</span>
      <button class="btn btn-primary btn-sm" id="btnLogNewSrv" style="background:#0284c7;border-color:#0284c7;font-size:0.75rem;"><i class="fa-solid fa-plus"></i> Log Work Order</button>
    </h4>

    <div style="margin-bottom:18px;">
      ${activeOrders.length ? activeOrders.map(h => `
        <div style="background:#fff7ed;border:1px solid #ffedd5;border-radius:12px;padding:12px 14px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <span style="font-weight:800;font-size:0.9rem;color:#9a3412;">${h.service_type}</span>
            <span class="badge ${h.service_status === 'in_service' ? 'badge-in_service' : 'badge-scheduled_maint'}">${h.service_status.replace('_', ' ')}</span>
          </div>
          <div style="font-size:0.8rem;color:#475569;margin-bottom:6px;">
            Shop: <strong>${h.serviced_by || 'Auto Repair Shop'}</strong> · Started: ${fmtDate(h.start_date)} · Est. Cost: <strong>${fmtMoney(h.cost)}</strong>
          </div>
          ${h.description ? `<p style="font-size:0.78rem;color:#64748b;margin:0 0 10px 0;line-height:1.4;">${h.description}</p>` : ''}
          <button class="btn btn-primary btn-sm" data-complete-srv-id="${h.id}" style="background:#059669;border-color:#059669;color:#fff;">
            <i class="fa-solid fa-circle-check"></i> Complete Work Order &amp; Release Vehicle
          </button>
        </div>
      `).join('') : `
        <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:14px;text-align:center;color:#64748b;font-size:0.82rem;">
          <i class="fa-solid fa-circle-check" style="color:#059669;margin-right:4px;"></i> No active repairs or maintenance needed for this vehicle.
        </div>
      `}
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.92rem;">
      <i class="fa-solid fa-clock-rotate-left" style="color:#059669;"></i> Complete Works &amp; Service History
    </h4>

    <div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
      ${completedOrders.length ? completedOrders.map(h => `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:0.82rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">
            <span style="font-weight:700;color:#0f172a;">${h.service_type}</span>
            <span style="font-weight:700;color:#059669;">${fmtMoney(h.cost)}</span>
          </div>
          <div style="color:#64748b;font-size:0.76rem;">
            Completed on ${fmtDate(h.completion_date || h.created_at)} by <strong>${h.serviced_by || 'Casa / Shop'}</strong>
          </div>
          ${h.description ? `<div style="font-size:0.75rem;color:#475569;margin-top:2px;">${h.description}</div>` : ''}
        </div>
      `).join('') : `
        <div style="padding:10px;text-align:center;color:#94a3b8;font-size:0.8rem;">No completed service history recorded yet.</div>
      `}
    </div>
  `, true);

  $('#mClose').addEventListener('click', closeModal);
  $('#btnLogNewSrv').addEventListener('click', () => { closeModal(); openLogServiceModal(vehicleId); });

  $$('[data-complete-srv-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const srvId = Number(btn.dataset.completeSrvId);
      if (!confirm('Mark this service work order as complete and release vehicle back to Available status?')) return;

      btn.disabled = true;
      btn.textContent = 'Completing Order…';

      await supabase.from('service_history').update({
        service_status: 'completed',
        completion_date: new Date().toISOString()
      }).eq('id', srvId);

      await supabase.from('vehicles').update({ status: 'available' }).eq('id', vehicleId);

      toast('Service work order completed! Vehicle returned to Available fleet.', 'success');
      closeModal();
      await loadVehicles();
      await openServiceHistoryModal(vehicleId);
      renderTab();
    });
  });
}

// ---------------------------------------------------------------------
// SYSTEM SETTINGS MODULE (Company Profile, Rental Policy, Notifications, Appearance)
// ---------------------------------------------------------------------
const DEFAULT_SETTINGS = {
  company: {
    name: 'Vehicle Rental Management System',
    phone: '+63 (2) 8888-RENT',
    mobile: '+63 917 123 4567',
    email: 'support@rentflow.ph',
    address: '123 Main Avenue, Metro Manila, Philippines',
    currency: '₱ (PHP)',
    hours: '8:00 AM - 8:00 PM Daily',
  },
  policy: {
    cancellationWindow: 24,
    defaultDownpayment: 20,
    lateFeePerHour: 300,
    requireLicense: true,
    requireGovernmentId: true,
  },
  notifications: {
    bookingAlerts: true,
    pickupReminders: true,
    paymentReceipts: true,
    autoEmailConfirmations: true,
  },
  appearance: {
    theme: 'light',
    accentColor: '#2563eb',
    fontFamily: 'Plus Jakarta Sans',
  }
};

function getSystemSettings() {
  try {
    const raw = localStorage.getItem('rentflow_system_settings');
    return raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

function saveSystemSettings(newSettings) {
  localStorage.setItem('rentflow_system_settings', JSON.stringify(newSettings));
  if (newSettings.appearance?.accentColor) {
    document.documentElement.style.setProperty('--accent', newSettings.appearance.accentColor);
  }
}

let activeSettingsSubTab = 'company';

async function renderAdminSettings(view) {
  const currentSettings = getSystemSettings();
  const comp = currentSettings.company || DEFAULT_SETTINGS.company;
  const pol = currentSettings.policy || DEFAULT_SETTINGS.policy;
  const notif = currentSettings.notifications || DEFAULT_SETTINGS.notifications;
  const appr = currentSettings.appearance || DEFAULT_SETTINGS.appearance;

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2><i class="fa-solid fa-gear" style="color:#2563eb;margin-right:8px;"></i> System Settings &amp; Configuration</h2>
          <p>Customize company profile, rental policies, notification preferences, and system appearance.</p>
        </div>
      </div>

      <!-- Settings Sub-tabs -->
      <div class="pill-row" style="margin-bottom:20px;">
        <div class="pill ${activeSettingsSubTab === 'company' ? 'active' : ''}" data-cfg-tab="company">
          <i class="fa-solid fa-building" style="margin-right:4px;"></i> Company Profile
        </div>
        <div class="pill ${activeSettingsSubTab === 'policy' ? 'active' : ''}" data-cfg-tab="policy">
          <i class="fa-solid fa-file-contract" style="margin-right:4px;"></i> Rental Policy &amp; Terms
        </div>
        <div class="pill ${activeSettingsSubTab === 'notifs' ? 'active' : ''}" data-cfg-tab="notifs">
          <i class="fa-solid fa-bell" style="margin-right:4px;"></i> Notification Preferences
        </div>
        <div class="pill ${activeSettingsSubTab === 'appearance' ? 'active' : ''}" data-cfg-tab="appearance">
          <i class="fa-solid fa-palette" style="margin-right:4px;"></i> Appearance &amp; Theme
        </div>
      </div>

      <div id="settingsTabContent">
        ${renderSettingsSubTabContent(activeSettingsSubTab, comp, pol, notif, appr)}
      </div>
    </div>
  `;

  $$('[data-cfg-tab]').forEach(pill => {
    pill.addEventListener('click', () => {
      activeSettingsSubTab = pill.dataset.cfgTab;
      renderAdminSettings(view);
    });
  });

  attachSettingsFormListeners(view, currentSettings);
}

function renderSettingsSubTabContent(tab, comp, pol, notif, appr) {
  if (tab === 'company') {
    return `
      <div class="setting-card">
        <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <i class="fa-solid fa-building" style="color:#2563eb;"></i> Company Profile &amp; Contact Details
        </h3>
        
        <div class="field">
          <label>Company / Organization Name</label>
          <input type="text" id="cfgCompName" value="${comp.name || ''}" placeholder="Vehicle Rental Management System" />
        </div>

        <div class="detail-grid">
          <div class="field">
            <label>Support Hotline Landline</label>
            <input type="text" id="cfgCompPhone" value="${comp.phone || ''}" placeholder="+63 (2) 8888-RENT" />
          </div>
          <div class="field">
            <label>Support Mobile Hotline</label>
            <input type="text" id="cfgCompMobile" value="${comp.mobile || ''}" placeholder="+63 917 123 4567" />
          </div>
          <div class="field">
            <label>Official Support Email</label>
            <input type="email" id="cfgCompEmail" value="${comp.email || ''}" placeholder="support@rentflow.ph" />
          </div>
          <div class="field">
            <label>Operating Currency</label>
            <input type="text" id="cfgCompCurrency" value="${comp.currency || '₱ (PHP)'}" placeholder="₱ (PHP)" />
          </div>
        </div>

        <div class="field">
          <label>Main Branch Office Address</label>
          <input type="text" id="cfgCompAddress" value="${comp.address || ''}" placeholder="123 Main Avenue, Metro Manila, Philippines" />
        </div>

        <div class="field">
          <label>Business Operating Hours</label>
          <input type="text" id="cfgCompHours" value="${comp.hours || ''}" placeholder="8:00 AM - 8:00 PM Daily" />
        </div>

        <button class="btn btn-primary" id="btnSaveCompany" style="margin-top:10px;">
          <i class="fa-solid fa-floppy-disk"></i> Save Company Profile
        </button>
      </div>
    `;
  } else if (tab === 'policy') {
    return `
      <div class="setting-card">
        <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <i class="fa-solid fa-file-contract" style="color:#059669;"></i> Rental Policies &amp; Penalty Terms
        </h3>

        <div class="detail-grid">
          <div class="field">
            <label>Free Cancellation Notice (Hours before pickup)</label>
            <input type="number" id="cfgCancelWin" value="${pol.cancellationWindow || 24}" min="0" max="72" />
          </div>
          <div class="field">
            <label>Default Reservation Deposit (%)</label>
            <select id="cfgDefDep">
              <option value="20" ${pol.defaultDownpayment === 20 ? 'selected' : ''}>20% Partial Downpayment</option>
              <option value="30" ${pol.defaultDownpayment === 30 ? 'selected' : ''}>30% Partial Downpayment</option>
              <option value="50" ${pol.defaultDownpayment === 50 ? 'selected' : ''}>50% Partial Downpayment</option>
              <option value="100" ${pol.defaultDownpayment === 100 ? 'selected' : ''}>100% Full Payment Only</option>
            </select>
          </div>
          <div class="field">
            <label>Overdue / Late Return Fee (₱ per hour)</label>
            <input type="number" id="cfgLateFee" value="${pol.lateFeePerHour || 300}" min="0" step="50" />
          </div>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Require Valid Professional Driver's License</div>
            <div class="setting-sub">Mandatory driver license submission for booking approvals.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="cfgReqLicense" ${pol.requireLicense ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Require Secondary Government Photo ID</div>
            <div class="setting-sub">Verify secondary identification prior to key handover.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="cfgReqGovId" ${pol.requireGovernmentId ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </div>

        <button class="btn btn-primary" id="btnSavePolicy" style="margin-top:14px;background:#059669;border-color:#059669;">
          <i class="fa-solid fa-floppy-disk"></i> Save Rental Policies
        </button>
      </div>
    `;
  } else if (tab === 'notifs') {
    return `
      <div class="setting-card">
        <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <i class="fa-solid fa-bell" style="color:#d97706;"></i> System Notification Preferences
        </h3>

        <div class="setting-row">
          <div>
            <div class="setting-label">Instant Booking Request &amp; Approval Alerts</div>
            <div class="setting-sub">Send live alerts to staff when new booking requests arrive.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="cfgNtfBooking" ${notif.bookingAlerts ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Vehicle Pickup &amp; Return Reminders</div>
            <div class="setting-sub">Notify customers 1 hour prior to scheduled vehicle pickup.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="cfgNtfPickup" ${notif.pickupReminders ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Instant Payment Receipts</div>
            <div class="setting-sub">Display digital receipt voucher immediately upon verified payment.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="cfgNtfReceipts" ${notif.paymentReceipts ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Automated Email Confirmations</div>
            <div class="setting-sub">Dispatch booking confirmation emails to customer addresses.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="cfgNtfAutoEmail" ${notif.autoEmailConfirmations ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </div>

        <button class="btn btn-primary" id="btnSaveNotifs" style="margin-top:14px;background:#d97706;border-color:#d97706;">
          <i class="fa-solid fa-floppy-disk"></i> Save Notification Preferences
        </button>
      </div>
    `;
  } else {
    const currentAccent = appr.accentColor || '#2563eb';
    return `
      <div class="setting-card">
        <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <i class="fa-solid fa-palette" style="color:#4f46e5;"></i> Appearance &amp; System Theme
        </h3>

        <div class="field">
          <label>Theme Mode</label>
          <select id="cfgThemeMode">
            <option value="light" ${appr.theme === 'light' ? 'selected' : ''}>☀️ Light Mode (Warm Clean)</option>
            <option value="dark" ${appr.theme === 'dark' ? 'selected' : ''}>🌙 Dark Mode (Sleek Night)</option>
          </select>
        </div>

        <div class="field">
          <label>Brand Accent Color Palette</label>
          <div class="color-swatch-grid">
            <div class="color-swatch ${currentAccent === '#2563eb' ? 'active' : ''}" data-color="#2563eb" style="background:#2563eb;" title="Friendly Blue">✓</div>
            <div class="color-swatch ${currentAccent === '#059669' ? 'active' : ''}" data-color="#059669" style="background:#059669;" title="Emerald Green">✓</div>
            <div class="color-swatch ${currentAccent === '#4f46e5' ? 'active' : ''}" data-color="#4f46e5" style="background:#4f46e5;" title="Royal Indigo">✓</div>
            <div class="color-swatch ${currentAccent === '#d97706' ? 'active' : ''}" data-color="#d97706" style="background:#d97706;" title="Amber Bronze">✓</div>
            <div class="color-swatch ${currentAccent === '#e11d48' ? 'active' : ''}" data-color="#e11d48" style="background:#e11d48;" title="Deep Coral">✓</div>
          </div>
          <input type="hidden" id="cfgAccentColor" value="${currentAccent}" />
        </div>

        <div class="field">
          <label>System Typography Font Family</label>
          <select id="cfgFontFamily">
            <option value="Plus Jakarta Sans" ${appr.fontFamily === 'Plus Jakarta Sans' ? 'selected' : ''}>Plus Jakarta Sans (Modern Geometric)</option>
            <option value="Inter" ${appr.fontFamily === 'Inter' ? 'selected' : ''}>Inter (High Legibility)</option>
            <option value="Space Grotesk" ${appr.fontFamily === 'Space Grotesk' ? 'selected' : ''}>Space Grotesk (Tech Accent)</option>
          </select>
        </div>

        <button class="btn btn-primary" id="btnSaveAppr" style="margin-top:14px;background:#4f46e5;border-color:#4f46e5;">
          <i class="fa-solid fa-wand-magic-sparkles"></i> Apply Theme &amp; Appearance
        </button>
      </div>
    `;
  }
}

function attachSettingsFormListeners(view, currentSettings) {
  $$('.color-swatch', view).forEach(sw => {
    sw.addEventListener('click', () => {
      $$('.color-swatch', view).forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      const selectedColor = sw.dataset.color;
      const hiddenInput = $('#cfgAccentColor', view);
      if (hiddenInput) hiddenInput.value = selectedColor;
      document.documentElement.style.setProperty('--accent', selectedColor);
    });
  });

  const btnComp = $('#btnSaveCompany', view);
  if (btnComp) {
    btnComp.addEventListener('click', () => {
      currentSettings.company = {
        name: $('#cfgCompName').value.trim(),
        phone: $('#cfgCompPhone').value.trim(),
        mobile: $('#cfgCompMobile').value.trim(),
        email: $('#cfgCompEmail').value.trim(),
        currency: $('#cfgCompCurrency').value.trim(),
        address: $('#cfgCompAddress').value.trim(),
        hours: $('#cfgCompHours').value.trim(),
      };
      saveSystemSettings(currentSettings);
      toast('Company profile details saved successfully!', 'success');
      renderAdminSettings(view);
    });
  }

  const btnPol = $('#btnSavePolicy', view);
  if (btnPol) {
    btnPol.addEventListener('click', () => {
      currentSettings.policy = {
        cancellationWindow: Number($('#cfgCancelWin').value || 24),
        defaultDownpayment: Number($('#cfgDefDep').value || 20),
        lateFeePerHour: Number($('#cfgLateFee').value || 300),
        requireLicense: $('#cfgReqLicense').checked,
        requireGovernmentId: $('#cfgReqGovId').checked,
      };
      saveSystemSettings(currentSettings);
      toast('Rental policies updated successfully!', 'success');
      renderAdminSettings(view);
    });
  }

  const btnNotifs = $('#btnSaveNotifs', view);
  if (btnNotifs) {
    btnNotifs.addEventListener('click', () => {
      currentSettings.notifications = {
        bookingAlerts: $('#cfgNtfBooking').checked,
        pickupReminders: $('#cfgNtfPickup').checked,
        paymentReceipts: $('#cfgNtfReceipts').checked,
        autoEmailConfirmations: $('#cfgNtfAutoEmail').checked,
      };
      saveSystemSettings(currentSettings);
      toast('Notification preferences saved!', 'success');
      renderAdminSettings(view);
    });
  }

  const btnAppr = $('#btnSaveAppr', view);
  if (btnAppr) {
    btnAppr.addEventListener('click', () => {
      const themeVal = $('#cfgThemeMode').value;
      const colorVal = $('#cfgAccentColor').value;
      const fontVal = $('#cfgFontFamily').value;

      currentSettings.appearance = {
        theme: themeVal,
        accentColor: colorVal,
        fontFamily: fontVal,
      };

      saveSystemSettings(currentSettings);

      localStorage.setItem('rentflow_theme', themeVal);
      applyTheme();
      document.documentElement.style.setProperty('--accent', colorVal);
      document.body.style.fontFamily = `'${fontVal}', sans-serif`;

      toast(`Appearance updated! Theme set to ${themeVal}.`, 'success');
      renderShell();
    });
  }
}

// ---------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') { state.user = null; state.profile = null; renderAuth(); }
});

bootstrapSession();
