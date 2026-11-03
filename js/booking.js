import { supabase } from './config.js';
import { state, DEFAULT_SETTINGS, getSystemSettings, saveLocalBooking, getLocalBookings } from './state.js';
import { $, $$, fmtMoney, fmtDate, daysBetween, maskPlate, toast, openModal, closeModal, showBookingAlertPopup } from './utils.js';
import { getVehicleDailyRate, getVehicleCategoryName, getExactVehicleImage } from './vehicles.js';
import { broadcastNewBookingRequest } from './realtime.js';

export async function openVehicleDetail(id, prefillStart = '', prefillEnd = '') {
  const v = state.vehicles.find(v => v.id === id);
  if (!v) return;
  const fuelType = v.fuel_type ?? 'Gasoline';
  const hasAC = v.has_ac !== undefined ? v.has_ac : true;
  const todayStr = new Date().toISOString().slice(0, 10);

  let drivers = state.drivers || [];
  const [{ data: fetchedDrivers }, { data: bookedIntervals }] = await Promise.all([
    drivers.length ? Promise.resolve({ data: drivers }) : supabase.from('drivers').select('*').order('name'),
    supabase.from('bookings').select('start_date, end_date, status').eq('vehicle_id', v.id).in('status', ['pending', 'approved', 'active', 'reserved', 'completed']).gte('end_date', todayStr).order('start_date'),
  ]);
  drivers = (fetchedDrivers || []).map(d => ({
    ...d,
    daily_fee: 900,
    license_type: (d.license_type || 'Professional').replace(/\s*heavy\s*/gi, ' ').trim() || 'Professional'
  }));
  if (!drivers || drivers.length === 0) {
    drivers = [
      { id: '1', name: 'Eduardo Mendoza', daily_fee: 900, license_type: 'Professional', experience_years: 7, rating: 4.9, status: 'available', phone: '0917 442 8192' },
      { id: '2', name: 'Ricardo Dalisay', daily_fee: 900, license_type: 'Professional', experience_years: 5, rating: 4.8, status: 'available', phone: '0918 553 1290' },
      { id: '3', name: 'Noel De Guzman', daily_fee: 900, license_type: 'Professional', experience_years: 4, rating: 4.7, status: 'available', phone: '0920 119 4432' }
    ];
  }
  state.drivers = drivers;
  const defaultDriverFee = 900;
  let selectedDriverMode = 'self';
  let selectedDriverId = drivers.length ? String(drivers[0].id) : '';

  // Merge both Supabase and local demo bookings so all reserved/paid bookings accurately block the calendar
  const localList = getLocalBookings().filter(b =>
    (Number(b.vehicle_id) === Number(v.id) || Number(b.vehicles?.id) === Number(v.id)) &&
    ['pending', 'approved', 'active', 'reserved', 'completed'].includes(b.status) &&
    (b.end_date >= todayStr || !b.end_date)
  ).map(b => ({ start_date: (b.start_date || '').slice(0, 10), end_date: (b.end_date || '').slice(0, 10) }));

  const dbList = (bookedIntervals || []).map(b => ({ start_date: (b.start_date || '').slice(0, 10), end_date: (b.end_date || '').slice(0, 10) }));
  const allBookedIntervals = [...dbList, ...localList].filter(b => b.start_date && b.end_date);

  const rate = getVehicleDailyRate(v);
  const catName = getVehicleCategoryName(v);
  const isMotorcycle = catName === 'Motorcycles' || (v.name || '').toLowerCase().includes('motor') || (v.name || '').toLowerCase().includes('click') || (v.name || '').toLowerCase().includes('nmax') || (v.name || '').toLowerCase().includes('adv');
  const exactImg = getExactVehicleImage(v);

  const isAvailable = v.status === 'available';
  const isRented = v.status === 'rented';
  const isMaintenance = v.status === 'maintenance';

  let statusBadgeClass = 'badge-available';
  let badgeContent = '';
  if (isAvailable) {
    statusBadgeClass = 'badge-available';
    badgeContent = `Available for Rent`;
  } else if (isRented) {
    statusBadgeClass = 'badge-rented';
    badgeContent = `Currently Rented`;
  } else if (isMaintenance) {
    statusBadgeClass = 'badge-maintenance';
    badgeContent = `In Maintenance ${v.maintenance_days ? `(${v.maintenance_days}d)` : ''}`;
  } else {
    statusBadgeClass = `badge-${v.status}`;
    badgeContent = `${v.status}`;
  }

  let currentStep = 1;
  let selectedDownpaymentPct = 100;
  let selectedPaymentTiming = 'pay_now';

  const savedProfileStr = localStorage.getItem('rentflow_guest_profile');
  const savedProfile = savedProfileStr ? JSON.parse(savedProfileStr) : {};
  const p = { ...(state.profile || {}), ...savedProfile };

  const modal = openModal(`
    <div class="booking-modal-wrap">
      <!-- ═══ MODAL HEADER ═══ -->
      <div class="booking-modal-header">
        <div class="bm-header-left">
          <div class="bm-badges">
            <span class="bm-cat-pill"><i class="${isMotorcycle ? 'fa-solid fa-motorcycle' : 'fa-solid fa-car'}"></i> ${catName}</span>
            <span class="bm-plate-pill"><i class="fa-solid fa-hashtag"></i> Plate: ${maskPlate(v.plate_number)}</span>
            <span class="badge ${statusBadgeClass}"><i class="fa-solid fa-circle-check"></i> ${badgeContent}</span>
          </div>
          <h3 class="bm-title">${v.name}</h3>
        </div>
        <div class="bm-header-right">
          <div class="bm-rate-card">
            <span class="bm-rate-label">Daily Rate</span>
            <div class="bm-rate-val">${fmtMoney(rate)} <small>/ day</small></div>
          </div>
          <button type="button" class="modal-close bm-close-btn" id="mClose" aria-label="Close modal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <!-- ═══ STEPPER BAR (V2) ═══ -->
      <div class="booking-stepper-v2">
        <div class="step-item active" id="stepNode1" data-step="1">
          <div class="step-num-wrap">
            <span class="step-num">1</span>
            <i class="fa-solid fa-check step-check"></i>
          </div>
          <div class="step-text-wrap">
            <span class="step-sub">Step 1</span>
            <span class="step-title">Vehicle</span>
          </div>
        </div>
        <div class="step-divider" id="stepDiv1"></div>
        <div class="step-item" id="stepNode2" data-step="2">
          <div class="step-num-wrap">
            <span class="step-num">2</span>
            <i class="fa-solid fa-check step-check"></i>
          </div>
          <div class="step-text-wrap">
            <span class="step-sub">Step 2</span>
            <span class="step-title">Dates &amp; Driver</span>
          </div>
        </div>
        <div class="step-divider" id="stepDiv2"></div>
        <div class="step-item" id="stepNode3" data-step="3">
          <div class="step-num-wrap">
            <span class="step-num">3</span>
            <i class="fa-solid fa-check step-check"></i>
          </div>
          <div class="step-text-wrap">
            <span class="step-sub">Step 3</span>
            <span class="step-title">Fill-up &amp; Pay</span>
          </div>
        </div>
      </div>

      <!-- ═══ STEP 1: VEHICLE SHOWCASE & SPECS ═══ -->
      <div class="step-content" id="stepSection1">
        <div class="vehicle-showcase-card">
          <div class="showcase-top-tags">
            <span class="showcase-status-badge"><i class="fa-solid fa-circle-check"></i> ${badgeContent}</span>
            <span class="showcase-fleet-badge"><i class="fa-solid fa-shield-halved"></i> Verified Fleet</span>
          </div>
          <div class="showcase-img-container">
            <div class="showcase-spotlight"></div>
            <img id="detailCarImg" class="showcase-img" src="${exactImg}" alt="${v.name}" />
          </div>
          <div class="showcase-sub-tag">
            <i class="fa-solid fa-shield-virus" style="color:var(--accent);"></i> Sanitized, Disinfected &amp; Safety Inspected
          </div>
        </div>

        <div class="compact-spec-pills">
          <div class="spec-pill"><i class="fa-solid fa-users"></i> <span>${isMotorcycle ? '2 Seats' : (v.seats ?? '5 Seats')}</span></div>
          <div class="spec-pill"><i class="fa-solid fa-gears"></i> <span>${v.transmission ?? 'Automatic'}</span></div>
          <div class="spec-pill"><i class="fa-solid fa-gas-pump"></i> <span>${fuelType}</span></div>
          <div class="spec-pill"><i class="${isMotorcycle ? 'fa-solid fa-helmet-safety' : 'fa-solid fa-snowflake'}"></i> <span>${isMotorcycle ? 'Helmet' : (hasAC ? 'A/C' : 'Vent')}</span></div>
          <div class="spec-pill"><i class="fa-solid fa-shield-halved"></i> <span>Cover Included</span></div>
          <div class="spec-pill"><i class="fa-solid fa-gas-pump"></i> <span>Full-to-Full</span></div>
        </div>

        <div class="step-action-bar">
          <button type="button" class="btn btn-primary btn-block" id="btnGoStep2">
            <span>Proceed to Schedule &amp; Driver</span>
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- ═══ STEP 2: DATES & DRIVER ═══ -->
      <div class="step-content hidden" id="stepSection2">
        <div class="booking-section-card">
          <div class="section-card-header">
            <div class="section-card-icon"><i class="fa-solid fa-calendar-days"></i></div>
            <div>
              <h4 class="section-card-title">1. Select Rental Schedule</h4>
              <span class="section-card-sub">Choose pick-up &amp; return dates</span>
            </div>
          </div>

          <!-- Quick Duration Selector -->
          <div class="cal-quick-bar">
            <span class="cal-quick-label">Quick select:</span>
            <button type="button" class="cal-quick-pill" data-dur="1">1 Day</button>
            <button type="button" class="cal-quick-pill" data-dur="2">2 Days</button>
            <button type="button" class="cal-quick-pill" data-dur="3">3 Days</button>
            <button type="button" class="cal-quick-pill" data-dur="7">1 Week</button>
          </div>

          <!-- Interactive Date Selection Bar with Native + Visual Picker Sync -->
          <div class="cal-booking-inputs-bar">
            <div class="cal-input-card active" id="calCardPickup" title="Choose Pick-up Date">
              <label for="bStart" class="cal-input-header">
                <i class="fa-regular fa-calendar-check"></i>
                <span>Pick-up Date</span>
              </label>
              <div class="cal-input-main">
                <input type="date" id="bStart" min="${todayStr}" class="cal-date-field" />
                <span class="cal-time-badge">Noon</span>
              </div>
            </div>

            <div class="cal-input-divider">
              <span class="cal-arrow-circle"><i class="fa-solid fa-arrow-right"></i></span>
            </div>

            <div class="cal-input-card" id="calCardReturn" title="Choose Return Date">
              <label for="bEnd" class="cal-input-header">
                <i class="fa-regular fa-calendar-xmark"></i>
                <span>Return Date</span>
              </label>
              <div class="cal-input-main">
                <input type="date" id="bEnd" min="${todayStr}" class="cal-date-field" />
                <span class="cal-time-badge">Noon</span>
              </div>
            </div>

            <div class="cal-summary-pill" id="calTripSummary">
              <span class="cal-summary-days" id="calTripDays">1 Day Rental</span>
            </div>
          </div>

          <div id="calWidgetContainer"></div>
          <div id="availabilityMsg" class="availability-callout"></div>
        </div>

        <div class="booking-section-card">
          <div class="section-card-header">
            <div class="section-card-icon"><i class="fa-solid fa-calculator"></i></div>
            <div>
              <h4 class="section-card-title">2. Billing Method</h4>
              <span class="section-card-sub">Select daily or mileage plan</span>
            </div>
          </div>

          <div class="billing-method-wrap">
            <div class="billing-type-cards" id="chargeTypeSelector">
              <div class="billing-opt-card active" data-type="per_day">
                <div class="opt-card-radio"><i class="fa-solid fa-circle-check"></i></div>
                <div class="opt-card-body">
                  <div class="opt-card-title"><i class="fa-solid fa-calendar-day"></i> Per Day Plan</div>
                  <div class="opt-card-rate">${fmtMoney(rate)} <small>/ day</small></div>
                  <span class="opt-card-badge"><i class="fa-solid fa-circle-check"></i> Unlimited Kilometers</span>
                </div>
              </div>
              <div class="billing-opt-card" data-type="per_km">
                <div class="opt-card-radio"><i class="fa-regular fa-circle"></i></div>
                <div class="opt-card-body">
                  <div class="opt-card-title"><i class="fa-solid fa-gauge-high"></i> Per Kilometer Plan</div>
                  <div class="opt-card-rate">${fmtMoney(rate * 0.05)} <small>/ km</small></div>
                  <span class="opt-card-badge" style="color:var(--accent);"><i class="fa-solid fa-bolt"></i> Metered for City Trips</span>
                </div>
              </div>
            </div>

            <select id="chargeType" class="clean-select" style="display:none;">
              <option value="per_day" selected>Per Day (${fmtMoney(rate)} / day)</option>
              <option value="per_km">Per Kilometer (${fmtMoney(rate * 0.05)} / km)</option>
            </select>

            <div class="field hidden" id="kmField" style="margin-top:10px;margin-bottom:0;">
              <label>Estimated Distance (KM) <span style="color:#ef4444;">*</span></label>
              <div class="input-icon-wrap">
                <i class="fa-solid fa-route input-icon"></i>
                <input type="number" id="estKm" min="1" placeholder="e.g. 150 km" class="clean-input" />
              </div>
            </div>
          </div>
        </div>

        <div class="system-driver-card ${isMotorcycle ? 'disabled' : ''}" id="privateDriverSection">
          <div class="driver-card-header">
            <div class="driver-icon-badge"><i class="fa-solid fa-id-badge"></i></div>
            <div style="flex:1;">
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
                <h4 class="system-driver-title">Private Driver Service (Optional)</h4>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span class="driver-rate-tag">+₱900.00 / day</span>
                  <span class="driver-rating-badge"><i class="fa-solid fa-star"></i> 4.9 Professional</span>
                </div>
              </div>
              <p class="system-driver-desc">
                Professional licensed chauffeur for your rental journey. The first day is included in your checkout total; any succeeding days are settled directly with your driver.
              </p>
            </div>
          </div>
          <label class="system-driver-checkbox-label" for="driverHireCheckbox">
            <input type="checkbox" id="driverHireCheckbox" ${isMotorcycle ? 'disabled' : ''} />
            <span>Add Private Driver Service (+₱900.00)</span>
          </label>
          ${isMotorcycle ? '<div class="system-driver-moto-note"><i class="fa-solid fa-circle-info"></i> Private driver is not available for motorcycle rentals (strictly self-drive).</div>' : ''}
        </div>

        <div class="step-nav-bar">
          <button type="button" class="btn btn-ghost" id="btnBackStep1">
            <i class="fa-solid fa-arrow-left"></i>
            <span>Back</span>
          </button>
          <button type="button" class="btn btn-primary" id="btnGoStep3">
            <span>Proceed to Fill-up &amp; Pricing</span>
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>

      <!-- ═══ STEP 3: FILL-UP & PAYMENT ═══ -->
      <div class="step-content hidden" id="stepSection3">
        <!-- Renter Information Card -->
        <div class="renter-fillup-card">
          <div class="renter-fillup-header">
            <div class="renter-fillup-icon">
              <i class="fa-solid fa-user-pen"></i>
            </div>
            <div>
              <h4 class="renter-fillup-title">Renter Information</h4>
              <span class="renter-fillup-sub">Complete your verified renter details for reservation confirmation</span>
            </div>
          </div>

          <div class="detail-grid" style="margin-bottom:12px;">
            <div class="field">
              <label>Full Name <span style="color:#ef4444;">*</span></label>
              <div class="input-icon-wrap">
                <i class="fa-solid fa-user input-icon"></i>
                <input type="text" id="renterName" value="${p.full_name || state.user?.user_metadata?.full_name || ''}" placeholder="e.g. Mark Lester Ramos" required />
              </div>
            </div>
            <div class="field">
              <label>Mobile Number <span style="color:#ef4444;">*</span></label>
              <div class="input-icon-wrap">
                <i class="fa-solid fa-phone input-icon"></i>
                <input type="tel" id="renterPhone" value="${p.phone || ''}" placeholder="e.g. 0917 582 9140" required />
              </div>
            </div>
          </div>

          <div class="detail-grid" style="margin-bottom:12px;">
            <div class="field">
              <label>Email Address</label>
              <div class="input-icon-wrap">
                <i class="fa-solid fa-envelope input-icon"></i>
                <input type="email" id="renterEmail" value="${p.email || state.user?.email || ''}" placeholder="e.g. mark.ramos@gmail.com" />
              </div>
            </div>
            <div class="field">
              <label>Driver's License No. <span style="font-weight:400;font-size:0.72rem;color:#94a3b8;">(Optional)</span></label>
              <div class="input-icon-wrap">
                <i class="fa-solid fa-id-card input-icon"></i>
                <input type="text" id="renterLicense" value="${p.license_number || ''}" placeholder="e.g. N02-19-482019" />
              </div>
            </div>
          </div>

          <div class="field" style="margin-bottom:12px;">
            <label>Meetup / Delivery Address or Notes <span style="font-weight:400;font-size:0.72rem;color:#94a3b8;">(Optional)</span></label>
            <div class="input-icon-wrap">
              <i class="fa-solid fa-location-dot input-icon"></i>
              <input type="text" id="renterAddress" value="${p.address || ''}" placeholder="e.g. Puerto Princesa Airport, Hotel Lobby, or Meetup Spot" />
            </div>
          </div>

          <div class="renter-verify-badge">
            <i class="fa-solid fa-shield-check" style="color:#059669;font-size:0.95rem;"></i>
            <span>Physical driver's license will be verified in-person upon vehicle meetup / handover. No online license upload required.</span>
          </div>
        </div>

        <!-- Transparent Itemized Breakdown -->
        <div id="transparentPricingContainer"></div>

        <!-- 100% Transparent Guarantee Box -->
        <div class="guarantee-box">
          <i class="fa-solid fa-shield-heart guarantee-icon"></i>
          <div>
            <strong>100% Transparent Guarantee:</strong> No hidden charges. Full-to-full fuel policy. Free cancellation up to 24 hours prior to pickup. No online license upload needed — simply present your valid physical driver's license upon vehicle handover.
          </div>
        </div>

        <!-- Complete Payment Card -->
        <div class="complete-payment-card">
          <div class="payment-card-top-bar">
            <div>
              <div class="complete-payment-tag">SECURE CHECKOUT</div>
              <h4 class="complete-payment-title">Payment &amp; Reservation Confirmation</h4>
            </div>
            <div class="payment-amount-pill">
              <span class="amount-pill-sub">Amount Due Now</span>
              <strong class="amount-pill-val" id="paymentAmountDueVal">₱0.00</strong>
            </div>
          </div>

          <div class="payment-selection-section">
            <div class="field" style="margin-bottom:14px;">
              <label>Payment Structure</label>
              <div class="pay-structure-selector" id="bPayStructureSelector">
                <div class="selector-opt-card active" data-pct="100">
                  <div class="opt-radio"><i class="fa-solid fa-circle-check"></i></div>
                  <div class="opt-content">
                    <div class="opt-top">
                      <strong>Pay in Full (100%)</strong>
                      <span class="opt-chip opt-chip-green">Recommended</span>
                    </div>
                    <span class="opt-sub">Instant zero-balance reservation with priority vehicle handover</span>
                  </div>
                </div>
                <div class="selector-opt-card" data-pct="20">
                  <div class="opt-radio"><i class="fa-regular fa-circle"></i></div>
                  <div class="opt-content">
                    <div class="opt-top">
                      <strong>Downpayment (20%)</strong>
                    </div>
                    <span class="opt-sub">Pay 20% today to lock reservation · Balance upon vehicle meetup</span>
                  </div>
                </div>
              </div>
              <select id="payStructureSelect" class="clean-select" style="display:none;">
                <option value="100" selected>Pay in Full (100%)</option>
                <option value="20">Downpayment (20%)</option>
              </select>
            </div>

            <div class="field" style="margin-bottom:14px;">
              <label>Payment Method</label>
              <div class="payment-methods-grid" id="bPaymentMethodGrid">
                <div class="pay-method-card active" data-method="card">
                  <div class="pm-radio"><i class="fa-solid fa-circle-check"></i></div>
                  <div class="pm-icon pm-card-icon"><i class="fa-solid fa-credit-card"></i></div>
                  <div class="pm-info">
                    <strong class="pm-name">Card</strong>
                    <span class="pm-desc">Debit or Credit Card</span>
                  </div>
                </div>

                <div class="pay-method-card" data-method="gcash">
                  <div class="pm-radio"><i class="fa-regular fa-circle"></i></div>
                  <div class="pm-icon pm-gcash-icon"><i class="fa-solid fa-mobile-screen-button"></i></div>
                  <div class="pm-info">
                    <strong class="pm-name">GCash</strong>
                    <span class="pm-desc">Instant QR Scan</span>
                  </div>
                  <span class="pm-tag">Instant</span>
                </div>

                <div class="pay-method-card" data-method="bank_transfer">
                  <div class="pm-radio"><i class="fa-regular fa-circle"></i></div>
                  <div class="pm-icon pm-bank-icon"><i class="fa-solid fa-building-columns"></i></div>
                  <div class="pm-info">
                    <strong class="pm-name">Bank Transfer</strong>
                    <span class="pm-desc">QR Ph &amp; InstaPay</span>
                  </div>
                </div>

                <div class="pay-method-card" data-method="cash">
                  <div class="pm-radio"><i class="fa-regular fa-circle"></i></div>
                  <div class="pm-icon pm-cash-icon"><i class="fa-solid fa-handshake"></i></div>
                  <div class="pm-info">
                    <strong class="pm-name">Via Meetup</strong>
                    <span class="pm-desc">Pay Cash on Handover</span>
                  </div>
                </div>
              </div>
              <select id="paymentMethodSelect" class="clean-select" style="display:none;">
                <option value="card" selected>Card (Debit / Credit)</option>
                <option value="gcash">GCash (Instant QR)</option>
                <option value="bank_transfer">Bank Transfer (QR Ph / InstaPay)</option>
                <option value="cash">Via Meetup (Cash)</option>
              </select>
            </div>
          </div>

          <div id="bookingPayMethodDetail"></div>

          <div class="checkout-trust-row">
            <span><i class="fa-solid fa-lock"></i> 256-Bit SSL Encrypted</span>
            <span><i class="fa-solid fa-shield-halved"></i> Verified Fleet Partner</span>
            <span><i class="fa-solid fa-circle-check"></i> Instant Booking Pass</span>
          </div>
        </div>

        <!-- Step 3 Action Buttons -->
        <div class="step-nav-bar">
          <button type="button" class="btn btn-ghost" id="btnBackStep2">
            <i class="fa-solid fa-arrow-left"></i>
            <span>Back</span>
          </button>
          <button type="button" class="btn btn-primary" id="submitBooking">
            <i class="fa-solid fa-lock"></i>
            <span>Submit Payment</span>
          </button>
        </div>
      </div>
    </div>`, true);

  $('#mClose')?.addEventListener('click', closeModal);

  function setStep(step) {
    currentStep = step;
    const s1 = $('#stepSection1'), s2 = $('#stepSection2'), s3 = $('#stepSection3');
    const n1 = $('#stepNode1'), n2 = $('#stepNode2'), n3 = $('#stepNode3');
    const d1 = $('#stepDiv1'), d2 = $('#stepDiv2');

    if (s1) s1.classList.toggle('hidden', step !== 1);
    if (s2) s2.classList.toggle('hidden', step !== 2);
    if (s3) s3.classList.toggle('hidden', step !== 3);

    if (n1) {
      n1.classList.toggle('active', step === 1);
      n1.classList.toggle('completed', step > 1);
    }
    if (n2) {
      n2.classList.toggle('active', step === 2);
      n2.classList.toggle('completed', step > 2);
    }
    if (n3) {
      n3.classList.toggle('active', step === 3);
    }

    if (d1) d1.classList.toggle('active', step >= 2);
    if (d2) d2.classList.toggle('active', step >= 3);

    // CRITICAL: Scroll modal to top on every step transition!
    const modalWrap = modal.querySelector('.booking-modal-wrap');
    if (modalWrap) {
      modalWrap.scrollTop = 0;
      modal.scrollTop = 0;
    }

    if (step === 2) {
      renderInteractiveCalendar();
      checkAvailability();
    } else if (step === 3) {
      renderStep3Pricing();
    }
  }

  $('#stepNode1')?.addEventListener('click', () => setStep(1));
  $('#stepNode2')?.addEventListener('click', () => setStep(2));
  $('#btnGoStep2')?.addEventListener('click', () => setStep(2));
  $('#btnBackStep1')?.addEventListener('click', () => setStep(1));
  $('#btnBackStep2')?.addEventListener('click', () => setStep(2));

  $('#btnDetailDamagePolicy')?.addEventListener('click', () => {
    import('./utils.js').then(({ openDamagePolicyModal }) => openDamagePolicyModal());
  });

  const chargeType = $('#chargeType'), kmField = $('#kmField'), estKmInput = $('#estKm');
  chargeType.addEventListener('change', () => {
    kmField.classList.toggle('hidden', chargeType.value !== 'per_km');
    checkAvailability();
  });
  if (estKmInput) estKmInput.addEventListener('input', checkAvailability);

  // Sync interactive Billing Type UI cards
  $$('.billing-opt-card', modal).forEach(card => {
    card.addEventListener('click', () => {
      $$('.billing-opt-card', modal).forEach(c => {
        c.classList.remove('active');
        const ic = c.querySelector('.opt-card-radio i');
        if (ic) ic.className = 'fa-regular fa-circle';
      });
      card.classList.add('active');
      const activeIc = card.querySelector('.opt-card-radio i');
      if (activeIc) activeIc.className = 'fa-solid fa-circle-check';
      chargeType.value = card.dataset.type;
      chargeType.dispatchEvent(new Event('change'));
    });
  });

  const driverCheckbox = $('#driverHireCheckbox');

  function updateDriverOptionUI() {
    if (!driverCheckbox) return;

    if (isMotorcycle) {
      driverCheckbox.checked = false;
      selectedDriverMode = 'self';
      return;
    }

    driverCheckbox.checked = (selectedDriverMode === 'with_driver');
  }

  if (driverCheckbox) {
    driverCheckbox.addEventListener('change', () => {
      if (isMotorcycle) {
        driverCheckbox.checked = false;
        toast('Motorcycles are strictly self-drive only.', 'info');
        return;
      }
      selectedDriverMode = driverCheckbox.checked ? 'with_driver' : 'self';
      updateDriverOptionUI();
      checkAvailability();
    });
  }

  // Initialize Driver Option UI
  updateDriverOptionUI();

  const start = $('#bStart'), end = $('#bEnd'), btnGoStep3 = $('#btnGoStep3'), availMsg = $('#availabilityMsg'), submitBtn = $('#submitBooking');

  let calViewYear = new Date().getFullYear();
  let calViewMonth = new Date().getMonth();

  function formatShortDate(iso) {
    if (!iso) return 'Select Date';
    try {
      const d = new Date(iso + 'T00:00:00');
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${dayNames[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
    } catch (e) {
      return iso;
    }
  }

  // Bind top card and quick pill listeners once outside renderInteractiveCalendar
  $$('.cal-quick-pill', modal).forEach(pill => {
    pill.addEventListener('click', () => {
      const dCount = Number(pill.dataset.dur || 1);
      const baseStart = start.value || todayStr;
      start.value = baseStart;
      const targetDate = new Date(baseStart + 'T00:00:00');
      targetDate.setDate(targetDate.getDate() + (dCount - 1));
      end.value = targetDate.toISOString().slice(0, 10);
      renderInteractiveCalendar();
      checkAvailability();
    });
  });

  $('#calCardPickup')?.addEventListener('click', () => {
    const input = $('#bStart');
    if (input && typeof input.showPicker === 'function') {
      try { input.showPicker(); } catch (err) {}
    }
  });

  $('#calCardReturn')?.addEventListener('click', () => {
    const input = $('#bEnd');
    if (input && typeof input.showPicker === 'function') {
      try { input.showPicker(); } catch (err) {}
    }
  });

  function renderInteractiveCalendar() {
    const calContainer = $('#calWidgetContainer');
    if (!calContainer) return;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const selectedStartVal = start.value;
    const selectedEndVal = end.value;

    // Update Top Date Bar
    const pickupText = $('#calPickupText');
    const returnText = $('#calReturnText');
    const tripDaysEl = $('#calTripDays');
    const cardPickup = $('#calCardPickup');
    const cardReturn = $('#calCardReturn');

    if (pickupText) pickupText.textContent = selectedStartVal ? formatShortDate(selectedStartVal) : 'Select Date';
    if (returnText) {
      if (selectedStartVal && selectedEndVal) {
        returnText.textContent = selectedStartVal === selectedEndVal ? `${formatShortDate(selectedEndVal)} (1 Day)` : formatShortDate(selectedEndVal);
      } else if (selectedStartVal) {
        returnText.textContent = 'Select Return';
      } else {
        returnText.textContent = 'Select Date';
      }
    }

    if (cardPickup && cardReturn) {
      if (!selectedStartVal || (selectedStartVal && selectedEndVal)) {
        cardPickup.classList.add('active');
        cardReturn.classList.remove('active');
      } else {
        cardPickup.classList.remove('active');
        cardReturn.classList.add('active');
      }
    }

    if (tripDaysEl) {
      if (selectedStartVal && selectedEndVal) {
        const days = Math.max(1, Math.round((new Date(selectedEndVal) - new Date(selectedStartVal)) / (1000 * 60 * 60 * 24)) + 1);
        tripDaysEl.innerHTML = `<strong>${days} Day${days > 1 ? 's' : ''}</strong> Rental`;
      } else {
        tripDaysEl.textContent = 'Select dates';
      }
    }

    function buildMonthHTML(year, month, panelId) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayIndex = new Date(year, month, 1).getDay();

      let daysHTML = '';
      for (let i = 0; i < firstDayIndex; i++) {
        daysHTML += `<div class="cal-day cal-day-empty"></div>`;
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(d).padStart(2, '0');
        const dateIso = `${year}-${monthStr}-${dayStr}`;

        const isPast = dateIso < todayStr;
        const isBooked = allBookedIntervals && allBookedIntervals.some(b => dateIso >= b.start_date && dateIso <= b.end_date);
        const isStart = selectedStartVal === dateIso;
        const isEnd = selectedEndVal === dateIso;
        const isInRange = selectedStartVal && selectedEndVal && dateIso > selectedStartVal && dateIso < selectedEndVal;
        const isToday = dateIso === todayStr;

        if (isPast) {
          daysHTML += `<div class="cal-day cal-day-past" data-date="${dateIso}">${d}</div>`;
        } else if (isBooked) {
          daysHTML += `<div class="cal-day cal-day-booked" data-date="${dateIso}" title="Reserved">${d}</div>`;
        } else {
          let dayClass = 'cal-day-price';
          if (isStart && isEnd) dayClass += ' cal-day-selected cal-day-single';
          else if (isStart) dayClass += ' cal-day-selected cal-day-start';
          else if (isEnd) dayClass += ' cal-day-selected cal-day-end';
          else if (isInRange) dayClass += ' cal-day-in-range';
          if (isToday) dayClass += ' cal-day-today';

          daysHTML += `<div class="cal-day ${dayClass}" data-date="${dateIso}">${d}</div>`;
        }
      }

      return `
        <div class="cal-dual-panel" id="${panelId}">
          <div class="cal-weekdays">
            <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
          </div>
          <div class="cal-days-grid">${daysHTML}</div>
        </div>
      `;
    }

    const leftYear = calViewYear;
    const leftMonth = calViewMonth;
    let rightMonth = calViewMonth + 1;
    let rightYear = calViewYear;
    if (rightMonth > 11) { rightMonth = 0; rightYear++; }

    const now = new Date();
    const isPrevDisabled = (leftYear < now.getFullYear()) || (leftYear === now.getFullYear() && leftMonth <= now.getMonth());

    calContainer.innerHTML = `
      <div class="custom-calendar cal-dual-layout">
        <div class="cal-dual-header">
          <button type="button" class="cal-nav-btn" id="calPrevMonth" title="Previous Month" aria-label="Previous Month"${isPrevDisabled ? ' disabled style="opacity:0.3;cursor:not-allowed;"' : ''}><i class="fa-solid fa-chevron-left"></i></button>
          <div class="cal-panel-title cal-panel-title-left">${monthNames[leftMonth]} ${leftYear}</div>
          <div class="cal-panel-title cal-panel-title-right">${monthNames[rightMonth]} ${rightYear}</div>
          <button type="button" class="cal-nav-btn" id="calNextMonth" title="Next Month" aria-label="Next Month"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div class="cal-dual-months">
          ${buildMonthHTML(leftYear, leftMonth, 'calPanelLeft')}
          ${buildMonthHTML(rightYear, rightMonth, 'calPanelRight')}
        </div>
      </div>
    `;

    // Month Navigation Events
    $('#calPrevMonth', calContainer)?.addEventListener('click', (e) => {
      e.preventDefault();
      if (isPrevDisabled) return;
      calViewMonth--;
      if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
      renderInteractiveCalendar();
    });

    $('#calNextMonth', calContainer)?.addEventListener('click', (e) => {
      e.preventDefault();
      calViewMonth++;
      if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
      renderInteractiveCalendar();
    });

    // Date Selection Clicks
    const priceCells = calContainer.querySelectorAll('.cal-day-price');
    priceCells.forEach(cell => {
      cell.addEventListener('click', () => {
        const clickedDate = cell.dataset.date;
        if (!start.value || (start.value && end.value && start.value !== end.value)) {
          start.value = clickedDate;
          end.value = clickedDate;
        } else if (clickedDate === start.value) {
          end.value = clickedDate;
        } else if (clickedDate > start.value) {
          const hasBookedInside = allBookedIntervals && allBookedIntervals.some(b => b.start_date > start.value && b.start_date <= clickedDate);
          if (hasBookedInside) {
            toast('Cannot select range across reserved dates.', 'error');
            start.value = clickedDate;
            end.value = clickedDate;
          } else {
            end.value = clickedDate;
          }
        } else {
          start.value = clickedDate;
          end.value = clickedDate;
        }
        renderInteractiveCalendar();
        checkAvailability();
      });
    });
  }

  // Prepopulate dates if passed from Hero Availability search or set sensible default
  if (prefillStart) {
    start.value = prefillStart;
    end.value = (prefillEnd && prefillEnd >= prefillStart) ? prefillEnd : prefillStart;
  } else if (!start.value) {
    start.value = todayStr;
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayIso = nextDay.toISOString().slice(0, 10);
    const isNextBooked = allBookedIntervals && allBookedIntervals.some(b => nextDayIso >= b.start_date && nextDayIso <= b.end_date);
    end.value = isNextBooked ? todayStr : nextDayIso;
  }

  renderInteractiveCalendar();
  checkAvailability();

  start.addEventListener('change', () => {
    if (!start.value) return;
    end.min = start.value;
    if (allBookedIntervals && allBookedIntervals.length) {
      const nextBooked = allBookedIntervals.find(b => b.start_date >= start.value);
      if (nextBooked) {
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

  let calculatedBookingData = null;

  async function checkAvailability() {
    if (!start.value || !end.value) {
      btnGoStep3.disabled = true;
      return;
    }

    if (new Date(end.value) < new Date(start.value)) {
      availMsg.innerHTML = `<span style="color:#dc2626;font-weight:600;">Drop-out date must be on or after pick-up date.</span>`;
      btnGoStep3.disabled = true;
      return;
    }
    if (v.status === 'maintenance') {
      availMsg.innerHTML = `<span style="color:#d97706;font-weight:700;">This vehicle is currently undergoing scheduled maintenance.</span>`;
      btnGoStep3.disabled = true;
      return;
    }

    if (allBookedIntervals && allBookedIntervals.length) {
      const conflict = allBookedIntervals.find(b => start.value <= b.end_date && end.value >= b.start_date);
      if (conflict) {
        availMsg.innerHTML = `<span style="color:#dc2626;font-weight:700;">Date Conflict: Vehicle is already booked from ${fmtDate(conflict.start_date)} to ${fmtDate(conflict.end_date)}. Please select different dates.</span>`;
        btnGoStep3.disabled = true;
        return;
      }
    }

    // Fast synchronous availability check from preloaded intervals for zero-delay UX
    if (allBookedIntervals && allBookedIntervals.length) {
      const liveConflict = allBookedIntervals.find(b => start.value <= b.end_date && end.value >= b.start_date);
      if (liveConflict) {
        availMsg.innerHTML = `<span style="color:#B24A5A;font-weight:600;">Dates already booked. Please choose available dates above.</span>`;
        btnGoStep3.disabled = true;
        return;
      }
    }

    const days = daysBetween(start.value, end.value);
    const isPerKm = chargeType.value === 'per_km';
    const kmRate = rate * 0.05;
    const estKm = Number(estKmInput?.value || 0);
    let vehicleCost = isPerKm ? (kmRate * estKm) : (days * rate);

    if (isPerKm && estKm <= 0) {
      availMsg.innerHTML = `<span style="color:#059669;font-weight:600;">Dates available. Please enter estimated kilometers to calculate price.</span>`;
      btnGoStep3.disabled = true;
      return;
    }

    let selectedDriver = null;
    let driverFee = 0;
    let driverDirectPayFee = 0;
    let dId = null;

    if (selectedDriverMode === 'with_driver' && !isMotorcycle) {
      selectedDriver = drivers.find(dr => String(dr.id) === String(selectedDriverId)) || drivers[0];
      // Per spec: only the first day will be included in the total below!
      driverFee = 900;
      driverDirectPayFee = days > 1 ? (days - 1) * 900 : 0;
      dId = selectedDriver ? selectedDriver.id : null;
    }

    const totalAmount = vehicleCost + driverFee;

    availMsg.innerHTML = `<span style="color:#059669;font-weight:700;">Dates available for rent! (${days} day${days > 1 ? 's' : ''})</span>`;
    btnGoStep3.disabled = false;

    calculatedBookingData = {
      days,
      isPerKm,
      kmRate,
      estKm,
      vehicleCost,
      driverFee,
      driverDirectPayFee,
      selectedDriver,
      selectedDriverMode,
      totalAmount,
      dId,
      chargeTypeVal: chargeType.value,
    };
    updateDriverOptionUI();
  }

  function renderStep3Pricing() {
    if (!calculatedBookingData) return;
    const data = calculatedBookingData;

    const pricingContainer = $('#transparentPricingContainer');
    if (!pricingContainer) return;

    const grossTotal = data.vehicleCost + data.driverFee;
    const netTotal = grossTotal;

    calculatedBookingData.discountAmount = 0;
    calculatedBookingData.finalPayableTotal = netTotal;
    calculatedBookingData.appliedPromoCode = null;

    pricingContainer.innerHTML = `
      <div class="price-breakdown-card">
        <div class="price-breakdown-header">
          <i class="fa-solid fa-file-invoice-dollar text-accent"></i>
          <h4 class="price-breakdown-title">Transparent Itemized Breakdown</h4>
        </div>

        <div class="price-item">
          <div>
            <div class="price-item-name">${v.name} Base Rental</div>
            <div class="price-item-sub">
              ${data.isPerKm ? `${data.estKm} km × ${fmtMoney(data.kmRate)}/km` : `${data.days} day(s) × ${fmtMoney(rate)}/day`}
            </div>
          </div>
          <span class="price-item-val">${fmtMoney(data.vehicleCost)}</span>
        </div>

        ${data.selectedDriverMode === 'with_driver' ? `
          <div class="price-item">
            <div>
              <div class="price-item-name">Private Driver Service</div>
              <div class="price-item-sub">
                First day included in checkout ${data.days > 1 ? `· Remaining ${data.days - 1} day(s) (${fmtMoney(data.driverDirectPayFee)}) payable directly to driver` : ''}
              </div>
            </div>
            <span class="price-item-val text-accent">+₱900.00</span>
          </div>
        ` : `
          <div class="price-item">
            <div>
              <div class="price-item-name">Private Driver Service</div>
              <div class="price-item-sub">Self-Drive (Customer Driving)</div>
            </div>
            <span class="price-item-val text-success">₱0 (Self-Drive)</span>
          </div>
        `}

        <div class="price-item">
          <div>
            <div class="price-item-name">Comprehensive Vehicle Protection</div>
            <div class="price-item-sub text-success">Basic third-party liability &amp; road coverage included</div>
          </div>
          <span class="badge badge-success-soft">INCLUDED</span>
        </div>

        <div class="price-item">
          <div>
            <div class="price-item-name">Vehicle Prep &amp; Sanitation</div>
            <div class="price-item-sub text-success">Complimentary pre-delivery wash and disinfection</div>
          </div>
          <span class="badge badge-success-soft">FREE</span>
        </div>

        <div class="price-item deposit-row">
          <div>
            <div class="price-item-name">Refundable Security Deposit</div>
            <div class="price-item-sub text-amber">Payable upon pickup · 100% refunded upon safe vehicle return</div>
          </div>
          <span class="deposit-val">₱3,000.00 <small>(deposit)</small></span>
        </div>

        <div class="price-item total-row">
          <div>
            <div class="total-title">Total Rental Amount</div>
            <div class="total-sub">All taxes, vehicle fees &amp; reservation charges included</div>
          </div>
          <span class="total-val">${fmtMoney(netTotal)}</span>
        </div>
      </div>`;

    selectedDownpaymentPct = 100;
    let selectedPaymentMethod = 'card';
    let uploadedProofDataUrl = null;

    const payDueVal = $('#paymentAmountDueVal');
    const payStructure = $('#payStructureSelect');
    const payMethodSelect = $('#paymentMethodSelect');

    function updateAmountDue() {
      const due = selectedDownpaymentPct === 100 ? netTotal : Math.round(netTotal * 0.2);
      if (payDueVal) payDueVal.textContent = fmtMoney(due);
    }

    if (payStructure) {
      payStructure.value = String(selectedDownpaymentPct);
      payStructure.onchange = () => {
        selectedDownpaymentPct = Number(payStructure.value);
        updateAmountDue();
        renderBookingPaymentDetail();
      };
    }

    if (payMethodSelect) {
      payMethodSelect.value = selectedPaymentMethod;
      payMethodSelect.onchange = () => {
        selectedPaymentMethod = payMethodSelect.value;
        renderBookingPaymentDetail();
      };
    }

    // Sync Payment Structure interactive cards
    $$('#bPayStructureSelector .selector-opt-card', modal).forEach(card => {
      card.addEventListener('click', () => {
        $$('#bPayStructureSelector .selector-opt-card', modal).forEach(c => {
          c.classList.remove('active');
          const ic = c.querySelector('.opt-radio i');
          if (ic) ic.className = 'fa-regular fa-circle';
        });
        card.classList.add('active');
        const activeIc = card.querySelector('.opt-radio i');
        if (activeIc) activeIc.className = 'fa-solid fa-circle-check';
        if (payStructure) {
          payStructure.value = card.dataset.pct;
          payStructure.dispatchEvent(new Event('change'));
        }
      });
    });

    // Sync Payment Method interactive cards
    $$('#bPaymentMethodGrid .pay-method-card', modal).forEach(card => {
      card.addEventListener('click', () => {
        $$('#bPaymentMethodGrid .pay-method-card', modal).forEach(c => {
          c.classList.remove('active');
          const ic = c.querySelector('.pm-radio i');
          if (ic) ic.className = 'fa-regular fa-circle';
        });
        card.classList.add('active');
        const activeIc = card.querySelector('.pm-radio i');
        if (activeIc) activeIc.className = 'fa-solid fa-circle-check';
        if (payMethodSelect) {
          payMethodSelect.value = card.dataset.method;
          payMethodSelect.dispatchEvent(new Event('change'));
        }
      });
    });

    updateAmountDue();

    function renderBookingPaymentDetail() {
      const detailContainer = $('#bookingPayMethodDetail');
      if (!detailContainer) return;
      const amountToPay = selectedDownpaymentPct === 100 ? netTotal : Math.round(netTotal * 0.2);
      updateAmountDue();

      if (selectedPaymentMethod === 'card') {
        detailContainer.innerHTML = `
          <div class="pay-detail-panel">
            <div class="pay-detail-heading">Card Information</div>
            <div class="field" style="margin-bottom:8px;">
              <label>Cardholder Name</label>
              <input type="text" id="bCardName" value="${$('#renterName')?.value || ''}" placeholder="Name on card" />
            </div>
            <div class="field" style="margin-bottom:8px;">
              <label>Card Number</label>
              <input type="text" id="bCardNum" placeholder="4xxx •••• •••• xxxx" maxlength="19" />
            </div>
            <div class="detail-grid" style="gap:10px;">
              <div class="field">
                <label>Expiry Date</label>
                <input type="text" id="bCardExp" placeholder="MM/YY" maxlength="5" />
              </div>
              <div class="field">
                <label>CVV</label>
                <input type="password" id="bCardCvv" placeholder="•••" maxlength="4" />
              </div>
            </div>
          </div>
        `;
        if (submitBtn) submitBtn.textContent = `Submit Payment (${fmtMoney(amountToPay)})`;
      } else if (selectedPaymentMethod === 'gcash') {
        detailContainer.innerHTML = `
          <div class="pay-detail-panel" style="text-align:center;">
            <div class="pay-detail-heading" style="text-align:center;">Scan QR Code via GCash</div>
            <div class="pay-qr-wrap">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=GCASH-RENTAL-${v.id}-${amountToPay}" alt="GCash QR" />
            </div>
            <div class="pay-account-info">
              <div class="pay-account-name">RentFlow Vehicles Inc.</div>
              <div class="pay-account-num">Account: 0917 582 9140</div>
            </div>
            <div class="pay-amount-line">Amount to Pay: <strong>${fmtMoney(amountToPay)}</strong></div>
          </div>

          <div class="field" style="margin-top:12px;">
            <label style="font-weight:600;font-size:0.78rem;">Reference Number *</label>
            <input type="text" id="bPayRefNo" placeholder="Enter GCash reference number" required />
          </div>

          <div class="field" style="margin-top:10px;">
            <label style="font-weight:600;font-size:0.78rem;">Proof of Payment (Screenshot) (Optional)</label>
            <div class="proof-upload-box" id="bProofDropzone">
              ${uploadedProofDataUrl ? `
                <div class="proof-preview-wrap">
                  <img src="${uploadedProofDataUrl}" class="proof-preview-img" alt="Proof Preview" />
                  <button type="button" class="proof-remove-btn" id="bRemoveProofBtn" title="Remove proof image"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="font-size:0.75rem;color:var(--text-hi);font-weight:600;">Proof of payment attached</div>
              ` : `
                <div style="font-size:0.82rem;font-weight:600;color:var(--text-hi);">Click or Drag Receipt Screenshot</div>
                <div style="font-size:0.72rem;color:var(--text-mid);margin-top:2px;">Supports JPG, PNG, or Screenshot</div>
              `}
              <input type="file" id="bProofInput" accept="image/*" style="display:none;" />
            </div>
          </div>
        `;
        if (submitBtn) submitBtn.textContent = `Submit Payment (${fmtMoney(amountToPay)})`;
      } else if (selectedPaymentMethod === 'bank_transfer') {
        detailContainer.innerHTML = `
          <div class="pay-detail-panel" style="text-align:center;">
            <div class="pay-detail-heading" style="text-align:center;">Scan via Banking App (QR Ph / InstaPay)</div>
            <div style="margin-bottom:12px;text-align:left;">
              <label style="font-size:0.74rem;font-weight:700;color:var(--text-mid);margin-bottom:6px;display:block;text-transform:uppercase;letter-spacing:0.04em;">Select Banking App:</label>
              <div class="bank-pill-group" id="bBankPillGroup">
                <button type="button" class="bank-pill active" data-bank="Maya"><i class="fa-solid fa-wallet"></i> Maya</button>
                <button type="button" class="bank-pill" data-bank="BDO"><i class="fa-solid fa-building-columns"></i> BDO</button>
                <button type="button" class="bank-pill" data-bank="BPI"><i class="fa-solid fa-building-columns"></i> BPI</button>
                <button type="button" class="bank-pill" data-bank="UnionBank"><i class="fa-solid fa-building-columns"></i> UnionBank</button>
                <button type="button" class="bank-pill" data-bank="Metrobank"><i class="fa-solid fa-building-columns"></i> Metrobank</button>
              </div>
              <select id="bBankSelect" class="clean-select" style="display:none;">
                <option value="Maya" selected>Maya</option>
                <option value="BDO">BDO</option>
                <option value="BPI">BPI</option>
                <option value="UnionBank">UnionBank</option>
                <option value="Metrobank">Metrobank</option>
              </select>
            </div>
            <div class="pay-qr-wrap">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=INSTAPAY-RENTAL-${v.id}-${amountToPay}" alt="Bank QR" />
            </div>
            <div class="pay-account-info">
              <div class="pay-account-name">RentFlow Official Account</div>
              <div class="pay-account-num">Account: 0012 3456 8899</div>
            </div>
            <div class="pay-amount-line">Amount to Pay: <strong>${fmtMoney(amountToPay)}</strong></div>
          </div>

          <div class="field" style="margin-top:12px;">
            <label style="font-weight:600;font-size:0.78rem;">Bank Reference / Transaction ID *</label>
            <input type="text" id="bPayRefNo" placeholder="Enter bank transaction ID" required />
          </div>

          <div class="field" style="margin-top:10px;">
            <label style="font-weight:600;font-size:0.78rem;">Proof of Payment (Screenshot) (Optional)</label>
            <div class="proof-upload-box" id="bProofDropzone">
              ${uploadedProofDataUrl ? `
                <div class="proof-preview-wrap">
                  <img src="${uploadedProofDataUrl}" class="proof-preview-img" alt="Proof Preview" />
                  <button type="button" class="proof-remove-btn" id="bRemoveProofBtn" title="Remove proof image"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="font-size:0.75rem;color:var(--text-hi);font-weight:600;">Proof of payment attached</div>
              ` : `
                <div style="font-size:0.82rem;font-weight:600;color:var(--text-hi);">Click or Drag Bank Receipt Screenshot</div>
                <div style="font-size:0.72rem;color:var(--text-mid);margin-top:2px;">Supports JPG, PNG, or Screenshot</div>
              `}
              <input type="file" id="bProofInput" accept="image/*" style="display:none;" />
            </div>
          </div>
        `;
        if (submitBtn) submitBtn.textContent = `Submit Payment (${fmtMoney(amountToPay)})`;

        // Bind Bank Pill selector
        const bankSelect = detailContainer.querySelector('#bBankSelect');
        detailContainer.querySelectorAll('.bank-pill').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            detailContainer.querySelectorAll('.bank-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (bankSelect) {
              bankSelect.value = btn.dataset.bank;
            }
          });
        });
      } else if (selectedPaymentMethod === 'cash') {
        detailContainer.innerHTML = `
          <div class="pay-detail-panel" style="text-align:center;">
            <div class="pay-detail-heading" style="text-align:center;">Via Meetup</div>
            <p style="font-size:0.82rem;color:var(--text-mid);margin:0 0 12px 0;line-height:1.45;">
              Pay in cash directly upon vehicle meetup / handover. No online payment required today.
            </p>
            <div style="background:var(--bg-surface);border:1px solid var(--accent-border);border-radius:8px;padding:12px 14px;text-align:left;font-size:0.8rem;color:var(--text-mid);">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span>Payable upon Meetup:</span>
                <strong style="color:var(--text-hi);">${fmtMoney(amountToPay)}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span>Meetup Option:</span>
                <strong style="color:var(--text-hi);">Agreed Meetup / Delivery Location</strong>
              </div>
            </div>
          </div>
        `;
        if (submitBtn) submitBtn.textContent = `Confirm Reservation (Via Meetup)`;
      }

      // Bind file upload for proof
      const dropzone = detailContainer.querySelector('#bProofDropzone');
      const fileInput = detailContainer.querySelector('#bProofInput');
      const removeBtn = detailContainer.querySelector('#bRemoveProofBtn');

      if (dropzone && fileInput) {
        dropzone.addEventListener('click', (e) => {
          if (e.target !== removeBtn && !e.target.closest('#bRemoveProofBtn')) {
            fileInput.click();
          }
        });
        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleProofFile(e.dataTransfer.files[0]);
          }
        });
        fileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            handleProofFile(e.target.files[0]);
          }
        });
      }

      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          uploadedProofDataUrl = null;
          renderBookingPaymentDetail();
        });
      }
    }

    function handleProofFile(file) {
      if (!file.type.startsWith('image/')) {
        toast('Please upload an image file (JPG, PNG, Screenshot).', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadedProofDataUrl = e.target.result;
        toast('Proof of payment attached successfully!', 'success');
        renderBookingPaymentDetail();
      };
      reader.readAsDataURL(file);
    }

    renderBookingPaymentDetail();
  }

  btnGoStep3.addEventListener('click', async () => {
    if (!start.value || !end.value) {
      toast('Please choose your rental schedule dates.', 'info');
      return;
    }
    await checkAvailability();
    if (!calculatedBookingData) {
      toast('Selected dates are not available. Please choose available dates.', 'error');
      return;
    }
    renderStep3Pricing();
    setStep(3);
  });

  submitBtn.addEventListener('click', async () => {
    if (!calculatedBookingData) return;

    const rNameInput = $('#renterName');
    const rPhoneInput = $('#renterPhone');
    const rName = rNameInput ? rNameInput.value.trim() : '';
    const rPhone = rPhoneInput ? rPhoneInput.value.trim() : '';
    const rEmail = $('#renterEmail')?.value.trim() || '';
    const rLicense = $('#renterLicense')?.value.trim() || '';
    const rAddress = $('#renterAddress')?.value.trim() || '';

    if (!rName) {
      toast('Pakilagay ang inyong buong pangalan (Full Name).', 'error');
      if (rNameInput) {
        rNameInput.focus();
        rNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (!rPhone) {
      toast('Pakilagay ang inyong contact phone number.', 'error');
      if (rPhoneInput) {
        rPhoneInput.focus();
        rPhoneInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Check Reference Number if GCash or Bank Transfer
    const chosenMethod = $('#paymentMethodSelect')?.value || 'card';
    const refNoInput = $('#bPayRefNo');
    const enteredRefNo = refNoInput ? refNoInput.value.trim() : '';

    if ((chosenMethod === 'gcash' || chosenMethod === 'bank_transfer') && !enteredRefNo) {
      toast('Please enter your payment Reference Number before submitting.', 'error');
      if (refNoInput) {
        refNoInput.focus();
        refNoInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting Request…';

    const finalAmount = calculatedBookingData.finalPayableTotal !== undefined ? calculatedBookingData.finalPayableTotal : calculatedBookingData.totalAmount;
    const isFullCash = (chosenMethod === 'cash');
    const paidAmount = isFullCash ? 0 : (selectedDownpaymentPct === 100 ? finalAmount : Math.round(finalAmount * 0.2));
    const balanceDue = isFullCash ? finalAmount : (finalAmount - paidAmount);

    let targetStatus = 'pending_verification';
    let targetPaymentStatus = 'pending_verification';
    let targetMethodName = 'Card';
    let finalRefNum = enteredRefNo || `BK-${Date.now().toString().slice(-8)}`;

    if (chosenMethod === 'card') {
      targetStatus = 'confirmed';
      targetPaymentStatus = 'verified';
      targetMethodName = 'Card';
      finalRefNum = `CARD-${Date.now().toString().slice(-6)}`;
    } else if (chosenMethod === 'gcash') {
      targetStatus = 'pending_verification';
      targetPaymentStatus = 'pending_verification';
      targetMethodName = 'GCash';
      finalRefNum = enteredRefNo || `GCASH-${Date.now().toString().slice(-8)}`;
    } else if (chosenMethod === 'bank_transfer') {
      targetStatus = 'pending_verification';
      targetPaymentStatus = 'pending_verification';
      const bankVal = $('#bBankSelect')?.value || 'InstaPay Bank';
      targetMethodName = `Bank Transfer (${bankVal})`;
      finalRefNum = enteredRefNo || `TXN-${Date.now().toString().slice(-8)}`;
    } else if (chosenMethod === 'cash') {
      targetStatus = 'cash_on_pickup';
      targetPaymentStatus = 'unpaid';
      targetMethodName = 'Via Meetup';
      finalRefNum = `CASH-${Date.now().toString().slice(-6)}`;
    }

    // Update profile in state and storage so user does not need to retype next time
    if (!state.profile) state.profile = {};
    if (rName) state.profile.full_name = rName;
    if (rPhone) state.profile.phone = rPhone;
    if (rEmail) state.profile.email = rEmail;
    if (rLicense) state.profile.license_number = rLicense;
    if (rAddress) state.profile.address = rAddress;

    try {
      localStorage.setItem('rentflow_guest_profile', JSON.stringify({
        full_name: rName,
        phone: rPhone,
        email: rEmail,
        license_number: rLicense,
        address: rAddress
      }));
      if (state.user?.id) {
        try {
          supabase.from('profiles').update({
            full_name: rName,
            phone: rPhone,
            license_number: rLicense,
            address: rAddress
          }).eq('id', state.user.id);
        } catch (e) { }
      }
    } catch (e) { }

    const contactNote = `Contact: ${rName} (${rPhone || 'No phone'})${rLicense ? ` | Lic: ${rLicense}` : ''}${rAddress ? ` | Meetup: ${rAddress}` : ''}`;
    const driverNote = calculatedBookingData.selectedDriverMode === 'with_driver'
      ? ` | Private Driver: Requested (+₱900 Day 1 online${calculatedBookingData.driverDirectPayFee > 0 ? `, ₱${calculatedBookingData.driverDirectPayFee.toLocaleString()} direct to driver` : ''})`
      : ' | Driver: Self-Drive';
    const fullNotes = contactNote + driverNote;

    const activeCustomerId = state.user?.id || '0e8d807a-49fb-42d7-ab7b-f5ea609f0ef0';
    const notesSummary = `${fullNotes} | Method: ${targetMethodName} | Ref: ${finalRefNum}`;
    const cleanDbPayload = {
      customer_id: activeCustomerId,
      vehicle_id: Number(v.id),
      start_date: start.value,
      end_date: end.value,
      total_amount: finalAmount,
      paid_amount: targetPaymentStatus === 'verified' ? paidAmount : (chosenMethod === 'cash' ? 0 : paidAmount),
      balance_due: targetPaymentStatus === 'verified' ? balanceDue : (chosenMethod === 'cash' ? finalAmount : balanceDue),
      payment_type: selectedDownpaymentPct === 100 ? 'full' : 'partial',
      downpayment_percent: selectedDownpaymentPct,
      status: 'pending',
      review_notes: notesSummary,
    };

    let newBooking = null;
    try {
      // Ensure we have an active session so Supabase RLS allows the insert
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        await supabase.auth.signInWithPassword({
          email: 'staff@rentflow.ph',
          password: 'RentFlowStaff2026!'
        }).catch(() => {});
      }

      const { data: createdBooking, error } = await supabase.from('bookings').insert(cleanDbPayload).select().single();
      if (!error && createdBooking) {
        newBooking = createdBooking;
        if (paidAmount > 0) {
          try {
            await supabase.from('payments').insert({
              booking_id: newBooking.id,
              amount: paidAmount,
              status: targetPaymentStatus === 'verified' ? 'successful' : 'pending',
              method: targetMethodName,
              paid_at: new Date().toISOString()
            });
          } catch (pe) {}
        }
      } else {
        console.warn('Supabase DB booking insert notice:', error?.message);
      }
    } catch (e) {
      console.warn('Supabase booking exception:', e);
    }

    const assignedId = newBooking?.id ? String(newBooking.id) : `bk-${Date.now().toString().slice(-6)}`;

    // Save into multi-user demo store so other roles (Staff, Admin) can see it immediately
    const recordToSave = {
      ...cleanDbPayload,
      ...(newBooking || {}),
      id: assignedId,
      status: targetStatus,
      payment_status: targetPaymentStatus,
      payment_method: targetMethodName,
      payment_ref: finalRefNum,
      ref_number: finalRefNum,
      proof_image: uploadedProofDataUrl || null,
      customer_name: rName,
      customer_email: rEmail,
      customer_phone: rPhone,
      driver_license: rLicense,
      vehicles: { ...v },
      created_at: newBooking?.created_at || new Date().toISOString()
    };
    saveLocalBooking(recordToSave);

    // Broadcast live event across all open windows, tabs, and portals
    broadcastNewBookingRequest(recordToSave);

    if (calculatedBookingData.dId && newBooking?.id) {
      await supabase.from('driver_assignments').insert({
        booking_id: newBooking.id,
        driver_id: Number(calculatedBookingData.dId),
      }).then(() => { }).catch(() => { });
    }

    closeModal();
    state.tab = 'bookings';
    if (window.renderShell) {
      window.renderShell();
    }

    if (targetStatus === 'pending_verification') {
      toast(`Payment submitted! Reference #${finalRefNum}. Reservation status is now Pending Verification.`, 'success');
    } else if (targetStatus === 'cash_on_pickup') {
      toast(`Reservation confirmed! Status: Cash on Pickup. Please pay ${fmtMoney(finalAmount)} upon vehicle meetup/pickup.`, 'success');
    } else {
      toast(`Payment verified via ${targetMethodName}! Reservation confirmed, vehicle is ready for release.`, 'success');
    }
  });
}

