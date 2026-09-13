import { supabase } from './config.js';
import { state, DEFAULT_SETTINGS, getSystemSettings, saveLocalBooking } from './state.js';
import { $, $$, fmtMoney, fmtDate, daysBetween, maskPlate, toast, openModal, closeModal, showBookingAlertPopup } from './utils.js';
import { getVehicleDailyRate, getVehicleCategoryName, getExactVehicleImage } from './vehicles.js';

export async function openVehicleDetail(id) {
  const v = state.vehicles.find(v => v.id === id);
  if (!v) return;
  const fuelType = v.fuel_type ?? 'Gasoline';
  const hasAC = v.has_ac !== undefined ? v.has_ac : true;
  const todayStr = new Date().toISOString().slice(0, 10);

  let drivers = state.drivers || [];
  const [{ data: fetchedDrivers }, { data: bookedIntervals }] = await Promise.all([
    drivers.length ? Promise.resolve({ data: drivers }) : supabase.from('drivers').select('*').order('name'),
    supabase.from('bookings').select('start_date, end_date').eq('vehicle_id', v.id).in('status', ['pending', 'approved', 'active']).gte('end_date', todayStr).order('start_date'),
  ]);
  drivers = (fetchedDrivers || []).map(d => ({ ...d, daily_fee: Number(d.daily_fee || 0) < 500 ? 500 : Number(d.daily_fee) }));
  state.drivers = drivers;

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
    badgeContent = `<i class="fa-solid fa-circle-check" style="color:#059669;"></i> Available for Rent`;
  } else if (isRented) {
    statusBadgeClass = 'badge-rented';
    badgeContent = `<i class="fa-solid fa-clock" style="color:#dc2626;"></i> Currently Rented`;
  } else if (isMaintenance) {
    statusBadgeClass = 'badge-maintenance';
    badgeContent = `<i class="fa-solid fa-wrench" style="color:#ca8a04;"></i> In Maintenance ${v.maintenance_days ? `(${v.maintenance_days}d)` : ''}`;
  } else {
    statusBadgeClass = `badge-${v.status}`;
    badgeContent = `<i class="fa-solid fa-car-side"></i> ${v.status}`;
  }

  let currentStep = 1;
  let selectedDownpaymentPct = 100;

  const modal = openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.25rem;font-weight:800;color:#0f172a;">${v.name}</h3>
        <span class="muted" style="font-size:0.78rem;"><i class="fa-solid fa-layer-group"></i> ${catName} · Plate: ${maskPlate(v.plate_number)}</span>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    <div class="booking-stepper">
      <div class="step-item active" id="stepNode1" data-step="1">
        <span class="step-num">1</span>
        <span class="step-title">Vehicle Details</span>
      </div>
      <div class="step-divider" id="stepDiv1"></div>
      <div class="step-item" id="stepNode2" data-step="2">
        <span class="step-num">2</span>
        <span class="step-title">Dates &amp; Driver</span>
      </div>
      <div class="step-divider" id="stepDiv2"></div>
      <div class="step-item" id="stepNode3" data-step="3">
        <span class="step-num">3</span>
        <span class="step-title">Transparent Pricing</span>
      </div>
    </div>

    <div class="step-content" id="stepSection1">
      <div class="angle-viewer" style="margin-bottom:16px;">
        <div class="angle-viewer-img-wrap" style="height:250px;border-radius:12px;overflow:hidden;background:#f8fafc;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;">
          <img id="detailCarImg" class="angle-viewer-img" src="${exactImg}" alt="${v.name}" style="width:100%;height:100%;object-fit:cover;" />
        </div>
      </div>

      <p class="muted" style="margin-bottom:14px;line-height:1.5;color:#475569;">
        ${v.description ?? 'Comfortable, fuel-efficient, and well-maintained rental vehicle.'}
      </p>

      <div class="detail-grid" style="margin-bottom:16px;background:#f8fafc;padding:12px 16px;border-radius:10px;border:1px solid #e2e8f0;">
        <div>
          <label>Availability Status</label>
          <div><span class="badge ${statusBadgeClass}">${badgeContent}</span></div>
        </div>
        <div>
          <label>Daily Rental Rate</label>
          <div style="font-weight:800;font-size:1.05rem;color:#2563eb;">${fmtMoney(rate)} <span style="font-size:0.75rem;font-weight:500;color:#64748b;">/ day</span></div>
        </div>
        <div>
          <label>Passenger Capacity</label>
          <div style="font-weight:700;font-size:0.88rem;color:#0f172a;"><i class="fa-solid fa-users" style="color:#2563eb;"></i> ${isMotorcycle ? '2 Passengers' : (v.seats ?? '5 Passengers')}</div>
        </div>
        <div>
          <label>Transmission</label>
          <div style="font-weight:700;font-size:0.88rem;color:#0f172a;"><i class="fa-solid fa-gear" style="color:#2563eb;"></i> ${v.transmission ?? 'Automatic'}</div>
        </div>
        <div>
          <label>Fuel Type</label>
          <div style="font-weight:700;font-size:0.88rem;color:#0f172a;"><i class="fa-solid fa-gas-pump" style="color:#d97706;"></i> ${fuelType}</div>
        </div>
        <div>
          <label>${isMotorcycle ? 'Included Gear' : 'Air Conditioning'}</label>
          <div style="font-weight:700;font-size:0.88rem;color:#0f172a;"><i class="fa-solid fa-${isMotorcycle ? 'helmet-safety' : (hasAC ? 'snowflake' : 'fan')}" style="color:${isMotorcycle ? '#059669' : (hasAC ? '#0284c7' : '#94a3b8')};"></i> ${isMotorcycle ? 'Helmet Included' : (hasAC ? 'Air Conditioned' : 'Non-AC')}</div>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:14px;">
        <button type="button" class="btn btn-primary btn-block" id="btnGoStep2">
          Proceed to Schedule &amp; Driver <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    </div>

    <div class="step-content hidden" id="stepSection2">
      <h4 style="margin-bottom:12px;display:flex;align-items:center;gap:6px;color:#0f172a;">
        <i class="fa-solid fa-calendar-days" style="color:#2563eb;"></i> 1. Select Rental Dates
      </h4>
      <div id="calWidgetContainer"></div>
      <div class="detail-grid" style="margin-bottom:12px;">
        <div class="field"><label>Start Date</label><input type="date" id="bStart" min="${todayStr}" /></div>
        <div class="field"><label>End Date</label><input type="date" id="bEnd" min="${todayStr}" /></div>
      </div>
      <div id="availabilityMsg" class="muted" style="margin-bottom:12px;"></div>

      <div class="divider"></div>
      <h4 style="margin-bottom:12px;display:flex;align-items:center;gap:6px;color:#0f172a;">
        <i class="fa-solid fa-money-bill-wave" style="color:#059669;"></i> 2. Billing Method
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

      <div class="divider"></div>
      <h4 style="margin-bottom:12px;display:flex;align-items:center;gap:6px;color:#0f172a;">
        <i class="fa-solid fa-id-badge" style="color:#7c3aed;"></i> 3. Driver Option <span style="font-weight:500;font-size:0.75rem;color:#94a3b8;">(Optional)</span>
      </h4>
      <div class="field">
        <select id="driverSelect" style="font-size:0.88rem;">
          <option value="">Self-drive (No driver needed - Drive yourself)</option>
          ${drivers.map(d => `<option value="${d.id}" ${d.status !== 'available' ? 'disabled' : ''}>${d.name} — ${d.license_type ?? 'Pro'} License · ${fmtMoney(d.daily_fee ?? 500)}/day${d.status !== 'available' ? ' (Unavailable)' : ''}</option>`).join('')}
        </select>
      </div>
      <div id="driverInfo"></div>

      <div style="display:flex;gap:10px;margin-top:16px;">
        <button type="button" class="btn btn-ghost" id="btnBackStep1" style="flex:1;">
          <i class="fa-solid fa-arrow-left"></i> Back
        </button>
        <button type="button" class="btn btn-primary" id="btnGoStep3" style="flex:2;" disabled>
          Review Pricing Breakdown <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    </div>

    <div class="step-content hidden" id="stepSection3">
      <div id="transparentPricingContainer"></div>

      <div class="guarantee-box">
        <i class="fa-solid fa-shield-halved" style="color:#059669;font-size:1.1rem;margin-top:2px;"></i>
        <div>
          <strong>100% Transparent Guarantee:</strong> Walang hidden fees. Full-to-full fuel policy. Libreng cancellation hanggang 24 oras bago ang pickup. Walang kailangang online license upload — ipresenta lamang ang physical driver's license kapag nag-pickup na ng sasakyan.
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <label style="margin-bottom:8px;">Select Payment Structure</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;" id="payOptionToggles">
          <div class="pay-tier-btn active" id="payOptFull">
            <div class="tier-label">Pay in Full (100%)</div>
            <div class="tier-amount" id="payFullAmount">₱0.00</div>
            <div class="tier-sub">Instant zero-balance reservation</div>
          </div>
          <div class="pay-tier-btn" id="payOptDown">
            <div class="tier-label">Reserve (20% Down)</div>
            <div class="tier-amount" id="payDownAmount">₱0.00</div>
            <div class="tier-sub">Remaining balance upon vehicle pickup</div>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:14px;">
        <button type="button" class="btn btn-ghost" id="btnBackStep2" style="flex:1;">
          <i class="fa-solid fa-arrow-left"></i> Back
        </button>
        <button type="button" class="btn btn-primary" id="submitBooking" style="flex:2;">
          <i class="fa-solid fa-circle-check"></i> Submit Booking Request
        </button>
      </div>
    </div>
  `, true);

  $('#mClose').addEventListener('click', closeModal);

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

  $('#stepNode1').addEventListener('click', () => setStep(1));
  $('#stepNode2').addEventListener('click', () => setStep(2));
  $('#btnGoStep2').addEventListener('click', () => setStep(2));
  $('#btnBackStep1').addEventListener('click', () => setStep(1));
  $('#btnBackStep2').addEventListener('click', () => setStep(2));

  const chargeType = $('#chargeType'), kmField = $('#kmField'), estKmInput = $('#estKm');
  chargeType.addEventListener('change', () => {
    kmField.classList.toggle('hidden', chargeType.value !== 'per_km');
    checkAvailability();
  });
  if (estKmInput) estKmInput.addEventListener('input', checkAvailability);

  const driverSelect = $('#driverSelect'), driverInfo = $('#driverInfo');
  driverSelect.addEventListener('change', () => {
    const dId = driverSelect.value;
    if (!dId) { driverInfo.innerHTML = ''; checkAvailability(); return; }
    const d = drivers.find(dr => String(dr.id) === dId);
    if (!d) return;
    driverInfo.innerHTML = `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-top:8px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#5b21b6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.9rem;">${(d.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.95rem;">${d.name}</div>
            <div style="font-size:0.78rem;color:#64748b;">${d.phone ?? 'Direct dispatch upon booking'}</div>
          </div>
          <span class="badge badge-${d.status === 'available' ? 'available' : 'rented'}" style="margin-left:auto;">${d.status}</span>
        </div>
        <div class="detail-grid" style="gap:8px;">
          <div><label style="font-size:0.68rem;">License Type</label><div style="font-weight:600;font-size:0.84rem;color:#0f172a;">${d.license_type ?? 'Professional'}</div></div>
          <div><label style="font-size:0.68rem;">Experience</label><div style="font-weight:600;font-size:0.84rem;color:#0f172a;">${d.experience_years ?? '3'}+ years</div></div>
          <div><label style="font-size:0.68rem;">Rating</label><div style="font-weight:600;font-size:0.84rem;color:#d97706;"><i class="fa-solid fa-star" style="color:#eab308;font-size:0.78rem;"></i> ${d.rating ?? '4.5'} / 5.0</div></div>
          <div><label style="font-size:0.68rem;">Driver Fee</label><div style="font-weight:700;font-size:0.84rem;color:#059669;">${fmtMoney(d.daily_fee ?? 500)} / day</div></div>
        </div>
      </div>
    `;
    checkAvailability();
  });

  const start = $('#bStart'), end = $('#bEnd'), btnGoStep3 = $('#btnGoStep3'), availMsg = $('#availabilityMsg'), submitBtn = $('#submitBooking');

  let calViewYear = new Date().getFullYear();
  let calViewMonth = new Date().getMonth();

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

  start.addEventListener('change', () => {
    if (!start.value) return;
    end.min = start.value;
    if (bookedIntervals && bookedIntervals.length) {
      const nextBooked = bookedIntervals.find(b => b.start_date >= start.value);
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
      availMsg.innerHTML = `<span style="color:#dc2626;font-weight:600;"><i class="fa-solid fa-circle-exclamation"></i> Return date must be on or after start date.</span>`;
      btnGoStep3.disabled = true;
      return;
    }
    if (v.status === 'maintenance') {
      availMsg.innerHTML = `<span style="color:#d97706;font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> This vehicle is currently undergoing scheduled maintenance.</span>`;
      btnGoStep3.disabled = true;
      return;
    }

    if (bookedIntervals && bookedIntervals.length) {
      const conflict = bookedIntervals.find(b => start.value <= b.end_date && end.value >= b.start_date);
      if (conflict) {
        availMsg.innerHTML = `<span style="color:#dc2626;font-weight:700;"><i class="fa-solid fa-circle-xmark"></i> Date Conflict: Vehicle is already booked from ${fmtDate(conflict.start_date)} to ${fmtDate(conflict.end_date)}. Please select different dates.</span>`;
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
      availMsg.innerHTML = `<span style="color:#dc2626;font-weight:700;"><i class="fa-solid fa-circle-xmark"></i> Dates already booked. Please choose available dates above.</span>`;
      btnGoStep3.disabled = true;
      return;
    }

    const days = daysBetween(start.value, end.value);
    const isPerKm = chargeType.value === 'per_km';
    const kmRate = rate * 0.05;
    const estKm = Number(estKmInput?.value || 0);
    let vehicleCost = isPerKm ? (kmRate * estKm) : (days * rate);

    if (isPerKm && estKm <= 0) {
      availMsg.innerHTML = `<span style="color:#059669;font-weight:600;"><i class="fa-solid fa-circle-check"></i> Dates available. Please enter estimated kilometers to calculate price.</span>`;
      btnGoStep3.disabled = true;
      return;
    }

    const dId = driverSelect.value;
    const selectedDriver = dId ? drivers.find(dr => String(dr.id) === dId) : null;
    const driverFee = selectedDriver ? (selectedDriver.daily_fee ?? 500) * days : 0;
    const totalAmount = vehicleCost + driverFee;

    availMsg.innerHTML = `<span style="color:#059669;font-weight:700;"><i class="fa-solid fa-circle-check"></i> Dates available for rent! (${days} day${days > 1 ? 's' : ''})</span>`;
    btnGoStep3.disabled = false;

    calculatedBookingData = {
      days,
      isPerKm,
      kmRate,
      estKm,
      vehicleCost,
      driverFee,
      selectedDriver,
      totalAmount,
      dId,
      chargeTypeVal: chargeType.value,
    };
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
          <i class="fa-solid fa-receipt" style="color:#2563eb;"></i> Transparent Itemized Breakdown
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

        ${data.selectedDriver ? `
          <div class="price-item">
            <span>
              Driver Service (${data.selectedDriver.name})
              <div style="font-size:0.75rem;color:#64748b;">${data.days} day(s) × ${fmtMoney(data.selectedDriver.daily_fee ?? 500)}/day</div>
            </span>
            <span style="font-weight:700;color:#059669;">+ ${fmtMoney(data.driverFee)}</span>
          </div>
        ` : `
          <div class="price-item">
            <span>
              Driver Service
              <div style="font-size:0.75rem;color:#64748b;">Self-Drive (Customer Driving)</div>
            </span>
            <span style="font-weight:600;color:#64748b;">₱0.00</span>
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
          <span style="font-weight:600;color:#475569;">₱3,000.00 <span style="font-size:0.72rem;color:#94a3b8;">(deposit)</span></span>
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

    const payFull = $('#payFullAmount'), payDown = $('#payDownAmount');
    if (payFull) payFull.textContent = fmtMoney(netTotal);
    if (payDown) payDown.textContent = fmtMoney(Math.round(netTotal * 0.2));

    const optDownSub = $('#payOptDown .tier-sub');
    if (optDownSub) {
      const bal = netTotal - Math.round(netTotal * 0.2);
      optDownSub.textContent = `Remaining balance (${fmtMoney(bal)}) upon vehicle pickup`;
    }

    const optFull = $('#payOptFull'), optDown = $('#payOptDown');
    if (optFull && optDown) {
      optFull.onclick = () => {
        selectedDownpaymentPct = 100;
        optFull.classList.add('active');
        optDown.classList.remove('active');
      };
      optDown.onclick = () => {
        selectedDownpaymentPct = 20;
        optDown.classList.add('active');
        optFull.classList.remove('active');
      };
    }
  }

  btnGoStep3.addEventListener('click', () => {
    renderStep3Pricing();
    setStep(3);
  });

  submitBtn.addEventListener('click', async () => {
    if (!calculatedBookingData) return;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting Request…`;

    const finalAmount = calculatedBookingData.finalPayableTotal !== undefined ? calculatedBookingData.finalPayableTotal : calculatedBookingData.totalAmount;
    const paidAmount = selectedDownpaymentPct === 100 ? finalAmount : Math.round(finalAmount * 0.2);
    const balanceDue = finalAmount - paidAmount;

    const contactNote = `Contact: ${state.profile?.full_name || 'Customer'} (${state.profile?.phone || 'No phone'})`;
    const fullNotes = contactNote;

    const bookingPayload = {
      customer_id: state.user.id,
      vehicle_id: v.id,
      start_date: start.value,
      end_date: end.value,
      total_amount: finalAmount,
      status: 'pending',
      downpayment_percent: selectedDownpaymentPct,
      paid_amount: 0,
      balance_due: finalAmount,
      promo_code: null,
      discount_amount: 0,
      review_notes: fullNotes,
    };

    let newBooking = null;
    try {
      let { data: createdBooking, error } = await supabase.from('bookings').insert(bookingPayload).select().single();
      if (error) {
        console.warn('Full booking insert failed, retrying with baseline schema:', error.message);
        // Fallback in case schema_update.sql has not been run in Supabase yet
        const fallbackPayload = {
          customer_id: state.user.id,
          vehicle_id: v.id,
          start_date: start.value,
          end_date: end.value,
          total_amount: finalAmount,
          status: 'pending',
          review_notes: fullNotes,
        };
        const retry = await supabase.from('bookings').insert(fallbackPayload).select().single();
        if (retry.error) {
          console.warn('Supabase DB insert failed (RLS/Auth), falling back to local multi-user store:', retry.error.message);
          newBooking = {
            id: `bk-${Date.now().toString().slice(-6)}`,
            ...fallbackPayload,
            downpayment_percent: selectedDownpaymentPct,
            paid_amount: 0,
            balance_due: finalAmount,
            promo_code: appliedPromo ? appliedPromo.code : null,
            discount_amount: appliedPromo ? appliedPromo.discount : 0,
            created_at: new Date().toISOString()
          };
        } else {
          newBooking = retry.data;
        }
      } else {
        newBooking = createdBooking;
      }
    } catch (e) {
      console.warn('Supabase booking exception, using local store:', e);
      newBooking = {
        id: `bk-${Date.now().toString().slice(-6)}`,
        ...bookingPayload,
        created_at: new Date().toISOString()
      };
    }

    // Save into multi-user demo store so other roles (Staff, Admin) can see it immediately
    const recordToSave = {
      ...bookingPayload,
      ...(newBooking || {}),
      id: newBooking?.id || `bk-${Date.now().toString().slice(-6)}`,
      customer_name: state.profile?.full_name || 'Guest Customer',
      customer_email: state.profile?.email || state.user?.email,
      customer_phone: state.profile?.phone || '',
      vehicles: { ...v },
      created_at: newBooking?.created_at || new Date().toISOString()
    };
    saveLocalBooking(recordToSave);

    // Save pending manager alert into localStorage
    try {
      localStorage.setItem('rentflow_pending_manager_alert', JSON.stringify(recordToSave));
    } catch (e) {}

    // Trigger real-time floating pop-up notification with audio chime!
    showBookingAlertPopup(recordToSave);

    if (calculatedBookingData.dId) {
      await supabase.from('driver_assignments').insert({
        booking_id: newBooking?.id ?? null,
        driver_id: Number(calculatedBookingData.dId),
      }).then(() => {}).catch(() => {});
    }

    closeModal();

    const refNum = `BK-${Date.now().toString().slice(-8)}`;
    const sysSettings = getSystemSettings();
    const comp = sysSettings.company || DEFAULT_SETTINGS.company;
    const pol = sysSettings.policy || DEFAULT_SETTINGS.policy;

    openModal(`
      <div style="text-align:center;margin-bottom:18px;">
        <div style="width:56px;height:56px;border-radius:50%;background:#ecfdf5;border:2px solid #a7f3d0;display:inline-flex;align-items:center;justify-content:center;margin-bottom:10px;">
          <i class="fa-solid fa-circle-check" style="font-size:28px;color:#059669;"></i>
        </div>
        <h2 style="font-size:1.3rem;font-weight:800;color:#0f172a;margin-bottom:4px;">Booking Submitted Successfully!</h2>
        <span class="badge badge-pending" style="font-size:0.75rem;">Pending Staff Approval</span>
        <p class="muted" style="margin-top:8px;font-size:0.82rem;color:#64748b;">Booking Reference: <strong style="color:#0f172a;">${refNum}</strong></p>
      </div>

      <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;">
        <i class="fa-solid fa-car" style="color:#2563eb;"></i> Booking Summary
      </h4>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;">
        <div class="receipt-row"><span style="color:#64748b;">Vehicle</span><span style="font-weight:700;color:#0f172a;">${v.name}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Category</span><span style="color:#0f172a;">${catName}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Plate Number</span><span style="color:#0f172a;">${maskPlate(v.plate_number)}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Pickup Date</span><span style="color:#0f172a;font-weight:600;">${fmtDate(start.value)}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Return Date</span><span style="color:#0f172a;font-weight:600;">${fmtDate(end.value)}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Duration</span><span style="color:#0f172a;">${calculatedBookingData.days} day(s)</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Driver Option</span><span style="font-weight:600;color:#0f172a;">${calculatedBookingData.selectedDriver ? calculatedBookingData.selectedDriver.name : 'Self-Drive'}</span></div>
        ${appliedPromo ? `
          <div class="receipt-row"><span style="color:#059669;font-weight:700;">Promo Discount</span><span style="font-weight:700;color:#059669;">${appliedPromo.code} (-${fmtMoney(appliedPromo.discount)})</span></div>
        ` : ''}
        <div class="receipt-row"><span style="color:#64748b;">Payment Structure</span><span style="font-weight:700;color:#2563eb;">${selectedDownpaymentPct === 100 ? 'Full Payment (100%)' : '20% Downpayment'}</span></div>
      </div>

      <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;">
        <i class="fa-solid fa-receipt" style="color:#059669;"></i> Transparent Total
      </h4>
      <div class="receipt" style="margin-bottom:16px;">
        <div class="receipt-row"><span>Vehicle Rental</span><span>${fmtMoney(calculatedBookingData.vehicleCost)}</span></div>
        ${calculatedBookingData.driverFee > 0 ? `<div class="receipt-row"><span>Driver Fee</span><span>${fmtMoney(calculatedBookingData.driverFee)}</span></div>` : ''}
        ${appliedPromo ? `
          <div class="receipt-row" style="color:#059669;font-weight:700;">
            <span>Promo Discount (${appliedPromo.code})</span>
            <span>- ${fmtMoney(appliedPromo.discount)}</span>
          </div>
        ` : ''}
        <div class="receipt-row"><span>Comprehensive Protection</span><span style="color:#059669;font-weight:600;">Included Free</span></div>
        <div class="receipt-row"><span>Sanitation &amp; Prep</span><span style="color:#059669;font-weight:600;">Included Free</span></div>
        <div class="divider"></div>
        <div class="receipt-row receipt-total"><span>Total Estimated Cost</span><span>${fmtMoney(finalAmount)}</span></div>
      </div>

      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;align-items:flex-start;gap:10px;">
        <i class="fa-solid fa-circle-info" style="color:#0284c7;font-size:1.1rem;margin-top:2px;"></i>
        <p style="font-size:0.78rem;color:#0369a1;line-height:1.5;margin:0;">
          Staff will review your booking request and notify you once approved. You will be able to complete payment online or upon physical pickup of the vehicle.
        </p>
      </div>

      <button class="btn btn-primary btn-block" id="confirmClose">View My Bookings</button>
    `);

    $('#confirmClose').addEventListener('click', () => {
      closeModal();
      state.tab = 'bookings';
      if (window.renderShell) {
        window.renderShell();
      }
    });
  });
}
