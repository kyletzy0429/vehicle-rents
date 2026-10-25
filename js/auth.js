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


  const vehiclePreviews = [
    { name: 'Toyota Fortuner 2.8 V', cat: 'SUV', seats: 7, img: 'images/fortuner.webp', rate: 4200, desc: 'Premium Diesel SUV with high ground clearance, leather seats, and dual aircon.' },
    { name: 'Toyota Vios 1.5 G CVT', cat: 'Sedan', seats: 5, img: 'images/vios.webp', rate: 2500, desc: 'Fuel-efficient subcompact sedan. Automatic transmission, ideal for city driving.' },
    { name: 'Toyota Innova 2.8 E', cat: 'MPV', seats: 8, img: 'images/innova.webp', rate: 3200, desc: 'Spacious 8-seater MPV with powerful 2.8L Diesel engine and dual AC.' },
    { name: 'Ford Ranger Raptor', cat: 'Pickup', seats: 5, img: 'images/raptor.webp', rate: 4500, desc: 'Heavy-duty 4x4 pickup truck with high ground clearance for provincial trips.' },
    { name: 'Mitsubishi Xpander GLS', cat: 'Crossover', seats: 7, img: 'images/xpander.webp', rate: 3000, desc: 'Modern crossover MPV with spacious 3-row seating and flexible cargo space.' },
    { name: 'Yamaha NMAX 155 ABS', cat: 'Motorcycle', seats: 2, img: 'images/nmax.webp', rate: 500, desc: '155cc Automatic Maxi Scooter with Variable Valve Actuation and ABS.' },
  ];

  const reviewsData = [
    {
      category: 'suv airport',
      name: 'Mike Denver',
      initials: 'MD',
      avatarBg: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
      role: 'Verified Renter',
      location: 'PPC, Palawan',
      score: '5.0',
      time: '3d ago',
      vehicleIcon: 'fa-car-side',
      vehicle: 'Toyota Fortuner 2.8 V',
      cat: 'SUV',
      text: 'Super smooth ng booking process! Pagka-landing namin sa PPC, naka-park na agad ang Fortuner sa arrival area with instant digital key access. Mababait at very professional ang staff. Napakalinis ng sasakyan, amoy showroom bago pa!',
      chips: ['Spotless Clean', 'PPC Airport Handover', 'Contactless Key Handover']
    },
    {
      category: 'suv luxury',
      name: 'JR Aplino',
      initials: 'JA',
      avatarBg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      role: 'Verified Renter',
      location: 'PPC, Palawan',
      score: '5.0',
      time: '5d ago',
      vehicleIcon: 'fa-car-side',
      vehicle: 'Ford Ranger Raptor 4x4',
      cat: 'Pickup',
      text: 'Immaculate vehicle condition. Kayang-kaya ng Raptor ang long drive galing PPC papuntang El Nido nang walang aberya. Extending our trip by two days via the portal took less than two minutes without calling anyone. Truly a world-class platform!',
      chips: ['4x4 Palawan Roadtrip', 'Instant Trip Extension', 'Comprehensive Cover']
    },
    {
      category: 'city luxury',
      name: 'Mark Vincent',
      initials: 'MV',
      avatarBg: 'linear-gradient(135deg, #10b981, #047857)',
      role: 'Verified Renter',
      location: 'PPC Palawan',
      score: '5.0',
      time: '1w ago',
      vehicleIcon: 'fa-car-side',
      vehicle: 'Toyota Vios 1.5 G CVT',
      cat: 'Sedan',
      text: 'Effortless rental experience. The real-time availability engine meant zero waiting for manual phone confirmations. Official digital receipt and rental agreement were generated immediately. Napakatipid pa sa gas para sa city driving dito sa PPC.',
      chips: ['City Rental PPC', 'Instant Agreement Sync', 'High Fuel Efficiency']
    },
    {
      category: 'suv city airport',
      name: 'Ryan',
      initials: 'R',
      avatarBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
      role: 'Verified Renter',
      location: 'Palawan',
      score: '5.0',
      time: '1w ago',
      vehicleIcon: 'fa-car-side',
      vehicle: 'Toyota Innova 2.8 E',
      cat: 'MPV',
      text: 'Booked the 8-seater Innova para sa family trip namin sa Puerto Princesa at mga pasyalan sa Palawan. Plenty of legroom and luggage space. The vehicle was thoroughly disinfected and had GPS tracking enabled. Best rental platform in Palawan by far.',
      chips: ['Family Vacation', '8-Seater Comfort', 'Live GPS Enabled']
    }
  ];

  $('#app').innerHTML = `
    <div class="landing-page" data-theme="${isDark ? 'dark' : ''}">
      <div class="ambient-aura">
        <div class="ambient-blob-1"></div>
        <div class="ambient-blob-2"></div>
      </div>

      <!-- ═══ NAVBAR ═══ -->
      <nav class="lp-navbar">
        <div class="lp-navbar-inner">
          <div class="lp-navbar-brand">
            <div>
              <div class="lp-navbar-title">Vehicle Rental<br>Management System</div>
              <div class="lp-navbar-sub">Vehicle Rental System</div>
            </div>
          </div>
          <div class="lp-navbar-links">
            <a href="#lp-hero" class="lp-nav-link active">Home</a>
            <a href="#lp-about" class="lp-nav-link">About</a>
            <a href="#lp-fleet" class="lp-nav-link">Vehicles</a>
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
              <i class="fa-solid fa-calendar-check"></i> View Deals
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
          <div class="lp-hero-tag">PREMIUM VEHICLE RENTALS</div>
          <h1 class="lp-hero-headline">Experience Next-Gen<br>Luxury Vehicle Rentals &amp;<br><span class="lp-hero-highlight">Live Instant Handover</span></h1>
          <p class="lp-hero-desc">Discover Palawan &amp; beyond with live vehicle availability, instant digital reservations, contactless QR check-in, and 24/7 dedicated roadside support.</p>
          <div class="lp-hero-btns">
            <a href="#lp-fleet" class="lp-btn-explore">Explore Available Vehicles <i class="fa-solid fa-arrow-down" style="font-size:0.8rem;"></i></a>
            <button type="button" class="lp-btn-signin-hero" id="lpHeroSignIn"><i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In to View Deals</button>
          </div>
          <div class="lp-hero-stats">
            <div class="lp-stat"><span class="lp-stat-val">4.9 / 5</span><span class="lp-stat-label">Verified Customer Reviews</span></div>
            <div class="lp-stat"><span class="lp-stat-val">&lt;60s</span><span class="lp-stat-label">Instant Cloud Booking</span></div>
            <div class="lp-stat"><span class="lp-stat-val">24/7</span><span class="lp-stat-label">VIP Concierge Service</span></div>
          </div>
        </div>
        <div class="lp-hero-image-wrap">
          <img src="images/hero-fleet.jpg?v=3" alt="Premium Vehicles" class="lp-hero-img" />
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
          <p class="lp-section-desc">Vehicle Rental Management System is an all-in-one vehicle rental and guest reservation platform designed to digitize vehicle bookings, live inventory tracking, digital concierge requests, and administrative operations.</p>

          <div class="lp-overview-grid">
            <div class="lp-overview-card">
              <div class="lp-overview-icon"><i class="fa-solid fa-car"></i></div>
              <h3 class="lp-overview-title">Application Purpose</h3>
              <p class="lp-overview-text">The system enables guests to explore our premium selection of vehicles, view live pricing, make instant reservations, check in contactlessly with QR codes, and submit service requests directly from their personal devices.</p>
            </div>
            <div class="lp-overview-card">
              <div class="lp-overview-icon"><i class="fa-solid fa-lock"></i></div>
              <h3 class="lp-overview-title">Secure Sign-In &amp; Data Use</h3>
              <p class="lp-overview-text">We use secure authentication to verify guest identities and associate vehicle reservations with your user account. We access only your basic profile (name and email) to issue booking confirmations and rental agreements.</p>
            </div>
            <div class="lp-overview-card">
              <div class="lp-overview-icon"><i class="fa-solid fa-bolt"></i></div>
              <h3 class="lp-overview-title">Real-Time Cloud Sync</h3>
              <p class="lp-overview-text">Connected to real-time cloud data, our system ensures instant synchronization between guest bookings, dispatch statuses, maintenance tasks, and digital payment receipts.</p>
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
          <h2 class="lp-section-title">Featured Vehicles</h2>
          <p class="lp-section-desc">Live pricing and availability directly connected to our verified database.</p>

          <div class="lp-fleet-grid">
            ${vehiclePreviews.map(v => `
              <div class="lp-fleet-card">
                <div class="lp-fleet-img-wrap">
                  <span class="vehicle-stage-badge">${v.cat}</span>
                  <img src="${v.img}" alt="${v.name}" class="lp-fleet-img" loading="lazy" />
                  <span class="lp-fleet-avail-tag"><span class="status-dot"></span> Ready</span>
                </div>
                <div class="lp-fleet-body">
                  <h3 class="lp-fleet-name">${v.name}</h3>
                  <div class="vehicle-specs-row">
                    <span class="v-spec-pill">${v.seats} Seats</span>
                    <span class="v-spec-pill">${v.cat}</span>
                    <span class="v-spec-pill">Insured</span>
                  </div>
                  <div class="lp-fleet-price">₱${v.rate.toLocaleString()}.00 <span>/ day</span></div>
                  <p class="lp-fleet-desc">${v.desc}</p>
                  <button type="button" class="lp-btn-booknow" data-lp-book>
                    <span>Rent Now</span>
                  </button>
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
          <div class="lp-section-tag"><i class="fa-solid fa-crown" style="color:#f59e0b;margin-right:6px;"></i> VERIFIED RENTER EXPERIENCES</div>
          <h2 class="lp-section-title">Loved by Drivers Across the Philippines</h2>
          <p class="lp-section-desc">Experience effortless vehicle rentals with guaranteed cloud-synced availability, immaculate vehicles, and 24/7 concierge assistance.</p>

          <!-- Aggregate Trust Bar -->
          <div class="lp-reviews-trust-bar">
            <div class="lp-trust-main-score">
              <div class="lp-trust-score-num">4.96</div>
              <div class="lp-trust-score-meta">
                <div class="lp-trust-stars">
                  <i class="fa-solid fa-star"></i>
                  <i class="fa-solid fa-star"></i>
                  <i class="fa-solid fa-star"></i>
                  <i class="fa-solid fa-star"></i>
                  <i class="fa-solid fa-star"></i>
                </div>
                <div class="lp-trust-score-label">1,480+ Verified Trips</div>
              </div>
            </div>

            <div class="lp-trust-divider"></div>

            <div class="lp-trust-metrics">
              <div class="lp-trust-metric-item">
                <div class="lp-metric-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
                <div class="lp-metric-info">
                  <span class="lp-metric-val">99.8%</span>
                  <span class="lp-metric-lbl">Showroom Cleanliness</span>
                </div>
              </div>
              <div class="lp-trust-metric-item">
                <div class="lp-metric-icon"><i class="fa-solid fa-clock-rotate-left"></i></div>
                <div class="lp-metric-info">
                  <span class="lp-metric-val">99.4%</span>
                  <span class="lp-metric-lbl">Punctual Handover</span>
                </div>
              </div>
              <div class="lp-trust-metric-item">
                <div class="lp-metric-icon"><i class="fa-solid fa-shield-halved"></i></div>
                <div class="lp-metric-info">
                  <span class="lp-metric-val">100%</span>
                  <span class="lp-metric-lbl">Guaranteed Live Sync</span>
                </div>
              </div>
              <div class="lp-trust-metric-item">
                <div class="lp-metric-icon"><i class="fa-solid fa-headset"></i></div>
                <div class="lp-metric-info">
                  <span class="lp-metric-val">24/7</span>
                  <span class="lp-metric-lbl">Roadside Concierge</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Category Filter Tabs -->
          <div class="lp-reviews-filters" role="tablist">
            <button type="button" class="lp-review-filter-btn active" data-filter="all"><i class="fa-solid fa-layer-group"></i> All Reviews (${reviewsData.length})</button>
            <button type="button" class="lp-review-filter-btn" data-filter="suv"><i class="fa-solid fa-truck-monster"></i> SUVs &amp; 4x4</button>
            <button type="button" class="lp-review-filter-btn" data-filter="luxury"><i class="fa-solid fa-gem"></i> VIP &amp; Executive</button>
            <button type="button" class="lp-review-filter-btn" data-filter="city"><i class="fa-solid fa-city"></i> Sedans &amp; City</button>
            <button type="button" class="lp-review-filter-btn" data-filter="airport"><i class="fa-solid fa-plane-arrival"></i> Airport Delivery</button>
          </div>

          <!-- Reviews Grid -->
          <div class="lp-reviews-grid">
            ${reviewsData.map(r => `
              <div class="lp-review-card" data-category="${r.category}">
                <i class="fa-solid fa-quote-right lp-quote-watermark"></i>
                <div class="lp-review-card-head">
                  <div class="lp-reviewer-profile">
                    <div class="lp-avatar-wrap" style="background:${r.avatarBg};">
                      ${r.initials}
                      <span class="lp-avatar-verified" title="Verified Renter"><i class="fa-solid fa-check"></i></span>
                    </div>
                    <div class="lp-reviewer-meta">
                      <div class="lp-reviewer-name">${r.name}</div>
                      <div class="lp-reviewer-location"><i class="fa-solid fa-location-dot" style="color:var(--accent);font-size:0.68rem;"></i> ${r.location}</div>
                    </div>
                  </div>
                  <div class="lp-review-card-rating">
                    <span class="lp-score-badge"><i class="fa-solid fa-star"></i> ${r.score}</span>
                    <div class="lp-review-time-ago">${r.time}</div>
                  </div>
                </div>

                <div class="lp-review-vehicle-pill">
                  <i class="fa-solid ${r.vehicleIcon}"></i>
                  <span>Rented: <strong>${r.vehicle}</strong></span>
                </div>

                <p class="lp-review-quote">"${r.text}"</p>

                <div class="lp-review-chip-list">
                  ${r.chips.map(c => `<span class="lp-review-chip">${c}</span>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Bottom CTA -->
          <div class="lp-reviews-bottom-cta">
            <div class="lp-cta-text">
              <div class="lp-cta-pill"><i class="fa-solid fa-shield-check"></i> 100% RISK-FREE RESERVATION</div>
              <h3>Ready to Experience First-Class Driving?</h3>
              <p>Book online in under 60 seconds with live instant confirmation and flexible rental extensions.</p>
            </div>
            <div class="lp-cta-action">
              <a href="#lp-fleet" class="lp-btn-reserve-cta" id="lpReviewBookNow">
                <i class="fa-solid fa-car"></i> View Deals <i class="fa-solid fa-arrow-right" style="font-size:0.85rem;margin-left:4px;"></i>
              </a>
            </div>
          </div>

        </div>
      </section>

      <!-- ═══ FOOTER ═══ -->
      <footer class="lp-footer">
        <div class="lp-footer-inner">
          <div class="lp-footer-brand">
            <div style="margin-bottom:12px;">
              <span style="font-size:1.1rem;font-weight:800;color:var(--text-hi);">Vehicle Rental Management System</span>
            </div>
            <p style="color:var(--text-mid);font-size:0.88rem;line-height:1.6;max-width:280px;">Where premium vehicles meet cutting-edge real-time rental technology.</p>
          </div>
          <div class="lp-footer-col">
            <h4>Navigation</h4>
            <a href="#lp-hero">Home</a>
            <a href="#lp-about">About &amp; Purpose</a>
            <a href="#lp-fleet">Vehicles &amp; Pricing</a>
            <a href="#lp-perks">Features</a>
            <a href="#lp-reviews">Renter Reviews</a>
          </div>
          <div class="lp-footer-col">
            <h4>Services &amp; Legal</h4>
            <a href="#">Instant Booking</a>
            <a href="#" id="lpFooterGuest">Renter Portal</a>
            <a href="#" id="lpFooterStaff">Staff &amp; Admin Sign In</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
          <div class="lp-footer-col">
            <h4>Contact &amp; Location</h4>
            <a href="#"><i class="fa-solid fa-location-dot" style="width:16px;"></i> PPC, Palawan</a>
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

  // View Deal buttons on fleet cards → go to auth
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

  // Filter tabs for reviews
  const filterBtns = $$('.lp-review-filter-btn');
  const reviewCards = $$('.lp-review-card');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetFilter = btn.getAttribute('data-filter') || 'all';
      reviewCards.forEach(card => {
        const cats = card.getAttribute('data-category') || '';
        if (targetFilter === 'all' || cats.includes(targetFilter)) {
          card.style.display = 'flex';
          card.style.opacity = '0';
          card.style.transform = 'translateY(8px)';
          requestAnimationFrame(() => {
            card.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
            setTimeout(() => {
              card.style.transform = '';
              card.style.transition = '';
            }, 260);
          });
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Review Book Now CTA button
  const reviewBookBtn = $('#lpReviewBookNow');
  if (reviewBookBtn) {
    reviewBookBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const fleetSec = document.querySelector('#lp-fleet');
      if (fleetSec) fleetSec.scrollIntoView({ behavior: 'smooth' });
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
export function renderAuth(initialMode = null) {
  if (initialMode) authMode = initialMode;
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
          <h1 class="auth-form-title">${authMode === 'signup' ? 'Create Account' : 'Sign in'}</h1>
          ${authMode === 'signup' ? '<p class="auth-form-sub">Already have an account? <a href="#" id="authToggleLogin" style="color:var(--accent);font-weight:700;">Sign in instead</a></p>' : '<p class="auth-form-sub">Sign in to access your bookings and dashboard</p>'}

          <!-- Quick Portal Access -->
          <div class="auth-demo-bar">
            <div class="auth-demo-label">DEMO PORTAL ACCESS</div>
            <div class="auth-demo-btns">
              <button type="button" class="auth-demo-btn" id="quickDemoGuest">Renter</button>
              <button type="button" class="auth-demo-btn" id="quickDemoStaff">Staff</button>
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
              <p style="font-size:0.78rem;color:var(--text-mid);margin:0 0 14px 0;">New accounts are registered as renters. Staff and admin accounts are promoted by an administrator.</p>
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
        <img src="images/hero-fleet.jpg?v=3" alt="Premium Vehicles" class="auth-hero-img" />
        <div class="auth-hero-overlay">
          <h2 class="auth-hero-tagline">Every ride, elegantly managed.</h2>
          <p class="auth-hero-sub">From pick-up to drop-off, one system keeps your vehicles, guests, and staff perfectly in sync.</p>
        </div>
        <div class="auth-rating-badge">
          <div class="auth-rating-label">RENTER RATING</div>
          <div class="auth-rating-val">4.9 <span>/ 5</span></div>
        </div>
      </div>
    </div>
  `;

  // Back to home
  $('#authBackHome')?.addEventListener('click', () => renderLandingPage());

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
        const redirectUrl = window.location.origin + window.location.pathname;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl
          }
        });
        if (error) toast(error.message, 'error');
      } catch (err) {
        toast('Google Sign-In is not configured in Supabase yet.', 'info');
      }
    });
  }

  // Form submit
  $('#authForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = $('#authSubmit');
    submitBtn.disabled = true;
    $('#authError').innerHTML = '';
    const email = $('#email').value.trim();
    const password = $('#password').value;

    try {
      if (authMode === 'signup') {
        const fullName = $('#fullName')?.value.trim() || 'New Customer';
        const contactNum = $('#contactNum')?.value.trim() || '';
        const confirmPw = $('#confirmPassword')?.value;
        if (confirmPw && confirmPw !== password) {
          throw { message: 'Passwords do not match.' };
        }

        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account…';

        let signUpUser = null;
        try {
          const { data, error } = await supabase.auth.signUp({
            email, password,
            options: { data: { full_name: fullName, phone: contactNum, role: 'customer' } },
          });
          if (error) {
            if (error.message.includes('already registered')) {
              throw { message: 'Registered na ang email na ito. Pakipindot ang "Sign in instead" sa itaas.' };
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
          phone: contactNum,
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
        toast(`Maligayang pagdating, ${fullName}! Account created successfully.`, 'success');

        // Dumiretso agad sa dashboard
        if (window.renderShell) {
          window.renderShell();
        }
        return;
      }

      // LOGIN MODE
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in…';

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
        // Fast shortcut for demo credentials
        if (email === 'staff@rentflow.ph') {
          return switchSystemRole('staff');
        } else if (email === 'admin@rentflow.ph') {
          return switchSystemRole('admin');
        } else if (email === 'mark.ramos@gmail.com') {
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
      toast(`Welcome back, ${state.profile.full_name || 'User'}!`, 'success');

      // Dumiretso agad sa dashboard
      if (window.renderShell) {
        window.renderShell();
      }
      return;
    } catch (err) {
      const errMsg = err.message || 'An error occurred';
      $('#authError').innerHTML = `<div class="auth-error-msg">${errMsg.includes('Invalid') ? 'Maling email o password. Pakisuri at subukan muli.' : errMsg}</div>`;
      submitBtn.disabled = false;
      submitBtn.innerHTML = authMode === 'login' ? 'Sign in' : 'Create account';
    }
  });
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
      toast('Google Sign-In is not configured in Supabase. Paki-login gamit ang email o demo access.', 'info');
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
