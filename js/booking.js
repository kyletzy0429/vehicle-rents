import { supabase } from './config.js';
import { state, DEFAULT_SETTINGS, getSystemSettings, saveLocalBooking, getLocalBookings } from './state.js';
import { $, $$, fmtMoney, fmtDate, daysBetween, maskPlate, toast, openModal, closeModal } from './utils.js';
import { getVehicleDailyRate, getVehicleCategoryName, getExactVehicleImage } from './vehicles.js';
import { broadcastNewBookingRequest } from './realtime.js';

export async function openVehicleDetail(id, prefillStart = '', prefillEnd = '') {
    const v = state.vehicles.find(v => String(v.id) === String(id));
    if (!v) return;
    const fuelType = v.fuel_type ?? 'Gasoline';
    const hasAC = v.has_ac !== undefined ? v.has_ac : true;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Compute clean initial dates: today to today + 3 days
    const defaultEnd = new Date(today);
    defaultEnd.setDate(defaultEnd.getDate() + 3);
    const defaultEndStr = defaultEnd.toISOString().slice(0, 10);
    const initStart = prefillStart || todayStr;
    const initEnd = (prefillEnd && prefillEnd >= initStart) ? prefillEnd : defaultEndStr;

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
    let selectedDriverMode = 'self';
    let selectedDriverId = drivers.length ? String(drivers[0].id) : '';

    // Merge both Supabase and local demo bookings
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
    const seats = v.seats || (isMotorcycle ? 2 : (catName.toLowerCase().includes('van') ? 14 : (catName.toLowerCase().includes('mpv') || catName.toLowerCase().includes('suv') ? 7 : 5)));

    const isAvailable = v.status === 'available';
    const isRented = v.status === 'rented';
    const isMaintenance = v.status === 'maintenance';

    let statusBadgeClass = isAvailable ? 'badge-available' : (isRented ? 'badge-rented' : `badge-${v.status}`);
    let badgeContent = isAvailable ? 'Available' : (isRented ? 'Currently Rented' : (isMaintenance ? 'In Maintenance' : v.status));

    // Initial Step is 2 ("Dates and driver") per 4-booking-process.png
    let currentStep = 2;
    let selectedDownpaymentPct = 100;

    const savedProfileStr = localStorage.getItem('rentflow_guest_profile');
    const savedProfile = savedProfileStr ? JSON.parse(savedProfileStr) : {};
    const p = { ...(state.profile || {}), ...savedProfile };

    closeModal();

    let targetContainer = document.getElementById('mainView');
    if (!targetContainer || state.portal !== 'customer') {
        state.portal = 'customer';
        state.tab = 'browse';
        if (window.renderShell) window.renderShell();
        targetContainer = document.getElementById('mainView');
    }

    targetContainer.innerHTML = `
    <div class="booking-page-view" style="min-height:100vh;background:var(--bg-canvas,#F5F2FB);padding-bottom:80px;">
      <!-- ═══ STEPPER BAR (Matches 4-booking-process.png) ═══ -->
      <div class="booking-stepper-v2">
        <div class="step-item" id="stepNode1" data-step="1">
          <div class="step-num-wrap"><span class="step-num">1</span></div>
          <div class="step-text-wrap"><span class="step-title">Vehicle</span></div>
        </div>
        <div class="step-divider active" id="stepDiv1"></div>
        <div class="step-item active" id="stepNode2" data-step="2">
          <div class="step-num-wrap"><span class="step-num">2</span></div>
          <div class="step-text-wrap"><span class="step-title">Dates and driver</span></div>
        </div>
        <div class="step-divider" id="stepDiv2"></div>
        <div class="step-item" id="stepNode3" data-step="3">
          <div class="step-num-wrap"><span class="step-num">3</span></div>
          <div class="step-text-wrap"><span class="step-title">Fill-up and pay</span></div>
        </div>
      </div>

      <!-- ═══ 2-COLUMN BOOKING CONTAINER (Matches 4-booking-process.png) ═══ -->
      <div class="booking-view-container" style="max-width:1200px;margin:0 auto;padding:0 24px;">
        <div class="booking-2col-layout">
        <!-- LEFT COLUMN: FORMS & ACTIONS -->
        <div class="booking-form-col">

          <!-- ═══ STEP 1: VEHICLE OVERVIEW ═══ -->
          <div class="step-content hidden" id="stepSection1">
            <div class="booking-section-card">
              <h4 class="section-card-title">Vehicle Specifications</h4>
              <div class="booking-fields-grid">
                <div class="field"><label>Capacity</label><input type="text" value="${seats} Seats" class="clean-input" readonly /></div>
                <div class="field"><label>Transmission</label><input type="text" value="${v.transmission ?? 'Automatic'}" class="clean-input" readonly /></div>
                <div class="field"><label>Fuel Type</label><input type="text" value="${fuelType}" class="clean-input" readonly /></div>
                <div class="field"><label>Climate Control</label><input type="text" value="${hasAC ? 'Air Conditioned' : 'Standard Vent'}" class="clean-input" readonly /></div>
              </div>
            </div>
            <div class="booking-action-row">
              <button type="button" class="btn btn-primary" id="btnGoStep2">
                <span>Proceed to Dates &amp; Driver</span>
                <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>

          <!-- ═══ STEP 2: DATES AND DRIVER (Matches 4-booking-process.png) ═══ -->
          <div class="step-content" id="stepSection2">
            <!-- Card 1: Trip Details (Minimized) -->
            <div class="booking-section-card" style="padding:16px 20px;margin-bottom:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h4 class="section-card-title" style="margin:0;font-size:1.02rem;">Trip details</h4>
                <span style="font-size:0.75rem;color:var(--text-mid);">Rental dates &amp; location</span>
              </div>
              <div class="booking-fields-grid" style="gap:10px;">
                <div class="field">
                  <label for="bStart" style="font-size:0.75rem;margin-bottom:4px;font-weight:600;color:var(--text-mid);">Pick-up date</label>
                  <input type="date" id="bStart" min="${todayStr}" value="${initStart}" class="clean-input" style="height:36px;padding:4px 10px;font-size:0.85rem;" required />
                </div>
                <div class="field">
                  <label for="bEnd" style="font-size:0.75rem;margin-bottom:4px;font-weight:600;color:var(--text-mid);">Return date</label>
                  <input type="date" id="bEnd" min="${todayStr}" value="${initEnd}" class="clean-input" style="height:36px;padding:4px 10px;font-size:0.85rem;" required />
                </div>
                <div class="field">
                  <label for="bLocation" style="font-size:0.75rem;margin-bottom:4px;font-weight:600;color:var(--text-mid);">Pick-up location</label>
                  <input type="text" id="bLocation" value="${p.address || 'Puerto Princesa Airport'}" class="clean-input" style="height:36px;padding:4px 10px;font-size:0.85rem;" />
                </div>
                <div class="field">
                  <label for="bTime" style="font-size:0.75rem;margin-bottom:4px;font-weight:600;color:var(--text-mid);">Pick-up time</label>
                  <input type="text" id="bTime" value="09:00 AM" class="clean-input" style="height:36px;padding:4px 10px;font-size:0.85rem;" />
                </div>
              </div>
            </div>

            <!-- Card 2: Driver Information -->
            <div class="booking-section-card" style="padding:16px 20px;margin-bottom:14px;">
              <h4 class="section-card-title" style="margin:0 0 12px 0;font-size:1.02rem;">Driver information</h4>
              <div class="booking-fields-grid">
                <div class="field">
                  <label for="renterName">Full name</label>
                  <input type="text" id="renterName" value="${p.full_name || 'Juan Dela Cruz'}" placeholder="Juan Dela Cruz" class="clean-input" required />
                </div>
                <div class="field">
                  <label for="renterPhone">Mobile number</label>
                  <input type="tel" id="renterPhone" value="${p.phone || '0917 000 0000'}" placeholder="0917 000 0000" class="clean-input" required />
                </div>
                <div class="field">
                  <label for="renterLicense">License number</label>
                  <input type="text" id="renterLicense" value="${p.license_number || 'N01-00-000000'}" placeholder="N01-00-000000" class="clean-input" />
                </div>
                <div class="field">
                  <label for="renterLicenseExpiry">License expiry</label>
                  <input type="text" id="renterLicenseExpiry" value="${p.license_expiry || 'Mar 2029'}" placeholder="Mar 2029" class="clean-input" />
                </div>
              </div>
            </div>

            <!-- Optional Driver Add-on -->
            ${!isMotorcycle ? `
              <div class="system-driver-card">
                <label class="system-driver-checkbox-label" for="driverHireCheckbox">
                  <input type="checkbox" id="driverHireCheckbox" />
                  <span class="system-driver-text">Add Private Driver Service <span class="driver-price-tag">(+PHP 900 / day)</span></span>
                </label>
              </div>
            ` : '<input type="checkbox" id="driverHireCheckbox" style="display:none;" />'}

            <div id="availabilityMsg" class="availability-callout"></div>

            <div class="booking-action-row">
              <button type="button" class="btn btn-ghost" id="btnBackStep1">Back</button>
              <button type="button" class="btn btn-primary" id="btnGoStep3">Continue to payment</button>
            </div>
          </div>

          <!-- ═══ STEP 3: FILL-UP AND PAY ═══ -->
          <div class="step-content hidden" id="stepSection3">
            <div id="transparentPricingContainer"></div>

            <div class="booking-section-card">
              <h4 class="section-card-title">Payment Structure</h4>
              <div class="pay-structure-selector" id="bPayStructureSelector" style="display:flex;gap:12px;margin-bottom:12px;">
                <div class="selector-opt-card active btn btn-ghost" data-pct="100" style="flex:1;cursor:pointer;">
                  <strong>Pay in Full (100%)</strong>
                </div>
                <div class="selector-opt-card btn btn-ghost" data-pct="20" style="flex:1;cursor:pointer;">
                  <strong>Downpayment (20%)</strong>
                </div>
              </div>
              <select id="payStructureSelect" style="display:none;">
                <option value="100" selected>100</option>
                <option value="20">20</option>
              </select>
            </div>

            <div class="booking-section-card">
              <h4 class="section-card-title">Payment Method</h4>
              <div class="payment-methods-grid" id="bPaymentMethodGrid">
                <div class="pay-method-card active" data-method="card">
                  <i class="fa-solid fa-credit-card pm-icon"></i>
                  <strong class="pm-name">Card</strong>
                  <span class="pm-desc">Debit / Credit</span>
                </div>
                <div class="pay-method-card" data-method="gcash">
                  <img src="assets/gcash-logo.webp" alt="GCash" class="pm-icon" style="width:28px;height:28px;border-radius:6px;object-fit:cover;" />
                  <strong class="pm-name">GCash</strong>
                  <span class="pm-desc">Instant QR</span>
                </div>
                <div class="pay-method-card" data-method="bank_transfer">
                  <i class="fa-solid fa-building-columns pm-icon"></i>
                  <strong class="pm-name">Bank Transfer</strong>
                  <span class="pm-desc">QR Ph / Maya</span>
                </div>
                <div class="pay-method-card" data-method="cash">
                  <i class="fa-solid fa-handshake pm-icon"></i>
                  <strong class="pm-name">Via Meetup</strong>
                  <span class="pm-desc">Pay Cash</span>
                </div>
              </div>
              <select id="paymentMethodSelect" style="display:none;">
                <option value="card" selected>card</option>
                <option value="gcash">gcash</option>
                <option value="bank_transfer">bank_transfer</option>
                <option value="cash">cash</option>
              </select>
              <div id="bookingPayMethodDetail"></div>
            </div>

            <div class="booking-action-row">
              <button type="button" class="btn btn-ghost" id="btnBackStep2">Back</button>
              <button type="button" class="btn btn-primary" id="submitBooking">Confirm &amp; Pay</button>
            </div>
          </div>

          <!-- Hidden compatibility elements -->
          <input type="hidden" id="renterEmail" value="${p.email || state.user?.email || ''}" />
          <input type="hidden" id="renterAddress" value="${p.address || 'Puerto Princesa Airport'}" />
          <select id="chargeType" style="display:none;"><option value="per_day" selected>per_day</option></select>
          <input type="hidden" id="paymentAmountDueVal" value="0.00" />
        </div>

        <!-- ═══ RIGHT COLUMN: STICKY SUMMARY CARD (Matches 4-booking-process.png) ═══ -->
        <div class="booking-summary-col">
          <div class="booking-summary-card">
            <div class="booking-summary-img-wrap">
              <img id="detailCarImg" class="booking-summary-img" src="${exactImg}" alt="${v.name}" />
            </div>
            <h3 class="booking-summary-title">${v.name}</h3>
            <p class="booking-summary-meta">${catName}, ${seats} seats, ${fuelType}</p>
            <div class="summary-line"></div>
            <div class="summary-row">
              <span>Rate (<span id="summaryDaysLabel">3 days</span>)</span>
              <strong id="summaryRateVal">PHP 0.00</strong>
            </div>
            <div class="summary-row">
              <span>Driver fee</span>
              <strong id="summaryDriverVal">PHP 0.00</strong>
            </div>
            <div class="summary-row">
              <span>Security deposit</span>
              <strong id="summaryDepositVal">PHP 3,000.00</strong>
            </div>
            <div class="summary-line"></div>
            <div class="summary-total-row">
              <span class="summary-total-label">Total due</span>
              <strong class="summary-total-val" id="summaryTotalVal">PHP 0.00</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

    const start = $('#bStart');
    const end = $('#bEnd');
    const btnGoStep3 = $('#btnGoStep3');
    const availMsg = $('#availabilityMsg');
    const submitBtn = $('#submitBooking');
    const driverCheckbox = $('#driverHireCheckbox');
    const chargeType = $('#chargeType');

    let calculatedBookingData = null;

    function checkAvailability() {
        if (!start || !end) return;
        if (!start.value || !end.value) {
            if (btnGoStep3) btnGoStep3.disabled = true;
            return;
        }

        if (new Date(end.value) < new Date(start.value)) {
            if (availMsg) availMsg.innerHTML = `<span style="color:var(--coral);font-weight:600;">Return date must be on or after pick-up date.</span>`;
            if (btnGoStep3) btnGoStep3.disabled = true;
            return;
        }

        if (v.status === 'maintenance') {
            if (availMsg) availMsg.innerHTML = `<span style="color:var(--amber);font-weight:700;">This vehicle is currently undergoing scheduled maintenance.</span>`;
            if (btnGoStep3) btnGoStep3.disabled = true;
            return;
        }

        if (allBookedIntervals && allBookedIntervals.length) {
            const conflict = allBookedIntervals.find(b => start.value <= b.end_date && end.value >= b.start_date);
            if (conflict) {
                if (availMsg) availMsg.innerHTML = `<span style="color:var(--coral);font-weight:600;">Date Conflict: Vehicle is already booked from ${fmtDate(conflict.start_date)} to ${fmtDate(conflict.end_date)}. Please select different dates.</span>`;
                if (btnGoStep3) btnGoStep3.disabled = true;
                return;
            }
        }

        const days = Math.max(1, daysBetween(start.value, end.value));
        const vehicleCost = days * rate;

        let selectedDriver = null;
        let driverFee = 0;
        let driverDirectPayFee = 0;
        let dId = null;

        if (selectedDriverMode === 'with_driver' && !isMotorcycle) {
            selectedDriver = drivers.find(dr => String(dr.id) === String(selectedDriverId)) || drivers[0];
            driverFee = 900;
            driverDirectPayFee = days > 1 ? (days - 1) * 900 : 0;
            dId = selectedDriver ? selectedDriver.id : null;
        }

        const depositFee = 3000;
        const totalAmount = vehicleCost + driverFee;

        if (availMsg) {
            availMsg.innerHTML = `<span style="color:var(--green);font-weight:600;">Dates available for rent! (${days} day${days > 1 ? 's' : ''})</span>`;
        }
        if (btnGoStep3) btnGoStep3.disabled = false;

        calculatedBookingData = {
            days,
            isPerKm: false,
            kmRate: rate * 0.05,
            estKm: 0,
            vehicleCost,
            driverFee,
            driverDirectPayFee,
            selectedDriver,
            selectedDriverMode,
            totalAmount,
            depositFee,
            dId
        };

        // Update sticky summary card in 0ms!
        const summaryDaysLabel = $('#summaryDaysLabel');
        const summaryRateVal = $('#summaryRateVal');
        const summaryDriverVal = $('#summaryDriverVal');
        const summaryDepositVal = $('#summaryDepositVal');
        const summaryTotalVal = $('#summaryTotalVal');

        if (summaryDaysLabel) summaryDaysLabel.textContent = `${days} day${days > 1 ? 's' : ''}`;
        if (summaryRateVal) summaryRateVal.textContent = `PHP ${fmtMoney(vehicleCost)}`;
        if (summaryDriverVal) summaryDriverVal.textContent = `PHP ${fmtMoney(driverFee)}`;
        if (summaryDepositVal) summaryDepositVal.textContent = `PHP ${fmtMoney(depositFee)}`;
        if (summaryTotalVal) summaryTotalVal.textContent = `PHP ${fmtMoney(totalAmount + depositFee)}`;
    }

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

        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (step === 2) {
            checkAvailability();
        } else if (step === 3) {
            renderStep3Pricing();
        }
    }

    // Stepper & Nav Bindings
    $('#stepNode1')?.addEventListener('click', () => {
        state.tab = 'browse';
        window.renderShell();
    });
    $('#stepNode2')?.addEventListener('click', () => setStep(2));
    $('#stepNode3')?.addEventListener('click', () => {
        checkAvailability();
        if (calculatedBookingData) setStep(3);
    });
    $('#btnGoStep2')?.addEventListener('click', () => setStep(2));
    $('#btnBackStep1')?.addEventListener('click', () => {
        state.tab = 'browse';
        window.renderShell();
    });
    $('#btnGoStep3')?.addEventListener('click', () => {
        checkAvailability();
        if (calculatedBookingData) {
            setStep(3);
        } else {
            const availMsg = $('#availabilityMsg');
            if (availMsg) {
                availMsg.innerHTML = '<span style="color:var(--coral,#dc2626);font-weight:600;">Please select valid available dates.</span>';
            }
        }
    });
    $('#btnBackStep2')?.addEventListener('click', () => setStep(2));

    // Date Change Listeners (Synchronous 0ms response)
    start?.addEventListener('change', () => {
        if (start.value && end) {
            end.min = start.value;
            if (end.value < start.value) {
                end.value = start.value;
            }
        }
        checkAvailability();
    });
    start?.addEventListener('input', checkAvailability);

    end?.addEventListener('change', checkAvailability);
    end?.addEventListener('input', checkAvailability);

    // Driver Checkbox Listener
    if (driverCheckbox) {
        driverCheckbox.addEventListener('change', () => {
            selectedDriverMode = driverCheckbox.checked ? 'with_driver' : 'self';
            checkAvailability();
        });
    }

    // Step 3 Pricing & Payment Render
    function renderStep3Pricing() {
        if (!calculatedBookingData) return;
        const data = calculatedBookingData;

        let selectedPaymentMethod = $('#bPaymentMethodGrid .pay-method-card.active')?.dataset.method || 'card';
        let uploadedProofDataUrl = null;

        const payStructure = $('#payStructureSelect');
        const payMethodSelect = $('#paymentMethodSelect');

        // Sync Payment Structure UI
        $$('#bPayStructureSelector .selector-opt-card').forEach(card => {
            card.onclick = () => {
                $$('#bPayStructureSelector .selector-opt-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                selectedDownpaymentPct = Number(card.dataset.pct || 100);
                if (payStructure) payStructure.value = String(selectedDownpaymentPct);
                renderPaymentDetail();
            };
        });

        // Sync Payment Method UI
        $$('#bPaymentMethodGrid .pay-method-card').forEach(card => {
            card.onclick = () => {
                $$('#bPaymentMethodGrid .pay-method-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                selectedPaymentMethod = card.dataset.method;
                if (payMethodSelect) payMethodSelect.value = selectedPaymentMethod;
                renderPaymentDetail();
            };
        });

        function renderPaymentDetail() {
            const detailContainer = $('#bookingPayMethodDetail');
            if (!detailContainer) return;

            const finalAmount = data.totalAmount + data.depositFee;
            const isFullCash = (selectedPaymentMethod === 'cash');
            const dueAmount = isFullCash ? 0 : (selectedDownpaymentPct === 100 ? finalAmount : Math.round(finalAmount * (selectedDownpaymentPct / 100)));
            const balAmount = finalAmount - dueAmount;

            // Update right-side summary card dynamically
            const summaryTotalVal = $('#summaryTotalVal');
            const summaryTotalLabel = $('.summary-total-label');
            const summaryDepositVal = $('#summaryDepositVal');

            if (summaryTotalVal) {
                if (isFullCash) {
                    if (summaryTotalLabel) summaryTotalLabel.textContent = 'Pay on Handover';
                    summaryTotalVal.textContent = `PHP ${fmtMoney(finalAmount)}`;
                } else if (selectedDownpaymentPct === 20) {
                    if (summaryTotalLabel) summaryTotalLabel.textContent = 'Due Now (20% Downpayment)';
                    summaryTotalVal.textContent = `PHP ${fmtMoney(dueAmount)}`;
                } else {
                    if (summaryTotalLabel) summaryTotalLabel.textContent = 'Total due now';
                    summaryTotalVal.textContent = `PHP ${fmtMoney(finalAmount)}`;
                }
            }

            let summaryBalRow = $('#summaryBalRow');
            if (selectedDownpaymentPct === 20 && !isFullCash) {
                if (!summaryBalRow && summaryDepositVal && summaryDepositVal.parentElement) {
                    summaryBalRow = document.createElement('div');
                    summaryBalRow.className = 'summary-row';
                    summaryBalRow.id = 'summaryBalRow';
                    summaryBalRow.style.color = 'var(--accent, #5B4B8A)';
                    summaryBalRow.style.fontWeight = '700';
                    summaryDepositVal.parentElement.insertAdjacentElement('afterend', summaryBalRow);
                }
                if (summaryBalRow) {
                    summaryBalRow.style.display = 'flex';
                    summaryBalRow.innerHTML = `<span>Remaining on pickup</span><strong>PHP ${fmtMoney(balAmount)}</strong>`;
                }
            } else if (summaryBalRow) {
                summaryBalRow.style.display = 'none';
            }

            if (selectedPaymentMethod === 'card') {
                detailContainer.innerHTML = `
          <div class="pay-detail-panel" style="margin-top:14px;">
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:8px;">Credit / Debit Card</div>
            <div class="booking-fields-grid">
              <div class="field"><label>Card Number</label><input type="text" placeholder="4xxx •••• •••• xxxx" class="clean-input" /></div>
              <div class="field"><label>Expiry &amp; CVV</label><input type="text" placeholder="MM/YY •••" class="clean-input" /></div>
            </div>
          </div>
        `;
                if (submitBtn) submitBtn.textContent = `Confirm & Pay PHP ${fmtMoney(dueAmount)}`;
            } else if (selectedPaymentMethod === 'gcash') {
                detailContainer.innerHTML = `
          <div class="pay-detail-panel" style="text-align:center;margin-top:14px;">
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:8px;">
              <img src="assets/gcash-logo.webp" alt="GCash" style="width:24px;height:24px;border-radius:4px;object-fit:cover;" />
              Scan QR Code via GCash
            </div>
            <div style="margin:8px 0;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=GCASH-RENTAL-${v.id}-${dueAmount}" alt="GCash QR" style="border-radius:8px;" /></div>
            <div style="font-size:0.82rem;color:var(--text-mid);">Account: 0917 582 9140 (Vehicle Rental System)</div>
            <div class="field" style="margin-top:10px;text-align:left;">
              <label>GCash Reference Number *</label>
              <input type="text" id="bPayRefNo" placeholder="e.g. 1002 9482 1940" class="clean-input" />
            </div>
          </div>
        `;
                if (submitBtn) submitBtn.textContent = `Submit GCash Payment (PHP ${fmtMoney(dueAmount)})`;
            } else if (selectedPaymentMethod === 'bank_transfer') {
                detailContainer.innerHTML = `
          <div class="pay-detail-panel" style="text-align:center;margin-top:14px;">
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:8px;">Bank Transfer / Maya QR</div>
            <div style="margin:8px 0;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=INSTAPAY-RENTAL-${v.id}-${dueAmount}" alt="Bank QR" style="border-radius:8px;" /></div>
            <div style="font-size:0.82rem;color:var(--text-mid);">Account: 0012 3456 8899 (BDO / Maya)</div>
            <div class="field" style="margin-top:10px;text-align:left;">
              <label>Transaction ID / Reference Number *</label>
              <input type="text" id="bPayRefNo" placeholder="Enter bank reference number" class="clean-input" />
            </div>
          </div>
        `;
                if (submitBtn) submitBtn.textContent = `Submit Bank Transfer (PHP ${fmtMoney(dueAmount)})`;
            } else if (selectedPaymentMethod === 'cash') {
                detailContainer.innerHTML = `
          <div class="pay-detail-panel" style="margin-top:14px;padding:14px;background:#FFFFFF;border:1px solid var(--glass-border);border-radius:9px;">
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:4px;">Cash on Meetup / Handover</div>
            <p style="font-size:0.82rem;color:var(--text-mid);margin:0;line-height:1.4;">
              Pay cash directly upon vehicle delivery or airport counter handover. No online advance needed.
            </p>
          </div>
        `;
                if (submitBtn) submitBtn.textContent = `Confirm Reservation (Cash on Pickup)`;
            }
        }

        renderPaymentDetail();
    }

    // Initial trigger so everything is pre-calculated on open
    checkAvailability();

    // Submit Booking Handler
    submitBtn?.addEventListener('click', async () => {
        if (!calculatedBookingData) return;

        const rName = ($('#renterName')?.value || '').trim();
        const rPhone = ($('#renterPhone')?.value || '').trim();
        const rLicense = ($('#renterLicense')?.value || '').trim();
        const rLocation = ($('#bLocation')?.value || 'Puerto Princesa Airport').trim();
        const rTime = ($('#bTime')?.value || '09:00 AM').trim();

        if (!rName) {
            toast('Please enter your full name.', 'error');
            $('#renterName')?.focus();
            return;
        }

        if (!rPhone) {
            toast('Please enter your contact mobile number.', 'error');
            $('#renterPhone')?.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting reservation...';

        const chosenMethod = $('#paymentMethodSelect')?.value || 'card';
        const enteredRefNo = ($('#bPayRefNo')?.value || '').trim();
        const finalAmount = calculatedBookingData.totalAmount + calculatedBookingData.depositFee;
        const isFullCash = (chosenMethod === 'cash');
        const paidAmount = isFullCash ? 0 : (selectedDownpaymentPct === 100 ? finalAmount : Math.round(finalAmount * 0.2));
        const balanceDue = isFullCash ? finalAmount : (finalAmount - paidAmount);

        let targetStatus = 'confirmed';
        let targetPaymentStatus = 'verified';
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
            targetMethodName = 'Bank Transfer';
            finalRefNum = enteredRefNo || `TXN-${Date.now().toString().slice(-8)}`;
        } else if (chosenMethod === 'cash') {
            targetStatus = 'cash_on_pickup';
            targetPaymentStatus = 'unpaid';
            targetMethodName = 'Cash on Pickup';
            finalRefNum = `CASH-${Date.now().toString().slice(-6)}`;
        }

        // Save profile in localStorage & state
        state.profile = state.profile || {};
        state.profile.full_name = rName;
        state.profile.phone = rPhone;
        state.profile.license_number = rLicense;
        state.profile.address = rLocation;

        try {
            localStorage.setItem('rentflow_guest_profile', JSON.stringify({
                full_name: rName,
                phone: rPhone,
                license_number: rLicense,
                address: rLocation
            }));
        } catch (e) { }

        const activeCustomerId = state.user?.id || '0e8d807a-49fb-42d7-ab7b-f5ea609f0ef0';
        const cleanDbPayload = {
            customer_id: activeCustomerId,
            vehicle_id: Number(v.id),
            start_date: start.value,
            end_date: end.value,
            total_amount: finalAmount,
            paid_amount: paidAmount,
            balance_due: balanceDue,
            payment_type: selectedDownpaymentPct === 100 ? 'full' : 'partial',
            downpayment_percent: selectedDownpaymentPct,
            status: targetStatus,
            review_notes: `Meetup: ${rLocation} (${rTime}) | Method: ${targetMethodName} | Ref: ${finalRefNum}`
        };

        let newBooking = null;
        try {
            const { data: createdBooking, error } = await supabase.from('bookings').insert(cleanDbPayload).select().single();
            if (!error && createdBooking) {
                newBooking = createdBooking;
            }
        } catch (e) {
            console.warn('Booking DB notice:', e);
        }

        const assignedId = newBooking?.id ? String(newBooking.id) : `bk-${Date.now().toString().slice(-6)}`;
        const recordToSave = {
            ...cleanDbPayload,
            ...(newBooking || {}),
            id: assignedId,
            status: targetStatus,
            payment_status: targetPaymentStatus,
            payment_method: targetMethodName,
            payment_ref: finalRefNum,
            ref_number: finalRefNum,
            customer_name: rName,
            customer_phone: rPhone,
            driver_license: rLicense,
            vehicles: { ...v },
            created_at: newBooking?.created_at || new Date().toISOString()
        };

        saveLocalBooking(recordToSave);
        broadcastNewBookingRequest(recordToSave);

        closeModal();
        state.tab = 'bookings';
        if (window.renderShell) {
            window.renderShell();
        }

        toast(`Reservation created successfully! Reference: #${finalRefNum}`, 'success');

        // Automatically display the receipt pass modal on screen per user requirement
        if (window.openPaidReceiptModal) {
            setTimeout(() => {
                window.openPaidReceiptModal(recordToSave.id, targetMethodName, finalRefNum);
            }, 100);
        }
    });
}

// ═══ STANDALONE BOOKING DATE SELECTION MODAL (Matches media_1793708316816_d3eb85a3.png) ═══
export async function openBookingDatePickerModal({ vehicle, initialStart = '', initialEnd = '', onConfirm = null }) {
  const v = vehicle;
  if (!v) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  let curStart = initialStart || todayStr;
  let curEnd = initialEnd || initialStart || todayStr;

  const rate = getVehicleDailyRate(v);
  const catName = getVehicleCategoryName(v);
  const exactImg = getExactVehicleImage(v);
  const isMotorcycle = catName === 'Motorcycles' || (v.name || '').toLowerCase().includes('motor') || (v.name || '').toLowerCase().includes('click');
  const seats = v.seats || (isMotorcycle ? 2 : (catName.toLowerCase().includes('van') ? 14 : 7));

  // Fetch booked intervals
  const [{ data: bookedIntervals }] = await Promise.all([
    supabase.from('bookings').select('start_date, end_date, status').eq('vehicle_id', v.id).in('status', ['pending', 'approved', 'active', 'reserved', 'completed']).gte('end_date', todayStr).order('start_date')
  ]);

  const localList = getLocalBookings().filter(b =>
    (Number(b.vehicle_id) === Number(v.id) || Number(b.vehicles?.id) === Number(v.id)) &&
    ['pending', 'approved', 'active', 'reserved', 'completed'].includes(b.status) &&
    (b.end_date >= todayStr || !b.end_date)
  ).map(b => ({ start_date: (b.start_date || '').slice(0, 10), end_date: (b.end_date || '').slice(0, 10) }));

  const dbList = (bookedIntervals || []).map(b => ({ start_date: (b.start_date || '').slice(0, 10), end_date: (b.end_date || '').slice(0, 10) }));
  const allIntervals = [...dbList, ...localList].filter(b => b.start_date && b.end_date);

  let targetField = 'start';
  let dateObj = new Date(curStart || todayStr);
  if (isNaN(dateObj.getTime())) dateObj = new Date();
  let mYear = dateObj.getFullYear();
  let mMonth = dateObj.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const modalHtml = `
    <div class="date-picker-modal">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="width:68px;height:68px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
            <img src="${exactImg}" alt="${v.name}" style="width:100%;height:100%;object-fit:contain;" />
          </div>
          <div>
            <h3 style="font-family:'Fraunces',serif;font-size:1.3rem;font-weight:700;color:var(--text-hi,#2a2340);margin:0 0 4px 0;">
              ${v.name}
            </h3>
            <p style="font-size:0.85rem;color:var(--text-mid,#5e5778);margin:0;">
              ${catName}, ${seats} seats | PHP ${fmtMoney(rate).replace('₱', '').trim()} / day
            </p>
          </div>
        </div>
        <button type="button" class="btn btn-outline" id="mCloseDatePick" style="padding:6px 16px;font-size:0.85rem;border-radius:8px;">
          Close
        </button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;">
        <div>
          <div style="font-size:0.8rem;font-weight:600;color:var(--text-mid);margin-bottom:6px;">Pick-up date</div>
          <div id="mBoxPickUp" class="cal-date-box active">
            <span id="mDispPickUp" style="font-size:0.95rem;font-weight:600;color:var(--text-hi);">${fmtDate(curStart)}</span>
            <span style="font-size:0.8rem;color:#94a3b8;font-weight:400;">calendar</span>
          </div>
        </div>

        <div>
          <div style="font-size:0.8rem;font-weight:600;color:var(--text-mid);margin-bottom:6px;">Return date</div>
          <div id="mBoxReturn" class="cal-date-box">
            <span id="mDispReturn" style="font-size:0.92rem;font-weight:500;color:var(--text-hi);">${fmtDate(curEnd)}</span>
            <span style="font-size:0.8rem;color:#94a3b8;font-weight:400;">calendar</span>
          </div>
        </div>
      </div>

      <div class="cal-date-picker-wrap" style="padding:0;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding:0 2px;">
          <button type="button" class="btn btn-ghost" id="mCalPrevMonth" style="width:34px;height:34px;padding:0;border-radius:8px;border:1px solid var(--glass-border,#E2DCF0);display:flex;align-items:center;justify-content:center;color:var(--text-hi);font-size:0.95rem;background:#ffffff;">
            &lt;
          </button>
          <h4 id="mCalMonthTitle" style="font-family:'Fraunces',serif;font-size:1.18rem;font-weight:700;color:var(--text-hi);margin:0;">
            ${monthNames[mMonth]} ${mYear}
          </h4>
          <button type="button" class="btn btn-ghost" id="mCalNextMonth" style="width:34px;height:34px;padding:0;border-radius:8px;border:1px solid var(--glass-border,#E2DCF0);display:flex;align-items:center;justify-content:center;color:var(--text-hi);font-size:0.95rem;background:#ffffff;">
            &gt;
          </button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(7, 1fr);gap:6px;text-align:center;margin-bottom:8px;font-size:0.8rem;font-weight:500;color:var(--text-mid);">
          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
        </div>

        <div id="mCalGrid" style="display:grid;grid-template-columns:repeat(7, 1fr);gap:6px;margin-bottom:14px;"></div>

        <div style="display:flex;align-items:center;justify-content:flex-start;gap:16px;flex-wrap:wrap;font-size:0.75rem;color:var(--text-mid);padding-top:12px;margin-bottom:12px;">
          <div class="cal-legend-item">
            <span class="cal-legend-pill" style="background:#eaf7ee;border:1px solid #ccebd5;"></span>
            <span>Free for this vehicle</span>
          </div>
          <div class="cal-legend-item">
            <span class="cal-legend-pill" style="background:#fce8e6;border:1px solid #fad2cf;"></span>
            <span>Already booked</span>
          </div>
          <div class="cal-legend-item">
            <span class="cal-legend-pill" style="background:#3b2e58;"></span>
            <span>Your dates</span>
          </div>
          <div class="cal-legend-item">
            <span class="cal-legend-pill" style="background:#ffffff;border:2px solid #2a2340;"></span>
            <span>Today</span>
          </div>
        </div>

        <div id="mCalSummary" style="font-size:0.98rem;font-weight:700;color:#1e6b37;">
          Available: 4 days, PHP 19,200
        </div>
      </div>
    </div>
  `;

  openModal(modalHtml);

  function refreshModalCal() {
    const titleEl = document.getElementById('mCalMonthTitle');
    if (titleEl) titleEl.textContent = `${monthNames[mMonth]} ${mYear}`;

    const grid = document.getElementById('mCalGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const firstDay = new Date(mYear, mMonth, 1).getDay();
    const daysCount = new Date(mYear, mMonth + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.style.height = '38px';
      grid.appendChild(empty);
    }

    for (let day = 1; day <= daysCount; day++) {
      const dateStr = `${mYear}-${String(mMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isPast = dateStr < todayStr;
      const isToday = dateStr === todayStr;
      const isBooked = allIntervals.some(b => dateStr >= b.start_date && dateStr <= b.end_date);
      const isStart = curStart && dateStr === curStart;
      const isEnd = curEnd && dateStr === curEnd;
      const isInRange = curStart && curEnd && dateStr > curStart && dateStr < curEnd;

      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';
      cell.textContent = day;

      if (isStart || isEnd) {
        cell.classList.add(isStart ? 'range-start' : 'range-end');
      } else if (isInRange) {
        cell.classList.add('in-range');
      } else if (isBooked) {
        cell.classList.add('booked');
        cell.title = 'Already booked for this vehicle';
      } else if (isPast) {
        cell.classList.add('past');
      } else {
        cell.classList.add('free');
        cell.title = 'Available for this vehicle';
      }

      if (isToday) {
        cell.classList.add('today');
      }

      if (!isBooked && !isPast) {
        cell.addEventListener('click', () => {
          if (targetField === 'start') {
            curStart = dateStr;
            if (curEnd && curEnd < curStart) curEnd = '';
            targetField = 'end';
          } else {
            if (dateStr < curStart) {
              curStart = dateStr;
              curEnd = '';
              targetField = 'end';
            } else {
              curEnd = dateStr;
              targetField = 'start';
            }
          }
          refreshModalCal();
          if (onConfirm) onConfirm(curStart, curEnd || curStart);
        });
      }

      grid.appendChild(cell);
    }

    const dispP = document.getElementById('mDispPickUp');
    const dispR = document.getElementById('mDispReturn');
    const boxP = document.getElementById('mBoxPickUp');
    const boxR = document.getElementById('mBoxReturn');

    if (dispP) dispP.textContent = curStart ? fmtDate(curStart) : 'Select date';
    if (dispR) dispR.textContent = curEnd ? fmtDate(curEnd) : 'Select date';

    if (boxP && boxR) {
      boxP.classList.toggle('active', targetField === 'start');
      boxR.classList.toggle('active', targetField === 'end');
    }

    const sumEl = document.getElementById('mCalSummary');
    if (sumEl) {
      if (curStart && curEnd) {
        const conflict = allIntervals.find(b => curStart <= b.end_date && curEnd >= b.start_date);
        if (conflict) {
          sumEl.innerHTML = `<span style="color:var(--coral,#dc2626);font-weight:700;">Date conflict: Booked from ${fmtDate(conflict.start_date)} to ${fmtDate(conflict.end_date)}</span>`;
        } else {
          const days = Math.max(1, daysBetween(curStart, curEnd));
          const total = days * rate;
          sumEl.innerHTML = `Available: ${days} ${days === 1 ? 'day' : 'days'}, PHP ${fmtMoney(total).replace('₱', '').trim()}`;
        }
      } else if (curStart) {
        sumEl.innerHTML = `<span style="color:var(--accent,#5B4B8A);font-weight:600;">Pick-up: ${fmtDate(curStart)} · Select return date on calendar</span>`;
      }
    }
  }

  document.getElementById('mBoxPickUp')?.addEventListener('click', () => {
    targetField = 'start';
    refreshModalCal();
  });

  document.getElementById('mBoxReturn')?.addEventListener('click', () => {
    targetField = 'end';
    refreshModalCal();
  });

  document.getElementById('mCalPrevMonth')?.addEventListener('click', () => {
    mMonth--;
    if (mMonth < 0) {
      mMonth = 11;
      mYear--;
    }
    refreshModalCal();
  });

  document.getElementById('mCalNextMonth')?.addEventListener('click', () => {
    mMonth++;
    if (mMonth > 11) {
      mMonth = 0;
      mYear++;
    }
    refreshModalCal();
  });

  document.getElementById('mCloseDatePick')?.addEventListener('click', () => {
    closeModal();
  });

  refreshModalCal();
}

if (typeof window !== 'undefined') {
  window.openBookingDatePickerModal = openBookingDatePickerModal;
}
