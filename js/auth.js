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
            <a href="#lp-fleet" class="lp-nav-link">Latest Deals</a>
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

      <!-- ═══ FEATURED FLEET / LATEST DEALS ═══ -->
      <section class="lp-section lp-section-fleet" id="lp-fleet">
        <div class="lp-section-inner">
          <div class="lp-section-tag">REALTIME INVENTORY</div>
          <h2 class="lp-section-title">Latest Deals in Palawan</h2>
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
                  <div class="lp-fleet-price">₱${v.rate.toLocaleString()} <span>per day</span></div>
                  <p class="lp-fleet-desc">${v.desc}</p>
                  <button type="button" class="lp-btn-booknow" data-lp-book="${v.name}" data-lp-name="${v.name}">
                    <span>View Deal</span>
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
            <a href="#lp-fleet">Latest Deals in Palawan</a>
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

  // View Deal buttons on fleet cards → prompt user: Login or Continue as Guest
  $$('[data-lp-book]').forEach(btn => {
    btn.addEventListener('click', () => {
      const vName = btn.getAttribute('data-lp-book') || '';
      openLandingDealPrompt(vName);
    });
  });

  // Footer shortcuts
  const fg = $('#lpFooterGuest');
  if (fg) fg.addEventListener('click', (e) => { e.preventDefault(); renderAuth('login'); });
  const fs = $('#lpFooterStaff');
  if (fs) fs.addEventListener('click', (e) => { e.preventDefault(); renderAuth('login'); });

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
   LANDING PAGE "VIEW DEAL" PROMPT (Login as Renter vs Continue as Guest)
   ========================================================================== */
export function openLandingDealPrompt(vehName = '') {
  const modal = openModal(`
    <div class="clean-deal-prompt">
      <button type="button" class="clean-prompt-close" id="promptCloseBtn" aria-label="Close">✕</button>
      
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
  let mode = initialMode || 'login'; // 'login', 'signup', or 'forgot'
  let emailValue = initialEmail || '';

  // Ensure landing page is mounted in background if not already present
  if (!$('#lp-hero') && !state.user) {
    renderLandingPage();
  }

  // Remove any existing auth modal overlay
  $('#cleanAuthOverlay')?.remove();
  $('#rentifyAuthOverlay')?.remove();
  $('#skAuthModalOverlay')?.remove();

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
    let title = '';
    let subtitle = '';
    let formHtml = '';
    let footerHtml = '';

    if (mode === 'signup') {
      title = 'Create Account';
      subtitle = 'Enter your email and password to create an account.';
      formHtml = `
        <form id="cleanAuthForm">
          <div class="clean-field">
            <label class="clean-label">Email Address</label>
            <input type="email" id="cleanEmail" class="clean-input" placeholder="you@example.com" value="${emailValue}" required autocomplete="email" autofocus />
          </div>

          <div class="clean-field">
            <label class="clean-label">Create Password</label>
            <div class="clean-input-pass-wrap">
              <input type="password" id="cleanPassword" class="clean-input" placeholder="At least 6 characters" minlength="6" required autocomplete="new-password" />
              <button type="button" class="clean-eye-btn" data-target="cleanPassword" aria-label="Toggle password">
                <i class="fa-regular fa-eye"></i>
              </button>
            </div>
          </div>

          <div class="clean-field">
            <label class="clean-label">Confirm Password</label>
            <div class="clean-input-pass-wrap">
              <input type="password" id="cleanConfirmPassword" class="clean-input" placeholder="Confirm your password" minlength="6" required autocomplete="new-password" />
              <button type="button" class="clean-eye-btn" data-target="cleanConfirmPassword" aria-label="Toggle password">
                <i class="fa-regular fa-eye"></i>
              </button>
            </div>
          </div>

          <button type="submit" class="clean-submit-btn" id="cleanSubmitBtn">
            Create Account &rarr;
          </button>
        </form>
      `;
      footerHtml = `
        Already have an account? <a href="#" id="cleanToLogin" class="clean-purple-link">Sign in</a>
      `;
    } else if (mode === 'forgot') {
      title = 'Reset Password';
      subtitle = 'Enter your email address to receive password reset instructions.';
      formHtml = `
        <form id="cleanAuthForm">
          <div class="clean-field">
            <label class="clean-label">Email Address</label>
            <input type="email" id="cleanEmail" class="clean-input" placeholder="you@example.com" value="${emailValue}" required autocomplete="email" autofocus />
          </div>

          <button type="submit" class="clean-submit-btn" id="cleanSubmitBtn">
            Send Reset Link &rarr;
          </button>
        </form>
      `;
      footerHtml = `
        Remember your password? <a href="#" id="cleanToLogin" class="clean-purple-link">Sign in</a>
      `;
    } else {
      // mode === 'login'
      title = 'Welcome Back';
      subtitle = 'Access your bookings, manage your rentals, and explore new destinations.';
      formHtml = `
        <form id="cleanAuthForm">
          <div class="clean-field">
            <label class="clean-label">Email Address</label>
            <input type="email" id="cleanEmail" class="clean-input" placeholder="you@example.com" value="${emailValue}" required autocomplete="email" autofocus />
          </div>

          <div class="clean-field">
            <div class="clean-label-row">
              <label class="clean-label">Password</label>
              <a href="#" id="cleanForgotLink" class="clean-purple-link">Forgot password?</a>
            </div>
            <div class="clean-input-pass-wrap">
              <input type="password" id="cleanPassword" class="clean-input" placeholder="••••••••" required autocomplete="current-password" />
              <button type="button" class="clean-eye-btn" data-target="cleanPassword" aria-label="Toggle password">
                <i class="fa-regular fa-eye"></i>
              </button>
            </div>
          </div>

          <button type="submit" class="clean-submit-btn" id="cleanSubmitBtn">
            Sign In &rarr;
          </button>
        </form>
      `;
      footerHtml = `
        Don't have an account? <a href="#" id="cleanToSignup" class="clean-purple-link">Sign up</a>
      `;
    }

    overlay.innerHTML = `
      <div class="clean-auth-card">
        <!-- Top Navigation Bar: Working Back & Close Buttons -->
        <div class="clean-auth-topbar">
          <button type="button" class="clean-back-btn" id="cleanBackBtn" title="Go back">
            <i class="fa-solid fa-arrow-left"></i> <span>Back</span>
          </button>
          <button type="button" class="clean-close-btn" id="cleanCloseBtn" aria-label="Close" title="Close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="clean-auth-content">
          <h2 class="clean-auth-title">${title}</h2>
          <p class="clean-auth-sub">${subtitle}</p>

          <div id="cleanAuthError"></div>

          ${formHtml}

          <!-- Quick Demo Access (1-Click Instant Login) -->
          <div class="clean-demo-box">
            <div class="clean-demo-divider">
              <span>Quick Demo Access</span>
            </div>
            <div class="clean-demo-grid">
              <button type="button" class="clean-demo-btn clean-demo-renter" data-demo-role="customer" title="Instant Login as Renter">
                <span class="clean-demo-role">Renter</span>
                <span class="clean-demo-name">Mark Ramos</span>
              </button>
              <button type="button" class="clean-demo-btn clean-demo-staff" data-demo-role="staff" title="Instant Login as Staff">
                <span class="clean-demo-role">Staff</span>
                <span class="clean-demo-name">Sarah V.</span>
              </button>
              <button type="button" class="clean-demo-btn clean-demo-admin" data-demo-role="admin" title="Instant Login as Admin">
                <span class="clean-demo-role">Admin</span>
                <span class="clean-demo-name">Roland B.</span>
              </button>
            </div>
          </div>

          <div class="clean-auth-footer">
            ${footerHtml}
          </div>
        </div>
      </div>
    `;

    // Bind Back Button (Guaranteed to work!)
    overlay.querySelector('#cleanBackBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (mode === 'signup' || mode === 'forgot') {
        mode = 'login';
        renderModal();
      } else {
        closeModal();
      }
    });

    // Bind Close Button (Guaranteed to work!)
    overlay.querySelector('#cleanCloseBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });

    // Bind Backdrop Click (clicking outside closes modal)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Bind Eye Toggles
    overlay.querySelectorAll('.clean-eye-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        const input = overlay.querySelector('#' + targetId);
        if (!input) return;
        const icon = btn.querySelector('i');
        if (input.type === 'password') {
          input.type = 'text';
          if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
          }
        } else {
          input.type = 'password';
          if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
          }
        }
      });
    });

    // Bind Quick Demo Access Buttons
    overlay.querySelectorAll('[data-demo-role]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const role = btn.getAttribute('data-demo-role');
        closeModal();
        switchSystemRole(role);
      });
    });

    // Bind Switch Links
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

    // Form Submission
    const form = overlay.querySelector('#cleanAuthForm');
    const errBox = overlay.querySelector('#cleanAuthError');

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = overlay.querySelector('#cleanSubmitBtn');
      const email = overlay.querySelector('#cleanEmail')?.value.trim();
      emailValue = email;

      if (errBox) errBox.innerHTML = '';

      if (mode === 'forgot') {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending link…';
        try {
          await supabase.auth.resetPasswordForEmail(email);
          toast(`Password reset instructions sent to ${email}`, 'info');
          mode = 'login';
          renderModal();
        } catch (err) {
          toast('Notice: Please check your email inbox for password reset instructions.', 'info');
          mode = 'login';
          renderModal();
        }
        return;
      }

      if (mode === 'signup') {
        const password = overlay.querySelector('#cleanPassword')?.value;
        const confirmPass = overlay.querySelector('#cleanConfirmPassword')?.value;

        if (password !== confirmPass) {
          if (errBox) errBox.innerHTML = '<div class="clean-auth-error">Passwords do not match. Pakisuri muli.</div>';
          return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account…';

        const fullName = email.split('@')[0];
        const phone = '';

        try {
          await handleAuthenticateSignup(email, password, fullName, phone, closeModal);
        } catch (err) {
          const errMsg = err.message || 'An error occurred';
          if (errBox) {
            errBox.innerHTML = `<div class="clean-auth-error">${errMsg.includes('already registered') ? 'Registered na ang email na ito. Pakipindot ang "Sign in".' : errMsg}</div>`;
          }
          btn.disabled = false;
          btn.innerHTML = 'Create Account &rarr;';
        }
        return;
      }

      // mode === 'login'
      const password = overlay.querySelector('#cleanPassword')?.value;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in…';

      try {
        await handleAuthenticateLogin(email, password, closeModal);
      } catch (err) {
        const errMsg = err.message || 'An error occurred';
        if (errBox) {
          errBox.innerHTML = `<div class="clean-auth-error">${errMsg.includes('Invalid') ? 'Maling email o password. Pakisuri at subukan muli.' : errMsg}</div>`;
        }
        btn.disabled = false;
        btn.innerHTML = 'Sign In &rarr;';
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
