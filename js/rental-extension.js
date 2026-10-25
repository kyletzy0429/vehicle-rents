import { supabase } from './config.js';
import { state, getLocalBookings, saveLocalBooking, updateLocalBookingStatus } from './state.js';
import { $, $$, fmtMoney, fmtDate, toast, openModal, closeModal, maskPlate } from './utils.js';

function getVehicleImg(v) {
  if (!v) return 'images/fortuner.webp';
  if (v.image_url) return v.image_url;
  const name = (v.name || '').toLowerCase();
  if (name.includes('fortuner')) return 'images/fortuner.webp';
  if (name.includes('vios')) return 'images/vios.webp';
  if (name.includes('innova')) return 'images/innova.webp';
  if (name.includes('montero')) return 'images/montero.webp';
  if (name.includes('raptor') || name.includes('ranger')) return 'images/raptor.webp';
  if (name.includes('xpander')) return 'images/xpander.webp';
  if (name.includes('mirage')) return 'images/mirage.webp';
  if (name.includes('wigo')) return 'images/wigo.webp';
  if (name.includes('hilux')) return 'images/hilux.webp';
  if (name.includes('commuter') || name.includes('hiace')) return 'images/commuter.webp';
  if (name.includes('nmax')) return 'images/nmax.webp';
  if (name.includes('click')) return 'images/click.webp';
  return 'images/fortuner.webp';
}

function addDaysToDate(dateStr, numDays) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + Number(numDays));
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calcDaysBetween(startStr, endStr) {
  if (!startStr || !endStr) return 1;
  const s = new Date(startStr + 'T00:00:00');
  const e = new Date(endStr + 'T00:00:00');
  const diffTime = e - s;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

/**
 * Checks for double booking conflicts on the vehicle during the extension period.
 * Extension interval is (currentEndDate + 1 day) up to newEndDate.
 */
export async function checkExtensionConflict(vehicleId, currentBookingId, oldEndDate, newEndDate) {
  const extStartDate = addDaysToDate(oldEndDate, 1);

  // 1. Check local storage bookings
  const localBookings = getLocalBookings().filter(b => 
    String(b.vehicle_id) === String(vehicleId) &&
    String(b.id) !== String(currentBookingId) &&
    ['pending', 'approved', 'active', 'reserved', 'completed'].includes(b.status)
  );

  let conflictingBooking = localBookings.find(b => {
    const bStart = (b.start_date || '').slice(0, 10);
    const bEnd = (b.end_date || '').slice(0, 10);
    return bStart <= newEndDate && bEnd >= extStartDate;
  });

  // 2. Check Supabase database
  if (!conflictingBooking && supabase) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, start_date, end_date, status, customer_id, profiles(full_name)')
        .eq('vehicle_id', vehicleId)
        .neq('id', currentBookingId)
        .in('status', ['pending', 'approved', 'active', 'reserved'])
        .lte('start_date', newEndDate)
        .gte('end_date', extStartDate);

      if (!error && data && data.length > 0) {
        conflictingBooking = data[0];
      }
    } catch (e) {
      console.warn('Extension conflict DB check notice:', e);
    }
  }

  if (conflictingBooking) {
    return {
      conflict: true,
      conflictBooking: conflictingBooking,
      conflictStart: conflictingBooking.start_date,
      conflictEnd: conflictingBooking.end_date
    };
  }

  return { conflict: false };
}

/**
 * Opens the interactive Rental Extension modal.
 * Can be called with a specific bookingId or null to pick from all active rentals.
 */
export async function openRentalExtensionModal(bookingId = null) {
  let targetBooking = null;
  let allActiveBookings = [];

  // Fetch or find candidate active bookings
  try {
    const local = getLocalBookings().filter(b => ['approved', 'active', 'reserved'].includes(b.status));
    let dbBookings = [];
    if (supabase) {
      const { data } = await supabase
        .from('bookings')
        .select('*, vehicles(id, name, plate_number, image_url, category_id, categories(daily_rate)), profiles(full_name, phone)')
        .in('status', ['approved', 'active', 'reserved'])
        .order('created_at', { ascending: false });
      if (data) dbBookings = data;
    }

    const mergedMap = new Map();
    dbBookings.forEach(b => mergedMap.set(String(b.id), b));
    local.forEach(b => {
      if (!mergedMap.has(String(b.id))) {
        mergedMap.set(String(b.id), b);
      }
    });

    allActiveBookings = Array.from(mergedMap.values());
  } catch (e) {
    console.warn('Error loading active bookings:', e);
    allActiveBookings = getLocalBookings().filter(b => ['approved', 'active', 'reserved'].includes(b.status));
  }

  if (bookingId) {
    targetBooking = allActiveBookings.find(b => String(b.id) === String(bookingId));
    if (!targetBooking) {
      // Direct lookup in active customer bookings or local storage
      targetBooking = getLocalBookings().find(b => String(b.id) === String(bookingId));
    }
  } else if (allActiveBookings.length > 0) {
    targetBooking = allActiveBookings[0];
  }

  if (!targetBooking && allActiveBookings.length === 0) {
    toast('No approved or active rentals found eligible for extension.', 'info');
    return;
  }

  renderExtensionModalContent(targetBooking, allActiveBookings);
}

function renderExtensionModalContent(booking, allActiveBookings) {
  let currentBooking = booking || allActiveBookings[0];
  let extraDays = 1;

  // Resolve vehicle & daily rate
  function resolveVehicleRate(b) {
    if (!b) return 2000;
    if (b.daily_rate) return Number(b.daily_rate);
    if (b.vehicles?.categories?.daily_rate) return Number(b.vehicles.categories.daily_rate);
    
    // Find in state.vehicles or state.categories
    const v = (state.vehicles || []).find(x => String(x.id) === String(b.vehicle_id));
    if (v) {
      if (v.daily_rate) return Number(v.daily_rate);
      const cat = (state.categories || []).find(c => c.id === v.category_id);
      if (cat && cat.daily_rate) return Number(cat.daily_rate);
    }
    
    // Approximate from total amount / days
    const days = calcDaysBetween(b.start_date, b.end_date);
    if (b.total_amount && days > 0) {
      return Math.round(Number(b.total_amount) / days);
    }
    return 2000;
  }

  function resolveVehicle(b) {
    if (b?.vehicles && typeof b.vehicles === 'object') return b.vehicles;
    const found = (state.vehicles || []).find(x => String(x.id) === String(b?.vehicle_id));
    if (found) return found;
    return { name: b?.vehicle_name || 'Vehicle', plate_number: 'N/A' };
  }

  function resolveCustomerName(b) {
    if (b?.profiles?.full_name) return b.profiles.full_name;
    if (b?.customer_name) return b.customer_name;
    return 'Customer';
  }

  const modalHtml = `
    <div class="ext-modal-wrap">
      <div class="modal-head" style="margin-bottom:16px;">
        <div>
          <h3 style="font-size:1.25rem;font-weight:800;color:var(--text-hi,#0f172a);display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-clock-rotate-left" style="color:var(--accent,#7c3aed);"></i> Rental Extension
          </h3>
          <span class="muted" style="font-size:0.8rem;">Extend the return date of an active rental and calculate extra charges.</span>
        </div>
        <button type="button" class="modal-close" id="mClose" title="Close" aria-label="Close"><i class="fa-solid fa-xmark"></i> Close</button>
      </div>

      <!-- Booking Selector if multiple available -->
      ${allActiveBookings.length > 1 ? `
        <div class="field" style="margin-bottom:16px;">
          <label style="font-size:0.82rem;font-weight:700;">Select Active Rental</label>
          <select id="extBookingSelect" style="width:100%;font-size:0.88rem;padding:10px 12px;border-radius:10px;border:1.5px solid #cbd5e1;">
            ${allActiveBookings.map(b => {
              const v = resolveVehicle(b);
              const cName = resolveCustomerName(b);
              const isSelected = String(b.id) === String(currentBooking.id);
              return `<option value="${b.id}" ${isSelected ? 'selected' : ''}>${v.name} (${v.plate_number}) - ${cName} [${(b.start_date||'').slice(5)} to ${(b.end_date||'').slice(5)}]</option>`;
            }).join('')}
          </select>
        </div>
      ` : ''}

      <!-- Vehicle & Booking Summary Card -->
      <div id="extBookingDetailsCard"></div>

      <!-- Extension Days Selection -->
      <div class="ext-section-box">
        <label style="font-size:0.85rem;font-weight:800;color:var(--text-hi,#0f172a);display:block;margin-bottom:8px;">
          Choose Additional Days
        </label>
        
        <div class="ext-quick-days" id="extQuickDays">
          <button type="button" class="ext-day-chip active" data-days="1">+1 Day</button>
          <button type="button" class="ext-day-chip" data-days="2">+2 Days</button>
          <button type="button" class="ext-day-chip" data-days="3">+3 Days</button>
          <button type="button" class="ext-day-chip" data-days="5">+5 Days</button>
          <button type="button" class="ext-day-chip" data-days="7">+7 Days</button>
        </div>

        <div style="display:flex;align-items:center;gap:12px;margin-top:12px;">
          <div style="flex:1;">
            <label style="font-size:0.75rem;font-weight:700;color:#64748b;margin-bottom:4px;display:block;">Custom Days Count</label>
            <div class="ext-stepper-wrap">
              <button type="button" class="ext-stepper-btn" id="extMinusDay"><i class="fa-solid fa-minus"></i></button>
              <input type="number" id="extDaysInput" min="1" max="60" value="1" class="ext-stepper-val" />
              <button type="button" class="ext-stepper-btn" id="extPlusDay"><i class="fa-solid fa-plus"></i></button>
            </div>
          </div>

          <div style="flex:1.4;">
            <label style="font-size:0.75rem;font-weight:700;color:#64748b;margin-bottom:4px;display:block;">New Return Date</label>
            <input type="date" id="extNewDateInput" class="ext-date-input" />
          </div>
        </div>
      </div>

      <!-- Real-time Availability & Conflict Status Banner -->
      <div id="extAvailabilityBanner" style="margin-bottom:16px;"></div>

      <!-- Real-time Cost Calculation Breakdown -->
      <div class="ext-calc-card" id="extCalcCard"></div>

      <!-- Optional Admin / Customer Extension Note -->
      <div class="field" style="margin-bottom:16px;">
        <label style="font-size:0.78rem;font-weight:700;color:#64748b;">Extension Notes or Reason (Optional)</label>
        <input type="text" id="extNotesInput" placeholder="e.g. Flight rescheduled, customer requested 2 more days" style="font-size:0.85rem;" />
      </div>

      <!-- Action Footer -->
      <div style="display:flex;gap:12px;justify-content:flex-end;">
        <button type="button" class="btn btn-ghost" id="extCancelBtn">Cancel</button>
        <button type="button" class="btn btn-primary" id="extConfirmBtn" style="min-width:180px;">
          <i class="fa-solid fa-check"></i> Confirm Extension
        </button>
      </div>
    </div>
  `;

  openModal(modalHtml);

  // Bind change events and calculations
  const bookingSelect = $('#extBookingSelect');
  const detailsContainer = $('#extBookingDetailsCard');
  const daysInput = $('#extDaysInput');
  const newDateInput = $('#extNewDateInput');
  const bannerContainer = $('#extAvailabilityBanner');
  const calcCard = $('#extCalcCard');
  const confirmBtn = $('#extConfirmBtn');
  const cancelBtn = $('#extCancelBtn');
  const quickDaysWrap = $('#extQuickDays');

  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  const mCloseBtn = $('#mClose');
  if (mCloseBtn) mCloseBtn.addEventListener('click', closeModal);

  if (bookingSelect) {
    bookingSelect.addEventListener('change', () => {
      const selectedId = bookingSelect.value;
      const found = allActiveBookings.find(b => String(b.id) === String(selectedId));
      if (found) {
        currentBooking = found;
        extraDays = 1;
        daysInput.value = 1;
        updateUI();
      }
    });
  }

  function updateQuickPillState(days) {
    if (!quickDaysWrap) return;
    quickDaysWrap.querySelectorAll('.ext-day-chip').forEach(chip => {
      if (Number(chip.dataset.days) === Number(days)) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  if (quickDaysWrap) {
    quickDaysWrap.querySelectorAll('.ext-day-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        extraDays = Number(chip.dataset.days) || 1;
        daysInput.value = extraDays;
        updateUI();
      });
    });
  }

  $('#extMinusDay')?.addEventListener('click', () => {
    if (extraDays > 1) {
      extraDays--;
      daysInput.value = extraDays;
      updateUI();
    }
  });

  $('#extPlusDay')?.addEventListener('click', () => {
    extraDays++;
    daysInput.value = extraDays;
    updateUI();
  });

  daysInput?.addEventListener('input', () => {
    let val = parseInt(daysInput.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    extraDays = val;
    updateUI();
  });

  newDateInput?.addEventListener('change', () => {
    const chosenDate = newDateInput.value;
    const currentEnd = (currentBooking.end_date || '').slice(0, 10);
    if (chosenDate > currentEnd) {
      extraDays = calcDaysBetween(currentEnd, chosenDate);
      daysInput.value = extraDays;
      updateUI(false);
    } else {
      toast('New return date must be after current return date (' + fmtDate(currentEnd) + ')', 'error');
      newDateInput.value = addDaysToDate(currentEnd, extraDays);
    }
  });

  async function updateUI(syncDateField = true) {
    const v = resolveVehicle(currentBooking);
    const cName = resolveCustomerName(currentBooking);
    const dailyRate = resolveVehicleRate(currentBooking);
    const currentStart = (currentBooking.start_date || '').slice(0, 10);
    const currentEnd = (currentBooking.end_date || '').slice(0, 10);
    const originalDays = calcDaysBetween(currentStart, currentEnd);

    const newEnd = addDaysToDate(currentEnd, extraDays);
    if (syncDateField && newDateInput) {
      newDateInput.min = addDaysToDate(currentEnd, 1);
      newDateInput.value = newEnd;
    }

    updateQuickPillState(extraDays);

    // Render Booking Summary Card
    detailsContainer.innerHTML = `
      <div class="ext-summary-card">
        <img src="${getVehicleImg(v)}" class="ext-v-img" alt="${v.name || 'Vehicle'}" />
        <div class="ext-summary-main">
          <div class="ext-v-title">${v.name || 'Vehicle'} <span class="muted">(${maskPlate(v.plate_number || 'N/A')})</span></div>
          <div class="ext-sub-info">
            <i class="fa-solid fa-user" style="font-size:0.75rem;color:#64748b;"></i> <strong>${cName}</strong>
            · Daily Rate: <strong style="color:var(--accent,#7c3aed);">${fmtMoney(dailyRate)}/day</strong>
          </div>
          <div class="ext-date-badge-row">
            <span class="ext-badge-old">
              Current: <strong>${fmtDate(currentStart)} → ${fmtDate(currentEnd)}</strong> (${originalDays} days)
            </span>
            <i class="fa-solid fa-arrow-right" style="color:var(--accent,#7c3aed);font-size:0.8rem;"></i>
            <span class="ext-badge-new">
              New: <strong>${fmtDate(newEnd)}</strong> (+${extraDays} days)
            </span>
          </div>
        </div>
      </div>
    `;

    // Calculate Costs
    const extraCharge = extraDays * dailyRate;
    const currentTotal = Number(currentBooking.total_amount || 0);
    const currentPaid = Number(currentBooking.paid_amount || 0);
    const newTotal = currentTotal + extraCharge;
    const currentBalance = Number(currentBooking.balance_due ?? (currentTotal - currentPaid));
    const newBalance = currentBalance + extraCharge;

    calcCard.innerHTML = `
      <div class="ext-calc-row">
        <span>Current Booking Total (${originalDays} days)</span>
        <strong>${fmtMoney(currentTotal)}</strong>
      </div>
      <div class="ext-calc-row highlight">
        <span>
          <i class="fa-solid fa-plus-circle" style="color:var(--accent,#7c3aed);margin-right:4px;"></i>
          Extension Fee (${extraDays} extra day${extraDays > 1 ? 's' : ''} × ${fmtMoney(dailyRate)})
        </span>
        <strong style="color:var(--accent,#7c3aed);font-size:1.05rem;">+${fmtMoney(extraCharge)}</strong>
      </div>
      <div class="ext-calc-divider"></div>
      <div class="ext-calc-row total-row">
        <span>New Total Rental Amount (${originalDays + extraDays} days)</span>
        <span class="ext-new-total">${fmtMoney(newTotal)}</span>
      </div>
      <div class="ext-calc-sub">
        <span>Paid so far: <strong>${fmtMoney(currentPaid)}</strong></span>
        <span>· New Balance Due: <strong style="color:#dc2626;">${fmtMoney(newBalance)}</strong></span>
      </div>
    `;

    // Double-Booking Check
    bannerContainer.innerHTML = `
      <div class="ext-checking-box">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Checking vehicle availability for extended dates...
      </div>
    `;
    confirmBtn.disabled = true;

    const conflictResult = await checkExtensionConflict(
      currentBooking.vehicle_id || v.id,
      currentBooking.id,
      currentEnd,
      newEnd
    );

    if (conflictResult.conflict) {
      const conf = conflictResult.conflictBooking;
      const confCustomer = conf?.profiles?.full_name || 'another customer';
      bannerContainer.innerHTML = `
        <div class="ext-alert-danger">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:1.1rem;margin-top:2px;"></i>
          <div>
            <strong>Vehicle Unavailable for Extended Dates</strong>
            <p style="margin:4px 0 0 0;font-size:0.78rem;line-height:1.4;">
              This vehicle already has a reservation starting on <strong>${fmtDate(conf.start_date)}</strong> by <strong>${confCustomer}</strong>.
              Please choose a shorter extension period or a different return date before the next reservation.
            </p>
          </div>
        </div>
      `;
      confirmBtn.disabled = true;
    } else {
      bannerContainer.innerHTML = `
        <div class="ext-alert-success">
          <i class="fa-solid fa-circle-check" style="font-size:1.1rem;margin-top:2px;"></i>
          <div>
            <strong>Vehicle is Available!</strong>
            <p style="margin:2px 0 0 0;font-size:0.78rem;">
              No overlapping reservations found from <strong>${fmtDate(addDaysToDate(currentEnd, 1))}</strong> through <strong>${fmtDate(newEnd)}</strong>.
            </p>
          </div>
        </div>
      `;
      confirmBtn.disabled = false;
    }
  }

  // Initial trigger
  updateUI();

  // Confirm extension click handler
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Confirming...`;

    const v = resolveVehicle(currentBooking);
    const dailyRate = resolveVehicleRate(currentBooking);
    const currentEnd = (currentBooking.end_date || '').slice(0, 10);
    const newEnd = addDaysToDate(currentEnd, extraDays);
    const extraCharge = extraDays * dailyRate;
    const currentTotal = Number(currentBooking.total_amount || 0);
    const newTotal = currentTotal + extraCharge;
    const currentPaid = Number(currentBooking.paid_amount || 0);
    const currentBalance = Number(currentBooking.balance_due ?? (currentTotal - currentPaid));
    const newBalance = currentBalance + extraCharge;

    const userNote = ($('#extNotesInput')?.value || '').trim();
    const extensionLog = `[Extended +${extraDays}d to ${newEnd} (+${fmtMoney(extraCharge)}) on ${new Date().toISOString().slice(0, 10)}${userNote ? `: ${userNote}` : ''}]`;
    const updatedReviewNotes = (currentBooking.review_notes ? currentBooking.review_notes + ' | ' : '') + extensionLog;

    try {
      // 1. Update in Supabase
      if (supabase && !String(currentBooking.id).startsWith('bk-')) {
        await supabase.from('bookings').update({
          end_date: newEnd,
          total_amount: newTotal,
          balance_due: newBalance,
          review_notes: updatedReviewNotes
        }).eq('id', currentBooking.id);
      }
    } catch (e) {
      console.warn('Supabase extension update notice:', e);
    }

    // 2. Update local storage
    updateLocalBookingStatus(currentBooking.id, currentBooking.status, {
      end_date: newEnd,
      total_amount: newTotal,
      balance_due: newBalance,
      review_notes: updatedReviewNotes
    });

    // 3. Update memory object
    currentBooking.end_date = newEnd;
    currentBooking.total_amount = newTotal;
    currentBooking.balance_due = newBalance;
    currentBooking.review_notes = updatedReviewNotes;

    // Show Confirmation Receipt Modal
    closeModal();
    openExtensionSuccessModal(currentBooking, v, extraDays, extraCharge, newEnd, newTotal, newBalance);

    // Refresh active view
    if (window.renderShell) {
      window.renderShell();
    } else {
      const view = $('#view');
      if (view) {
        if (state.portal === 'admin' && window.renderAdminRentals) {
          window.renderAdminRentals(view);
        } else if (state.portal === 'customer' && window.renderCustomerBookings) {
          window.renderCustomerBookings(view);
        } else if (state.portal === 'staff' && window.renderStaffActive) {
          window.renderStaffActive(view);
        }
      }
    }

    toast(`Rental successfully extended until ${fmtDate(newEnd)}! (+${fmtMoney(extraCharge)})`, 'success');
  });
}

function openExtensionSuccessModal(b, v, extraDays, extraCharge, newEnd, newTotal, newBalance) {
  const receiptHtml = `
    <div style="text-align:center;padding:10px 0;">
      <div style="width:60px;height:60px;background:#ecfdf5;color:#059669;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:1.8rem;">
        <i class="fa-solid fa-check"></i>
      </div>
      <h3 style="font-size:1.3rem;font-weight:800;color:#0f172a;margin-bottom:6px;">
        Extension Confirmed!
      </h3>
      <p style="font-size:0.85rem;color:#64748b;margin-bottom:20px;">
        Your vehicle rental has been officially extended in the system.
      </p>

      <div class="receipt" style="text-align:left;margin-bottom:20px;">
        <div style="font-weight:800;font-size:1rem;color:#0f172a;margin-bottom:8px;">
          ${v.name || 'Vehicle'} <span class="muted">(${maskPlate(v.plate_number || 'N/A')})</span>
        </div>
        <div class="receipt-row">
          <span>Booking Reference</span>
          <strong>${b.ref_number || `BK-${String(b.id).slice(-6)}`}</strong>
        </div>
        <div class="receipt-row">
          <span>New Return Date</span>
          <strong style="color:var(--accent,#7c3aed);">${fmtDate(newEnd)}</strong>
        </div>
        <div class="receipt-row">
          <span>Days Added</span>
          <strong>+${extraDays} Day${extraDays > 1 ? 's' : ''}</strong>
        </div>
        <div class="receipt-row">
          <span>Extension Fee</span>
          <strong style="color:#059669;">+${fmtMoney(extraCharge)}</strong>
        </div>
        <div class="receipt-row receipt-total">
          <span>Updated Total Amount</span>
          <span>${fmtMoney(newTotal)}</span>
        </div>
        ${newBalance > 0 ? `
          <div class="receipt-row" style="margin-top:6px;color:#dc2626;">
            <span>Outstanding Balance Due</span>
            <strong>${fmtMoney(newBalance)}</strong>
          </div>
        ` : ''}
      </div>

      <div style="display:flex;gap:10px;justify-content:center;">
        <button type="button" class="btn btn-secondary" onclick="window.print();">
          <i class="fa-solid fa-print"></i> Print Details
        </button>
        <button type="button" class="btn btn-primary" id="btnDoneExtension" onclick="document.getElementById('activeModal')?.remove();">
          Done
        </button>
      </div>
    </div>
  `;

  openModal(receiptHtml);
}

// Global exposure
if (typeof window !== 'undefined') {
  window.openRentalExtensionModal = openRentalExtensionModal;
}
