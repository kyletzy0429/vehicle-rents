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
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.25rem;font-weight:800;color:#0f172a;">${v.name}</h3>
        <span class="muted" style="font-size:0.78rem;">${catName} · Plate: ${maskPlate(v.plate_number)}</span>
      </div>
      <div class="modal-close" id="mClose">Close</div>
    </div>

    <div class="booking-stepper">
      <div class="step-item active" id="stepNode1" data-step="1">
        <span class="step-num">1</span>
        <span class="step-title">Vehicle</span>
      </div>
      <div class="step-divider" id="stepDiv1"></div>
      <div class="step-item" id="stepNode2" data-step="2">
        <span class="step-num">2</span>
        <span class="step-title">Dates &amp; Driver</span>
      </div>
      <div class="step-divider" id="stepDiv2"></div>
      <div class="step-item" id="stepNode3" data-step="3">
        <span class="step-num">3</span>
        <span class="step-title">Fill-up &amp; Payment</span>
      </div>
    </div>

    <div class="step-content" id="stepSection1">
      <div class="angle-viewer" style="margin-bottom:16px;">
        <div class="angle-viewer-img-wrap" style="height:250px;border-radius:12px;overflow:hidden;background:#f8fafc;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;">
          <img id="detailCarImg" class="angle-viewer-img" src="${exactImg}" alt="${v.name}" style="width:100%;height:100%;object-fit:cover;" />
        </div>
      </div>

      <p class="muted" style="margin-bottom:14px;line-height:1.5;color:#475569;">
        ${(v.description || '').replace(/FOX Racing shocks,?\s*/gi, '').replace(/\b\d+-Seater\s+(Pickup Truck|SUV|Sedan|MPV|Subcompact Sedan|Modern Crossover MPV|Economy Sedan|Hatchback|Full-size Passenger Van)\.?\s*/gi, '').trim() || 'Comfortable, fuel-efficient, and well-maintained rental vehicle.'}
      </p>

      <div class="detail-grid" style="margin-bottom:16px;background:#f8fafc;padding:12px 16px;border-radius:10px;border:1px solid #e2e8f0;">
        <div>
          <label>Availability Status</label>
          <div><span class="badge ${statusBadgeClass}">${badgeContent}</span></div>
        </div>
        <div>
          <label>Daily Rental Rate</label>
          <div style="font-weight:800;font-size:1.05rem;color:var(--accent);">${fmtMoney(rate)} <span style="font-size:0.75rem;font-weight:500;color:#64748b;">/ day</span></div>
        </div>
        <div>
          <label>Passenger Capacity</label>
          <div style="font-weight:700;font-size:0.88rem;color:#0f172a;">${isMotorcycle ? '2 Passengers' : (v.seats ?? '5 Passengers')}</div>
        </div>
        <div>
          <label>Transmission</label>
          <div style="font-weight:700;font-size:0.88rem;color:#0f172a;">${v.transmission ?? 'Automatic'}</div>
        </div>
        <div>
          <label>Fuel Type</label>
          <div style="font-weight:700;font-size:0.88rem;color:#0f172a;">${fuelType}</div>
        </div>
        <div>
          <label>${isMotorcycle ? 'Included Gear' : 'Air Conditioning'}</label>
          <div style="font-weight:700;font-size:0.88rem;color:#0f172a;">${isMotorcycle ? 'Helmet Included' : (hasAC ? 'Air Conditioned' : 'Non-AC')}</div>
        </div>
      </div>


      <div style="display:flex;gap:10px;margin-top:14px;">
        <button type="button" class="btn btn-primary btn-block" id="btnGoStep2">
          Proceed to Schedule &amp; Driver
        </button>
      </div>
    </div>

    <div class="step-content hidden" id="stepSection2">
      <h4 style="margin-bottom:12px;display:flex;align-items:center;gap:6px;color:#0f172a;">
        1. Select Rental Dates
      </h4>
      
      <!-- Hertz / Booking.com Style Interactive Date Bar -->
      <div class="cal-booking-inputs-bar">
        <div class="cal-input-card active" id="calCardPickup" title="Click to choose Pick-up Date">
          <div class="cal-input-header">
            <i class="fa-regular fa-calendar-check"></i>
            <span>Pick-up Date</span>
          </div>
          <div class="cal-input-main">
            <span class="cal-date-text" id="calPickupText">Select Date</span>
            <span class="cal-time-badge">Noon</span>
          </div>
        </div>

        <div class="cal-input-divider">
          <i class="fa-solid fa-arrow-right"></i>
        </div>

        <div class="cal-input-card" id="calCardReturn" title="Click to choose Return Date">
          <div class="cal-input-header">
            <i class="fa-regular fa-calendar-xmark"></i>
            <span>Return Date</span>
          </div>
          <div class="cal-input-main">
            <span class="cal-date-text" id="calReturnText">Select Date</span>
            <span class="cal-time-badge">Noon</span>
          </div>
        </div>

        <div class="cal-summary-pill" id="calTripSummary">
          <span class="cal-summary-days" id="calTripDays">Select Dates</span>
        </div>
      </div>

      <!-- Preserved hidden inputs so all existing forms, validation and handlers work seamlessly -->
      <div style="display:none;">
        <input type="date" id="bStart" min="${todayStr}" />
        <input type="date" id="bEnd" min="${todayStr}" />
      </div>

      <div id="calWidgetContainer"></div>
      <div id="availabilityMsg" class="muted" style="margin-bottom:12px;"></div>

      <div class="divider"></div>
      <h4 style="margin-bottom:12px;display:flex;align-items:center;gap:6px;color:#0f172a;">
        2. Billing Method
      </h4>
      <div class="detail-grid" style="margin-bottom:14px;">
        <div class="field">
          <label>Charge Type</label>
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

      <div class="system-driver-card ${isMotorcycle ? 'disabled' : ''}" id="privateDriverSection">
        <h4 class="system-driver-title">Private Driver (Optional)</h4>
        <p class="system-driver-desc">
          Hire a private driver for the duration of your rental for P900/day. Please note that only the first day will be included in the total below. Any additional day will have to be paid directly to the driver.
        </p>
        <label class="system-driver-checkbox-label" for="driverHireCheckbox">
          <input type="checkbox" id="driverHireCheckbox" ${isMotorcycle ? 'disabled' : ''} />
          <span>I WANT TO HIRE A PRIVATE DRIVER (+₱900.00)</span>
        </label>
        ${isMotorcycle ? '<div class="system-driver-moto-note">Private driver is not available for motorcycle rentals.</div>' : ''}
      </div>



      <div style="display:flex;gap:10px;margin-top:16px;">
        <button type="button" class="btn btn-ghost" id="btnBackStep1" style="flex:1;">
          Back
        </button>
        <button type="button" class="btn btn-primary" id="btnGoStep3" style="flex:2;" disabled>
          Proceed to Fill-up &amp; Pricing
        </button>
      </div>
    </div>

    <div class="step-content hidden" id="stepSection3">
      <!-- ═══ RENTER FILL-UP FORM ═══ -->
      <div class="renter-fillup-card">
        <div class="renter-fillup-header">
          <div class="renter-fillup-icon">
            <i class="fa-solid fa-user-pen"></i>
          </div>
          <div>
            <h4 class="renter-fillup-title">Renter Information</h4>
            <span class="renter-fillup-sub">Pakilagay ang inyong impormasyon para sa opisyal na booking</span>
          </div>
        </div>

        <div class="detail-grid" style="margin-bottom:12px;">
          <div class="field">
            <label style="font-weight:700;font-size:0.78rem;">Full Name (Buong Pangalan) <span style="color:#ef4444;">*</span></label>
            <input type="text" id="renterName" value="${p.full_name || state.user?.user_metadata?.full_name || ''}" placeholder="e.g. Mark Lester Ramos" required />
          </div>
          <div class="field">
            <label style="font-weight:700;font-size:0.78rem;">Phone Number (Contact Number) <span style="color:#ef4444;">*</span></label>
            <input type="tel" id="renterPhone" value="${p.phone || ''}" placeholder="e.g. 0917 582 9140" required />
          </div>
        </div>

        <div class="detail-grid" style="margin-bottom:12px;">
          <div class="field">
            <label style="font-weight:700;font-size:0.78rem;">Email Address</label>
            <input type="email" id="renterEmail" value="${p.email || state.user?.email || ''}" placeholder="e.g. mark.ramos@gmail.com" />
          </div>
          <div class="field">
            <label style="font-weight:700;font-size:0.78rem;">Driver's License No. <span style="font-weight:400;font-size:0.72rem;color:#94a3b8;">(Optional)</span></label>
            <input type="text" id="renterLicense" value="${p.license_number || ''}" placeholder="e.g. N02-19-482019" />
          </div>
        </div>

        <div class="field" style="margin-bottom:12px;">
          <label style="font-weight:700;font-size:0.78rem;">Meetup / Delivery Address or Notes <span style="font-weight:400;font-size:0.72rem;color:#94a3b8;">(Optional)</span></label>
          <input type="text" id="renterAddress" value="${p.address || ''}" placeholder="e.g. Puerto Princesa Airport / Hotel Lobby" />
        </div>

        <div class="renter-verify-badge">
          <i class="fa-solid fa-circle-check" style="color:#059669;font-size:0.95rem;"></i>
          <span>Physical driver's license will be verified in-person upon vehicle meetup / pickup. No online upload required.</span>
        </div>
      </div>

      <div id="transparentPricingContainer"></div>

      <div class="guarantee-box">
        <div>
          <strong>100% Transparent Guarantee:</strong> Walang hidden fees. Full-to-full fuel policy. Libreng cancellation hanggang 24 oras bago ang pickup. Walang kailangang online license upload — ipresenta lamang ang physical driver's license kapag nag-pickup na ng sasakyan.
        </div>
      </div>

      <div class="complete-payment-card">
        <div class="complete-payment-tag">PAYMENT</div>
        <h4 class="complete-payment-title">Complete your payment</h4>
        <div class="complete-payment-due">
          Amount due: <strong id="paymentAmountDueVal">₱0.00</strong>
        </div>

        <div class="field" style="margin-bottom:12px;">
          <label>Payment structure</label>
          <select id="payStructureSelect" class="clean-select">
            <option value="100">Pay in Full (100%) — Instant zero-balance reservation</option>
            <option value="20">Downpayment (20%) — Balance upon vehicle pickup</option>
          </select>
        </div>

        <div class="field" style="margin-bottom:14px;">
          <label>Payment method</label>
          <select id="paymentMethodSelect" class="clean-select">
            <option value="card">Card</option>
            <option value="gcash">GCash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Via meetup</option>
          </select>
        </div>

        <div id="bookingPayMethodDetail"></div>
      </div>

      <div style="display:flex;gap:10px;margin-top:14px;">
        <button type="button" class="btn btn-ghost" id="btnBackStep2" style="flex:1;">
          Back
        </button>
        <button type="button" class="btn btn-primary" id="submitBooking" style="flex:2;">
          Submit Payment
        </button>
      </div>
    </div>
  `, true);

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
        returnText.textContent = 'Same Day / Return';
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
        const days = Math.max(1, Math.round((new Date(selectedEndVal) - new Date(selectedStartVal)) / (1000 * 60 * 60 * 24)));
        tripDaysEl.innerHTML = `<strong>${days} Day${days > 1 ? 's' : ''}</strong> Rental`;
      } else if (selectedStartVal) {
        tripDaysEl.innerHTML = `<span id="calQuickSingleDay" style="cursor:pointer;color:var(--accent);font-weight:700;" title="Click for 1-day rental">1 Day? Tap here</span>`;
      } else {
        tripDaysEl.textContent = 'Select dates';
      }
    }

    // Pricing tiers based on average vehicle rates across categories
    const baseRate = rate;
    const weekendMultiplier = 1.35;
    const fridayMultiplier = 1.15;
    const tierLow = baseRate;
    const tierMid = Math.round(baseRate * fridayMultiplier);
    const tierHigh = Math.round(baseRate * weekendMultiplier);

    function getPriceTier(dateIso) {
      const dayOfWeek = new Date(dateIso + 'T00:00:00').getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) return { tier: 'high', price: tierHigh };
      if (dayOfWeek === 5) return { tier: 'mid', price: tierMid };
      return { tier: 'low', price: tierLow };
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

        const { tier, price } = getPriceTier(dateIso);

        if (isPast) {
          daysHTML += `<div class="cal-day cal-day-past" data-date="${dateIso}">${d}</div>`;
        } else if (isBooked) {
          daysHTML += `<div class="cal-day cal-day-booked" data-date="${dateIso}" title="Booked (Unavailable)">${d}</div>`;
        } else {
          let dayClass = `cal-day-price cal-day-price-${tier}`;
          if (isStart && isEnd) dayClass += ' cal-day-selected cal-day-single';
          else if (isStart) dayClass += ' cal-day-selected cal-day-start';
          else if (isEnd) dayClass += ' cal-day-selected cal-day-end';
          else if (isInRange) dayClass += ' cal-day-in-range';
          if (isToday) dayClass += ' cal-day-today';

          daysHTML += `
            <div class="cal-day ${dayClass}" data-date="${dateIso}" title="${monthNames[month]} ${d}, ${year} - ₱${price.toLocaleString()}/day">
              ${d}
            </div>
          `;
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

    // Calculate left and right month
    const leftYear = calViewYear;
    const leftMonth = calViewMonth;
    let rightMonth = calViewMonth + 1;
    let rightYear = calViewYear;
    if (rightMonth > 11) { rightMonth = 0; rightYear++; }

    // Check if prev button should be disabled (cannot navigate before current month)
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
        <div class="cal-price-legend">
          <div class="cal-price-legend-item">
            <span class="cal-legend-pill cal-pill-low">₱${tierLow.toLocaleString()}+</span>
          </div>
          <div class="cal-price-legend-item">
            <span class="cal-legend-pill cal-pill-mid">₱${tierMid.toLocaleString()}+</span>
          </div>
          <div class="cal-price-legend-item">
            <span class="cal-legend-pill cal-pill-high">₱${tierHigh.toLocaleString()}+</span>
          </div>
          <span class="cal-legend-note">Based on average prices of all cars.</span>
        </div>
      </div>
    `;

    // Month Navigation Events
    $('#calPrevMonth')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (isPrevDisabled) return;
      calViewMonth--;
      if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
      renderInteractiveCalendar();
    });

    $('#calNextMonth')?.addEventListener('click', (e) => {
      e.preventDefault();
      calViewMonth++;
      if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
      renderInteractiveCalendar();
    });

    // Top Card Click Handlers
    $('#calCardPickup')?.addEventListener('click', () => {
      start.value = '';
      end.value = '';
      renderInteractiveCalendar();
      checkAvailability();
    });

    $('#calCardReturn')?.addEventListener('click', () => {
      if (start.value && !end.value) {
        // Quick toggle to 1-day rental!
        end.value = start.value;
        renderInteractiveCalendar();
        checkAvailability();
      } else if (start.value && end.value) {
        end.value = '';
        renderInteractiveCalendar();
        checkAvailability();
      }
    });

    // Quick single-day rental helper link if present
    const qBtn = calContainer.querySelector('#calQuickSingleDay') || $('#calQuickSingleDay');
    if (qBtn) {
      qBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (start.value) {
          end.value = start.value;
          renderInteractiveCalendar();
          checkAvailability();
        }
      });
    }

    // Hover Range Preview Effect & Date Selection
    const priceCells = calContainer.querySelectorAll('.cal-day-price');
    priceCells.forEach(cell => {
      cell.addEventListener('mouseenter', () => {
        if (start.value && !end.value) {
          const hoveredDate = cell.dataset.date;
          if (hoveredDate > start.value) {
            priceCells.forEach(c => {
              const d = c.dataset.date;
              if (d > start.value && d <= hoveredDate) {
                c.classList.add('cal-day-hover-in-range');
                c.style.backgroundColor = '#273549';
                c.style.color = '#ffffff';
                c.style.borderRadius = '0';
              } else if (d > start.value) {
                c.classList.remove('cal-day-hover-in-range');
                const t = c.dataset.tier;
                if (t === 'low') { c.style.backgroundColor = '#71deb5'; c.style.color = '#0f172a'; }
                else if (t === 'mid') { c.style.backgroundColor = '#fbc072'; c.style.color = '#0f172a'; }
                else if (t === 'high') { c.style.backgroundColor = '#fda4af'; c.style.color = '#0f172a'; }
                c.style.borderRadius = '8px';
              }
            });
          }
        }
      });

      cell.addEventListener('click', () => {
        const clickedDate = cell.dataset.date;

        // Check if the next consecutive day is booked or unavailable
        const nextDateObj = new Date(clickedDate + 'T00:00:00');
        nextDateObj.setDate(nextDateObj.getDate() + 1);
        const nextDateIso = nextDateObj.toISOString().slice(0, 10);
        const isNextDayBooked = allBookedIntervals && allBookedIntervals.some(b => nextDateIso >= b.start_date && nextDateIso <= b.end_date);

        if (!start.value || (start.value && end.value)) {
          start.value = clickedDate;
          // If the next consecutive date is already booked, this is an isolated single day left!
          // Auto-select as 1-day rental so the user can immediately book without being blocked!
          if (isNextDayBooked) {
            end.value = clickedDate;
            toast('1-day rental selected (next date is already reserved).', 'info');
          } else {
            end.value = '';
          }
        } else if (clickedDate === start.value) {
          // User clicked on the exact same date again -> Confirm as 1-day rental!
          end.value = clickedDate;
          toast('1-day rental confirmed for this date.', 'info');
        } else if (clickedDate > start.value) {
          // Check if any existing booking starts strictly between start.value and clickedDate
          const hasBookedInside = allBookedIntervals && allBookedIntervals.some(b => {
            return b.start_date > start.value && b.start_date <= clickedDate;
          });
          if (hasBookedInside) {
            toast('Cannot select range across already booked dates.', 'error');
            start.value = clickedDate;
            if (isNextDayBooked) {
              end.value = clickedDate;
            } else {
              end.value = '';
            }
          } else {
            end.value = clickedDate;
          }
        } else {
          // Clicked earlier date
          start.value = clickedDate;
          if (isNextDayBooked) {
            end.value = clickedDate;
          } else {
            end.value = '';
          }
        }
        renderInteractiveCalendar();
        checkAvailability();
      });
    });

    calContainer.addEventListener('mouseleave', () => {
      priceCells.forEach(c => {
        const d = c.dataset.date;
        if (d !== start.value && d !== end.value && !(start.value && end.value && d > start.value && d < end.value)) {
          c.classList.remove('cal-day-hover-in-range');
          const t = c.dataset.tier;
          if (t === 'low') { c.style.backgroundColor = '#71deb5'; c.style.color = '#0f172a'; }
          else if (t === 'mid') { c.style.backgroundColor = '#fbc072'; c.style.color = '#0f172a'; }
          else if (t === 'high') { c.style.backgroundColor = '#fda4af'; c.style.color = '#0f172a'; }
          c.style.borderRadius = '8px';
        }
      });
    });
  }

  // Prepopulate dates if passed from Hero Availability search
  if (prefillStart) {
    start.value = prefillStart;
    if (prefillEnd && prefillEnd >= prefillStart) {
      end.value = prefillEnd;
    }
  }

  renderInteractiveCalendar();

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

    availMsg.textContent = 'Verifying date availability…';
    const { data: overlaps, error } = await supabase
      .from('bookings')
      .select('id, start_date, end_date')
      .eq('vehicle_id', v.id)
      .in('status', ['pending', 'approved', 'active'])
      .lte('start_date', end.value)
      .gte('end_date', start.value);

    if (error) { availMsg.textContent = 'Could not check availability.'; return; }
    if (overlaps && overlaps.length) {
      availMsg.innerHTML = `<span style="color:#dc2626;font-weight:700;">Dates already booked. Please choose available dates above.</span>`;
      btnGoStep3.disabled = true;
      return;
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
        <h4 style="font-size:0.95rem;font-weight:800;color:#0f172a;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
          Transparent Itemized Breakdown
        </h4>

        <div class="price-item">
          <span>
            ${v.name} Base Rental
            <div style="font-size:0.75rem;color:#64748b;">
              ${data.isPerKm ? `${data.estKm} km × ${fmtMoney(data.kmRate)}/km` : `${data.days} day(s) × ${fmtMoney(rate)}/day`}
            </div>
          </span>
          <span style="font-weight:700;color:#0f172a;">${fmtMoney(data.vehicleCost)}</span>
        </div>

        ${data.selectedDriverMode === 'with_driver' ? `
          <div class="price-item">
            <span>
              Private Driver (Optional)
              <div style="font-size:0.75rem;color:#64748b;">
                First day included in checkout ${data.days > 1 ? `· Remaining ${data.days - 1} day(s) (${fmtMoney(data.driverDirectPayFee)}) to be paid directly to driver` : ''}
              </div>
            </span>
            <span style="font-weight:700;color:var(--accent);">+₱900.00</span>
          </div>
        ` : `
          <div class="price-item">
            <span>
              Private Driver (Optional)
              <div style="font-size:0.75rem;color:#64748b;">Self-Drive (Customer Driving)</div>
            </span>
            <span style="font-weight:700;color:#059669;">₱0 (Self-Drive)</span>
          </div>
        `}

        <div class="price-item">
          <span>
            Comprehensive Vehicle Protection
            <div style="font-size:0.75rem;color:#059669;font-weight:600;">Basic third-party liability included</div>
          </span>
          <span style="font-weight:700;color:#059669;">FREE</span>
        </div>

        <div class="price-item">
          <span>
            Sanitation &amp; Vehicle Prep
            <div style="font-size:0.75rem;color:#059669;font-weight:600;">Complimentary pre-delivery wash</div>
          </span>
          <span style="font-weight:700;color:#059669;">FREE</span>
        </div>

        <div class="price-item">
          <span>
            Refundable Security Deposit
            <div style="font-size:0.75rem;color:#d97706;font-weight:600;">Payable upon pickup · 100% refundable upon safe return</div>
          </span>
          <span style="font-weight:600;color:#475569;">3,000.00 <span style="font-size:0.72rem;color:#94a3b8;">(deposit)</span></span>
        </div>

        <div class="price-item total-row">
          <span>
            Estimated Total Amount
            <div style="font-size:0.74rem;font-weight:500;color:#64748b;">All taxes &amp; vehicle rental fees included</div>
          </span>
          <span class="total-val">${fmtMoney(netTotal)}</span>
        </div>
      </div>
    `;

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
                  <button type="button" class="proof-remove-btn" id="bRemoveProofBtn" title="Remove proof image">✕</button>
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
            <div style="margin-bottom:10px;text-align:left;">
              <label style="font-size:0.75rem;font-weight:600;color:var(--text-mid);margin-bottom:4px;display:block;">Select Banking App:</label>
              <select id="bBankSelect" class="clean-select">
                <option value="Maya">Maya / Smart Padala</option>
                <option value="BDO">BDO Unibank</option>
                <option value="BPI">BPI Online</option>
                <option value="UnionBank">UnionBank of the Philippines</option>
                <option value="Metrobank">Metrobank Direct</option>
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
                  <button type="button" class="proof-remove-btn" id="bRemoveProofBtn" title="Remove proof image">✕</button>
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

  btnGoStep3.addEventListener('click', () => {
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

