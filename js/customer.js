import { supabase } from './config.js';
import { state, DEFAULT_SETTINGS, getSystemSettings, getLocalBookings, updateLocalBookingStatus } from './state.js';
import { $, $$, fmtMoney, fmtDate, daysBetween, maskPlate, toast, openModal, closeModal, emptyState } from './utils.js';
import { getFavorites, toggleFavorite, vehicleCardHTML, renderBrowse, getExactVehicleImage, loadVehicles } from './vehicles.js';
import { openVehicleDetail } from './booking.js';

export async function renderCustomer(tab, view) {
  if (tab === 'browse') return renderBrowse(view);
  if (tab === 'favorites') return renderCustomerFavorites(view);
  if (tab === 'bookings') return renderMyBookings(view);
  if (tab === 'profile') return renderCustomerProfile(view);
}

export async function renderCustomerFavorites(view) {
  const favIds = getFavorites();
  const favVehicles = state.vehicles.filter(v => favIds.includes(v.id));

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2><i class="fa-solid fa-heart" style="color:#e11d48;margin-right:6px;"></i> My Saved Favorites</h2>
          <p>Your bookmarked cars and motorcycles for fast reservation.</p>
        </div>
      </div>
      <div class="grid grid-vehicles" id="favGrid">
        ${favVehicles.length ? favVehicles.map(vehicleCardHTML).join('') : emptyState('fa-regular fa-heart', 'No favorite vehicles saved yet. Click the heart icon on any vehicle to save it here!')}
      </div>
    </div>
  `;

  $$('#favGrid .vehicle-card').forEach(card => card.addEventListener('click', () => openVehicleDetail(Number(card.dataset.id))));
  $$('#favGrid .fav-heart-btn').forEach(btn => btn.addEventListener('click', (e) => {
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
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid #e2e8f0;">
          <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:800;box-shadow:0 4px 12px rgba(37,99,235,0.25);">
            ${initials}
          </div>
          <div>
            <h3 style="font-size:1.25rem;font-weight:800;color:#0f172a;margin-bottom:2px;">${p.full_name || 'Customer Account'}</h3>
            <div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;color:#64748b;">
              <span><i class="fa-solid fa-envelope" style="color:#2563eb;"></i> ${state.user?.email || '—'}</span>
              <span>·</span>
              <span class="badge badge-completed"><i class="fa-solid fa-id-card"></i> Physical License Verified Upon Meetup</span>
            </div>
          </div>
        </div>

        <form id="profileForm">
          <h4 style="font-size:0.95rem;font-weight:700;color:#0f172a;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-user-gear" style="color:#2563eb;"></i> Personal Information
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
            <i class="fa-solid fa-id-card" style="color:#059669;"></i> Driver's License Information
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
            <i class="fa-solid fa-id-card-clip" style="color:#2563eb;"></i> Driver's License Photo <span style="font-weight:normal;color:#64748b;font-size:0.75rem;">(Optional)</span>
          </h4>
          <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;">
            <div id="licensePreviewBox" style="margin-bottom:12px;">
              ${p.license_id_url ? `
                <div style="position:relative;display:inline-block;">
                  <img src="${p.license_id_url}" id="licenseImgPreview" style="max-width:100%;max-height:190px;border-radius:10px;border:2px solid #2563eb;box-shadow:0 4px 12px rgba(0,0,0,0.1);" />
                  <div style="position:absolute;top:6px;right:6px;background:#059669;color:#fff;font-size:0.72rem;font-weight:700;padding:3px 10px;border-radius:99px;"><i class="fa-solid fa-shield-check"></i> ID Photo Uploaded</div>
                </div>
              ` : `
                <div style="padding:16px 10px;">
                  <i class="fa-solid fa-cloud-arrow-up" style="font-size:2.5rem;color:#94a3b8;margin-bottom:8px;"></i>
                  <div style="font-size:0.88rem;font-weight:700;color:#334155;">Upload Driver's License Card Photo</div>
                  <div style="font-size:0.75rem;color:#64748b;margin-top:2px;">Select clear photo of your Driver's License ID (JPG, PNG, WEBP)</div>
                </div>
              `}
            </div>
            <input type="file" id="licenseFileInput" accept="image/*" style="display:none;" />
            <input type="hidden" id="licenseIdUrl" value="${p.license_id_url ?? ''}" />
            <button type="button" class="btn btn-ghost btn-sm" id="uploadLicenseBtn" style="border:1px solid #cbd5e1;background:#ffffff;">
              <i class="fa-solid fa-arrow-up-from-bracket"></i> ${p.license_id_url ? 'Change License Photo' : 'Choose License Photo'}
            </button>
          </div>

          <div class="field" style="margin-bottom:22px;">
            <label>Complete Address</label>
            <input type="text" id="profAddress" value="${p.address ?? ''}" placeholder="123 Sampaguita St, Barangay San Antonio, Makati City" />
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="saveProfBtn" style="padding:14px;">
            <i class="fa-solid fa-floppy-disk"></i> Save Profile Details
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
            <img src="${dataUrl}" id="licenseImgPreview" style="max-width:100%;max-height:190px;border-radius:10px;border:2px solid #2563eb;box-shadow:0 4px 12px rgba(0,0,0,0.1);" />
            <div style="position:absolute;top:6px;right:6px;background:#059669;color:#fff;font-size:0.72rem;font-weight:700;padding:3px 10px;border-radius:99px;"><i class="fa-solid fa-shield-check"></i> Photo Ready</div>
          </div>
        `;
        toast('Driver License photo selected! Click Save Profile Details to submit.', 'info');
      };
      reader.readAsDataURL(file);
    });
  }

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

    let { error } = await supabase.from('profiles').update(updated).eq('id', state.user.id);

    if (error) {
      const standardPayload = { full_name: updated.full_name, phone: updated.phone };
      const { error: fbErr } = await supabase.from('profiles').update(standardPayload).eq('id', state.user.id);
      if (fbErr) {
        toast(fbErr.message, 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Profile Details';
        return;
      }
    }

    try {
      localStorage.setItem(`rentflow_prof_${state.user.id}`, JSON.stringify(updated));
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
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, vehicles(name, plate_number, image_url)')
      .eq('customer_id', state.user.id)
      .order('created_at', { ascending: false });
    if (!error && data) dbBookings = data;
  } catch (err) {
    console.warn('DB booking load notice:', err);
  }

  // Merge local demo bookings matching active customer
  const localList = getLocalBookings().filter(b => b.customer_id === state.user.id);
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

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div><h2><i class="fa-solid fa-calendar-check" style="color:#059669;margin-right:8px;"></i> My Bookings &amp; Rentals</h2><p>Track your requests, active rentals, receipts, and rental history.</p></div>
      </div>
      <div class="row-list" id="bookingList">
        ${bookings.length ? bookings.map(b => customerBookingRow(b)).join('') : emptyState('fa-regular fa-file-lines', 'No bookings yet — browse vehicles to get started.')}
      </div>
    </div>
  `;

  // Attach event listeners directly to buttons
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
}

export async function cancelCustomerBooking(bookingId) {
  if (!confirm('Are you sure you want to cancel this booking request?')) return;
  updateLocalBookingStatus(bookingId, 'cancelled', { review_notes: 'Cancelled by customer.' });

  try {
    const { data: b } = await supabase.from('bookings').select('vehicle_id, status').eq('id', bookingId).maybeSingle();
    await supabase.from('bookings').update({
      status: 'cancelled',
      review_notes: 'Cancelled by customer.'
    }).eq('id', bookingId).catch(() => {});

    if (b && b.vehicle_id) {
      await supabase.from('vehicles').update({ status: 'available' }).eq('id', b.vehicle_id).catch(() => {});
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
    actions = `<button type="button" class="btn btn-danger btn-sm" data-cancel-id="${b.id}" onclick="window.cancelCustomerBooking && window.cancelCustomerBooking('${b.id}')"><i class="fa-solid fa-xmark"></i> Cancel Request</button>`;
  } else if (b.status === 'approved') {
    actions = `
      <button type="button" class="btn btn-primary btn-sm" data-pay-id="${b.id}" onclick="window.openPaymentModal && window.openPaymentModal('${b.id}')"><i class="fa-solid fa-credit-card"></i> Pay / Reserve</button>
      <button type="button" class="btn btn-danger btn-sm" data-cancel-id="${b.id}" onclick="window.cancelCustomerBooking && window.cancelCustomerBooking('${b.id}')"><i class="fa-solid fa-xmark"></i> Cancel</button>
    `;
  } else if (b.status === 'active' || b.status === 'completed') {
    actions = `
      ${isPartial ? `<button type="button" class="btn btn-primary btn-sm" data-pay-balance-id="${b.id}" onclick="window.openPaymentModal && window.openPaymentModal('${b.id}', true)" style="background:#2563eb;border-color:#2563eb;"><i class="fa-solid fa-wallet"></i> Pay Balance (${fmtMoney(b.balance_due)})</button>` : ''}
      <button type="button" class="btn btn-ghost btn-sm" data-receipt-id="${b.id}" onclick="window.openPaidReceiptModal && window.openPaidReceiptModal('${b.id}')"><i class="fa-solid fa-print"></i> Receipt</button>
      <button type="button" class="btn btn-warning btn-sm" data-refund-req-id="${b.id}" onclick="window.openRefundRequestModal && window.openRefundRequestModal('${b.id}')" style="color:#b45309;background:#fef3c7;border:1px solid #fde68a;"><i class="fa-solid fa-hand-holding-dollar"></i> Request Refund</button>
    `;
  } else if (b.status === 'cancelled' || b.status === 'rejected') {
    actions = `
      <button type="button" class="btn btn-warning btn-sm" data-refund-req-id="${b.id}" onclick="window.openRefundRequestModal && window.openRefundRequestModal('${b.id}')" style="color:#b45309;background:#fef3c7;border:1px solid #fde68a;"><i class="fa-solid fa-hand-holding-dollar"></i> Request Refund</button>
    `;
  } else if (b.status === 'refund_requested') {
    actions = `<span class="muted" style="font-size:0.78rem;color:#b45309;font-weight:600;"><i class="fa-solid fa-clock"></i> Refund Pending</span>`;
  } else if (b.status === 'refunded') {
    actions = `<button type="button" class="btn btn-ghost btn-sm" data-refund-voucher-id="${b.id}" onclick="window.openRefundVoucherModal && window.openRefundVoucherModal('${b.id}')"><i class="fa-solid fa-receipt"></i> Refund Voucher</button>`;
  }

  const badgeHTML = isPartial
    ? `<span class="badge badge-reserved"><i class="fa-solid fa-bookmark"></i> Reserved (${b.downpayment_percent || 20}% Paid)</span>`
    : `<span class="badge badge-${b.status}">${b.status.replace('_', ' ')}</span>`;

  const cleanNotes = (b.review_notes || '')
    .replace(/Promo Applied:[^|]+\|\s*/gi, '')
    .replace(/Multi-Use Promo[^|]+\|\s*/gi, '')
    .trim();

  return `
    <div class="glass item-row">
      <img src="${getExactVehicleImage(v || {})}" style="width:84px;height:60px;object-fit:cover;border-radius:10px;" />
      <div class="item-main">
        <div class="item-title">${v?.name ?? 'Vehicle'} <span class="muted">(${maskPlate(v?.plate_number ?? '')})</span></div>
        <div class="item-sub">
          ${fmtDate(b.start_date)} → ${fmtDate(b.end_date)} · 
          ${isPartial
      ? `<span style="font-weight:700;color:#0f172a;">Total: ${fmtMoney(b.total_amount)}</span> (<span style="color:#059669;font-weight:600;">Paid: ${fmtMoney(b.paid_amount)}</span> | <span style="color:#2563eb;font-weight:700;">Balance Due at Pickup: ${fmtMoney(b.balance_due)}</span>)`
      : `Total: ${fmtMoney(b.total_amount)}`
    }
        </div>
        ${cleanNotes ? `<div class="item-sub" style="color:var(--coral);margin-top:2px;">${cleanNotes}</div>` : ''}
      </div>
      ${badgeHTML}
      <div class="item-actions">${actions}</div>
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
      <div class="modal-close" id="mClose">✕</div>
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
        <div class="receipt-row receipt-total"><span>Remaining Balance Due Now</span><span style="color:#2563eb;">${fmtMoney(currentBalance)}</span></div>
      ` : `
        <div class="receipt-row"><span>Reservation Option</span><span id="summaryTierLabel" style="font-weight:700;">${selectedPct === 100 ? 'Full Payment (100%)' : `${selectedPct}% Partial Downpayment`}</span></div>
        <div class="receipt-row"><span>Balance Due at Pickup</span><span id="summaryBalance" style="color:#64748b;">${fmtMoney(balanceDue)}</span></div>
        <div class="receipt-row receipt-total"><span>Amount Payable Now</span><span id="summaryPayNow" style="color:#2563eb;">${fmtMoney(payNow)}</span></div>
      `}
    </div>

    <div class="auth-tabs" style="margin-bottom:16px;">
      <div class="auth-tab" data-pay-method="cash">
        <i class="fa-solid fa-money-bill-wave" style="color:#16a34a;margin-right:4px;"></i> Cash on Pickup
      </div>
      <div class="auth-tab active" data-pay-method="gcash">
        <i class="fa-solid fa-qrcode" style="color:#2563eb;margin-right:4px;"></i> GCash QR
      </div>
      <div class="auth-tab" data-pay-method="bank_qr">
        <i class="fa-solid fa-building-columns" style="color:#059669;margin-right:4px;"></i> Bank QR
      </div>
      <div class="auth-tab" data-pay-method="card">
        <i class="fa-solid fa-credit-card" style="color:#d97706;margin-right:4px;"></i> Card
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
            ? `Reserve Vehicle (Cash on Pickup · ${fmtMoney(payNow)})`
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
          <div style="width:48px;height:48px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 10px auto;">
            <i class="fa-solid fa-money-bill-wave" style="color:#16a34a;font-size:1.4rem;"></i>
          </div>
          <div style="font-weight:700;font-size:0.95rem;color:#166534;margin-bottom:4px;">Cash on Pickup / Counter</div>
          <p style="font-size:0.82rem;color:#15803d;margin:0 0 12px 0;line-height:1.4;">
            Magbayad ng cash nang direkta sa branch counter bago kunin ang susi ng sasakyan.
          </p>
          <div style="background:#ffffff;border:1px dashed #86efac;border-radius:8px;padding:12px;text-align:left;font-size:0.78rem;color:#334155;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="color:#64748b;">Halaga na babayaran sa counter:</span>
              <strong style="color:#166534;font-size:0.9rem;">${fmtMoney(payNow)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="color:#64748b;">Pickup Counter:</span>
              <strong style="color:#0f172a;">RentFlow Main Hub Counter</strong>
            </div>
            <div style="font-size:0.72rem;color:#64748b;margin-top:6px;border-top:1px solid #f1f5f9;padding-top:6px;">
              <i class="fa-solid fa-circle-check" style="color:#16a34a;margin-right:4px;"></i> I-confirm ang reservation para mai-reserve agad ang sasakyan para sa iyo.
            </div>
          </div>
        </div>
      `;
      if (pBtn) pBtn.textContent = `Reserve Vehicle (Cash on Pickup · ${fmtMoney(payNow)})`;
    } else if (selectedMethod === 'gcash') {
      container.innerHTML = `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;text-align:center;margin-bottom:14px;">
          <div style="font-size:0.8rem;font-weight:700;color:#1e40af;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">
            <i class="fa-solid fa-mobile-screen" style="margin-right:4px;"></i> Scan to Pay via GCash
          </div>
          <div style="width:170px;height:170px;background:#ffffff;border:3px solid #2563eb;border-radius:12px;margin:0 auto 12px auto;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(37,99,235,0.15);position:relative;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=GCASH-RENTAL-${b.id}-${payNow}" alt="GCash QR Code" style="width:100%;height:100%;object-fit:contain;" />
          </div>
          <div style="font-weight:700;font-size:0.9rem;color:#0f172a;margin-bottom:2px;">RentFlow Vehicles Inc.</div>
          <div style="font-size:0.78rem;color:#475569;font-weight:600;"><i class="fa-solid fa-shield-halved" style="color:#2563eb;margin-right:4px;"></i> Account No: <span style="font-family:monospace;">0917 •••• 4567</span></div>
          <div style="font-size:0.72rem;color:#64748b;margin-top:4px;">Official GCash Express Merchant (Privacy Protected)</div>
        </div>
        <div class="field">
          <label>GCash Reference Number</label>
          <input type="text" id="payRefNo" placeholder="e.g. 1002 9482 1102" required />
        </div>
        <p class="muted" style="font-size:0.76rem;color:#64748b;line-height:1.4;">
          <i class="fa-solid fa-circle-info" style="color:#2563eb;margin-right:4px;"></i> Open your GCash App &gt; QR &gt; Scan QR code. Enter the Reference Number after payment.
        </p>
      `;
      if (pBtn) pBtn.textContent = `Confirm Payment of ${fmtMoney(payNow)}`;
    } else if (selectedMethod === 'bank_qr') {
      container.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;text-align:center;margin-bottom:14px;">
          <div style="font-size:0.8rem;font-weight:700;color:#166534;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">
            <i class="fa-solid fa-qrcode" style="margin-right:4px;"></i> InstaPay / QR Ph Payment
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
          <div style="font-size:0.78rem;color:#475569;font-weight:600;"><i class="fa-solid fa-lock" style="color:#059669;margin-right:4px;"></i> Account: <span style="font-family:monospace;">0012 •••• 8899</span></div>
          <div style="font-size:0.72rem;color:#64748b;margin-top:4px;">Secured by QR Ph & InstaPay Philippines</div>
        </div>
        <div class="field">
          <label>Bank Reference / Transaction ID</label>
          <input type="text" id="payRefNo" placeholder="e.g. TXN-99482019" required />
        </div>
        <p class="muted" style="font-size:0.76rem;color:#64748b;line-height:1.4;">
          <i class="fa-solid fa-shield-check" style="color:#059669;margin-right:4px;"></i> Scan with any QR Ph compliant PH Bank app (BDO, BPI, Maya, UnionBank).
        </p>
      `;
      if (pBtn) pBtn.textContent = `Confirm Payment of ${fmtMoney(payNow)}`;
    } else {
      container.innerHTML = `
        <div class="field"><label>Cardholder Name</label><input type="text" placeholder="Name on Card" /></div>
        <div class="field"><label>Card Number</label><input type="text" placeholder="4242 •••• •••• 4242" maxlength="19" /></div>
        <div class="detail-grid">
          <div class="field"><label>Expiry Date</label><input type="text" placeholder="MM/YY" /></div>
          <div class="field"><label>CVC / CVV</label><input type="password" placeholder="•••" maxlength="4" /></div>
        </div>
        <p class="muted" style="font-size:0.76rem;color:#64748b;">
          <i class="fa-solid fa-lock" style="color:#d97706;margin-right:4px;"></i> Encrypted 256-bit SSL Card Payment.
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

      const methodName = selectedMethod === 'cash' ? 'Cash on Pickup' : selectedMethod === 'gcash' ? 'GCash QR' : selectedMethod === 'bank_qr' ? 'Bank QR Ph' : 'Card';
      const newTotalPaid = currentPaid + payNow;
      const newBalance = Math.max(0, totalAmount - newTotalPaid);
      const newPaymentType = newBalance === 0 ? 'full' : 'partial';
      const finalRefNo = selectedMethod === 'cash' ? `CASH-${bookingId}-${Date.now().toString().slice(-4)}` : (refNo || `RCPT-${bookingId}`);

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

      toast(selectedMethod === 'cash'
        ? `Reservation confirmed for Cash Payment on Pickup (${fmtMoney(payNow)})!`
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
  const refCode = refNo || `REF-${Date.now().toString().slice(-6)}`;
  const sysSettings = getSystemSettings();
  const comp = sysSettings.company || DEFAULT_SETTINGS.company;

  const modal = openModal(`
    <div class="modal-head" style="margin-bottom:12px;padding-bottom:8px;">
      <div style="font-weight:700;font-size:0.9rem;color:#64748b;">Official Payment Receipt</div>
      <div class="modal-close" id="mClose" onclick="window.closeModal()">✕</div>
    </div>
    <div style="text-align:center;margin-bottom:18px;">
      <div style="width:58px;height:58px;border-radius:50%;background:#ecfdf5;border:2px solid #a7f3d0;display:inline-flex;align-items:center;justify-content:center;margin-bottom:10px;">
        <i class="fa-solid fa-check" style="font-size:28px;color:#059669;"></i>
      </div>
      <h2 style="font-size:1.35rem;font-weight:800;color:#0f172a;margin-bottom:4px;">Payment Successful!</h2>
      <span class="badge badge-completed" style="font-size:0.75rem;"><i class="fa-solid fa-shield-check"></i> Paid via ${payMethod}</span>
      <p class="muted" style="margin-top:8px;font-size:0.82rem;color:#64748b;">Ref / Transaction No: <strong style="color:#0f172a;font-family:monospace;">${refCode}</strong></p>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-file-invoice" style="color:#2563eb;"></i> Reservation &amp; Vehicle Summary</h4>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;">
      <div class="receipt-row"><span style="color:#64748b;">Customer</span><span style="font-weight:700;color:#0f172a;">${state.profile?.full_name ?? 'Customer'}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Driver's License</span><span style="font-weight:700;color:#0f172a;">${state.profile?.license_number ? state.profile.license_number : 'Physical card verified upon meetup'}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Vehicle</span><span style="font-weight:700;color:#0f172a;">${v.name ?? 'Rental Vehicle'}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Category</span><span style="color:#0f172a;">${v.categories?.name ?? 'Standard'}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Plate Number</span><span style="color:#0f172a;">${maskPlate(v.plate_number)}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Pickup Date</span><span style="color:#0f172a;font-weight:600;">${fmtDate(b.start_date)}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Return Date</span><span style="color:#0f172a;font-weight:600;">${fmtDate(b.end_date)}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Rental Period</span><span style="color:#0f172a;">${days} day(s)</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Fuel / AC</span><span style="color:#0f172a;">${fuelType} · ${hasAC ? 'With AC' : 'Non-AC'}</span></div>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-receipt" style="color:#059669;"></i> Payment &amp; Receipt Summary</h4>
    <div class="receipt" style="margin-bottom:16px;">
      <div class="receipt-row"><span>Payment Method</span><span style="font-weight:700;color:#059669;">${payMethod}</span></div>
      <div class="receipt-row"><span>Total Rental Cost</span><span style="font-weight:700;color:#0f172a;">${fmtMoney(b.total_amount)}</span></div>
      <div class="receipt-row"><span>Amount Paid Now</span><span style="font-weight:700;color:#059669;">${fmtMoney(b.paid_amount || b.total_amount)}</span></div>
      ${b.balance_due && Number(b.balance_due) > 0 ? `
        <div class="receipt-row" style="background:#eff6ff;padding:6px 8px;border-radius:6px;margin:4px 0;">
          <span style="color:#1d4ed8;font-weight:600;">Remaining Balance Due at Pickup</span>
          <span style="font-weight:800;color:#1d4ed8;">${fmtMoney(b.balance_due)}</span>
        </div>
      ` : ''}
      <div class="divider"></div>
      <div class="receipt-row receipt-total"><span>Payment Status</span><span class="badge ${b.balance_due && Number(b.balance_due) > 0 ? 'badge-reserved' : 'badge-completed'}">${b.balance_due && Number(b.balance_due) > 0 ? 'RESERVED (PARTIAL)' : 'FULL PAYMENT'}</span></div>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-clipboard-list" style="color:#0284c7;"></i> Rental Details</h4>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px;margin-bottom:14px;">
      <div class="receipt-row"><span style="color:#0369a1;">Pickup Location</span><span style="color:#0f172a;font-weight:600;">${comp.address || '123 PPC MAIN BRANCH VENUE'}</span></div>
      <div class="receipt-row"><span style="color:#0369a1;">Return Location</span><span style="color:#0f172a;font-weight:600;">${comp.address || '123 PPC MAIN BRANCH VENUE'}</span></div>
      <div class="receipt-row"><span style="color:#0369a1;">Fuel Policy</span><span style="color:#0f172a;">Full-to-Full</span></div>
      <div class="receipt-row"><span style="color:#0369a1;">Insurance</span><span style="color:#0f172a;">Basic coverage included</span></div>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-headset" style="color:#059669;"></i> Support Contact</h4>
    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px;margin-bottom:16px;">
      <div class="receipt-row"><span style="color:#065f46;"><i class="fa-solid fa-phone" style="margin-right:5px;"></i> Hotline</span><span style="font-weight:700;color:#0f172a;">${comp.phone || '+63 67676767'}</span></div>
      <div class="receipt-row"><span style="color:#065f46;"><i class="fa-solid fa-mobile-screen" style="margin-right:5px;"></i> Mobile</span><span style="font-weight:700;color:#0f172a;">${comp.mobile || '+63 917 123 4567'}</span></div>
      <div class="receipt-row"><span style="color:#065f46;"><i class="fa-solid fa-envelope" style="margin-right:5px;"></i> Email</span><span style="font-weight:600;color:#0f172a;">${comp.email || 'vehicleretal.ph'}</span></div>
      <div class="receipt-row"><span style="color:#065f46;"><i class="fa-solid fa-location-dot" style="margin-right:5px;"></i> Address</span><span style="color:#0f172a;">${comp.address || '123 PPC MAIN BRANCH VENUE'}</span></div>
    </div>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-bottom:16px;">
      <h4 style="margin:0 0 8px 0;display:flex;align-items:center;gap:6px;color:#92400e;font-size:0.88rem;"><i class="fa-solid fa-triangle-exclamation" style="color:#d97706;"></i> Important Information</h4>
      <p style="font-size:0.82rem;color:#78350f;line-height:1.6;margin:0;">Please arrive at least <strong>15 minutes before</strong> your scheduled pickup time. Don't forget to bring your <strong>driving license</strong> and a <strong>valid ID</strong> for verification.</p>
    </div>

    <div style="display:flex;gap:10px;margin-top:16px;">
      <button type="button" class="btn btn-ghost btn-block" id="printPaidReceiptBtn" onclick="window.print()"><i class="fa-solid fa-print"></i> Print Official Receipt</button>
      <button type="button" class="btn btn-primary btn-block" id="closePaidReceiptBtn" onclick="window.closeModal()"><i class="fa-solid fa-check"></i> Done</button>
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
      <div class="modal-close" id="mClose" onclick="window.closeModal()">✕</div>
    </div>

    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:16px;">
      <div style="font-size:0.82rem;color:#b45309;font-weight:700;display:flex;align-items:center;gap:6px;">
        <i class="fa-solid fa-shield-halved"></i> Refund Policy &amp; Guarantee
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
        <i class="fa-solid fa-paper-plane"></i> Submit Refund Request
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
        await supabase.from('bookings').update({
          status: 'cancelled',
          review_notes: fallbackNotes,
        }).eq('id', bookingId).catch(() => {});
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
      <div class="modal-close" onclick="window.closeModal()">✕</div>
    </div>
    <div style="text-align:center;margin-bottom:18px;">
      <div style="width:58px;height:58px;border-radius:50%;background:#ecfdf5;border:2px solid #a7f3d0;display:inline-flex;align-items:center;justify-content:center;margin-bottom:10px;">
        <i class="fa-solid fa-hand-holding-dollar" style="font-size:28px;color:#059669;"></i>
      </div>
      <h2 style="font-size:1.35rem;font-weight:800;color:#0f172a;margin-bottom:4px;">Refund Disbursed Successfully</h2>
      <span class="badge badge-refunded" style="font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> Transfer Completed</span>
      <p class="muted" style="margin-top:8px;font-size:0.82rem;color:#64748b;">Voucher / Claim No: <strong style="color:#0f172a;font-family:monospace;">${refCode}</strong></p>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-user" style="color:#2563eb;"></i> Beneficiary Details</h4>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;">
      <div class="receipt-row"><span style="color:#64748b;">Customer Name</span><span style="font-weight:700;color:#0f172a;">${cName}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Phone Number</span><span style="color:#0f172a;">${cPhone}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Vehicle</span><span style="font-weight:700;color:#0f172a;">${v.name ?? 'Vehicle'}</span></div>
      <div class="receipt-row"><span style="color:#64748b;">Rental Dates</span><span style="color:#0f172a;">${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</span></div>
      ${b.review_notes ? `<div class="receipt-row" style="flex-direction:column;align-items:flex-start;gap:4px;margin-top:4px;"><span style="color:#64748b;">Refund Transfer Notes</span><span style="color:#b45309;font-weight:600;">${b.review_notes}</span></div>` : ''}
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-receipt" style="color:#059669;"></i> Financial Summary</h4>
    <div class="receipt" style="margin-bottom:16px;">
      <div class="receipt-row"><span>Total Booking Amount</span><span>${fmtMoney(b.total_amount)}</span></div>
      <div class="receipt-row"><span>Refund Status</span><span class="badge badge-refunded">COMPLETED</span></div>
      <div class="divider"></div>
      <div class="receipt-row receipt-total"><span>Total Refund Disbursed</span><span style="color:#059669;">${fmtMoney(b.total_amount)}</span></div>
    </div>
    <button class="btn btn-primary btn-block" onclick="window.print()" style="margin-top:8px;background:#059669;border-color:#059669;"><i class="fa-solid fa-print"></i> Print Refund Voucher</button>
  `);
}

window.openRefundRequestModal = openRefundRequestModal;
window.openPaidReceiptModal = openPaidReceiptModal;
window.openRefundVoucherModal = openRefundVoucherModal;
