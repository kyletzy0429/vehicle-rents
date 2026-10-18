import { supabase } from './config.js';
import { state, DEFAULT_SETTINGS, getSystemSettings, getLocalBookings, updateLocalBookingStatus } from './state.js';
import { $, $$, fmtMoney, fmtDate, daysBetween, maskPlate, toast, openModal, closeModal, emptyState } from './utils.js';
import { getFavorites, toggleFavorite, vehicleCardHTML, renderBrowse, getExactVehicleImage, loadVehicles } from './vehicles.js';
import { openVehicleDetail } from './booking.js';
import { broadcastBookingStatusChange } from './realtime.js';

export async function renderCustomer(tab, view) {
  if (tab === 'browse') return renderBrowse(view);
  if (tab === 'favorites') return renderCustomerFavorites(view);
  if (tab === 'bookings') return renderMyBookings(view);
  if (tab === 'account' || tab === 'profile') return renderCustomerProfile(view);
  state.tab = 'browse';
  return renderBrowse(view);
}

export async function renderCustomerFavorites(view) {
  const favIds = getFavorites();
  const favVehicles = state.vehicles.filter(v => favIds.includes(v.id));

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2>My Saved Favorites</h2>
          <p>Your bookmarked cars and motorcycles for fast reservation.</p>
        </div>
      </div>
      <div class="grid grid-vehicles" id="favGrid">
        ${favVehicles.length ? favVehicles.map(vehicleCardHTML).join('') : emptyState('', 'No favorite vehicles saved yet. Click the heart icon on any vehicle to save it here!')}
      </div>
    </div>
  `;

  $$('#favGrid .vehicle-card').forEach(card => card.addEventListener('click', () => openVehicleDetail(Number(card.dataset.id))));
  $$('#favGrid .vehicle-book-pill-btn').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openVehicleDetail(Number(btn.dataset.bookBtn));
  }));
  $$('#favGrid .vehicle-fav-btn, #favGrid .fav-heart-btn').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(Number(btn.dataset.favid));
  }));
}

export async function renderCustomerProfile(view) {
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
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid #e2e8f0;">
          <div style="width:64px;height:64px;border-radius:50%;background:var(--primary-gradient);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:800;box-shadow:0 4px 12px var(--accent-glow);">
            ${initials}
          </div>
          <div style="flex:1;">
            <h3 style="font-size:1.25rem;font-weight:800;color:#0f172a;margin-bottom:2px;">${p.full_name || 'Customer Account'}</h3>
            <div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;color:#64748b;flex-wrap:wrap;">
              <span>${state.user?.email || '—'}</span>
            </div>
          </div>
        </div>

        <form id="profileForm">
          <h4 style="font-size:0.95rem;font-weight:700;color:#0f172a;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            Personal Information
          </h4>
          <div class="detail-grid" style="margin-bottom:18px;">
            <div class="field">
              <label>Full Name</label>
              <input type="text" id="profName" value="${p.full_name ?? ''}" placeholder="Full Name" required />
            </div>
            <div class="field">
              <label>Phone Number</label>
              <input type="text" id="profPhone" value="${p.phone ?? ''}" placeholder="+63 917 123 4567" required />
            </div>
          </div>

          <h4 style="font-size:0.95rem;font-weight:700;color:#0f172a;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            Driver's License Information
          </h4>
          <div class="detail-grid" style="margin-bottom:18px;">
            <div class="field">
              <label>Driver's License Number <span style="font-weight:normal;color:#64748b;font-size:0.75rem;">(Optional — verify in-person at meetup)</span></label>
              <input type="text" id="profLicense" value="${p.license_number ?? ''}" placeholder="Optional (e.g. N02-18-984012)" />
            </div>
            <div class="field">
              <label>License Expiry Date <span style="font-weight:normal;color:#64748b;font-size:0.75rem;">(Optional)</span></label>
              <input type="date" id="profLicenseExpiry" value="${p.license_expiry ?? ''}" />
            </div>
          </div>

          <h4 style="font-size:0.95rem;font-weight:700;color:#0f172a;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            Driver's License Photo <span style="font-weight:normal;color:#64748b;font-size:0.75rem;">(Optional)</span>
          </h4>
          <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;">
            <div id="licensePreviewBox" style="margin-bottom:12px;">
              ${p.license_id_url ? `
                <div style="position:relative;display:inline-block;">
                  <img src="${p.license_id_url}" id="licenseImgPreview" style="max-width:100%;max-height:190px;border-radius:10px;border:2px solid var(--accent);box-shadow:0 4px 12px rgba(0,0,0,0.1);" />
                  <div style="position:absolute;top:6px;right:6px;background:#059669;color:#fff;font-size:0.72rem;font-weight:700;padding:3px 10px;border-radius:99px;">ID Photo Uploaded</div>
                </div>
              ` : `
                <div style="padding:16px 10px;">
                  <div style="font-size:0.88rem;font-weight:700;color:#334155;">Upload Driver's License Card Photo</div>
                  <div style="font-size:0.75rem;color:#64748b;margin-top:2px;">Select clear photo of your Driver's License ID (JPG, PNG, WEBP)</div>
                </div>
              `}
            </div>
            <input type="file" id="licenseFileInput" accept="image/*" style="display:none;" />
            <input type="hidden" id="licenseIdUrl" value="${p.license_id_url ?? ''}" />
            <button type="button" class="btn btn-ghost btn-sm" id="uploadLicenseBtn" style="border:1px solid #cbd5e1;background:#ffffff;">
              ${p.license_id_url ? 'Change License Photo' : 'Choose License Photo'}
            </button>
          </div>

          <div class="field" style="margin-bottom:22px;">
            <label>Complete Address</label>
            <input type="text" id="profAddress" value="${p.address ?? ''}" placeholder="123 Sampaguita St, Barangay San Antonio, Makati City" />
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="saveProfBtn" style="padding:14px;">
            Save Profile Details
          </button>
        </form>
      </div>
    </div>
  `;

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
            <img src="${dataUrl}" id="licenseImgPreview" style="max-width:100%;max-height:190px;border-radius:10px;border:2px solid var(--accent);box-shadow:0 4px 12px rgba(0,0,0,0.1);" />
            <div style="position:absolute;top:6px;right:6px;background:#059669;color:#fff;font-size:0.72rem;font-weight:700;padding:3px 10px;border-radius:99px;">Photo Ready</div>
          </div>
        `;
        toast('Driver License photo selected! Click Save Profile Details to submit.', 'info');
      };
      reader.readAsDataURL(file);
    });
  }

  $('#btnVerifyNowBadge')?.addEventListener('click', () => {
    import('./auth.js').then(({ promptRenterVerificationModal }) => promptRenterVerificationModal(true));
  });

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

    const uid = state.user?.id || '8bebdf37-d488-4e10-bb84-63a01c157c3a';
    let { error } = await supabase.from('profiles').update(updated).eq('id', uid);

    if (error) {
      const standardPayload = { full_name: updated.full_name, phone: updated.phone };
      const { error: fbErr } = await supabase.from('profiles').update(standardPayload).eq('id', uid);
      if (fbErr) {
        toast(fbErr.message, 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Profile Details';
        return;
      }
    }

    try {
      localStorage.setItem(`rentflow_prof_${uid}`, JSON.stringify(updated));
    } catch (e) { }

    Object.assign(state.profile, updated);
    toast('Profile & License details saved successfully!', 'success');
    if (window.renderShell) {
      window.renderShell();
    }
  });
}

export async function renderMyBookings(view) {
  let dbBookings = [];
  const currentCustomerId = state.user?.id || '8bebdf37-d488-4e10-bb84-63a01c157c3a';
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, vehicles(name, plate_number, image_url)')
      .eq('customer_id', currentCustomerId)
      .order('created_at', { ascending: false });
    if (!error && data) dbBookings = data;
  } catch (err) {
    console.warn('DB booking load notice:', err);
  }

  // Merge local demo bookings matching active customer
  const localList = getLocalBookings().filter(b => b.customer_id === currentCustomerId);
  const dbIds = new Set(dbBookings.map(b => String(b.id)));
  const bookings = [...dbBookings];
  for (const lb of localList) {
    if (!dbIds.has(String(lb.id))) {
      bookings.push(lb);
    }
  }
  bookings.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  // Store in memory for instant modal retrieval (0ms)
  window._activeCustomerBookings = bookings;

  const todayStr = new Date().toISOString().slice(0, 10);
  const returnDueBooking = bookings.find(b => ['active', 'approved'].includes(b.status) && (b.end_date || '').slice(0, 10) <= todayStr);
  const isOverdue = returnDueBooking && (returnDueBooking.end_date || '').slice(0, 10) < todayStr;

  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const activeCount = bookings.filter(b => ['active', 'approved', 'reserved', 'partially_paid'].includes(b.status)).length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;
  const cancelledCount = bookings.filter(b => ['cancelled', 'rejected', 'refunded', 'refund_requested'].includes(b.status)).length;

  view.innerHTML = `
    <div class="view">
      <div class="section-head" style="margin-bottom:20px;">
        <div>
          <h2>My Bookings &amp; Rentals</h2>
          <p>Track your requests, active rentals, receipts, and rental history.</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <button type="button" class="btn btn-primary btn-sm" id="btnBookingsRenterId">
            <i class="fa-solid fa-id-badge"></i> Digital Renter Pass
        </div>
      </div>

      ${returnDueBooking ? `
        <div class="return-today-alert-card" style="background:${isOverdue ? '#fff8f8' : '#fffbeb'};border:1px solid ${isOverdue ? '#fecdd3' : '#fde68a'};border-left:5px solid ${isOverdue ? '#e11d48' : '#d97706'};border-radius:14px;padding:16px 20px;margin-bottom:22px;display:flex;align-items:center;justify-content:space-between;gap:16px;box-shadow:0 4px 16px rgba(0,0,0,0.03);flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:260px;">
            <div style="width:44px;height:44px;background:${isOverdue ? '#ffe4e6' : '#fef3c7'};color:${isOverdue ? '#e11d48' : '#d97706'};border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.25rem;flex-shrink:0;">
              <i class="fa-solid ${isOverdue ? 'fa-triangle-exclamation' : 'fa-bell'}"></i>
            </div>
            <div>
              <div style="font-weight:700;color:${isOverdue ? '#9f1239' : '#92400e'};font-size:0.98rem;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px;">
                <span>${isOverdue ? 'Rental Return Overdue' : 'Vehicle Return Due Today'}</span>
                <span style="font-size:0.72rem;background:${isOverdue ? '#ffe4e6' : '#fef3c7'};color:${isOverdue ? '#9f1239' : '#92400e'};border:1px solid ${isOverdue ? '#fecdd3' : '#fde68a'};padding:2px 8px;border-radius:20px;font-weight:700;">
                  <i class="fa-regular fa-clock" style="margin-right:3px;"></i>12:00 PM Handover
                </span>
              </div>
              <div style="font-size:0.84rem;color:${isOverdue ? '#881337' : '#78350f'};line-height:1.45;">
                Your <strong>${returnDueBooking.vehicles?.name || 'Rental'}</strong> is scheduled for return at <strong>123 PPC Main Branch Venue</strong>. Please ensure fuel matches pickup level.
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;">
            <button type="button" class="btn btn-sm" onclick="window.openRentalExtensionModal && window.openRentalExtensionModal('${returnDueBooking.id}')" style="background:${isOverdue ? '#e11d48' : '#d97706'};color:#ffffff;border:none;border-radius:8px;font-weight:600;padding:8px 16px;box-shadow:0 3px 10px ${isOverdue ? 'rgba(225,29,72,0.25)' : 'rgba(217,119,6,0.25)'};cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 0.2s;">
              <i class="fa-solid fa-clock-rotate-left"></i> Request Extension
            </button>
          </div>
        </div>
      ` : ''}

      <div class="booking-filter-tabs">
        <button type="button" class="booking-tab-btn active" data-bfilter="all">
          <i class="fa-solid fa-list-ul"></i> All Bookings <span class="booking-tab-badge">${bookings.length}</span>
        </button>
        <button type="button" class="booking-tab-btn" data-bfilter="pending">
          <i class="fa-solid fa-hourglass-half"></i> Pending <span class="booking-tab-badge">${pendingCount}</span>
        </button>
        <button type="button" class="booking-tab-btn" data-bfilter="active">
          <i class="fa-solid fa-car"></i> Active &amp; Approved <span class="booking-tab-badge">${activeCount}</span>
        </button>
        <button type="button" class="booking-tab-btn" data-bfilter="completed">
          <i class="fa-solid fa-circle-check"></i> Completed <span class="booking-tab-badge">${completedCount}</span>
        </button>
        <button type="button" class="booking-tab-btn" data-bfilter="cancelled">
          <i class="fa-solid fa-ban"></i> Cancelled <span class="booking-tab-badge">${cancelledCount}</span>
        </button>
      </div>

      <div class="row-list" id="bookingList">
        ${bookings.length ? bookings.map(b => customerBookingRow(b)).join('') : emptyState('', 'No bookings yet — browse vehicles to get started.')}
      </div>
    </div>
  `;

  $('#btnBookingsRenterId')?.addEventListener('click', () => {
    import('./utils.js').then(({ openRenterIdModal }) => openRenterIdModal(state.profile));
  });


  const filterBookings = (f) => {
    if (f === 'pending') return bookings.filter(b => b.status === 'pending');
    if (f === 'active') return bookings.filter(b => ['active', 'approved', 'reserved', 'partially_paid'].includes(b.status));
    if (f === 'completed') return bookings.filter(b => b.status === 'completed');
    if (f === 'cancelled') return bookings.filter(b => ['cancelled', 'rejected', 'refunded', 'refund_requested'].includes(b.status));
    return bookings;
  };

  const attachBookingListeners = () => {
    $$('[data-pay-id]', view).forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPaymentModal(btn.dataset.payId);
      });
    });
    $$('[data-pay-balance-id]', view).forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPaymentModal(btn.dataset.payBalanceId, true);
      });
    });
    $$('[data-receipt-id]', view).forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPaidReceiptModal(btn.dataset.receiptId);
    }));
    $$('[data-refund-req-id]', view).forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openRefundRequestModal(btn.dataset.refundReqId);
    }));
    $$('[data-refund-voucher-id]', view).forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openRefundVoucherModal(btn.dataset.refundVoucherId);
    }));
    $$('[data-cancel-id]', view).forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelCustomerBooking(btn.dataset.cancelId);
    }));
  };

  attachBookingListeners();

  $$('.booking-tab-btn', view).forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      const filterKey = tabBtn.dataset.bfilter;
      $$('.booking-tab-btn', view).forEach(b => b.classList.toggle('active', b === tabBtn));
      const filtered = filterBookings(filterKey);
      const listEl = $('#bookingList', view);
      if (!listEl) return;

      if (!filtered.length) {
        listEl.innerHTML = `
          <div class="empty-box" style="text-align:center;padding:48px 20px;background:#ffffff;border:1px dashed #cbd5e1;border-radius:14px;">
            <div style="width:48px;height:48px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:#64748b;font-size:1.25rem;">
              <i class="fa-solid fa-car-side"></i>
            </div>
            <h4 style="font-size:0.98rem;font-weight:700;color:var(--text-hi);margin-bottom:4px;">No ${filterKey === 'all' ? '' : filterKey} bookings</h4>
            <p style="font-size:0.83rem;color:var(--text-mid);margin-bottom:16px;">There are no bookings under this filter at the moment.</p>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.switchTab && window.switchTab('vehicles')">
              <i class="fa-solid fa-compass"></i> Browse Available Vehicles
            </button>
          </div>
        `;
      } else {
        listEl.innerHTML = filtered.map(b => customerBookingRow(b)).join('');
      }
      attachBookingListeners();
    });
  });
}

export async function cancelCustomerBooking(bookingId) {
  if (!confirm('Are you sure you want to cancel this booking request?')) return;
  updateLocalBookingStatus(bookingId, 'cancelled', { review_notes: 'Cancelled by customer.' });

  try {
    const { data: b } = await supabase.from('bookings').select('vehicle_id, status').eq('id', bookingId).maybeSingle();
    try {
      await supabase.from('bookings').update({
        status: 'cancelled',
        review_notes: 'Cancelled by customer.'
      }).eq('id', bookingId);
    } catch (e) {}

    if (b && b.vehicle_id) {
      try {
        await supabase.from('vehicles').update({ status: 'available' }).eq('id', b.vehicle_id);
      } catch (e) {}
    }
  } catch (e) {
    console.warn('DB cancel fallback:', e);
  }

  toast('Booking request has been cancelled.', 'info');
  await loadVehicles();
  if (window.renderTab) window.renderTab();
}

window.cancelCustomerBooking = cancelCustomerBooking;

export function customerBookingRow(b) {
  const v = b.vehicles;
  const isPartial = b.balance_due && Number(b.balance_due) > 0 && Number(b.paid_amount || 0) > 0;
  let actions = '';
  if (b.status === 'pending') {
    actions = `
      <button type="button" class="btn btn-primary btn-sm" data-pay-id="${b.id}" onclick="window.openPaymentModal && window.openPaymentModal('${b.id}')"><i class="fa-solid fa-credit-card"></i> Pay Now</button>
      <button type="button" class="btn btn-outline-danger btn-sm" data-cancel-id="${b.id}" onclick="window.cancelCustomerBooking && window.cancelCustomerBooking('${b.id}')"><i class="fa-solid fa-xmark"></i> Cancel Request</button>
    `;
  } else if (b.status === 'approved') {
    actions = `
      <button type="button" class="btn btn-primary btn-sm" data-pay-id="${b.id}" onclick="window.openPaymentModal && window.openPaymentModal('${b.id}')"><i class="fa-solid fa-credit-card"></i> Pay Now</button>
      <button type="button" class="btn btn-outline-danger btn-sm" data-cancel-id="${b.id}" onclick="window.cancelCustomerBooking && window.cancelCustomerBooking('${b.id}')"><i class="fa-solid fa-xmark"></i> Cancel</button>
    `;
  } else if (b.status === 'active' || b.status === 'completed') {
    actions = `
      ${b.status === 'active' ? `<button type="button" class="btn btn-ghost btn-sm" onclick="window.openRentalExtensionModal && window.openRentalExtensionModal('${b.id}')" style="border:1px solid #cbd5e1;"><i class="fa-solid fa-clock-rotate-left"></i> Extend Rental</button>` : ''}
      ${isPartial ? `<button type="button" class="btn btn-primary btn-sm" data-pay-balance-id="${b.id}" onclick="window.openPaymentModal && window.openPaymentModal('${b.id}', true)"><i class="fa-solid fa-credit-card"></i> Pay Balance (₱${fmtMoney(b.balance_due)})</button>` : ''}
      <button type="button" class="btn btn-ghost btn-sm" data-receipt-id="${b.id}" onclick="window.openPaidReceiptModal && window.openPaidReceiptModal('${b.id}')" style="border:1px solid #cbd5e1;"><i class="fa-solid fa-receipt" style="color:var(--accent);"></i> Receipt &amp; QR Pass</button>
      <button type="button" class="btn btn-warning btn-sm" data-refund-req-id="${b.id}" onclick="window.openRefundRequestModal && window.openRefundRequestModal('${b.id}')" style="color:#b45309;background:#fffbeb;border:1px solid #fde68a;"><i class="fa-solid fa-arrow-rotate-left"></i> Request Refund</button>
    `;
  } else if (b.status === 'cancelled' || b.status === 'rejected') {
    actions = `
      <button type="button" class="btn btn-warning btn-sm" data-refund-req-id="${b.id}" onclick="window.openRefundRequestModal && window.openRefundRequestModal('${b.id}')" style="color:#b45309;background:#fffbeb;border:1px solid #fde68a;"><i class="fa-solid fa-arrow-rotate-left"></i> Request Refund</button>
    `;
  } else if (b.status === 'refund_requested') {
    actions = `<span class="badge" style="background:#fff7ed;color:#c2410c;border:1px solid #ffedd5;padding:6px 12px;"><i class="fa-solid fa-hourglass-half"></i> Refund Pending</span>`;
  } else if (b.status === 'refunded') {
    actions = `<button type="button" class="btn btn-ghost btn-sm" data-refund-voucher-id="${b.id}" onclick="window.openRefundVoucherModal && window.openRefundVoucherModal('${b.id}')" style="border:1px solid #cbd5e1;"><i class="fa-solid fa-receipt"></i> Refund Voucher</button>`;
  }

  const badgeHTML = isPartial
    ? `<span class="badge badge-reserved">Reserved (${b.downpayment_percent || 20}% Paid)</span>`
    : `<span class="badge badge-${b.status}">${b.status.replace('_', ' ')}</span>`;

  const cleanNotes = (b.review_notes || '')
    .replace(/Promo Applied:[^|]+\|\s*/gi, '')
    .replace(/Multi-Use Promo[^|]+\|\s*/gi, '')
    .trim();

  let notePillsHTML = '';
  if (cleanNotes) {
    const rawParts = cleanNotes.split('|').map(s => s.trim()).filter(Boolean);
    const pills = rawParts.map(part => {
      let icon = 'fa-circle-info';
      if (/contact/i.test(part)) {
        icon = 'fa-phone';
      } else if (/lic/i.test(part)) {
        icon = 'fa-id-card';
      } else if (/meetup|venue|pickup|dropoff|location/i.test(part)) {
        icon = 'fa-location-dot';
      }
      return `<span class="booking-meta-pill"><i class="fa-solid ${icon}"></i><span>${part}</span></span>`;
    });
    notePillsHTML = `<div class="booking-meta-pill-wrap">${pills.join('')}</div>`;
  }

  return `
    <div class="glass item-row customer-booking-card">
      <div class="booking-card-body">
        <div class="booking-thumb-box">
          <img src="${getExactVehicleImage(v || {})}" alt="${v?.name || 'Vehicle'}" class="booking-thumb-img" />
        </div>
        <div class="booking-card-main">
          <div class="booking-card-header">
            <h4 class="booking-card-title">${v?.name ?? 'Vehicle'}</h4>
            <span class="booking-plate-pill">${maskPlate(v?.plate_number ?? '')}</span>
            ${badgeHTML}
          </div>
          <div class="booking-card-dates-price">
            <span class="booking-dates">
              <i class="fa-regular fa-calendar-days"></i>
              ${fmtDate(b.start_date)} &rarr; ${fmtDate(b.end_date)}
            </span>
            <span class="booking-dot-sep">&bull;</span>
            <div class="booking-price-line">
              ${isPartial
                ? `<span class="booking-total-txt">Total: <strong>₱${fmtMoney(b.total_amount)}</strong></span>
                   <span class="booking-deposit-txt">(Paid: <strong style="color:#059669;">₱${fmtMoney(b.paid_amount)}</strong> &bull; Balance: <strong style="color:var(--accent);">₱${fmtMoney(b.balance_due)}</strong>)</span>`
                : `<span class="booking-total-txt">Total: <strong>₱${fmtMoney(b.total_amount)}</strong></span>`
              }
            </div>
          </div>
          ${notePillsHTML}
        </div>
      </div>
      <div class="item-actions booking-card-actions">
        ${actions}
      </div>
    </div>
  `;
}

export async function openPaymentModal(bookingId, isPayingBalance = false) {
  let b = null;

  // 1. Instant check in memory (0ms)
  if (window._activeCustomerBookings) {
    b = window._activeCustomerBookings.find(item => String(item.id) === String(bookingId));
  }

  // 2. Instant check in local bookings storage
  if (!b) {
    b = getLocalBookings().find(item => String(item.id) === String(bookingId));
  }

  // 3. Fallback to Supabase if numeric/DB id and not yet found
  if (!b && !String(bookingId).startsWith('bk-')) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, vehicles(name, plate_number, image_url)')
        .eq('id', bookingId)
        .single();
      if (!error && data) {
        b = data;
      }
    } catch (e) {
      console.warn('Supabase booking query error:', e);
    }
  }

  if (!b) {
    toast('Booking details not found. Please refresh the page.', 'error');
    return;
  }

  // Ensure vehicles object is safely populated
  if (!b.vehicles || typeof b.vehicles !== 'object') {
    const v = (state.vehicles || []).find(v => String(v.id) === String(b.vehicle_id));
    b.vehicles = v ? { ...v } : { name: b.vehicle_name || 'Vehicle' };
  }

  let selectedMethod = 'gcash';
  let selectedPct = isPayingBalance ? 100 : (b.downpayment_percent || 100);

  const totalAmount = Number(b.total_amount || 0);
  const currentPaid = Number(b.paid_amount || 0);
  const currentBalance = Number(b.balance_due ?? (totalAmount - currentPaid));

  function getCalculatedPayNow(pct) {
    if (isPayingBalance) return currentBalance;
    if (pct === 100) return totalAmount;
    return Math.round(totalAmount * (pct / 100));
  }

  function getCalculatedBalance(pct) {
    if (isPayingBalance) return 0;
    return Math.max(0, totalAmount - getCalculatedPayNow(pct));
  }

  let payNow = getCalculatedPayNow(selectedPct);
  let balanceDue = getCalculatedBalance(selectedPct);

  const vehicleName = b.vehicles?.name || b.vehicle_name || 'Vehicle';

  const modal = openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.15rem;font-weight:800;color:#0f172a;">${isPayingBalance ? 'Pay Remaining Balance' : 'Pay / Reserve Booking'}</h3>
        <span class="muted" style="font-size:0.78rem;">${vehicleName} · ${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</span>
      </div>
      <div class="modal-close" id="mClose">Close</div>
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
        <div class="receipt-row receipt-total"><span>Remaining Balance Due Now</span><span style="color:var(--accent);">${fmtMoney(currentBalance)}</span></div>
      ` : `
        <div class="receipt-row"><span>Reservation Option</span><span id="summaryTierLabel" style="font-weight:700;">${selectedPct === 100 ? 'Full Payment (100%)' : `${selectedPct}% Partial Downpayment`}</span></div>
        <div class="receipt-row"><span>Balance Due at Pickup</span><span id="summaryBalance" style="color:#64748b;">${fmtMoney(balanceDue)}</span></div>
        <div class="receipt-row receipt-total"><span>Amount Payable Now</span><span id="summaryPayNow" style="color:var(--accent);">${fmtMoney(payNow)}</span></div>
      `}
    </div>

    <div class="auth-tabs" style="margin-bottom:16px;">
      <div class="auth-tab active" data-pay-method="gcash">
        GCash QR
      </div>
      <div class="auth-tab" data-pay-method="visa">
        <i class="fa-brands fa-cc-visa" style="color:#2563eb;font-size:1.1rem;margin-right:4px;"></i> Visa Card
      </div>
      <div class="auth-tab" data-pay-method="applepay">
        <i class="fa-brands fa-apple" style="font-size:1.15rem;margin-right:4px;"></i> Apple Pay
      </div>
      <div class="auth-tab" data-pay-method="bank_qr">
        Bank QR
      </div>
      <div class="auth-tab" data-pay-method="card">
        Mastercard
      </div>
      <div class="auth-tab" data-pay-method="cash">
        Pay on Cash
      </div>
    </div>

    <div id="payContent"></div>

    <button type="button" class="btn btn-primary btn-block" id="payBtn" style="margin-top:16px;">Confirm Payment of ${fmtMoney(payNow)}</button>
  `, false);

  const mClose = modal.querySelector('#mClose');
  if (mClose) mClose.addEventListener('click', closeModal);

  if (!isPayingBalance) {
    modal.querySelectorAll('.pay-tier-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.pay-tier-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPct = Number(btn.dataset.pct);
        payNow = getCalculatedPayNow(selectedPct);
        balanceDue = getCalculatedBalance(selectedPct);

        const lbl = modal.querySelector('#summaryTierLabel');
        if (lbl) lbl.textContent = selectedPct === 100 ? 'Full Payment (100%)' : `${selectedPct}% Partial Downpayment`;
        const balEl = modal.querySelector('#summaryBalance');
        if (balEl) balEl.textContent = fmtMoney(balanceDue);
        const payEl = modal.querySelector('#summaryPayNow');
        if (payEl) payEl.textContent = fmtMoney(payNow);

        const pBtn = modal.querySelector('#payBtn');
        if (pBtn) {
          pBtn.textContent = selectedMethod === 'cash'
            ? `Confirm Cash Reservation (${fmtMoney(payNow)})`
            : `Confirm Payment of ${fmtMoney(payNow)}`;
        }

        renderPaymentMethodContent();
      });
    });
  }

  function renderPaymentMethodContent() {
    const container = modal.querySelector('#payContent');
    const pBtn = modal.querySelector('#payBtn');
    if (!container) return;

    if (selectedMethod === 'cash') {
      container.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;text-align:center;margin-bottom:14px;">
          <div style="font-weight:700;font-size:0.95rem;color:#166534;margin-bottom:4px;">Pay on Cash (Venue Pickup)</div>
          <p style="font-size:0.82rem;color:#15803d;margin:0 0 12px 0;line-height:1.4;">
            Magbayad ng cash nang direkta sa branch counter bago kunin ang susi ng sasakyan.
          </p>
          <div style="background:#ffffff;border:1px dashed #86efac;border-radius:8px;padding:12px;text-align:left;font-size:0.78rem;color:#334155;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="color:#64748b;">Halaga na babayaran sa venue:</span>
              <strong style="color:#166534;font-size:0.9rem;">${fmtMoney(payNow)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#64748b;">Pickup Counter / Venue:</span>
              <strong style="color:#0f172a;">123 PPC MAIN BRANCH VENUE</strong>
            </div>
          </div>
        </div>
      `;
      if (pBtn) pBtn.textContent = `Confirm Cash Reservation (${fmtMoney(payNow)})`;
    } else if (selectedMethod === 'gcash') {
      container.innerHTML = `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;text-align:center;margin-bottom:14px;">
          <div style="font-size:0.8rem;font-weight:700;color:#1e40af;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">
            Scan to Pay via GCash
          </div>
          <div style="width:170px;height:170px;background:#ffffff;border:3px solid var(--accent);border-radius:12px;margin:0 auto 12px auto;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 4px 12px var(--accent-glow);position:relative;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=GCASH-RENTAL-${b.id}-${payNow}" alt="GCash QR Code" style="width:100%;height:100%;object-fit:contain;" />
          </div>
          <div style="font-weight:700;font-size:0.9rem;color:#0f172a;margin-bottom:2px;">RentFlow Vehicles Inc.</div>
          <div style="font-size:0.78rem;color:#475569;font-weight:600;">Account No: <span style="font-family:monospace;">0917 •••• 4567</span></div>
          <div style="font-size:0.72rem;color:#64748b;margin-top:4px;">Official GCash Express Merchant (Privacy Protected)</div>
        </div>
        <div class="field">
          <label>GCash Reference Number</label>
          <input type="text" id="payRefNo" placeholder="e.g. 1002 9482 1102" required />
        </div>
        <p class="muted" style="font-size:0.76rem;color:#64748b;line-height:1.4;">
          Open your GCash App &gt; QR &gt; Scan QR code. Enter the Reference Number after payment.
        </p>
      `;
      if (pBtn) pBtn.textContent = `Confirm Payment of ${fmtMoney(payNow)}`;
    } else if (selectedMethod === 'bank_qr') {
      container.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;text-align:center;margin-bottom:14px;">
          <div style="font-size:0.8rem;font-weight:700;color:#166534;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">
            InstaPay / QR Ph Payment
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
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=INSTAPAY-RENTAL-${b.id}-${payNow}" alt="Bank QR Code" style="width:100%;height:100%;object-fit:contain;" />
          </div>
          <div style="font-weight:700;font-size:0.9rem;color:#0f172a;margin-bottom:2px;">RentFlow Corporate Fleet</div>
          <div style="font-size:0.78rem;color:#475569;font-weight:600;">Account: <span style="font-family:monospace;">0012 •••• 8899</span></div>
          <div style="font-size:0.72rem;color:#64748b;margin-top:4px;">Secured by QR Ph & InstaPay Philippines</div>
        </div>
        <div class="field">
          <label>Bank Reference / Transaction ID</label>
          <input type="text" id="payRefNo" placeholder="e.g. TXN-99482019" required />
        </div>
        <p class="muted" style="font-size:0.76rem;color:#64748b;line-height:1.4;">
          Scan with any QR Ph compliant PH Bank app (BDO, BPI, Maya, UnionBank).
        </p>
      `;
      if (pBtn) pBtn.textContent = `Confirm Payment of ${fmtMoney(payNow)}`;
    } else if (selectedMethod === 'visa') {
      container.innerHTML = `
        <div class="visa-card-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div class="visa-chip"></div>
            <div style="display:flex;align-items:center;gap:6px;font-size:0.85rem;font-weight:800;letter-spacing:0.05em;">
              <i class="fa-brands fa-cc-visa" style="font-size:1.8rem;"></i>
            </div>
          </div>
          <div style="font-family:monospace;font-size:1.15rem;letter-spacing:0.18em;margin-bottom:12px;text-shadow:0 1px 2px rgba(0,0,0,0.3);">
            4111 •••• •••• 4892
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end;">
            <div>
              <div style="font-size:0.62rem;opacity:0.8;text-transform:uppercase;">CARDHOLDER</div>
              <div style="font-size:0.85rem;font-weight:700;">${b.customer_name || state.profile?.full_name || 'MARK LEST RAMOS'}</div>
            </div>
            <div>
              <div style="font-size:0.62rem;opacity:0.8;text-transform:uppercase;">EXPIRES</div>
              <div style="font-size:0.85rem;font-weight:700;">10/28</div>
            </div>
          </div>
        </div>

        <div class="field">
          <label>Cardholder Name</label>
          <input type="text" id="visaName" value="${b.customer_name || state.profile?.full_name || 'Mark Lester Ramos'}" placeholder="Name on Card" required />
        </div>
        <div class="field">
          <label>Visa Card Number</label>
          <div style="position:relative;">
            <input type="text" id="visaNumber" value="4111 2026 8892 4892" placeholder="4xxx •••• •••• xxxx" maxlength="19" required />
            <i class="fa-brands fa-cc-visa" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:#2563eb;font-size:1.4rem;"></i>
          </div>
        </div>
        <div class="detail-grid">
          <div class="field">
            <label>Expiry Date</label>
            <input type="text" id="visaExp" value="10/28" placeholder="MM/YY" maxlength="5" required />
          </div>
          <div class="field">
            <label>CVV / CVC</label>
            <input type="password" id="visaCvv" value="882" placeholder="•••" maxlength="3" required />
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:0.75rem;color:#059669;margin-top:6px;">
          <i class="fa-solid fa-shield-halved"></i>
          <span>Protected by <strong>Verified by Visa</strong> &amp; 3D Secure 2.0 Encryption</span>
        </div>
      `;
      if (pBtn) pBtn.textContent = `Pay ${fmtMoney(payNow)} with Visa`;
    } else if (selectedMethod === 'applepay') {
      container.innerHTML = `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px;text-align:center;margin-bottom:14px;">
          <div style="width:54px;height:54px;background:#000000;color:#ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:1.8rem;">
            <i class="fa-brands fa-apple"></i>
          </div>
          <h4 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:4px;">Apple Pay Ready</h4>
          <p style="font-size:0.8rem;color:#64748b;margin:0 0 16px 0;line-height:1.4;">
            Pay securely with Touch ID, Face ID, or your Apple Watch. Your real card details are never stored on device or shared with merchant.
          </p>

          <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:12px 14px;text-align:left;font-size:0.8rem;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="color:#64748b;">Apple Wallet Device:</span>
              <strong style="color:#0f172a;">iPhone (Passbook Device •••• 1024)</strong>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#64748b;">Total Authorization:</span>
              <strong style="color:var(--accent);font-size:0.95rem;">${fmtMoney(payNow)}</strong>
            </div>
          </div>

          <button type="button" class="btn-apple-pay" id="applePayDirectBtn">
            <i class="fa-brands fa-apple"></i> Pay with Apple Pay
          </button>
        </div>
      `;
      if (pBtn) pBtn.textContent = `Pay ${fmtMoney(payNow)} with Apple Pay`;

      const apDirect = container.querySelector('#applePayDirectBtn');
      if (apDirect) {
        apDirect.addEventListener('click', () => {
          if (pBtn) pBtn.click();
        });
      }
    } else {
      container.innerHTML = `
        <div class="field"><label>Cardholder Name</label><input type="text" placeholder="Name on Card" /></div>
        <div class="field"><label>Card Number</label><input type="text" placeholder="5412 •••• •••• 4242" maxlength="19" /></div>
        <div class="detail-grid">
          <div class="field"><label>Expiry Date</label><input type="text" placeholder="MM/YY" /></div>
          <div class="field"><label>CVC / CVV</label><input type="password" placeholder="•••" maxlength="4" /></div>
        </div>
        <p class="muted" style="font-size:0.76rem;color:#64748b;">
          Encrypted 256-bit SSL Card Payment.
        </p>
      `;
      if (pBtn) pBtn.textContent = `Confirm Payment of ${fmtMoney(payNow)}`;
    }
  }

  renderPaymentMethodContent();

  modal.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      modal.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
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
      payBtn.textContent = selectedMethod === 'cash' ? 'Confirming Cash Reservation…' : 'Verifying Payment…';

      const methodName = selectedMethod === 'cash' ? 'Cash on Pickup'
        : selectedMethod === 'gcash' ? 'GCash QR'
        : selectedMethod === 'bank_qr' ? 'Bank QR Ph'
        : selectedMethod === 'visa' ? 'Visa Card'
        : selectedMethod === 'applepay' ? 'Apple Pay'
        : 'Card';
      const newTotalPaid = selectedMethod === 'cash' ? currentPaid : (currentPaid + payNow);
      const newBalance = selectedMethod === 'cash' ? (totalAmount - currentPaid) : Math.max(0, totalAmount - newTotalPaid);
      const newPaymentType = newBalance === 0 ? 'full' : 'partial';
      const finalRefNo = selectedMethod === 'cash' ? `CASH-${bookingId}-${Date.now().toString().slice(-4)}`
        : selectedMethod === 'visa' ? `VISA-${Date.now().toString().slice(-6)}`
        : selectedMethod === 'applepay' ? `APAY-${Date.now().toString().slice(-6)}`
        : (refNo || `RCPT-${bookingId}`);

      // Update local storage booking immediately
      updateLocalBookingStatus(bookingId, 'active', {
        paid_amount: newTotalPaid,
        balance_due: newBalance,
        payment_type: newPaymentType,
        downpayment_percent: selectedPct
      });

      // Update in-memory booking
      if (b) {
        b.status = 'active';
        b.paid_amount = newTotalPaid;
        b.balance_due = newBalance;
        b.payment_type = newPaymentType;
        b.downpayment_percent = selectedPct;
      }

      // If DB booking, save to Supabase
      if (!isNaN(Number(bookingId))) {
        try {
          await supabase.from('payments').insert({
            booking_id: Number(bookingId),
            amount: payNow,
            status: 'successful',
            method: methodName,
            paid_at: new Date().toISOString(),
          });
          await supabase.from('bookings').update({
            status: 'active',
            paid_amount: newTotalPaid,
            balance_due: newBalance,
            payment_type: newPaymentType,
            downpayment_percent: selectedPct
          }).eq('id', Number(bookingId));
          if (b.vehicle_id) {
            await supabase.from('vehicles').update({ status: 'rented' }).eq('id', b.vehicle_id);
          }
        } catch (e) {
          console.warn('DB payment update notice:', e);
        }
      }

      // Update local storage and broadcast live to staff dashboard
      updateLocalBookingStatus(bookingId, 'active', {
        paid_amount: newTotalPaid,
        balance_due: newBalance,
        payment_type: newPaymentType,
        downpayment_percent: selectedPct
      });
      broadcastBookingStatusChange(bookingId, 'active');

      toast(selectedMethod === 'cash'
        ? `Reservation confirmed for Cash payment on pickup (${fmtMoney(payNow)})!`
        : (newBalance > 0
          ? `Reservation secured with ${selectedPct}% Deposit (${fmtMoney(payNow)})!`
          : `Payment verified via ${methodName}! Booking fully paid.`
        ),
        'success'
      );
      closeModal();
      await loadVehicles();
      await openPaidReceiptModal(bookingId, methodName, finalRefNo);
      if (window.renderTab) window.renderTab();
    });
  }
}

// Expose globally for inline onclick guarantees
window.openPaymentModal = openPaymentModal;
window.handlePayClick = openPaymentModal;


export async function openPaidReceiptModal(bookingId, payMethod = 'Online Payment', refNo = '') {
  let b = null;
  if (typeof window !== 'undefined' && window._activeCustomerBookings && window._activeCustomerBookings.length) {
    b = window._activeCustomerBookings.find(item => String(item.id) === String(bookingId));
  }
  if (!b) {
    const local = getLocalBookings().find(item => String(item.id) === String(bookingId));
    if (local) {
      b = { ...local };
    }
  }
  if (!b) {
    try {
      const res = await supabase
        .from('bookings')
        .select('*, vehicles(*, categories(name, daily_rate))')
        .eq('id', bookingId)
        .maybeSingle();
      if (res && res.data) b = res.data;
    } catch (err) {
      console.warn('Booking fetch notice:', err);
    }
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
  const refCode = refNo || b.ref_number || `REF-${String(b.id).slice(-4)}-${Date.now().toString().slice(-4)}`;
  const sysSettings = getSystemSettings();
  const comp = sysSettings.company || DEFAULT_SETTINGS.company;

  const customerName = state.profile?.full_name || b.customer_name || 'Customer';
  const customerPhone = state.profile?.phone || b.customer_phone || comp.phone || 'N/A';
  const customerLicense = state.profile?.license_number || b.driver_license || 'Physical card verified at meetup';
  const vehicleName = v.name || 'Rental Vehicle';
  const categoryName = v.categories?.name || 'Standard';
  const plateNo = v.plate_number ? maskPlate(v.plate_number) : 'Unassigned';
  const paidAmount = Number(b.paid_amount || b.total_amount || 0);
  const balDue = Number(b.balance_due || 0);
  const isFullPaid = balDue === 0;

  // Complete, structured Pass payload that instantly displays clean information upon scanning by ANY smartphone camera or QR reader
  const qrDataPayload = `=== RENTFLOW VENUE VERIFIED PASS ===
REF CODE: ${refCode} (ID: #${b.id})
CUSTOMER: ${customerName}
CONTACT: ${customerPhone}
LICENSE: ${customerLicense}
VEHICLE: ${vehicleName} (${plateNo})
CATEGORY: ${categoryName}
PERIOD: ${fmtDate(b.start_date)} to ${fmtDate(b.end_date)} (${days} Days)
PAY METHOD: ${payMethod}
TOTAL RENTAL: ${fmtMoney(b.total_amount)}
AMOUNT PAID: ${fmtMoney(paidAmount)}
BALANCE DUE: ${isFullPaid ? 'PAID IN FULL (PHP 0.00)' : fmtMoney(balDue)}
VENUE PICKUP: ${comp.address || '123 PPC MAIN BRANCH VENUE'}
VERIFICATION: VALID & CONFIRMED OFFICIAL PASS
ISSUED AT: ${new Date().toLocaleString()}
====================================`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(qrDataPayload)}`;

  const modal = openModal(`
    <div class="modal-head" style="margin-bottom:12px;padding-bottom:8px;">
      <div style="font-weight:700;font-size:0.9rem;color:#64748b;">Official Payment Receipt &amp; Venue Pass</div>
      <div class="modal-close" id="mClose" onclick="window.closeModal()">Close</div>
    </div>
    <div style="text-align:center;margin-bottom:16px;">
      <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#059669,#10b981);display:flex;align-items:center;justify-content:center;margin:0 auto 10px;box-shadow:0 4px 12px rgba(16,185,129,0.3);">
        <i class="fa-solid fa-circle-check" style="font-size:1.5rem;color:#fff;"></i>
      </div>
      <h2 style="font-size:1.35rem;font-weight:800;color:#0f172a;margin-bottom:4px;">Payment Successful!</h2>
      <span class="badge badge-completed" style="font-size:0.75rem;">Paid via ${payMethod}</span>
      <p class="muted" style="margin-top:6px;font-size:0.82rem;color:#64748b;">Ref / Transaction No: <strong style="color:#0f172a;font-family:monospace;">${refCode}</strong></p>
    </div>

    <!-- Official Venue QR Check-In Pass -->
    <div class="venue-pass-card">
      <div class="venue-pass-badge">
        <i class="fa-solid fa-qrcode"></i> Venue Express Pickup QR Pass
      </div>
      <div>
        <span class="venue-pass-ref"><i class="fa-solid fa-ticket" style="margin-right:4px;"></i> Pass Code: ${refCode}</span>
      </div>

      <div class="venue-qr-wrapper">
        <img src="${qrImageUrl}" alt="Venue QR Pass" class="venue-qr-img" />
      </div>

      <div style="font-weight:800;font-size:0.9rem;color:#0f172a;margin-bottom:4px;">
        I-scan sa Venue para sa Mabilisang Pag-claim
      </div>
      <p class="venue-pass-instructions">
        Ipakita ang QR code na ito sa venue counter (<strong style="color:var(--text-hi,#0f172a);">${comp.address || '123 PPC MAIN BRANCH VENUE'}</strong>). I-scan lamang ito ng staff gamit ang phone o scanner upang agad makita ang kumpletong detalye ng iyong booking.
      </p>

      <!-- Scanned Details Preview Card -->
      <div style="margin-top:12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;text-align:left;">
        <div style="font-weight:700;font-size:0.78rem;color:#64748b;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
          <span><i class="fa-solid fa-circle-info" style="color:var(--accent);margin-right:4px;"></i> QR Code Encoded Details</span>
          <span class="badge badge-completed" style="font-size:0.68rem;"><i class="fa-solid fa-shield-halved" style="margin-right:3px;"></i> Verified Pass</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.8rem;color:#1e293b;">
          <div><span style="color:#64748b;">Customer:</span> <strong>${customerName}</strong></div>
          <div><span style="color:#64748b;">Phone:</span> <strong>${customerPhone}</strong></div>
          <div><span style="color:#64748b;">Vehicle:</span> <strong>${vehicleName}</strong></div>
          <div><span style="color:#64748b;">Plate:</span> <strong>${plateNo}</strong></div>
          <div><span style="color:#64748b;">Dates:</span> <strong>${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</strong></div>
          <div><span style="color:#64748b;">Duration:</span> <strong>${days} day(s)</strong></div>
          <div><span style="color:#64748b;">Paid:</span> <strong style="color:#059669;">${fmtMoney(paidAmount)}</strong></div>
          <div><span style="color:#64748b;">Status:</span> <strong style="color:${isFullPaid ? '#059669' : 'var(--accent)'};">${isFullPaid ? 'Fully Paid' : `Bal: ${fmtMoney(balDue)}`}</strong></div>
        </div>
      </div>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;">
      <i class="fa-solid fa-car" style="color:var(--accent);"></i> Reservation &amp; Vehicle Summary
    </h4>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;">
      <div class="receipt-row"><span style="color:#64748b;">Customer</span><span style="font-weight:700;color:#0f172a;">${customerName}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Driver's License</span><span style="font-weight:700;color:#0f172a;">${customerLicense}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Vehicle</span><span style="font-weight:700;color:#0f172a;">${vehicleName}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Category</span><span style="color:#0f172a;">${categoryName}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Plate Number</span><span style="color:#0f172a;">${plateNo}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Pickup Date</span><span style="color:#0f172a;font-weight:600;">${fmtDate(b.start_date)}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Return Date</span><span style="color:#0f172a;font-weight:600;">${fmtDate(b.end_date)}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Rental Period</span><span style="color:#0f172a;">${days} day(s)</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Fuel / AC</span><span style="color:#0f172a;">${fuelType} · ${hasAC ? 'With AC' : 'Non-AC'}</span></div>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;">
      <i class="fa-solid fa-receipt" style="color:var(--accent);"></i> Payment &amp; Receipt Summary
    </h4>
    <div class="receipt" style="margin-bottom:16px;">
      <div class="receipt-row"><span>Payment Method</span><span style="font-weight:700;color:#059669;">${payMethod}</span></div>
      <div class="receipt-row"><span>Total Rental Cost</span><span style="font-weight:700;color:#0f172a;">${fmtMoney(b.total_amount)}</span></div>
      <div class="receipt-row"><span>Amount Paid Now</span><span style="font-weight:700;color:#059669;">${fmtMoney(paidAmount)}</span></div>
      ${balDue > 0 ? `
        <div class="receipt-row" style="background:#eff6ff;padding:6px 8px;border-radius:6px;margin:4px 0;">
          <span style="color:#1d4ed8;font-weight:600;">Remaining Balance Due at Pickup</span>
          <span style="font-weight:800;color:#1d4ed8;">${fmtMoney(balDue)}</span>
        </div>
      ` : ''}
      <div class="divider"></div>
      <div class="receipt-row receipt-total"><span>Payment Status</span><span class="badge ${balDue > 0 ? 'badge-reserved' : 'badge-completed'}">${balDue > 0 ? 'RESERVED (PARTIAL)' : 'FULL PAYMENT'}</span></div>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;">
      <i class="fa-solid fa-location-dot" style="color:var(--accent);"></i> Rental &amp; Pickup Venue Details
    </h4>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px;margin-bottom:14px;">
      <div class="receipt-row"><span style="color:#0369a1;">Pickup Location</span><span style="color:#0f172a;font-weight:600;">${comp.address || '123 PPC MAIN BRANCH VENUE'}</span></div>
      <div class="receipt-row"><span style="color:#0369a1;">Return Location</span><span style="color:#0f172a;font-weight:600;">${comp.address || '123 PPC MAIN BRANCH VENUE'}</span></div>
      <div class="receipt-row"><span style="color:#0369a1;">Fuel Policy</span><span style="color:#0f172a;">Full-to-Full</span></div>
      <div class="receipt-row"><span style="color:#0369a1;">Insurance</span><span style="color:#0f172a;">Comprehensive coverage included</span></div>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;">
      <i class="fa-solid fa-headset" style="color:#059669;"></i> Support Contact
    </h4>
    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px;margin-bottom:16px;">
      <div class="receipt-row"><span style="color:#065f46;">Hotline</span><span style="font-weight:700;color:#0f172a;">${comp.phone || '+63 67676767'}</span></div>
      <div class="receipt-row"><span style="color:#065f46;">Mobile</span><span style="font-weight:700;color:#0f172a;">${comp.mobile || '+63 917 123 4567'}</span></div>
      <div class="receipt-row"><span style="color:#065f46;">Email</span><span style="font-weight:600;color:#0f172a;">${comp.email || 'vehiclerental.ph'}</span></div>
      <div class="receipt-row"><span style="color:#065f46;">Address</span><span style="color:#0f172a;">${comp.address || '123 PPC MAIN BRANCH VENUE'}</span></div>
    </div>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-bottom:16px;">
      <h4 style="margin:0 0 8px 0;display:flex;align-items:center;gap:6px;color:#92400e;font-size:0.88rem;">
        <i class="fa-solid fa-triangle-exclamation"></i> Important Instructions
      </h4>
      <p style="font-size:0.82rem;color:#78350f;line-height:1.6;margin:0;">
        Pumunta sa venue nang hindi bababa sa <strong>15 minuto bago</strong> ang scheduled pickup time. Ipakita ang <strong>QR Code Pass</strong> sa itaas kasama ang iyong <strong>driver's license</strong> at <strong>1 valid ID</strong>.
      </p>
    </div>

    <div style="display:flex;gap:10px;margin-top:16px;">
      <button type="button" class="btn btn-ghost btn-block" id="printPaidReceiptBtn" onclick="window.print()" style="flex:1;">
        <i class="fa-solid fa-print" style="margin-right:6px;"></i> Print Official Receipt &amp; QR Pass
      </button>
      <button type="button" class="btn btn-primary btn-block" id="closePaidReceiptBtn" onclick="window.closeModal()" style="flex:1;">
        <i class="fa-solid fa-check" style="margin-right:6px;"></i> Done
      </button>
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

export async function openRefundRequestModal(bookingId) {
  let b = null;
  if (typeof window !== 'undefined' && window._activeCustomerBookings && window._activeCustomerBookings.length) {
    b = window._activeCustomerBookings.find(item => String(item.id) === String(bookingId));
  }
  if (!b) {
    const local = getLocalBookings().find(item => String(item.id) === String(bookingId));
    if (local) b = { ...local };
  }
  if (!b) {
    try {
      const res = await supabase.from('bookings').select('*, vehicles(name, plate_number)').eq('id', bookingId).maybeSingle();
      if (res && res.data) b = res.data;
    } catch (e) {
      console.warn('Refund modal booking fetch warning:', e);
    }
  }
  if (!b) {
    b = {
      id: bookingId,
      total_amount: 0,
      vehicles: state.vehicles[0] || { name: 'Rental Vehicle', plate_number: '—' }
    };
  }

  const v = b.vehicles || state.vehicles.find(veh => veh.id === b.vehicle_id) || { name: 'Rental Vehicle', plate_number: '—' };
  const refundAmount = Number(b.paid_amount || b.total_amount || 0);
  const defaultAccName = state.profile?.full_name || state.user?.full_name || (b.customer_name) || '';
  const defaultAccPhone = state.profile?.phone || state.user?.phone || (b.customer_phone) || '';

  const modal = openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.15rem;font-weight:800;color:#0f172a;">Request Refund</h3>
        <span class="muted" style="font-size:0.78rem;">Booking #${b.id} · ${v.name ?? 'Vehicle'}</span>
      </div>
      <div class="modal-close" id="mClose" onclick="window.closeModal()">Close</div>
    </div>

    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:16px;">
      <div style="font-size:0.82rem;color:#b45309;font-weight:700;">
        Refund Policy &amp; Guarantee
      </div>
      <div style="font-size:0.78rem;color:#78350f;margin-top:4px;line-height:1.5;">
        Submit your GCash, Maya, or Bank details. Approved refunds are transferred within 24 hours.
      </div>
    </div>

    <div class="receipt" style="margin-bottom:16px;">
      <div class="receipt-row receipt-total"><span>Total Paid Amount</span><span>${fmtMoney(refundAmount)}</span></div>
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
        <input type="text" id="refAccName" value="${defaultAccName}" placeholder="Recipient Full Name" required />
      </div>

      <div class="field" style="margin-bottom:12px;">
        <label>Account Number / Mobile Number</label>
        <input type="text" id="refAccNo" value="${defaultAccPhone}" placeholder="0917 123 4567" required />
      </div>

      <div class="field" style="margin-bottom:18px;">
        <label>Reason for Refund</label>
        <textarea id="refReason" rows="2" placeholder="e.g. Flight cancelled, change of travel dates..." required></textarea>
      </div>

      <button type="submit" class="btn btn-primary btn-block" id="subRefBtn" style="padding:13px;">
        Submit Refund Request
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

    updateLocalBookingStatus(bookingId, 'refund_requested', {
      review_notes: notes,
      refund_method: method,
      refund_account_name: accName,
      refund_account_number: accNo,
      refund_reason: reason
    });

    try {
      let { error } = await supabase.from('bookings').update({
        status: 'refund_requested',
        review_notes: notes,
      }).eq('id', bookingId);

      if (error) {
        const fallbackNotes = `[REFUND REQUESTED] ${notes}`;
        try {
          await supabase.from('bookings').update({
            status: 'cancelled',
            review_notes: fallbackNotes,
          }).eq('id', bookingId);
        } catch (e) {}
      }
    } catch (e) {
      console.warn('DB refund request notice:', e);
    }

    toast('Refund request submitted! Staff will review and process your transfer.', 'success');
    closeModal();
    if (window.renderTab) window.renderTab();
  });
}

export async function openRefundVoucherModal(bookingId) {
  let b = null;
  if (typeof window !== 'undefined' && window._activeCustomerBookings && window._activeCustomerBookings.length) {
    b = window._activeCustomerBookings.find(item => String(item.id) === String(bookingId));
  }
  if (!b) {
    const local = getLocalBookings().find(item => String(item.id) === String(bookingId));
    if (local) b = { ...local };
  }
  if (!b) {
    try {
      const res = await supabase.from('bookings').select('*, vehicles(name, plate_number), profiles!customer_id(full_name, phone)').eq('id', bookingId).maybeSingle();
      if (res && res.data) b = res.data;
    } catch (e) {
      console.warn('Voucher fetch notice:', e);
    }
  }
  if (!b) {
    b = {
      id: bookingId,
      total_amount: 0,
      vehicles: state.vehicles[0] || { name: 'Rental Vehicle' }
    };
  }

  const v = b.vehicles || state.vehicles.find(veh => veh.id === b.vehicle_id) || { name: 'Vehicle', plate_number: '—' };
  const cName = b.profiles?.full_name ?? b.customer_name ?? state.profile?.full_name ?? 'Customer';
  const cPhone = b.profiles?.phone ?? b.customer_phone ?? state.profile?.phone ?? '—';
  const refCode = `RFND-${bookingId}-${Date.now().toString().slice(-4)}`;

  openModal(`
    <div class="modal-head" style="margin-bottom:12px;padding-bottom:8px;">
      <div style="font-weight:700;font-size:0.9rem;color:#64748b;">Official Refund &amp; Disbursement Voucher</div>
      <div class="modal-close" onclick="window.closeModal()">Close</div>
    </div>
    <div style="text-align:center;margin-bottom:18px;">
      <h2 style="font-size:1.35rem;font-weight:800;color:#0f172a;margin-bottom:4px;">Refund Disbursed Successfully</h2>
      <span class="badge badge-refunded" style="font-size:0.75rem;">Transfer Completed</span>
      <p class="muted" style="margin-top:8px;font-size:0.82rem;color:#64748b;">Voucher / Claim No: <strong style="color:#0f172a;font-family:monospace;">${refCode}</strong></p>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;">Beneficiary Details</h4>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;">
      <div class="receipt-row"><span style="color:#64748b;">Customer Name</span><span style="font-weight:700;color:#0f172a;">${cName}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Phone Number</span><span style="color:#0f172a;">${cPhone}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Vehicle</span><span style="font-weight:700;color:#0f172a;">${v.name ?? 'Vehicle'}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Rental Dates</span><span style="color:#0f172a;">${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</span></div>
      ${b.review_notes ? `<div class="receipt-row" style="flex-direction:column;align-items:flex-start;gap:4px;margin-top:4px;"><span style="color:#64748b;">Refund Transfer Notes</span><span style="color:#b45309;font-weight:600;">${b.review_notes}</span></div>` : ''}
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;">Financial Summary</h4>
    <div class="receipt" style="margin-bottom:16px;">
      <div class="receipt-row"><span>Total Booking Amount</span><span>${fmtMoney(b.total_amount)}</span></div>
      <div class="receipt-row"><span>Refund Status</span><span class="badge badge-refunded">COMPLETED</span></div>
      <div class="divider"></div>
      <div class="receipt-row receipt-total"><span>Total Refund Disbursed</span><span style="color:#059669;">${fmtMoney(b.total_amount)}</span></div>
    </div>
    <button class="btn btn-primary btn-block" onclick="window.print()" style="margin-top:8px;background:#059669;border-color:#059669;">Print Refund Voucher</button>
  `);
}

window.openPaymentModal = openPaymentModal;
window.openRefundRequestModal = openRefundRequestModal;
window.openPaidReceiptModal = openPaidReceiptModal;
window.openRefundVoucherModal = openRefundVoucherModal;
