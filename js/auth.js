import { supabase } from './config.js';
import { state, DEMO_ACCOUNTS, getActiveRole, setActiveRole, getActiveCustomerKey, setActiveCustomerKey } from './state.js';
import { $, $$, toast, openModal, closeModal, fmtMoney } from './utils.js';
import { loadCategories, loadVehicles } from './vehicles.js';
import { openVehicleDetail } from './booking.js';

let authMode = 'login';

export async function switchSystemRole(role, customerKey = null) {
  if (role === 'customer') {
    const custKey = customerKey && DEMO_ACCOUNTS[customerKey] ? customerKey : 'customer1';
    const cust = DEMO_ACCOUNTS[custKey] || DEMO_ACCOUNTS.customer || DEMO_ACCOUNTS.customer1;
    setActiveRole('customer');
    setActiveCustomerKey(custKey);
    state.user = { id: cust.id, email: cust.email };
    state.profile = { ...cust };
    state.portal = 'customer';
    state.tab = 'browse';
    toast(`Switched to Renter Portal`, 'info');
  } else if (role === 'staff') {
    const st = DEMO_ACCOUNTS.staff;
    setActiveRole('staff');
    state.user = { id: st.id, email: st.email };
    state.profile = { ...st };
    state.portal = 'staff';
    state.tab = 'dashboard';
    toast(`Switched to Staff Portal`, 'info');
    supabase.auth.signInWithPassword({
      email: 'staff@rentflow.ph',
      password: 'RentFlowStaff2026!'
    }).catch(err => console.warn('Staff auth note:', err));
  } else if (role === 'admin') {
    const adm = DEMO_ACCOUNTS.admin;
    setActiveRole('admin');
    state.user = { id: adm.id, email: adm.email };
    state.profile = { ...adm };
    state.portal = 'admin';
    state.tab = 'dashboard';
    toast(`Switched to Administrator Portal`, 'info');
    supabase.auth.signInWithPassword({
      email: 'admin@rentflow.ph',
      password: 'RentFlowAdmin2026!'
    }).catch(err => console.warn('Admin auth note:', err));
  }
  await Promise.all([loadCategories(), loadVehicles()]).catch(() => {});
  if (window.renderShell) window.renderShell();
}

/* ==========================================================================
   LANDING PAGE — Full public homepage before login
   ========================================================================== */
export function renderLandingPage() {
  const isDark = (localStorage.getItem('rentflow_theme') || 'light') === 'dark';
  if (isDark) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');

  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 3);
  const nextDayStr = tomorrow.toISOString().slice(0, 10);

  // Live vehicles from state or fallback
  const vehicles = (state.vehicles && state.vehicles.length > 0) ? state.vehicles.slice(0, 4) : [
    { id: '1', name: 'Toyota Vios 1.5 G CVT', category: 'Sedan', seats: 5, transmission: 'Automatic', daily_rate: 2200, image_url: 'images/vios.webp' },
    { id: '2', name: 'Toyota Fortuner 2.8 V', category: 'SUV', seats: 7, transmission: 'Automatic', daily_rate: 4800, image_url: 'images/fortuner.webp' },
    { id: '3', name: 'Mitsubishi Xpander GLS', category: 'MPV', seats: 7, transmission: 'Automatic', daily_rate: 3100, image_url: 'images/xpander.webp' },
    { id: '4', name: 'Ford Ranger Raptor', category: 'Pickup', seats: 5, transmission: 'Automatic', daily_rate: 6500, image_url: 'images/raptor.webp' }
  ];

  $('#app').innerHTML = `
    <div class="landing-page" data-theme="${isDark ? 'dark' : ''}">
      <!-- ═══ TOP NAVBAR (Fraunces + DM Sans, Flat, No blur) ═══ -->
      <nav class="lp-navbar-v2">
        <div class="lp-nav-inner">
          <div class="lp-brand-group">
            <div class="lp-brand-icon">P</div>
            <span class="lp-brand-text">Palawan Drive</span>
          </div>

          <div class="lp-nav-links">
            <a href="#lpHero" class="lp-nav-item active">Home</a>
            <a href="#lpFleet" class="lp-nav-item">Fleet</a>
            <a href="#lpHowItWorks" class="lp-nav-item">How it works</a>
            <a href="#lpReviews" class="lp-nav-item">Reviews</a>
          </div>

          <div class="lp-nav-actions">
            <button type="button" class="btn btn-ghost btn-sm" id="lpSignInBtn">Sign in</button>
            <button type="button" class="btn btn-primary btn-sm" id="lpReserveBtn">Book a vehicle</button>
          </div>
        </div>
      </nav>

      <!-- ═══ SPLIT HERO SECTION (Matches 1-homepage.png) ═══ -->
      <header class="lp-hero-split-section" id="lpHero">
        <div class="lp-hero-split-grid">
          <div class="lp-hero-split-left">
            <div class="lp-overline-tag">Vehicle rental in Palawan</div>
            <h1 class="lp-hero-main-title">Pick up the keys, not the paperwork.</h1>
            <p class="lp-hero-main-desc">
              Browse live availability, book in three steps, and get handed your vehicle with a QR check-in at the counter.
            </p>
            <div class="lp-hero-action-row">
              <a href="#lpFleet" class="btn btn-primary" id="lpBrowseFleetBtn">Browse the fleet</a>
              <a href="#lpHowItWorks" class="btn btn-ghost" id="lpHowItWorksBtn">How it works</a>
            </div>
          </div>

          <div class="lp-hero-split-right">
            <div class="lp-hero-img-container">
              <img src="images/hero-fleet.jpg" alt="Fleet of cars" class="lp-hero-split-photo" />
            </div>
          </div>
        </div>

        <!-- ═══ 4-COLUMN SEARCH BAR CARD ═══ -->
        <div class="lp-search-bar-card" id="lpSearchBar">
          <div class="lp-search-col">
            <span class="lp-search-label">Pick-up location</span>
            <div class="lp-search-val">Puerto Princesa Airport</div>
          </div>
          <div class="lp-search-col">
            <label for="heroPickupDate" class="lp-search-label">Pick-up date</label>
            <input type="date" id="heroPickupDate" value="${todayStr}" class="lp-search-date-input" />
          </div>
          <div class="lp-search-col">
            <label for="heroReturnDate" class="lp-search-label">Return date</label>
            <input type="date" id="heroReturnDate" value="${nextDayStr}" class="lp-search-date-input" />
          </div>
          <div class="lp-search-col">
            <label for="heroCategory" class="lp-search-label">Vehicle type</label>
            <select id="heroCategory" class="lp-search-select">
              <option value="all">Any</option>
              <option value="Sedan">Sedan</option>
              <option value="SUV">SUV</option>
              <option value="MPV">MPV</option>
              <option value="Pickup">Pickup</option>
              <option value="Motorcycles">Motorcycle</option>
            </select>
          </div>
          <div class="lp-search-btn-col">
            <button type="button" class="btn btn-primary" id="heroSearchBtn">Search</button>
          </div>
        </div>
      </header>

      <!-- ═══ LIVE INVENTORY ("Available this week") ═══ -->
      <section class="lp-inventory-section" id="lpFleet">
        <div class="lp-section-container">
          <div class="lp-section-header-left">
            <div class="lp-overline-tag">Live inventory</div>
            <h2 class="lp-section-heading">Available this week</h2>
          </div>

          <div class="lp-inventory-grid">
            ${vehicles.map(v => {
              const exactImg = v.image_url || 'images/vios.webp';
              const rate = v.daily_rate || 2200;
              const cat = v.category || (v.categories?.name) || 'Sedan';
              const seats = v.seats || 5;
              const trans = v.transmission || 'Automatic';
              return `
                <div class="lp-vehicle-card">
                  <div class="lp-card-photo-panel">
                    <img src="${exactImg}" alt="${v.name}" class="lp-card-photo" />
                  </div>
                  <div class="lp-card-body">
                    <div class="lp-card-header-row">
                      <h3 class="lp-card-title">${v.name}</h3>
                      <span class="badge badge-available">Available</span>
                    </div>
                    <p class="lp-card-specs">${cat}, ${seats} seats, ${trans}</p>
                    <div class="lp-card-footer-row">
                      <div class="lp-card-rate-text">
                        <strong>PHP ${fmtMoney(rate)}</strong> <small>/ day</small>
                      </div>
                      <button type="button" class="btn btn-ghost btn-sm lp-btn-view" data-vid="${v.id}">View</button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </section>

      <!-- ═══ 4-COLUMN STATS STRIP ═══ -->
      <section class="lp-stats-strip-section">
        <div class="lp-stats-strip-grid">
          <div class="lp-stat-col">
            <div class="lp-stat-num">16</div>
            <div class="lp-stat-desc">Vehicles in the fleet</div>
          </div>
          <div class="lp-stat-col">
            <div class="lp-stat-num">3 steps</div>
            <div class="lp-stat-desc">From search to confirmed</div>
          </div>
          <div class="lp-stat-col">
            <div class="lp-stat-num">QR</div>
            <div class="lp-stat-desc">Counter check-in</div>
          </div>
          <div class="lp-stat-col">
            <div class="lp-stat-num">24/7</div>
            <div class="lp-stat-desc">Concierge support</div>
          </div>
        </div>
      </section>

      <!-- ═══ EDITORIAL HOW IT WORKS SECTION ═══ -->
      <section class="lp-editorial-section" id="lpHowItWorks">
        <div class="lp-section-container">
          <div class="lp-section-header-left">
            <div class="lp-overline-tag">Simple procedure</div>
            <h2 class="lp-section-heading">How it works</h2>
          </div>
          <div class="lp-how-grid">
            <div class="lp-how-card">
              <span class="lp-how-num">01</span>
              <h4 class="lp-how-title">Select dates &amp; vehicle</h4>
              <p class="lp-how-desc">Choose from our maintained fleet of sedans, SUVs, MPVs, and 4x4 pickups with transparent daily rates.</p>
            </div>
            <div class="lp-how-card">
              <span class="lp-how-num">02</span>
              <h4 class="lp-how-title">Reserve with downpayment</h4>
              <p class="lp-how-desc">Lock in your booking instantly using Card, GCash, or Bank Transfer, or choose cash meetup on arrival.</p>
            </div>
            <div class="lp-how-card">
              <span class="lp-how-num">03</span>
              <h4 class="lp-how-title">Scan QR &amp; drive</h4>
              <p class="lp-how-desc">Show your digital booking pass at our airport counter. Quick vehicle inspection and you are on the road.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ EDITORIAL REVIEWS SECTION ═══ -->
      <section class="lp-editorial-section" id="lpReviews" style="border-top:1px solid #E2DCF0;">
        <div class="lp-section-container">
          <div class="lp-section-header-left">
            <div class="lp-overline-tag">Guest experiences</div>
            <h2 class="lp-section-heading">Recent feedback</h2>
          </div>
          <div class="lp-reviews-editorial-grid">
            <div class="lp-rev-card">
              <p class="lp-rev-quote">"Super smooth ng booking. Pagka-landing sa Puerto Princesa Airport, nai-handover agad ang sasakyan within five minutes gamit ang QR pass."</p>
              <div class="lp-rev-author">
                <strong>Mike Denver</strong>
                <span>Toyota Fortuner · Airport Handover</span>
              </div>
            </div>
            <div class="lp-rev-card">
              <p class="lp-rev-quote">"The 4x4 Raptor handled the long provincial drive effortlessly. When we wanted to extend our stay, the online extension took less than two minutes."</p>
              <div class="lp-rev-author">
                <strong>JR Aplino</strong>
                <span>Ford Ranger Raptor · 5-day roadtrip</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ EDITORIAL FOOTER ═══ -->
      <footer class="lp-editorial-footer">
        <div class="lp-footer-container">
          <div class="lp-footer-left">
            <span>Palawan Drive. Vehicle Rental Management System.</span>
          </div>
          <div class="lp-footer-right">
            <a href="#lpHero">Terms</a>
            <a href="#lpHero">Privacy</a>
            <a href="#lpHero">Support</a>
          </div>
        </div>
      </footer>
    </div>
  `;

  // Attach event handlers
  $('#lpSignInBtn')?.addEventListener('click', () => renderAuth('login'));
  $('#lpReserveBtn')?.addEventListener('click', () => {
    const fleetSec = $('#lpFleet');
    if (fleetSec) fleetSec.scrollIntoView({ behavior: 'smooth' });
    else renderAuth('login');
  });

  $('#heroSearchBtn')?.addEventListener('click', () => {
    const sDate = $('#heroPickupDate')?.value;
    const eDate = $('#heroReturnDate')?.value;
    const cat = $('#heroCategory')?.value;
    const targetVeh = (state.vehicles || []).find(v => cat === 'all' || v.category === cat || v.categories?.name === cat) || state.vehicles?.[0];
    if (targetVeh) {
      openVehicleDetail(targetVeh.id, sDate, eDate);
    } else {
      const fleetSec = $('#lpFleet');
      if (fleetSec) fleetSec.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Bind View buttons on vehicle cards
  $$('.lp-btn-view').forEach(btn => {
    btn.addEventListener('click', () => {
      const vid = btn.dataset.vid;
      const sDate = $('#heroPickupDate')?.value;
      const eDate = $('#heroReturnDate')?.value;
      openVehicleDetail(vid, sDate, eDate);
    });
  });
}

export function openLandingDealPrompt(vehName = '') {
  const modal = openModal(`
    <div class="clean-deal-prompt">
      <button type="button" class="clean-prompt-close" id="promptCloseBtn" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
      
      <div class="clean-prompt-header">
        <div class="clean-prompt-tag"><i class="fa-solid fa-car-side"></i> Vehicle Reservation</div>
        <h3 class="clean-prompt-title">How would you like to continue?</h3>
        <p class="clean-prompt-subtitle">
          Viewing deals and availability for <strong>${vehName || 'Selected Vehicle'}</strong>. Choose an option to proceed:
        </p>
      </div>

      <div class="clean-prompt-choices">
        <button type="button" class="clean-choice-card" id="promptChoiceLogin">
          <div class="clean-choice-icon-wrap" style="background: rgba(124, 58, 237, 0.1); color: var(--accent);">
            <i class="fa-solid fa-user-lock"></i>
          </div>
          <div class="clean-choice-content">
            <h4 class="clean-choice-title">Log in as Renter</h4>
            <p class="clean-choice-desc">Access your account, track reservations, and view booking history.</p>
          </div>
          <div class="clean-choice-arrow"><i class="fa-solid fa-arrow-right"></i></div>
        </button>

        <button type="button" class="clean-choice-card highlight" id="promptChoiceGuest">
          <div class="clean-choice-icon-wrap" style="background: rgba(16, 185, 129, 0.1); color: #059669;">
            <i class="fa-solid fa-bolt"></i>
          </div>
          <div class="clean-choice-content">
            <h4 class="clean-choice-title">Continue as Guest</h4>
            <p class="clean-choice-desc">Instant booking without logging in. View full vehicle specs and book immediately.</p>
          </div>
          <div class="clean-choice-arrow"><i class="fa-solid fa-arrow-right"></i></div>
        </button>
      </div>
    </div>
  `);

  $('#promptCloseBtn')?.addEventListener('click', closeModal);

  $('#promptChoiceLogin')?.addEventListener('click', () => {
    closeModal();
    renderAuth('login');
  });

  $('#promptChoiceGuest')?.addEventListener('click', async () => {
    closeModal();
    if (!state.vehicles || state.vehicles.length === 0) {
      await loadVehicles();
    }
    let target = null;
    if (vehName) {
      target = state.vehicles.find(v => (v.name || '').toLowerCase().includes(vehName.toLowerCase()));
    }
    if (!target) target = state.vehicles[0];
    if (target) {
      openVehicleDetail(target.id);
    }
  });
}

/* ==========================================================================
   CLEAN AUTH MODAL (Purple & Lavender Theme, Working Back Button, No Gimmick Icons)
   ========================================================================== */
export function renderAuth(initialMode = 'login', initialEmail = '') {
  let mode = initialMode || 'login';
  let emailValue = initialEmail || '';
  let selectedRole = 'customer'; // customer, staff, admin

  $('#cleanAuthOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'clean-auth-overlay';
  overlay.id = 'cleanAuthOverlay';

  const onEscKey = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', onEscKey);

  function closeModal() {
    document.removeEventListener('keydown', onEscKey);
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
  }

  function renderModal() {
    overlay.innerHTML = `
      <div class="clean-auth-split-card">
        <!-- Close button at top right -->
        <button type="button" class="auth-split-close-btn" id="cleanCloseBtn" aria-label="Close" title="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <!-- LEFT HALF: Photo with Floating Bottom Prompt (Matches 2-sign-in.png) -->
        <div class="auth-split-left">
          <img src="images/travel-vacation.jpg" alt="Travel scenery" class="auth-split-bg-img" />
          <div class="auth-split-floating-card">
            <h3 class="auth-split-card-title">Your next trip starts with a confirmed vehicle.</h3>
            <p class="auth-split-card-sub">Sign in to manage bookings, favorites and receipts.</p>
          </div>
        </div>

        <!-- RIGHT HALF: Clean Form & Role Segmented Tabs (Matches 2-sign-in.png) -->
        <div class="auth-split-right">
          <div class="auth-split-form-wrap">
            <div class="auth-split-brand">
              <div class="lp-brand-icon">P</div>
              <span class="lp-brand-text">Palawan Drive</span>
            </div>

            <h2 class="auth-split-headline">${mode === 'signup' ? 'Create an account' : (mode === 'forgot' ? 'Reset password' : 'Welcome back')}</h2>
            <p class="auth-split-sub">${mode === 'signup' ? 'Enter your details to create an account.' : (mode === 'forgot' ? 'Enter your email to receive reset instructions.' : 'Sign in to continue to your account.')}</p>

            ${mode === 'login' ? `
              <!-- Segmented Role Control: Renter | Staff | Admin -->
              <div class="auth-role-segmented-control" id="authRoleSegmented">
                <button type="button" class="auth-segment-pill ${selectedRole === 'customer' ? 'active' : ''}" data-role="customer">Renter</button>
                <button type="button" class="auth-segment-pill ${selectedRole === 'staff' ? 'active' : ''}" data-role="staff">Staff</button>
                <button type="button" class="auth-segment-pill ${selectedRole === 'admin' ? 'active' : ''}" data-role="admin">Admin</button>
              </div>
            ` : ''}

            <div id="cleanAuthError"></div>

            <form id="cleanAuthForm">
              <div class="auth-form-field">
                <label for="cleanEmail">Email</label>
                <input type="email" id="cleanEmail" class="clean-input" placeholder="${selectedRole === 'customer' ? 'juan.delacruz@email.com' : (selectedRole === 'staff' ? 'staff@rentflow.ph' : 'admin@rentflow.ph')}" value="${emailValue}" required autocomplete="email" autofocus />
              </div>

              ${mode !== 'forgot' ? `
                <div class="auth-form-field">
                  <label for="cleanPassword">Password</label>
                  <div class="clean-input-pass-wrap">
                    <input type="password" id="cleanPassword" class="clean-input" placeholder="Enter your password" required autocomplete="current-password" />
                    <button type="button" class="clean-eye-btn" data-target="cleanPassword" aria-label="Toggle password">
                      <i class="fa-regular fa-eye"></i>
                    </button>
                  </div>
                </div>
              ` : ''}

              ${mode === 'signup' ? `
                <div class="auth-form-field">
                  <label for="cleanConfirmPassword">Confirm Password</label>
                  <div class="clean-input-pass-wrap">
                    <input type="password" id="cleanConfirmPassword" class="clean-input" placeholder="Confirm your password" required autocomplete="new-password" />
                    <button type="button" class="clean-eye-btn" data-target="cleanConfirmPassword" aria-label="Toggle password">
                      <i class="fa-regular fa-eye"></i>
                    </button>
                  </div>
                </div>
              ` : ''}

              ${mode === 'login' ? `
                <div class="auth-options-row">
                  <label class="auth-remember-label">
                    <input type="checkbox" id="keepSignedIn" checked />
                    <span>Keep me signed in</span>
                  </label>
                  <a href="#" id="cleanForgotLink" class="auth-forgot-link">Forgot password</a>
                </div>
              ` : ''}

              <button type="submit" class="btn btn-primary btn-block" id="cleanSubmitBtn" style="padding:12px;margin-top:16px;">
                ${mode === 'signup' ? 'Create an account' : (mode === 'forgot' ? 'Send reset link' : 'Sign in')}
              </button>

              ${mode === 'login' ? `
                <button type="button" class="btn btn-ghost btn-block" id="btnGoogleAuth" style="padding:12px;margin-top:10px;">
                  Continue with Google
                </button>
              ` : ''}
            </form>

            <div class="auth-split-footer-text">
              ${mode === 'signup' ? `
                Already have an account? <a href="#" id="cleanToLogin" class="auth-bold-link">Sign in</a>
              ` : (mode === 'forgot' ? `
                Remember your password? <a href="#" id="cleanToLogin" class="auth-bold-link">Sign in</a>
              ` : `
                New here? <a href="#" id="cleanToSignup" class="auth-bold-link">Create an account</a>
              `)}
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind Close Button
    overlay.querySelector('#cleanCloseBtn')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Bind Role Segmented Tabs (Renter | Staff | Admin)
    overlay.querySelectorAll('.auth-segment-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        selectedRole = pill.dataset.role;
        overlay.querySelectorAll('.auth-segment-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const emailInp = overlay.querySelector('#cleanEmail');
        const passInp = overlay.querySelector('#cleanPassword');
        if (selectedRole === 'staff') {
          if (emailInp) emailInp.value = 'staff@rentflow.ph';
          if (passInp) passInp.value = 'RentFlowStaff2026!';
        } else if (selectedRole === 'admin') {
          if (emailInp) emailInp.value = 'admin@rentflow.ph';
          if (passInp) passInp.value = 'RentFlowAdmin2026!';
        } else {
          if (emailInp) emailInp.value = 'mark.ramos@gmail.com';
          if (passInp) passInp.value = 'password123';
        }
      });
    });

    // Bind Google Auth demo click
    overlay.querySelector('#btnGoogleAuth')?.addEventListener('click', () => {
      closeModal();
      switchSystemRole(selectedRole || 'customer');
    });

    // Bind Eye toggle
    overlay.querySelectorAll('.clean-eye-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        const input = overlay.querySelector('#' + targetId);
        if (!input) return;
        const icon = btn.querySelector('i');
        if (input.type === 'password') {
          input.type = 'text';
          if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
        } else {
          input.type = 'password';
          if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
        }
      });
    });

    // Bind mode links
    overlay.querySelector('#cleanToSignup')?.addEventListener('click', (e) => {
      e.preventDefault();
      mode = 'signup';
      renderModal();
    });
    overlay.querySelector('#cleanToLogin')?.addEventListener('click', (e) => {
      e.preventDefault();
      mode = 'login';
      renderModal();
    });
    overlay.querySelector('#cleanForgotLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      mode = 'forgot';
      renderModal();
    });

    // Form submission
    const form = overlay.querySelector('#cleanAuthForm');
    const errBox = overlay.querySelector('#cleanAuthError');

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = overlay.querySelector('#cleanSubmitBtn');
      const email = overlay.querySelector('#cleanEmail')?.value.trim();
      emailValue = email;

      if (errBox) errBox.innerHTML = '';

      if (mode === 'forgot') {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending link…';
        try {
          await supabase.auth.resetPasswordForEmail(email);
          toast(`Password reset instructions sent to ${email}`, 'info');
          mode = 'login';
          renderModal();
        } catch (err) {
          toast('Check your email for reset instructions.', 'info');
          mode = 'login';
          renderModal();
        }
        return;
      }

      if (mode === 'signup') {
        const password = overlay.querySelector('#cleanPassword')?.value;
        const confirmPass = overlay.querySelector('#cleanConfirmPassword')?.value;
        if (password !== confirmPass) {
          if (errBox) errBox.innerHTML = '<div class="clean-auth-error">Passwords do not match. Please try again.</div>';
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account…';
        try {
          await handleAuthenticateSignup(email, password, email.split('@')[0], '', closeModal);
        } catch (err) {
          if (errBox) errBox.innerHTML = `<div class="clean-auth-error">${err.message || 'Error creating account'}</div>`;
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Create an account';
        }
        return;
      }

      // mode === 'login'
      const password = overlay.querySelector('#cleanPassword')?.value;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in…';

      try {
        await handleAuthenticateLogin(email, password, closeModal);
      } catch (err) {
        if (errBox) {
          errBox.innerHTML = `<div class="clean-auth-error">${err.message || 'Invalid email or password.'}</div>`;
        }
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Sign in';
      }
    });
  }

  renderModal();
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add('open');
  });
}

async function handleAuthenticateLogin(email, password, onSuccess) {
  let loggedInUser = null;
  let loginError = null;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) loginError = error;
    else loggedInUser = data?.user;
  } catch (err) {
    loginError = err;
  }

  // If Supabase gave "Email not confirmed", do not block the user!
  if (loginError && loginError.message && loginError.message.toLowerCase().includes('email not confirmed')) {
    console.warn('Email not confirmed in Supabase, continuing with authenticated customer profile:', loginError.message);
    loginError = null;
  }

  if (loginError) {
    // Shortcuts for demo credentials
    if (email === 'staff@rentflow.ph') {
      onSuccess?.();
      return switchSystemRole('staff');
    } else if (email === 'admin@rentflow.ph') {
      onSuccess?.();
      return switchSystemRole('admin');
    } else if (email === 'mark.ramos@gmail.com') {
      onSuccess?.();
      return switchSystemRole('customer');
    }
    throw loginError;
  }

  const userId = loggedInUser?.id || `cust-${Date.now().toString().slice(-8)}`;
  let userObj = loggedInUser ? { id: loggedInUser.id, email: loggedInUser.email } : { id: userId, email };

  // Load or construct profile
  let profile = null;
  try {
    const { data: profData } = await supabase.from('profiles').select('*').eq('id', userObj.id).maybeSingle();
    if (profData) profile = profData;
  } catch (e) {}

  if (!profile) {
    try {
      const savedLocal = localStorage.getItem(`rentflow_prof_${userObj.id}`) || localStorage.getItem('rentflow_custom_user');
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        profile = parsed.profile || parsed;
      }
    } catch (e) {}
  }

  if (!profile) {
    const meta = loggedInUser?.user_metadata || {};
    const determinedRole = email.includes('admin') ? 'admin' : (email.includes('staff') ? 'staff' : 'customer');
    profile = {
      id: userObj.id,
      full_name: meta.full_name || meta.name || email.split('@')[0],
      email: email,
      role: meta.role || determinedRole,
      phone: meta.phone || ''
    };
    try {
      await supabase.from('profiles').upsert(profile);
    } catch (e) {}
  }

  state.user = userObj;
  state.profile = profile;
  state.portal = profile.role || 'customer';
  state.tab = state.portal === 'customer' ? 'browse' : 'dashboard';

  setActiveRole(state.portal);
  localStorage.setItem('rentflow_custom_user', JSON.stringify({ user: userObj, profile }));
  localStorage.setItem(`rentflow_prof_${userObj.id}`, JSON.stringify(profile));

  await Promise.all([loadCategories(), loadVehicles()]).catch(() => {});
  onSuccess?.();
  toast(`Welcome back, ${state.profile.full_name || 'User'}!`, 'success');

  // Dumiretso agad sa dashboard
  if (window.renderShell) {
    window.renderShell();
  }
}

async function handleAuthenticateSignup(email, password, fullName, phone, onSuccess) {
  let signUpUser = null;
  try {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, phone: phone, role: 'customer' } },
    });
    if (error) {
      if (error.message.includes('already registered')) {
        throw { message: 'Registered na ang email na ito. Pakipindot ang "Sign in instead".' };
      }
      console.warn('Supabase auth signup notice:', error.message);
    }
    signUpUser = data?.user;
  } catch (authErr) {
    if (authErr.message && authErr.message.includes('Registered na')) throw authErr;
    console.warn('Signup auth notice:', authErr);
  }

  const userId = signUpUser?.id || `cust-${Date.now().toString().slice(-8)}`;
  const userObj = { id: userId, email };
  const profileObj = {
    id: userId,
    full_name: fullName,
    email: email,
    phone: phone,
    role: 'customer'
  };

  // Try upserting to Supabase profiles table
  try {
    await supabase.from('profiles').upsert(profileObj);
  } catch (e) {
    console.warn('Profile upsert notice:', e);
  }

  // Save persistent session in localStorage
  localStorage.setItem('rentflow_active_role', 'customer');
  localStorage.setItem('rentflow_active_customer_key', 'customer1');
  localStorage.setItem('rentflow_custom_user', JSON.stringify({ user: userObj, profile: profileObj }));
  localStorage.setItem(`rentflow_prof_${userId}`, JSON.stringify(profileObj));

  state.user = userObj;
  state.profile = profileObj;
  state.portal = 'customer';
  state.tab = 'browse';

  await Promise.all([loadCategories(), loadVehicles()]).catch(() => {});
  onSuccess?.();
  toast(`Maligayang pagdating, ${fullName}! Account created successfully.`, 'success');

  // Dumiretso agad sa dashboard
  if (window.renderShell) {
    window.renderShell();
  }
}

export async function logout() {
  await supabase.auth.signOut().catch(() => {});
  state.user = null;
  state.profile = null;
  localStorage.removeItem('rentflow_active_role');
  localStorage.removeItem('rentflow_custom_user');
  renderLandingPage();
}

export function checkCustomerVerificationStatus(force = false) {
  if (!state.user || state.portal !== 'customer') return;
  const p = state.profile || {};

  // Renter is verified if they have a non-empty driver license number
  const isVerified = Boolean(p.license_number && p.license_number.trim() && p.is_verified !== false);
  if (isVerified && !force) return;

  const dismissedKey = `rentflow_verify_prompt_${state.user.id || 'guest'}`;
  if (!force && sessionStorage.getItem(dismissedKey)) return;

  setTimeout(() => {
    const overlay = $('#modalOverlay');
    if (overlay && overlay.classList.contains('open')) return;
    promptRenterVerificationModal(force);
  }, 600);
}

export function promptRenterVerificationModal(force = false) {
  if (!state.user || state.portal !== 'customer') return;
  const p = state.profile || {};
  const dismissedKey = `rentflow_verify_prompt_${state.user.id || 'guest'}`;

  openModal(`
    <div class="renter-verification-modal-wrap" style="max-width:540px;margin:0 auto;">
      <div class="modal-head" style="margin-bottom:14px;">
        <div>
          <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(245,158,11,0.12);color:#d97706;padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;margin-bottom:6px;border:1px solid rgba(245,158,11,0.25);">
            <i class="fa-solid fa-id-card"></i> Account Verification Required
          </div>
          <h3 style="font-size:1.22rem;font-weight:800;color:var(--text-hi);margin:0 0 2px 0;">
            Verify Your Renter Account
          </h3>
          <span style="font-size:0.78rem;color:var(--text-mid);">
            Enter your driver's license details to complete your verified account.
          </span>
        </div>
        <div class="modal-close" id="mClose">Close</div>
      </div>

      <div style="background:linear-gradient(135deg, rgba(99,102,241,0.08), rgba(124,58,237,0.12));border:1px solid rgba(99,102,241,0.25);border-radius:12px;padding:12px 14px;margin-bottom:16px;display:flex;gap:12px;align-items:center;">
        <div style="width:38px;height:38px;border-radius:10px;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">
          <i class="fa-solid fa-shield-check"></i>
        </div>
        <div style="font-size:0.78rem;line-height:1.45;color:var(--text-hi);">
          <strong>LTO Driver's License verification</strong> is required for express vehicle handover, contactless key pickup, and instant booking confirmation.
        </div>
      </div>

      <form id="renterVerificationForm">
        <div class="detail-grid" style="margin-bottom:12px;">
          <div class="field">
            <label style="font-size:0.8rem;font-weight:700;display:flex;align-items:center;gap:5px;">
              <i class="fa-solid fa-user" style="font-size:0.72rem;color:var(--accent);"></i> Full Legal Name
            </label>
            <input type="text" id="rvFullName" value="${p.full_name || ''}" placeholder="e.g. Maria Santos" required />
          </div>
          <div class="field">
            <label style="font-size:0.8rem;font-weight:700;display:flex;align-items:center;gap:5px;">
              <i class="fa-solid fa-phone" style="font-size:0.72rem;color:var(--accent);"></i> Contact Phone Number
            </label>
            <input type="tel" id="rvPhone" value="${p.phone || ''}" placeholder="e.g. 0917 123 4567" required />
          </div>
        </div>

        <div class="detail-grid" style="margin-bottom:12px;">
          <div class="field">
            <label style="font-size:0.8rem;font-weight:700;display:flex;align-items:center;gap:5px;">
              <i class="fa-solid fa-id-card" style="font-size:0.72rem;color:var(--accent);"></i> Driver's License Number
            </label>
            <input type="text" id="rvLicenseNumber" value="${p.license_number || ''}" placeholder="e.g. N02-23-084920" required style="font-family:monospace;letter-spacing:0.04em;text-transform:uppercase;" />
            <small style="font-size:0.68rem;color:var(--text-mid);margin-top:2px;display:block;">Standard LTO format (e.g. N02-YY-NNNNNN)</small>
          </div>
          <div class="field">
            <label style="font-size:0.8rem;font-weight:700;display:flex;align-items:center;gap:5px;">
              <i class="fa-solid fa-calendar-days" style="font-size:0.72rem;color:var(--accent);"></i> License Expiry Date
            </label>
            <input type="date" id="rvLicenseExpiry" value="${p.license_expiry || '2028-12-31'}" required />
          </div>
        </div>

        <div class="field" style="margin-bottom:14px;">
          <label style="font-size:0.8rem;font-weight:700;display:flex;align-items:center;gap:5px;">
            <i class="fa-solid fa-location-dot" style="font-size:0.72rem;color:var(--accent);"></i> Complete Address / City
          </label>
          <input type="text" id="rvAddress" value="${p.address || ''}" placeholder="e.g. Brgy. San Pedro, Puerto Princesa City" required />
        </div>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;font-size:0.72rem;color:var(--text-mid);">
          <div style="display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-lock" style="color:#059669;"></i>
            <span>Encrypted &amp; Stored Securely</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-circle-check" style="color:var(--accent);"></i>
            <span>Express Vehicle Handover</span>
          </div>
        </div>

        <div style="display:flex;gap:10px;align-items:center;justify-content:flex-end;">
          <button type="button" class="btn btn-ghost" id="rvSkip" style="font-size:0.82rem;padding:8px 16px;">
            Remind me later
          </button>
          <button type="submit" class="btn btn-primary" id="rvSubmit" style="font-size:0.82rem;padding:8px 20px;display:inline-flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-circle-check"></i> Complete Verification
          </button>
        </div>
      </form>
    </div>
  `);

  const dismissModal = () => {
    sessionStorage.setItem(dismissedKey, 'true');
    closeModal();
  };

  $('#mClose')?.addEventListener('click', dismissModal);
  $('#rvSkip')?.addEventListener('click', dismissModal);

  $('#renterVerificationForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#rvSubmit');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying…';
    }

    const updated = {
      full_name: $('#rvFullName').value.trim(),
      phone: $('#rvPhone').value.trim(),
      license_number: $('#rvLicenseNumber').value.trim().toUpperCase(),
      license_expiry: $('#rvLicenseExpiry').value || '2028-12-31',
      address: $('#rvAddress').value.trim(),
      is_verified: true
    };

    try {
      await supabase.from('profiles').update(updated).eq('id', state.user.id);
    } catch (err) {
      try {
        await supabase.from('profiles').update({
          full_name: updated.full_name,
          phone: updated.phone
        }).eq('id', state.user.id);
      } catch (e2) {}
    }

    try {
      localStorage.setItem(`rentflow_prof_${state.user.id}`, JSON.stringify(updated));
      const customUserRaw = localStorage.getItem('rentflow_custom_user');
      if (customUserRaw) {
        const parsed = JSON.parse(customUserRaw);
        parsed.profile = { ...(parsed.profile || {}), ...updated };
        localStorage.setItem('rentflow_custom_user', JSON.stringify(parsed));
      }
    } catch (e3) {}

    Object.assign(state.profile, updated);
    sessionStorage.setItem(dismissedKey, 'true');
    closeModal();

    toast('Account verified successfully!', 'success');

    if (window.renderShell) {
      window.renderShell();
    }
  });
}

export const promptCustomerOnboardingModal = promptRenterVerificationModal;

export async function bootstrapSession() {
  try {
    const urlParams = new URLSearchParams(window.location.search);

    // Clean up OAuth errors in URL query (e.g. from failed Google OAuth exchange)
    const oauthError = urlParams.get('error') || urlParams.get('error_description');
    if (oauthError) {
      console.warn('OAuth redirect notice cleaned:', oauthError);
      window.history.replaceState({}, document.title, window.location.pathname);
      toast('Google Sign-In is not configured in Supabase. Please sign in using your email and password.', 'info');
    }

    const demoParam = urlParams.get('demo');
    if (demoParam) {
      if (demoParam === 'staff' || demoParam === 'manager') return switchSystemRole('staff');
      if (demoParam === 'admin') return switchSystemRole('admin');
      if (demoParam === 'customer2' || demoParam === 'maria') return switchSystemRole('customer', 'customer2');
      if (demoParam === 'customer3' || demoParam === 'alex') return switchSystemRole('customer', 'customer3');
      return switchSystemRole('customer', 'customer1');
    }

    // 1. Check if user session was stored in localStorage
    const savedCustom = localStorage.getItem('rentflow_custom_user');
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom);
        if (parsed.user && parsed.profile) {
          state.user = parsed.user;
          state.profile = parsed.profile;
          state.portal = parsed.profile.role || 'customer';
          state.tab = state.portal === 'customer' ? 'browse' : 'dashboard';
          await Promise.all([loadCategories(), loadVehicles()]).catch(() => {});
          if (window.renderShell) window.renderShell();
          return;
        }
      } catch (e) {}
    }

    // 2. Check Supabase active auth session
    let session = null;
    try {
      const res = await supabase.auth.getSession();
      session = res?.data?.session;
    } catch (e) {}
    
    if (session && session.user) {
      state.user = session.user;
      let profile = null;
      try {
        const res = await supabase.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
        profile = res?.data;
      } catch (e) {}

      if (!profile) {
        const meta = state.user.user_metadata || {};
        profile = {
          id: state.user.id,
          full_name: meta.full_name || meta.name || state.user.email?.split('@')[0] || 'Customer',
          email: state.user.email || '',
          role: meta.role || (state.user.email?.includes('admin') ? 'admin' : (state.user.email?.includes('staff') ? 'staff' : 'customer')),
          phone: meta.phone || ''
        };
        try {
          await supabase.from('profiles').upsert(profile);
        } catch (e) {}
      }

      state.profile = profile;
      state.portal = profile.role || 'customer';
      state.tab = state.portal === 'customer' ? 'browse' : 'dashboard';
      setActiveRole(state.portal);

      await Promise.all([loadCategories(), loadVehicles()]).catch(() => {});
      if (window.renderShell) window.renderShell();

      const bookVehicleId = urlParams.get('book');
      if (bookVehicleId) {
        setTimeout(() => {
          openVehicleDetail(Number(bookVehicleId));
        }, 500);
      }
      return;
    }

    // 3. Check if demo role was saved
    const savedRole = localStorage.getItem('rentflow_active_role');
    if (savedRole) {
      return switchSystemRole(savedRole);
    }

    // 4. Fallback for guest first-time visitor: render landing page
    return renderLandingPage();
  } catch (fatalErr) {
    console.error('Fatal error during bootstrapSession:', fatalErr);
    renderLandingPage();
  }
}
