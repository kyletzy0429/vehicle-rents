import { supabase } from './config.js';
import { state, DEMO_ACCOUNTS, getActiveRole, setActiveRole, getActiveCustomerKey, setActiveCustomerKey } from './state.js';
import { $, $$, toast, openModal, closeModal } from './utils.js';
import { loadCategories, loadVehicles } from './vehicles.js';
import { openVehicleDetail } from './booking.js';

let authMode = 'login';

export async function switchSystemRole(role, customerKey = null) {
  if (role === 'customer') {
    const cust = DEMO_ACCOUNTS.customer || DEMO_ACCOUNTS.customer1;
    setActiveRole('customer');
    setActiveCustomerKey('customer1');
    state.user = { id: cust.id, email: cust.email };
    state.profile = { ...cust };
    state.portal = 'customer';
    state.tab = 'browse';
    toast(`Switched to Guest Portal`, 'info');
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

  const vehiclePreviews = [
    { name: 'Toyota Fortuner 2.8 V', cat: 'SUV', seats: 7, img: 'images/fortuner.webp', rate: 4200, desc: 'Premium Diesel SUV with high ground clearance, leather seats, and dual aircon.' },
    { name: 'Toyota Vios 1.5 G CVT', cat: 'Sedan', seats: 5, img: 'images/vios.webp', rate: 2500, desc: 'Fuel-efficient subcompact sedan. Automatic transmission, ideal for city driving.' },
    { name: 'Toyota Innova 2.8 E', cat: 'MPV', seats: 8, img: 'images/innova.webp', rate: 3200, desc: 'Spacious 8-seater MPV with powerful 2.8L Diesel engine and dual AC.' },
    { name: 'Ford Ranger Raptor', cat: 'Pickup', seats: 5, img: 'images/raptor.webp', rate: 4500, desc: 'FOX Racing shocks, 4x4 Off-road mode. Great for heavy loads and adventure.' },
    { name: 'Mitsubishi Xpander GLS', cat: 'Crossover', seats: 7, img: 'images/xpander.webp', rate: 3000, desc: 'Modern crossover MPV with spacious 3-row seating and flexible cargo space.' },
    { name: 'Yamaha NMAX 155 ABS', cat: 'Motorcycle', seats: 2, img: 'images/nmax.webp', rate: 500, desc: '155cc Automatic Maxi Scooter with Variable Valve Actuation and ABS.' },
  ];

  $('#app').innerHTML = `
    <div class="landing-page" data-theme="${isDark ? 'dark' : ''}">

      <!-- ═══ NAVBAR ═══ -->
      <nav class="lp-navbar">
        <div class="lp-navbar-inner">
          <div class="lp-navbar-brand">
            <div class="lp-navbar-logo"><i class="fa-solid fa-car-side"></i></div>
            <div>
              <div class="lp-navbar-title">Vehicle Rental<br>Management System</div>
              <div class="lp-navbar-sub">Realtime Fleet System</div>
            </div>
          </div>
          <div class="lp-navbar-links">
            <a href="#lp-hero" class="lp-nav-link active">Home</a>
            <a href="#lp-about" class="lp-nav-link">About</a>
            <a href="#lp-fleet" class="lp-nav-link">Fleet</a>
            <a href="#lp-perks" class="lp-nav-link">Features</a>
            <a href="#lp-reviews" class="lp-nav-link">Reviews</a>
          </div>
          <div class="lp-navbar-actions">
            <div class="lang-select-pill" title="Language: English">
              <span>EN</span>
              <i class="fa-solid fa-chevron-down" style="font-size:0.6rem;opacity:0.6;"></i>
            </div>
            <button type="button" class="topbar-icon-btn" id="lpThemeToggle" title="Toggle Theme">
              <i class="fa-solid fa-${isDark ? 'sun' : 'moon'}" style="color:${isDark ? '#f59e0b' : 'var(--accent)'};"></i>
            </button>
            <button type="button" class="lp-btn-signin" id="lpSignInBtn">
              <i class="fa-solid fa-arrow-right-to-bracket"></i> Sign in
            </button>
            <button type="button" class="lp-btn-reserve" id="lpReserveBtn">
              <i class="fa-solid fa-calendar-check"></i> Reserve now
            </button>
          </div>
          <button type="button" class="lp-mobile-menu-btn" id="lpMobileMenuBtn" aria-label="Menu">
            <i class="fa-solid fa-bars"></i>
          </button>
        </div>
      </nav>

      <!-- ═══ HERO ═══ -->
      <section class="lp-hero" id="lp-hero">
        <div class="lp-hero-content">
          <div class="lp-hero-tag">✦ PREMIUM FLEET &amp; LIVE SYNC</div>
          <h1 class="lp-hero-headline">Experience<br>Premium Vehicle Rentals &amp;<br><span class="lp-hero-highlight">Realtime Availability</span></h1>
          <p class="lp-hero-desc">Step into world-class convenience with live fleet availability, instant reservations, personalized digital guest services, and 24/7 customer support.</p>
          <div class="lp-hero-btns">
            <a href="#lp-fleet" class="lp-btn-explore">Explore Available Vehicles <i class="fa-solid fa-arrow-down" style="font-size:0.8rem;"></i></a>
            <button type="button" class="lp-btn-signin-hero" id="lpHeroSignIn"><i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In to Reserve</button>
          </div>
          <div class="lp-hero-stats">
            <div class="lp-stat"><span class="lp-stat-val">4.9 <i class="fa-solid fa-star" style="color:#f59e0b;font-size:0.8rem;"></i></span><span class="lp-stat-label">Guest Rating</span></div>
            <div class="lp-stat"><span class="lp-stat-val">100%</span><span class="lp-stat-label">Realtime Sync</span></div>
            <div class="lp-stat"><span class="lp-stat-val">24 / 7</span><span class="lp-stat-label">Personalized Service</span></div>
          </div>
        </div>
        <div class="lp-hero-image-wrap">
          <img src="images/hero-fleet.jpg" alt="Premium Fleet Showroom" class="lp-hero-img" />
          <div class="lp-hero-availability-badge">
            <div class="lp-avail-dot"></div>
            <span class="lp-avail-label">LIVE AVAILABILITY</span>
            <div class="lp-avail-count">12 of 12 Vehicles Ready</div>
            <div class="lp-avail-sub">Instant real-time booking status</div>
          </div>
        </div>
      </section>

      <!-- ═══ ABOUT ═══ -->
      <section class="lp-section" id="lp-about">
        <div class="lp-section-inner">
          <div class="lp-section-tag">PLATFORM OVERVIEW</div>
          <h2 class="lp-section-title">About Vehicle Rental Management System</h2>
          <p class="lp-section-desc">Vehicle Rental Management System is an all-in-one fleet management and guest reservation platform designed to digitize vehicle bookings, live inventory tracking, digital concierge requests, and administrative operations.</p>

          <div class="lp-overview-grid">
            <div class="lp-overview-card">
              <div class="lp-overview-icon"><i class="fa-solid fa-car"></i></div>
              <h3 class="lp-overview-title">Application Purpose</h3>
              <p class="lp-overview-text">The system enables guests to explore our premium fleet of vehicles, view live pricing, make instant reservations, check in contactlessly with QR codes, and submit service requests directly from their personal devices.</p>
            </div>
            <div class="lp-overview-card">
              <div class="lp-overview-icon"><i class="fa-solid fa-lock"></i></div>
              <h3 class="lp-overview-title">Secure Sign-In &amp; Data Use</h3>
              <p class="lp-overview-text">We use secure authentication to verify guest identities and associate vehicle reservations with your user account. We access only your basic profile (name and email) to issue booking confirmations and digital passes.</p>
            </div>
            <div class="lp-overview-card">
              <div class="lp-overview-icon"><i class="fa-solid fa-bolt"></i></div>
              <h3 class="lp-overview-title">Real-Time Cloud Sync</h3>
              <p class="lp-overview-text">Connected to real-time cloud data, our system ensures instant synchronization between guest bookings, fleet dispatch statuses, maintenance tasks, and digital payment receipts.</p>
            </div>
          </div>

          <div class="lp-privacy-banner">
            <div>
              <div class="lp-privacy-title">Privacy &amp; Data Transparency</div>
              <div class="lp-privacy-sub">We value your privacy and comply with strict data protection standards. Review our official policies at any time:</div>
            </div>
            <div class="lp-privacy-btns">
              <button type="button" class="lp-btn-outline">Privacy Policy</button>
              <button type="button" class="lp-btn-outline">Terms of Service</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ FEATURED FLEET ═══ -->
      <section class="lp-section lp-section-fleet" id="lp-fleet">
        <div class="lp-section-inner">
          <div class="lp-section-tag">REALTIME INVENTORY</div>
          <h2 class="lp-section-title">Featured Vehicles &amp; Fleet</h2>
          <p class="lp-section-desc">Live pricing and availability directly connected to our fleet database.</p>

          <div class="lp-fleet-grid">
            ${vehiclePreviews.map(v => `
              <div class="lp-fleet-card">
                <div class="lp-fleet-img-wrap">
                  <img src="${v.img}" alt="${v.name}" class="lp-fleet-img" loading="lazy" />
                  <span class="lp-fleet-avail-tag">Available</span>
                </div>
                <div class="lp-fleet-body">
                  <h3 class="lp-fleet-name">${v.name} — ${v.cat}</h3>
                  <div class="lp-fleet-meta">
                    <span><i class="fa-solid fa-users"></i> Max ${v.seats} ${v.seats > 2 ? 'passengers' : 'riders'}</span>
                    <span><i class="fa-solid fa-bolt"></i> Realtime Sync</span>
                  </div>
                  <div class="lp-fleet-price">₱${v.rate.toLocaleString()}.00 <span>/ day</span></div>
                  <p class="lp-fleet-desc">${v.desc}</p>
                  <button type="button" class="lp-btn-booknow" data-lp-book>Book Now</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- ═══ PERKS / FEATURES ═══ -->
      <section class="lp-section" id="lp-perks">
        <div class="lp-section-inner">
          <div class="lp-section-tag">EXCLUSIVE FEATURES</div>
          <h2 class="lp-section-title">World-Class Rental Experience</h2>
          <p class="lp-section-desc">Crafted for convenience, reliability, and unforgettable journeys.</p>

          <div class="lp-perks-grid">
            <div class="lp-perk-card">
              <div class="lp-perk-icon"><i class="fa-solid fa-gauge-high"></i></div>
              <h3>Instant Online Booking</h3>
              <p>Reserve any vehicle in seconds with our real-time availability engine. No phone calls needed.</p>
            </div>
            <div class="lp-perk-card">
              <div class="lp-perk-icon"><i class="fa-solid fa-shield-halved"></i></div>
              <h3>Full Insurance Coverage</h3>
              <p>Every rental includes comprehensive insurance for your total peace of mind on every trip.</p>
            </div>
            <div class="lp-perk-card">
              <div class="lp-perk-icon"><i class="fa-solid fa-key"></i></div>
              <h3>Contactless Key Handover</h3>
              <p>Seamless digital vehicle access, GPS tracking, and digital concierge at your fingertips.</p>
            </div>
            <div class="lp-perk-card">
              <div class="lp-perk-icon"><i class="fa-solid fa-wifi"></i></div>
              <h3>Free Wi-Fi &amp; GPS</h3>
              <p>Complimentary portable Wi-Fi and built-in GPS navigation on all premium vehicle rentals.</p>
            </div>
            <div class="lp-perk-card">
              <div class="lp-perk-icon"><i class="fa-solid fa-truck-pickup"></i></div>
              <h3>Airport Pickup &amp; Delivery</h3>
              <p>Luxury airport pickup and round-the-clock vehicle delivery to your preferred location.</p>
            </div>
            <div class="lp-perk-card">
              <div class="lp-perk-icon"><i class="fa-solid fa-headset"></i></div>
              <h3>24/7 Roadside Assistance</h3>
              <p>Real-time roadside assistance requests and instant emergency support, anytime, anywhere.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ REVIEWS ═══ -->
      <section class="lp-section lp-section-reviews" id="lp-reviews">
        <div class="lp-section-inner">
          <div class="lp-section-tag">GUEST EXPERIENCES</div>
          <h2 class="lp-section-title">What Our Customers Say</h2>
          <p class="lp-section-desc">Real reviews from verified renters.</p>

          <div class="lp-reviews-grid">
            <div class="lp-review-card">
              <div class="lp-review-head"><span class="lp-stars">★★★★★</span><span class="lp-review-badge"><i class="fa-solid fa-comment"></i> GENERAL</span></div>
              <p class="lp-review-text">"Ganda ng place at mababait ang staffs! Super smooth ng booking process, walang hassle."</p>
              <div class="lp-reviewer">Aira Apolinar</div>
              <div class="lp-review-role">Verified Guest</div>
              <div class="lp-review-ago">18d ago</div>
            </div>
            <div class="lp-review-card">
              <div class="lp-review-head"><span class="lp-stars">★★★★☆</span><span class="lp-review-badge lp-badge-purple"><i class="fa-solid fa-car"></i> FLEET</span></div>
              <p class="lp-review-text">"Great vehicle condition and wonderful customer service. The Fortuner was immaculate. Will definitely book again next season."</p>
              <div class="lp-reviewer">David Chen</div>
              <div class="lp-review-role">Verified Guest</div>
              <div class="lp-review-ago">19d ago</div>
            </div>
            <div class="lp-review-card">
              <div class="lp-review-head"><span class="lp-stars">★★★★★</span><span class="lp-review-badge" style="border-color:#f59e0b;color:#f59e0b;"><i class="fa-solid fa-concierge-bell"></i> SERVICE</span></div>
              <p class="lp-review-text">"The real-time reservation and instant vehicle availability made booking effortless. Stunning fleet and exceptional staff!"</p>
              <div class="lp-reviewer">Sophia Martinez</div>
              <div class="lp-review-role">Verified Guest</div>
              <div class="lp-review-ago">20d ago</div>
            </div>
            <div class="lp-review-card">
              <div class="lp-review-head"><span class="lp-stars">★★★★★</span><span class="lp-review-badge"><i class="fa-solid fa-car"></i> FLEET</span></div>
              <p class="lp-review-text">"Flawless vehicle rental system. Everything from service requests to payment was smooth and instantaneous."</p>
              <div class="lp-reviewer">Alexander Wright</div>
              <div class="lp-review-role">Verified Guest</div>
              <div class="lp-review-ago">21d ago</div>
            </div>
            <div class="lp-review-card">
              <div class="lp-review-head"><span class="lp-stars">★★★★★</span><span class="lp-review-badge"><i class="fa-solid fa-comment"></i> GENERAL</span></div>
              <p class="lp-review-text">"Modern, elegant, and super fast! The live updates for reservations and dispatching kept us feeling pampered throughout."</p>
              <div class="lp-reviewer">Elena &amp; Mark Vance</div>
              <div class="lp-review-role">Verified Guest</div>
              <div class="lp-review-ago">22d ago</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ FOOTER ═══ -->
      <footer class="lp-footer">
        <div class="lp-footer-inner">
          <div class="lp-footer-brand">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <div class="lp-navbar-logo" style="width:42px;height:42px;font-size:1.1rem;"><i class="fa-solid fa-car-side"></i></div>
              <span style="font-size:1.1rem;font-weight:800;color:var(--text-hi);">Vehicle Rental Management System</span>
            </div>
            <p style="color:var(--text-mid);font-size:0.88rem;line-height:1.6;max-width:280px;">Where premium fleet meets cutting-edge real-time rental technology.</p>
          </div>
          <div class="lp-footer-col">
            <h4>Navigation</h4>
            <a href="#lp-hero">Home</a>
            <a href="#lp-about">About &amp; Purpose</a>
            <a href="#lp-fleet">Fleet &amp; Pricing</a>
            <a href="#lp-perks">Features</a>
            <a href="#lp-reviews">Guest Reviews</a>
          </div>
          <div class="lp-footer-col">
            <h4>Services &amp; Legal</h4>
            <a href="#">Instant Booking</a>
            <a href="#" id="lpFooterGuest">Guest Portal</a>
            <a href="#" id="lpFooterStaff">Staff &amp; Admin Sign In</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
          <div class="lp-footer-col">
            <h4>Contact &amp; Location</h4>
            <a href="#"><i class="fa-solid fa-location-dot" style="width:16px;"></i> Zone 5, Poblacion, Panabo City</a>
            <a href="#"><i class="fa-solid fa-phone" style="width:16px;"></i> +63 917 123 4567</a>
            <a href="#"><i class="fa-solid fa-envelope" style="width:16px;"></i> support@vehiclerental.ph</a>
          </div>
        </div>
        <div class="lp-footer-bottom">
          © 2026 Vehicle Rental Management System. All rights reserved. Operating in Real-Time.
        </div>
      </footer>
    </div>
  `;

  // Event listeners
  const signInBtns = [
    $('#lpSignInBtn'),
    $('#lpHeroSignIn'),
    $('#lpReserveBtn'),
  ];
  signInBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', () => renderAuth());
  });

  // Theme toggle
  const themeBtn = $('#lpThemeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('rentflow_theme', next);
      renderLandingPage();
    });
  }

  // Book Now buttons on fleet cards → go to auth
  $$('[data-lp-book]').forEach(btn => {
    btn.addEventListener('click', () => renderAuth());
  });

  // Footer shortcuts
  const fg = $('#lpFooterGuest');
  if (fg) fg.addEventListener('click', (e) => { e.preventDefault(); switchSystemRole('customer'); });
  const fs = $('#lpFooterStaff');
  if (fs) fs.addEventListener('click', (e) => { e.preventDefault(); renderAuth(); });

  // Mobile menu
  const mobileBtn = $('#lpMobileMenuBtn');
  const navLinks = document.querySelector('.lp-navbar-links');
  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener('click', () => {
      navLinks.classList.toggle('lp-mobile-open');
    });
  }

  // Smooth scroll for anchor links
  $$('.lp-nav-link, .lp-btn-explore, .lp-footer-col a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
        if (navLinks) navLinks.classList.remove('lp-mobile-open');
      }
    });
  });
}

/* ==========================================================================
   AUTH PAGE — Split layout (form left, image right)
   ========================================================================== */
export function renderAuth() {
  const isDark = (localStorage.getItem('rentflow_theme') || 'light') === 'dark';
  if (isDark) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');

  $('#app').innerHTML = `
    <div class="auth-split">
      <div class="auth-split-left">
        <button type="button" class="auth-back-btn" id="authBackHome">
          <i class="fa-solid fa-arrow-left"></i> Back to Home
        </button>

        <div class="auth-form-container">
          <h1 class="auth-form-title">Sign in</h1>
          ${authMode === 'signup' ? '<p class="auth-form-sub">Already have an account? <a href="#" id="authToggleLogin" style="color:var(--accent);font-weight:700;">Sign in instead</a></p>' : ''}

          <!-- Quick Portal Access -->
          <div class="auth-demo-bar">
            <div class="auth-demo-label">DEMO PORTAL ACCESS</div>
            <div class="auth-demo-btns">
              <button type="button" class="auth-demo-btn" id="quickDemoGuest">Guest</button>
              <button type="button" class="auth-demo-btn" id="quickDemoStaff">Manager</button>
              <button type="button" class="auth-demo-btn" id="quickDemoAdmin">Admin</button>
            </div>
          </div>

          <div id="authError"></div>

          <form id="authForm">
            ${authMode === 'signup' ? `
              <div class="auth-field">
                <label>Full name</label>
                <input type="text" id="fullName" placeholder="e.g. Mark Lester Ramos" required />
              </div>
              <div class="auth-field">
                <label>Contact number</label>
                <input type="tel" id="contactNum" placeholder="e.g. 09171234567" />
              </div>
            ` : ''}

            <div class="auth-field">
              <label>${authMode === 'signup' ? 'Email' : 'E-mail'}</label>
              <input type="email" id="email" placeholder="e.g. user@example.com" required />
            </div>

            <div class="auth-field">
              <label>Password</label>
              <div style="position:relative;">
                <input type="password" id="password" placeholder="••••••••" minlength="6" required />
              </div>
            </div>

            ${authMode === 'signup' ? `
              <div class="auth-field">
                <label>Confirm password</label>
                <input type="password" id="confirmPassword" placeholder="••••••••" minlength="6" required />
              </div>
              <p style="font-size:0.78rem;color:var(--text-mid);margin:0 0 14px 0;">New accounts are registered as guests. Staff and admin accounts are promoted by an administrator.</p>
            ` : `
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <label style="display:flex;align-items:center;gap:6px;font-size:0.84rem;cursor:pointer;margin:0;">
                  <input type="checkbox" id="rememberMe" checked style="accent-color:var(--accent);width:16px;height:16px;" />
                  Remember me
                </label>
                <a href="#" style="font-size:0.84rem;color:var(--accent);font-weight:700;text-decoration:none;">Forgot Password?</a>
              </div>
            `}

            <button type="submit" class="auth-submit-btn" id="authSubmit">
              ${authMode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          ${authMode === 'login' ? `
            <div class="auth-divider">
              <span>OR CONTINUE WITH</span>
            </div>
            <button type="button" class="auth-google-btn" id="googleSignInBtn">
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>
            <p style="font-size:0.72rem;color:var(--text-low);text-align:center;margin:12px 0 0 0;line-height:1.5;">
              By continuing with Google, you agree to our <a href="#" style="color:var(--accent);font-weight:700;">Terms of Service</a> and <a href="#" style="color:var(--accent);font-weight:700;">Privacy Policy</a>
            </p>
            <p style="text-align:center;margin-top:20px;font-size:0.88rem;color:var(--text-mid);">
              Don't have an account? <a href="#" id="authToggleSignup" style="color:var(--text-hi);font-weight:700;text-decoration:underline;">Create now</a>
            </p>
          ` : ''}
        </div>
      </div>

      <div class="auth-split-right">
        <img src="images/hero-fleet.jpg" alt="Premium Fleet" class="auth-hero-img" />
        <div class="auth-hero-overlay">
          <h2 class="auth-hero-tagline">Every ride, elegantly managed.</h2>
          <p class="auth-hero-sub">From pick-up to drop-out, one system keeps your fleet, guests, and staff perfectly in sync.</p>
        </div>
        <div class="auth-rating-badge">
          <div class="auth-rating-label">GUEST RATING</div>
          <div class="auth-rating-val">4.9 <span>/ 5</span></div>
        </div>
      </div>
    </div>
  `;

  // Back to home
  $('#authBackHome').addEventListener('click', () => renderLandingPage());

  // Demo quick access
  const qg = $('#quickDemoGuest');
  if (qg) qg.addEventListener('click', () => switchSystemRole('customer'));
  const qs = $('#quickDemoStaff');
  if (qs) qs.addEventListener('click', () => switchSystemRole('staff'));
  const qa = $('#quickDemoAdmin');
  if (qa) qa.addEventListener('click', () => switchSystemRole('admin'));

  // Toggle auth mode
  const toggleSignup = $('#authToggleSignup');
  if (toggleSignup) toggleSignup.addEventListener('click', (e) => { e.preventDefault(); authMode = 'signup'; renderAuth(); });
  const toggleLogin = $('#authToggleLogin');
  if (toggleLogin) toggleLogin.addEventListener('click', (e) => { e.preventDefault(); authMode = 'login'; renderAuth(); });

  // Google sign in (Supabase OAuth)
  const googleBtn = $('#googleSignInBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      try {
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
        if (error) toast(error.message, 'error');
      } catch (err) {
        toast('Google Sign-In is not configured yet.', 'info');
      }
    });
  }

  // Form submit
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
        const confirmPw = $('#confirmPassword')?.value;
        if (confirmPw && confirmPw !== password) {
          throw { message: 'Passwords do not match.' };
        }
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, role: 'customer' } },
        });
        if (error) throw error;
        toast('Account created! Logging you in…', 'success');
      }
      await bootstrapSession();
    } catch (err) {
      const errMsg = err.message || 'An error occurred';
      $('#authError').innerHTML = `<div class="auth-error-msg">${errMsg.includes('Invalid') ? 'Maling email o password. Pakisuri at subukan muli.' : errMsg}</div>`;
      submitBtn.disabled = false;
    }
  });
}

export async function logout() {
  await supabase.auth.signOut();
  state.user = null;
  state.profile = null;
  localStorage.removeItem('rentflow_active_role');
  renderLandingPage();
}

export function promptCustomerOnboardingModal(force = false) {
  if (!state.user || state.portal !== 'customer') return;
  const p = state.profile || {};

  const isComplete = Boolean(p.phone);
  if (isComplete && !force) return;

  const dismissedKey = `rentflow_onboarding_seen_${state.user.id}`;
  if (!force && sessionStorage.getItem(dismissedKey)) return;

  openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-hi);margin:0;">Complete Contact Information</h3>
        <span style="font-size:0.75rem;color:var(--text-mid);">For fast booking notifications &amp; handover coordination</span>
      </div>
      <div class="modal-close" id="mClose">Close</div>
    </div>

    <div style="background:var(--accent-glow);border:1px solid var(--accent-blue);border-radius:10px;padding:12px 14px;margin-bottom:18px;">
      <p style="margin:0;font-size:0.82rem;color:var(--text-hi);line-height:1.4;">
        Welcome to <strong>Vehicle Rental Management System</strong>! Please provide your phone number so our team can coordinate with you. <em>Note: Your physical driver's license will be verified in-person upon vehicle pickup / meetup.</em>
      </p>
    </div>

    <form id="onboardingForm">
      <div class="detail-grid" style="margin-bottom:14px;">
        <div class="field">
          <label>Full Name</label>
          <input type="text" id="obName" value="${p.full_name ?? ''}" placeholder="e.g. Mark Lester Ramos" required />
        </div>
        <div class="field">
          <label>Phone Number</label>
          <input type="tel" id="obPhone" value="${p.phone ?? ''}" placeholder="e.g. 0917 582 9140" required />
        </div>
      </div>
      <div class="field" style="margin-bottom:16px;">
        <label>Address (Optional)</label>
        <input type="text" id="obAddress" value="${p.address ?? ''}" placeholder="e.g. Panabo City, Davao del Norte" />
      </div>
      <div style="display:flex;gap:10px;">
        <button type="button" class="btn btn-ghost" id="obSkip" style="flex:1;">Skip for Now</button>
        <button type="submit" class="btn btn-primary" style="flex:2;">Save &amp; Continue</button>
      </div>
    </form>
  `);

  $('#mClose').addEventListener('click', () => { sessionStorage.setItem(dismissedKey, 'true'); closeModal(); });
  $('#obSkip').addEventListener('click', () => { sessionStorage.setItem(dismissedKey, 'true'); closeModal(); });

  $('#onboardingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const updated = {
      full_name: $('#obName').value.trim(),
      phone: $('#obPhone').value.trim(),
      address: $('#obAddress').value.trim(),
    };

    let { error } = await supabase.from('profiles').update(updated).eq('id', state.user.id);
    if (error) {
      const standardPayload = { full_name: updated.full_name, phone: updated.phone };
      await supabase.from('profiles').update(standardPayload).eq('id', state.user.id).catch(() => { });
    }

    try {
      localStorage.setItem(`rentflow_prof_${state.user.id}`, JSON.stringify(updated));
    } catch (err) { }

    Object.assign(state.profile, updated);
    toast('Contact details saved! You can now proceed to book.', 'success');
    sessionStorage.setItem(dismissedKey, 'true');
    closeModal();
    if (window.renderShell) {
      window.renderShell();
    }
  });
}

export async function bootstrapSession() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const demoParam = urlParams.get('demo');
    if (demoParam) {
      if (demoParam === 'staff' || demoParam === 'manager') return switchSystemRole('staff');
      if (demoParam === 'admin') return switchSystemRole('admin');
      if (demoParam === 'customer2' || demoParam === 'maria') return switchSystemRole('customer', 'customer2');
      if (demoParam === 'customer3' || demoParam === 'alex') return switchSystemRole('customer', 'customer3');
      return switchSystemRole('customer', 'customer1');
    }

    const savedRole = localStorage.getItem('rentflow_active_role');
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    
    // If no session and no saved role → show landing page
    if ((sessionErr || !session) && !savedRole) {
      return renderLandingPage();
    }

    // If no session but user selected a demo role previously, keep that demo role
    if ((sessionErr || !session) && savedRole) {
      return switchSystemRole(savedRole);
    }

    state.user = session.user;

    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', state.user.id).single();
    if (error || !profile) {
      console.error('Profile load error:', error);
      toast('Could not load your profile. Try logging in again.', 'error');
      renderAuth();
      return;
    }

    try {
      const savedExtra = localStorage.getItem(`rentflow_prof_${state.user.id}`);
      if (savedExtra) Object.assign(profile, JSON.parse(savedExtra));
    } catch (e) { }

    state.profile = profile;
    state.portal = profile.role || 'customer';
    try {
      await Promise.all([loadCategories(), loadVehicles()]);
    } catch (loadErr) {
      console.warn('Error loading initial data:', loadErr);
    }
    if (window.renderShell) window.renderShell();

    const bookVehicleId = urlParams.get('book');
    if (bookVehicleId) {
      setTimeout(() => {
        openVehicleDetail(Number(bookVehicleId));
      }, 500);
    }

    if (state.portal === 'customer' && !bookVehicleId) {
      setTimeout(() => {
        promptCustomerOnboardingModal();
      }, 400);
    }
  } catch (fatalErr) {
    console.error('Fatal error during bootstrapSession:', fatalErr);
    renderLandingPage();
  }
}
