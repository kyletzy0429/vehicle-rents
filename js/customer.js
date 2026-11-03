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

  $$('#favGrid .vehicle-card, #favGrid .renter-vehicle-card').forEach(card => card.addEventListener('click', () => openVehicleDetail(card.dataset.id)));
  $$('#favGrid [data-book-btn], #favGrid .card-view-btn, #favGrid .vehicle-book-pill-btn').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openVehicleDetail(btn.dataset.bookBtn);
  }));
  $$('#favGrid .vehicle-fav-btn, #favGrid .fav-heart-btn').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(Number(btn.dataset.favid));
  }));
}

export async function renderCustomerProfile(view) {
  const p = state.profile || {};
  const initials = (p.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const email = state.user?.email || p.email || 'mark.ramos@gmail.com';

  view.innerHTML = `
    <div class="view" style="max-width:680px;margin:0 auto;padding:12px 8px 60px 8px;">
      <!-- Eyebrow & Title -->
      <div style="margin-bottom:24px;">
        <div class="portal-eyebrow">RENTER PORTAL</div>
        <h1 class="portal-heading">Account &amp; Security</h1>
      </div>

      <div class="account-card" style="background:#ffffff;border:1px solid var(--glass-border, #E2DCF0);border-radius:14px;padding:32px;box-shadow:0 1px 3px rgba(42,35,64,0.04);">
        <!-- User Info Header -->
        <div style="display:flex;align-items:center;gap:16px;padding-bottom:24px;border-bottom:1px solid #f1f5f9;margin-bottom:24px;">
          <div style="width:56px;height:56px;border-radius:50%;background:#E9E3F7;color:#5B4B8A;font-family:var(--font-heading, 'Fraunces', serif);font-size:1.3rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            ${initials}
          </div>
          <div>
            <h2 style="font-family:var(--font-heading, 'Fraunces', serif);font-size:1.25rem;font-weight:700;color:#2A2340;margin:0 0 4px 0;">${p.full_name || 'Renter Account'}</h2>
            <div style="font-size:0.86rem;color:#5E5778;">Manage your login email and account password below.</div>
          </div>
        </div>

        <!-- 1. Email Address Form -->
        <form id="emailForm" style="margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #f1f5f9;">
          <div class="field">
            <label for="profEmail" style="font-weight:600;font-size:0.88rem;color:#2A2340;margin-bottom:8px;display:block;">Email Address</label>
            <div style="display:flex;gap:12px;align-items:center;">
              <input type="email" id="profEmail" value="${email}" placeholder="your.email@example.com" required style="flex:1;min-height:44px;padding:10px 14px;border-radius:8px;border:1.5px solid #E2DCF0;font-size:0.92rem;" />
              <button type="submit" class="btn btn-primary" id="saveEmailBtn" style="padding:10px 22px;border-radius:8px;white-space:nowrap;">Save Email</button>
            </div>
          </div>
        </form>

        <!-- 2. Change Password Form -->
        <form id="passwordForm">
          <h3 style="font-family:var(--font-heading, 'Fraunces', serif);font-size:1.15rem;font-weight:700;color:#2A2340;margin:0 0 16px 0;">Change Password</h3>
          
          <div class="field" style="margin-bottom:16px;">
            <label for="currentPassword" style="font-weight:600;font-size:0.88rem;color:#2A2340;margin-bottom:6px;display:block;">Current Password</label>
            <input type="password" id="currentPassword" placeholder="Enter current password" required style="width:100%;min-height:44px;padding:10px 14px;border-radius:8px;border:1.5px solid #E2DCF0;font-size:0.92rem;" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px;">
            <div class="field">
              <label for="newPassword" style="font-weight:600;font-size:0.88rem;color:#2A2340;margin-bottom:6px;display:block;">New Password</label>
              <input type="password" id="newPassword" placeholder="Minimum 6 characters" minlength="6" required style="width:100%;min-height:44px;padding:10px 14px;border-radius:8px;border:1.5px solid #E2DCF0;font-size:0.92rem;" />
            </div>
            <div class="field">
              <label for="confirmPassword" style="font-weight:600;font-size:0.88rem;color:#2A2340;margin-bottom:6px;display:block;">Confirm New Password</label>
              <input type="password" id="confirmPassword" placeholder="Re-type new password" minlength="6" required style="width:100%;min-height:44px;padding:10px 14px;border-radius:8px;border:1.5px solid #E2DCF0;font-size:0.92rem;" />
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;">
            <button type="submit" class="btn btn-primary" id="updatePasswordBtn" style="padding:10px 24px;border-radius:8px;">
              Update Password
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Email Form Handler
  $('#emailForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = $('#saveEmailBtn');
    const newEmail = $('#profEmail').value.trim();
    if (!newEmail) return;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const uid = state.user?.id || '0e8d807a-49fb-42d7-ab7b-f5ea609f0ef0';
    try {
      if (supabase) {
        if (newEmail !== state.user?.email) {
          await supabase.auth.updateUser({ email: newEmail }).catch(() => {});
        }
        await supabase.from('profiles').update({ email: newEmail }).eq('id', uid);
      }
    } catch (err) {
      console.warn('Email update notice:', err);
    }

    if (state.user) state.user.email = newEmail;
    if (state.profile) state.profile.email = newEmail;

    try {
      localStorage.setItem(`rentflow_prof_${uid}`, JSON.stringify({ ...state.profile, email: newEmail }));
    } catch (e) { }

    toast('Email address updated successfully!', 'success');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Email';

    if (window.renderShell) {
      window.renderShell();
    }
  });

  // Password Form Handler
  $('#passwordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updateBtn = $('#updatePasswordBtn');
    const newPass = $('#newPassword').value;
    const confirmPass = $('#confirmPassword').value;

    if (!newPass || newPass.length < 6) {
      toast('New password must be at least 6 characters.', 'error');
      return;
    }
    if (newPass !== confirmPass) {
      toast('New passwords do not match. Please verify.', 'error');
      return;
    }

    updateBtn.disabled = true;
    updateBtn.textContent = 'Updating Password…';

    try {
      if (supabase && supabase.auth) {
        const { error } = await supabase.auth.updateUser({ password: newPass });
        if (error) {
          console.warn('Supabase password update note:', error.message);
        }
      }
      toast('Password updated successfully! Use your new password next time you sign in.', 'success');
      $('#passwordForm').reset();
    } catch (err) {
      toast(err.message || 'Failed to update password.', 'error');
    } finally {
      updateBtn.disabled = false;
      updateBtn.textContent = 'Update Password';
    }
  });
}

export async function renderMyBookings(view) {
  let dbBookings = [];
  const currentCustomerId = state.user?.id || '0e8d807a-49fb-42d7-ab7b-f5ea609f0ef0';
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
  const returnDueBooking = bookings.find(b => ['active', 'approved', 'confirmed', 'vehicle_released'].includes(b.status) && (b.end_date || '').slice(0, 10) <= todayStr);
  const isOverdue = returnDueBooking && (returnDueBooking.end_date || '').slice(0, 10) < todayStr;

  const pendingCount = bookings.filter(b => ['pending', 'pending_verification', 'cash_on_pickup', 'awaiting_payment'].includes(b.status)).length;
  const activeCount = bookings.filter(b => ['active', 'approved', 'confirmed', 'vehicle_released', 'reserved', 'partially_paid'].includes(b.status)).length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;
  const cancelledCount = bookings.filter(b => ['cancelled', 'rejected', 'refunded', 'refund_requested'].includes(b.status)).length;

  view.innerHTML = `
    <div class="view">
      <div class="section-head" style="margin-bottom:20px;">
        <div>
          <h2>My Bookings &amp; Rentals</h2>
          <p>Track your requests, active rentals, receipts, and rental history.</p>
        </div>
      </div>

      <div class="search-unified-card bookings-unified-card">
        ${returnDueBooking ? `
          <div class="return-today-alert-card bookings-unified-alert ${isOverdue ? 'is-overdue' : 'is-due-today'}">
            <div class="bookings-alert-left">
              <div class="bookings-alert-icon">
                <i class="fa-solid ${isOverdue ? 'fa-triangle-exclamation' : 'fa-bell'}"></i>
              </div>
              <div class="bookings-alert-body">
                <div class="bookings-alert-title-row">
                  <span class="bookings-alert-title">${isOverdue ? 'Rental Return Overdue' : 'Vehicle Return Due Today'}</span>
                  <span class="bookings-alert-badge">
                    <i class="fa-regular fa-clock"></i> 12:00 PM Handover
                  </span>
                </div>
                <div class="bookings-alert-desc">
                  Your <strong>${returnDueBooking.vehicles?.name || 'Rental'}</strong> is scheduled for return at <strong>123 PPC Main Branch Venue</strong>. Please ensure fuel matches pickup level.
                </div>
              </div>
            </div>
            <div class="bookings-alert-actions">
              <button type="button" class="btn btn-sm bookings-alert-btn" onclick="window.openRentalExtensionModal && window.openRentalExtensionModal('${returnDueBooking.id}')">
                <i class="fa-solid fa-clock-rotate-left"></i> Request Extension
              </button>
            </div>
          </div>
        ` : ''}

        <div class="booking-filter-tabs ${returnDueBooking ? 'has-top-alert' : ''}">
          <button type="button" class="booking-tab-btn active" data-bfilter="all">
            All Bookings <span class="booking-tab-badge">${bookings.length}</span>
          </button>
          <button type="button" class="booking-tab-btn" data-bfilter="pending">
            Pending <span class="booking-tab-badge">${pendingCount}</span>
          </button>
          <button type="button" class="booking-tab-btn" data-bfilter="active">
            Active &amp; Approved <span class="booking-tab-badge">${activeCount}</span>
          </button>
          <button type="button" class="booking-tab-btn" data-bfilter="completed">
            Completed <span class="booking-tab-badge">${completedCount}</span>
          </button>
          <button type="button" class="booking-tab-btn" data-bfilter="cancelled">
            Cancelled <span class="booking-tab-badge">${cancelledCount}</span>
          </button>
        </div>
      </div>

      <div class="row-list" id="bookingList">
        ${bookings.length ? bookings.map(b => customerBookingRow(b)).join('') : emptyState('', 'No bookings yet — browse vehicles to get started.')}
      </div>
    </div>
  `;


  const filterBookings = (f) => {
    if (f === 'pending') return bookings.filter(b => ['pending', 'pending_verification', 'cash_on_pickup', 'awaiting_payment'].includes(b.status));
    if (f === 'active') return bookings.filter(b => ['active', 'approved', 'confirmed', 'vehicle_released', 'reserved', 'partially_paid'].includes(b.status));
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
            <div style="width:48px;height:48px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:var(--text-mid);font-size:1.25rem;">
              <i class="fa-solid fa-car-side"></i>
            </div>
            <h4 style="font-size:0.98rem;font-weight:700;color:var(--text-hi);margin-bottom:4px;">No ${filterKey === 'all' ? '' : filterKey} bookings</h4>
            <p style="font-size:0.83rem;color:var(--text-mid);margin-bottom:16px;">There are no bookings under this filter at the moment.</p>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.switchTab ? window.switchTab('browse') : (state.tab = 'browse', window.renderShell && window.renderShell())">
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
  let badgeHTML = '';

  if (b.status === 'pending_verification') {
    badgeHTML = `<span class="badge badge-pending_verification"><i class="fa-solid fa-hourglass-half" style="margin-right:4px;"></i> Pending Verification</span>`;
    actions = `
      <div style="font-size:0.78rem;color:#b45309;font-weight:700;display:flex;align-items:center;gap:4px;">
        <i class="fa-solid fa-clock"></i> Awaiting Staff Review
      </div>
      <button type="button" class="btn btn-ghost btn-sm" onclick="window.openRentalExtensionModal && window.openRentalExtensionModal('${b.id}')" style="border:1px solid #cbd5e1;"><i class="fa-solid fa-clock-rotate-left"></i> Extend Rental</button>
      <button type="button" class="btn btn-ghost btn-sm" data-receipt-id="${b.id}" onclick="window.openPaidReceiptModal && window.openPaidReceiptModal('${b.id}')" style="border:1px solid #cbd5e1;"><i class="fa-solid fa-receipt"></i> View Pass / Receipt</button>
      <button type="button" class="btn btn-outline-danger btn-sm" data-cancel-id="${b.id}" onclick="window.cancelCustomerBooking && window.cancelCustomerBooking('${b.id}')"><i class="fa-solid fa-xmark"></i> Cancel</button>
    `;
  } else if (b.status === 'cash_on_pickup') {
    badgeHTML = `<span class="badge badge-cash_on_pickup"><i class="fa-solid fa-money-bill-wave" style="margin-right:4px;"></i> Cash on Pickup</span>`;
    actions = `
      <div style="font-size:0.78rem;color:#166534;font-weight:700;display:flex;align-items:center;gap:4px;">
        <i class="fa-solid fa-handshake"></i> Pay Cash via Meetup
      </div>
      <button type="button" class="btn btn-ghost btn-sm" data-receipt-id="${b.id}" onclick="window.openPaidReceiptModal && window.openPaidReceiptModal('${b.id}')" style="border:1px solid #cbd5e1;"><i class="fa-solid fa-receipt"></i> View Pass / Receipt</button>
      <button type="button" class="btn btn-outline-danger btn-sm" data-cancel-id="${b.id}" onclick="window.cancelCustomerBooking && window.cancelCustomerBooking('${b.id}')"><i class="fa-solid fa-xmark"></i> Cancel</button>
    `;
  } else if (b.status === 'confirmed' || b.status === 'approved') {
    badgeHTML = `<span class="badge badge-confirmed"><i class="fa-solid fa-circle-check" style="margin-right:4px;"></i> Confirmed</span>`;
    actions = `
      <div style="font-size:0.75rem;color:#059669;font-weight:700;display:flex;align-items:center;gap:4px;">
        <i class="fa-solid fa-car-side"></i> Vehicle Ready for Release
      </div>
      <button type="button" class="btn btn-ghost btn-sm" onclick="window.openRentalExtensionModal && window.openRentalExtensionModal('${b.id}')" style="border:1px solid #cbd5e1;"><i class="fa-solid fa-clock-rotate-left"></i> Extend Rental</button>
      <button type="button" class="btn btn-ghost btn-sm" data-receipt-id="${b.id}" onclick="window.openPaidReceiptModal && window.openPaidReceiptModal('${b.id}')" style="border:1px solid #cbd5e1;"><i class="fa-solid fa-receipt" style="color:var(--accent);"></i> Receipt &amp; QR Pass</button>
    `;
  } else if (b.status === 'vehicle_released' || b.status === 'active') {
    badgeHTML = `<span class="badge badge-vehicle_released"><i class="fa-solid fa-route" style="margin-right:4px;"></i> Vehicle Released</span>`;
    actions = `
      <button type="button" class="btn btn-ghost btn-sm" onclick="window.openRentalExtensionModal && window.openRentalExtensionModal('${b.id}')" style="border:1px solid #cbd5e1;"><i class="fa-solid fa-clock-rotate-left"></i> Extend Rental</button>
      ${isPartial ? `<button type="button" class="btn btn-primary btn-sm" data-pay-balance-id="${b.id}" onclick="window.openPaymentModal && window.openPaymentModal('${b.id}', true)"><i class="fa-solid fa-credit-card"></i> Pay Balance (₱${fmtMoney(b.balance_due)})</button>` : ''}
      <button type="button" class="btn btn-ghost btn-sm" data-receipt-id="${b.id}" onclick="window.openPaidReceiptModal && window.openPaidReceiptModal('${b.id}')" style="border:1px solid #cbd5e1;"><i class="fa-solid fa-receipt" style="color:var(--accent);"></i> Receipt &amp; QR Pass</button>
      <button type="button" class="btn btn-warning btn-sm" data-refund-req-id="${b.id}" onclick="window.openRefundRequestModal && window.openRefundRequestModal('${b.id}')" style="color:#b45309;background:#fffbeb;border:1px solid #fde68a;"><i class="fa-solid fa-arrow-rotate-left"></i> Request Refund</button>
    `;
  } else if (b.status === 'awaiting_payment') {
    badgeHTML = `<span class="badge badge-awaiting_payment"><i class="fa-solid fa-triangle-exclamation" style="margin-right:4px;"></i> Awaiting Payment</span>`;
    actions = `
      <button type="button" class="btn btn-primary btn-sm" data-pay-id="${b.id}" onclick="window.openPaymentModal && window.openPaymentModal('${b.id}')"><i class="fa-solid fa-rotate-right"></i> Resubmit Payment Information</button>
      <button type="button" class="btn btn-outline-danger btn-sm" data-cancel-id="${b.id}" onclick="window.cancelCustomerBooking && window.cancelCustomerBooking('${b.id}')"><i class="fa-solid fa-xmark"></i> Cancel</button>
    `;
  } else if (b.status === 'pending' || b.status === 'pending_payment') {
    badgeHTML = `<span class="badge badge-pending">Pending Payment</span>`;
    actions = `
      <button type="button" class="btn btn-primary btn-sm" data-pay-id="${b.id}" onclick="window.openPaymentModal && window.openPaymentModal('${b.id}')"><i class="fa-solid fa-credit-card"></i> Pay Now</button>
      <button type="button" class="btn btn-outline-danger btn-sm" data-cancel-id="${b.id}" onclick="window.cancelCustomerBooking && window.cancelCustomerBooking('${b.id}')"><i class="fa-solid fa-xmark"></i> Cancel Request</button>
    `;
  } else if (b.status === 'completed') {
    badgeHTML = `<span class="badge badge-completed"><i class="fa-solid fa-flag-checkered" style="margin-right:4px;"></i> Completed</span>`;
    actions = `
      <button type="button" class="btn btn-ghost btn-sm" data-receipt-id="${b.id}" onclick="window.openPaidReceiptModal && window.openPaidReceiptModal('${b.id}')" style="border:1px solid #cbd5e1;"><i class="fa-solid fa-receipt"></i> Official Receipt</button>
    `;
  } else if (b.status === 'cancelled' || b.status === 'rejected') {
    badgeHTML = `<span class="badge badge-rejected">${b.status}</span>`;
    actions = `
      <button type="button" class="btn btn-primary btn-sm" data-pay-id="${b.id}" onclick="window.openPaymentModal && window.openPaymentModal('${b.id}')"><i class="fa-solid fa-rotate-right"></i> Resubmit Payment Information</button>
    `;
  } else if (b.status === 'refund_requested') {
    badgeHTML = `<span class="badge badge-pending">Refund Pending</span>`;
    actions = `<span class="badge" style="background:#fff7ed;color:#c2410c;border:1px solid #ffedd5;padding:6px 12px;"><i class="fa-solid fa-hourglass-half"></i> Refund Pending Review</span>`;
  } else if (b.status === 'refunded') {
    badgeHTML = `<span class="badge badge-completed">Refunded</span>`;
    actions = `<button type="button" class="btn btn-ghost btn-sm" data-refund-voucher-id="${b.id}" onclick="window.openRefundVoucherModal && window.openRefundVoucherModal('${b.id}')" style="border:1px solid #cbd5e1;"><i class="fa-solid fa-receipt"></i> Refund Voucher</button>`;
  } else {
    badgeHTML = `<span class="badge badge-${b.status}">${b.status.replace('_', ' ')}</span>`;
    actions = `<button type="button" class="btn btn-primary btn-sm" data-pay-id="${b.id}" onclick="window.openPaymentModal && window.openPaymentModal('${b.id}')"><i class="fa-solid fa-credit-card"></i> Pay Now</button>`;
  }

  if (isPartial && !['confirmed', 'vehicle_released', 'completed'].includes(b.status)) {
    badgeHTML = `<span class="badge badge-reserved">Reserved (${b.downpayment_percent || 20}% Paid)</span>`;
  }

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
        <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-hi);">${isPayingBalance ? 'Pay Remaining Balance' : 'Complete Booking Payment'}</h3>
        <span class="muted" style="font-size:0.78rem;">${vehicleName} · ${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</span>
      </div>
      <div class="modal-close" id="mClose"><i class="fa-solid fa-xmark"></i></div>
    </div>

    ${!isPayingBalance ? `
      <div class="field" style="margin-bottom:14px;">
        <label>Payment Structure</label>
        <div class="pay-structure-selector" id="modalPayStructureSelector">
          <div class="selector-opt-card ${selectedPct === 100 ? 'active' : ''}" data-pct="100">
            <div class="opt-radio"><i class="fa-solid ${selectedPct === 100 ? 'fa-circle-check' : 'fa-circle'}"></i></div>
            <div class="opt-content">
              <div class="opt-top">
                <strong>Pay in Full (100%)</strong>
                <span class="opt-chip opt-chip-green">Recommended</span>
              </div>
              <span class="opt-sub">Instant zero-balance reservation</span>
            </div>
          </div>
          <div class="selector-opt-card ${selectedPct === 20 ? 'active' : ''}" data-pct="20">
            <div class="opt-radio"><i class="fa-solid ${selectedPct === 20 ? 'fa-circle-check' : 'fa-circle'}"></i></div>
            <div class="opt-content">
              <div class="opt-top">
                <strong>Downpayment (20%)</strong>
              </div>
              <span class="opt-sub">Pay 20% today · Balance upon vehicle meetup</span>
            </div>
          </div>
        </div>
        <select id="modalPayStructureSelect" class="clean-select" style="display:none;">
          <option value="100" ${selectedPct === 100 ? 'selected' : ''}>Pay in Full (100%)</option>
          <option value="20" ${selectedPct === 20 ? 'selected' : ''}>Downpayment (20%)</option>
        </select>
      </div>
    ` : ''}

    <div class="receipt" id="paymentSummaryBox" style="margin-bottom:14px;">
      <div class="receipt-row"><span>Total Rental Cost</span><span>${fmtMoney(totalAmount)}</span></div>
      ${isPayingBalance ? `
        <div class="receipt-row"><span>Already Paid (Deposit)</span><span style="color:#059669;font-weight:700;">${fmtMoney(currentPaid)}</span></div>
        <div class="receipt-row receipt-total"><span>Remaining Balance Due Now</span><span style="color:var(--accent);">${fmtMoney(currentBalance)}</span></div>
      ` : `
        <div class="receipt-row"><span>Reservation Option</span><span id="summaryTierLabel" style="font-weight:700;">${selectedPct === 100 ? 'Full Payment (100%)' : `${selectedPct}% Partial Downpayment`}</span></div>
        <div class="receipt-row"><span>Balance Due at Pickup</span><span id="summaryBalance" style="color:var(--text-mid);">${fmtMoney(balanceDue)}</span></div>
        <div class="receipt-row receipt-total"><span>Amount Payable Now</span><span id="summaryPayNow" style="color:var(--accent);">${fmtMoney(payNow)}</span></div>
      `}
    </div>

    <div class="field" style="margin-bottom:14px;">
      <label>Payment Method</label>
      <div class="payment-methods-grid" id="modalPaymentMethodGrid">
        <div class="pay-method-card ${selectedMethod === 'card' ? 'active' : ''}" data-method="card">
          <div class="pm-radio"><i class="fa-solid ${selectedMethod === 'card' ? 'fa-circle-check' : 'fa-circle'}"></i></div>
          <div class="pm-icon pm-card-icon"><i class="fa-solid fa-credit-card"></i></div>
          <div class="pm-info">
            <strong class="pm-name">Card</strong>
            <span class="pm-desc">Debit or Credit Card</span>
          </div>
        </div>

        <div class="pay-method-card ${selectedMethod === 'gcash' ? 'active' : ''}" data-method="gcash">
          <div class="pm-radio"><i class="fa-solid ${selectedMethod === 'gcash' ? 'fa-circle-check' : 'fa-circle'}"></i></div>
          <div class="pm-icon pm-gcash-icon" style="padding:0;overflow:hidden;background:transparent;display:flex;align-items:center;justify-content:center;">
            <img src="assets/gcash-logo.webp" alt="GCash" style="width:28px;height:28px;border-radius:6px;object-fit:cover;" />
          </div>
          <div class="pm-info">
            <strong class="pm-name">GCash</strong>
            <span class="pm-desc">Instant QR Scan</span>
          </div>
          <span class="pm-tag">Instant</span>
        </div>

        <div class="pay-method-card ${selectedMethod === 'bank_qr' ? 'active' : ''}" data-method="bank_qr">
          <div class="pm-radio"><i class="fa-solid ${selectedMethod === 'bank_qr' ? 'fa-circle-check' : 'fa-circle'}"></i></div>
          <div class="pm-icon pm-bank-icon" style="background:#ffffff;display:flex;align-items:center;justify-content:center;"><img src="assets/qrph-logo.png" alt="QR Ph" style="width:28px;height:28px;object-fit:contain;" /></div>
          <div class="pm-info">
            <strong class="pm-name">Bank Transfer</strong>
            <span class="pm-desc">QR Ph &amp; InstaPay</span>
          </div>
        </div>

        <div class="pay-method-card ${selectedMethod === 'cash' ? 'active' : ''}" data-method="cash">
          <div class="pm-radio"><i class="fa-solid ${selectedMethod === 'cash' ? 'fa-circle-check' : 'fa-circle'}"></i></div>
          <div class="pm-icon pm-cash-icon"><i class="fa-solid fa-handshake"></i></div>
          <div class="pm-info">
            <strong class="pm-name">Via Meetup</strong>
            <span class="pm-desc">Pay Cash on Handover</span>
          </div>
        </div>
      </div>
      <select id="modalPaymentMethodSelect" class="clean-select" style="display:none;">
        <option value="card" ${selectedMethod === 'card' ? 'selected' : ''}>Card</option>
        <option value="gcash" ${selectedMethod === 'gcash' ? 'selected' : ''}>GCash</option>
        <option value="bank_qr" ${selectedMethod === 'bank_qr' ? 'selected' : ''}>Bank transfer</option>
        <option value="cash" ${selectedMethod === 'cash' ? 'selected' : ''}>Via meetup</option>
      </select>
    </div>

    <div id="payContent"></div>

    <button type="button" class="btn btn-primary btn-block" id="payBtn" style="margin-top:16px;">Confirm Payment of ${fmtMoney(payNow)}</button>
  `, false);

  const mClose = modal.querySelector('#mClose');
  if (mClose) mClose.addEventListener('click', closeModal);

  if (!isPayingBalance) {
    const structureSelect = modal.querySelector('#modalPayStructureSelect');
    if (structureSelect) {
      structureSelect.addEventListener('change', () => {
        selectedPct = Number(structureSelect.value);
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
            ? `Confirm Reservation via Meetup (${fmtMoney(payNow)})`
            : `Confirm Payment of ${fmtMoney(payNow)}`;
        }

        renderPaymentMethodContent();
      });

      // Bind interactive structure cards in customer modal
      modal.querySelectorAll('#modalPayStructureSelector .selector-opt-card').forEach(card => {
        card.addEventListener('click', () => {
          modal.querySelectorAll('#modalPayStructureSelector .selector-opt-card').forEach(c => {
            c.classList.remove('active');
            const ic = c.querySelector('.opt-radio i');
            if (ic) ic.className = 'fa-regular fa-circle';
          });
          card.classList.add('active');
          const activeIc = card.querySelector('.opt-radio i');
          if (activeIc) activeIc.className = 'fa-solid fa-circle-check';
          structureSelect.value = card.dataset.pct;
          structureSelect.dispatchEvent(new Event('change'));
        });
      });
    }
  }

  let modalProofDataUrl = null;

  function renderPaymentMethodContent() {
    const container = modal.querySelector('#payContent');
    const pBtn = modal.querySelector('#payBtn');
    if (!container) return;

    if (selectedMethod === 'cash') {
      container.innerHTML = `
        <div class="pay-detail-panel" style="text-align:center;">
          <div class="pay-detail-heading" style="text-align:center;">Via Meetup</div>
          <p style="font-size:0.82rem;color:var(--text-mid);margin:0 0 12px 0;line-height:1.45;">
            Pay in cash directly upon vehicle meetup / handover. No online payment required today.
          </p>
          <div style="background:var(--bg-surface);border:1px solid var(--accent-border);border-radius:8px;padding:12px 14px;text-align:left;font-size:0.8rem;color:var(--text-mid);">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span>Payable upon Meetup:</span>
              <strong style="color:var(--text-hi);">${fmtMoney(payNow)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span>Meetup Option:</span>
              <strong style="color:var(--text-hi);">Agreed Meetup / Delivery Location</strong>
            </div>
          </div>
        </div>
      `;
      if (pBtn) pBtn.textContent = `Confirm Reservation (Via Meetup)`;
    } else if (selectedMethod === 'gcash') {
      container.innerHTML = `
        <div class="pay-detail-panel" style="text-align:center;">
          <div class="pay-detail-heading" style="text-align:center;display:flex;align-items:center;justify-content:center;gap:8px;">
            <img src="assets/gcash-logo.webp" alt="GCash" style="width:24px;height:24px;border-radius:4px;object-fit:cover;" />
            Scan QR Code via GCash
          </div>
          <div class="pay-qr-wrap">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=GCASH-RENTAL-${b.id}-${payNow}" alt="GCash QR Code" />
          </div>
          <div class="pay-account-info">
            <div class="pay-account-name">RentFlow Vehicles Inc.</div>
            <div class="pay-account-num">Account: 0917 582 9140</div>
          </div>
          <div class="pay-amount-line">Amount to Pay: <strong>${fmtMoney(payNow)}</strong></div>
        </div>
        <div class="field" style="margin-top:12px;">
          <label style="font-weight:600;font-size:0.78rem;">Reference Number *</label>
          <input type="text" id="payRefNo" placeholder="Enter GCash reference number" value="${b.payment_ref && !b.payment_ref.startsWith('BK-') && !b.payment_ref.startsWith('CASH-') ? b.payment_ref : ''}" required />
        </div>
        <div class="field" style="margin-top:10px;">
          <label style="font-weight:600;font-size:0.78rem;">Proof of Payment (Screenshot) (Optional)</label>
          <div class="proof-upload-box" id="mProofDropzone">
            ${modalProofDataUrl ? `
              <div class="proof-preview-wrap">
                <img src="${modalProofDataUrl}" class="proof-preview-img" alt="Proof Preview" />
                <button type="button" class="proof-remove-btn" id="mRemoveProofBtn" title="Remove image"><i class="fa-solid fa-xmark"></i></button>
              </div>
              <div style="font-size:0.75rem;color:var(--text-hi);font-weight:600;">Proof of payment attached</div>
            ` : `
              <div style="font-size:0.82rem;font-weight:600;color:var(--text-hi);">Click or Drag Receipt Screenshot</div>
              <div style="font-size:0.72rem;color:var(--text-mid);margin-top:2px;">Supports JPG, PNG, or Screenshot</div>
            `}
            <input type="file" id="mProofInput" accept="image/*" style="display:none;" />
          </div>
        </div>
      `;
      if (pBtn) pBtn.textContent = `Submit Payment (${fmtMoney(payNow)})`;
    } else if (selectedMethod === 'bank_qr') {
      container.innerHTML = `
        <div class="pay-detail-panel" style="text-align:center;">
          <div class="pay-detail-heading" style="display:flex;align-items:center;justify-content:center;gap:8px;"><img src="assets/qrph-logo.png" alt="QR Ph" style="height:20px;object-fit:contain;" /><span>Scan via Banking App (QR Ph / InstaPay)</span></div>
          <div style="margin-bottom:12px;text-align:left;">
            <label style="font-size:0.74rem;font-weight:700;color:var(--text-mid);margin-bottom:6px;display:block;text-transform:uppercase;letter-spacing:0.04em;">Select Banking App:</label>
            <div class="bank-pill-group" id="custBankPillGroup">
              <button type="button" class="bank-pill active" data-bank="Maya"><i class="fa-solid fa-wallet"></i> Maya</button>
              <button type="button" class="bank-pill" data-bank="BDO"><i class="fa-solid fa-building-columns"></i> BDO</button>
              <button type="button" class="bank-pill" data-bank="BPI"><i class="fa-solid fa-building-columns"></i> BPI</button>
              <button type="button" class="bank-pill" data-bank="UnionBank"><i class="fa-solid fa-building-columns"></i> UnionBank</button>
              <button type="button" class="bank-pill" data-bank="Metrobank"><i class="fa-solid fa-building-columns"></i> Metrobank</button>
            </div>
            <select id="bankSelect" class="clean-select" style="display:none;">
              <option value="Maya" selected>Maya</option>
              <option value="BDO">BDO</option>
              <option value="BPI">BPI</option>
              <option value="UnionBank">UnionBank</option>
              <option value="Metrobank">Metrobank</option>
            </select>
          </div>
          <div class="pay-qr-wrap">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=INSTAPAY-RENTAL-${b.id}-${payNow}" alt="Bank QR Code" />
          </div>
          <div class="pay-account-info">
            <div class="pay-account-name">RentFlow Official Account</div>
            <div class="pay-account-num">Account: 0012 3456 8899</div>
          </div>
          <div class="pay-amount-line">Amount to Pay: <strong>${fmtMoney(payNow)}</strong></div>
        </div>
        <div class="field" style="margin-top:12px;">
          <label style="font-weight:600;font-size:0.78rem;">Bank Reference / Transaction ID *</label>
          <input type="text" id="payRefNo" placeholder="Enter bank transaction ID" value="${b.payment_ref && !b.payment_ref.startsWith('BK-') && !b.payment_ref.startsWith('CASH-') ? b.payment_ref : ''}" required />
        </div>
        <div class="field" style="margin-top:10px;">
          <label style="font-weight:600;font-size:0.78rem;">Proof of Payment (Screenshot) (Optional)</label>
          <div class="proof-upload-box" id="mProofDropzone">
            ${modalProofDataUrl ? `
              <div class="proof-preview-wrap">
                <img src="${modalProofDataUrl}" class="proof-preview-img" alt="Proof Preview" />
                <button type="button" class="proof-remove-btn" id="mRemoveProofBtn" title="Remove image"><i class="fa-solid fa-xmark"></i></button>
              </div>
              <div style="font-size:0.75rem;color:var(--text-hi);font-weight:600;">Proof of payment attached</div>
            ` : `
              <div style="font-size:0.82rem;font-weight:600;color:var(--text-hi);">Click or Drag Bank Receipt Screenshot</div>
              <div style="font-size:0.72rem;color:var(--text-mid);margin-top:2px;">Supports JPG, PNG, or Screenshot</div>
            `}
            <input type="file" id="mProofInput" accept="image/*" style="display:none;" />
          </div>
        </div>
      `;
      if (pBtn) pBtn.textContent = `Submit Payment (${fmtMoney(payNow)})`;

      const bSelect = container.querySelector('#bankSelect');
      container.querySelectorAll('.bank-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          container.querySelectorAll('.bank-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (bSelect) bSelect.value = btn.dataset.bank;
        });
      });
    } else {
      container.innerHTML = `
        <div class="pay-detail-panel">
          <div class="pay-detail-heading">Card Information</div>
          <div class="field" style="margin-bottom:8px;">
            <label>Cardholder Name</label>
            <input type="text" id="visaName" value="${b.customer_name || state.profile?.full_name || ''}" placeholder="Name on Card" required />
          </div>
          <div class="field" style="margin-bottom:8px;">
            <label>Card Number</label>
            <input type="text" id="visaNumber" placeholder="4xxx •••• •••• xxxx" maxlength="19" required />
          </div>
          <div class="detail-grid" style="gap:10px;">
            <div class="field">
              <label>Expiry Date</label>
              <input type="text" id="visaExp" placeholder="MM/YY" maxlength="5" required />
            </div>
            <div class="field">
              <label>CVV / CVC</label>
              <input type="password" id="visaCvv" placeholder="•••" maxlength="4" required />
            </div>
          </div>
        </div>
      `;
      if (pBtn) pBtn.textContent = `Submit Payment (${fmtMoney(payNow)})`;
    }

    // Attach listeners for proof upload
    const dropzone = container.querySelector('#mProofDropzone');
    const fileInput = container.querySelector('#mProofInput');
    const removeBtn = container.querySelector('#mRemoveProofBtn');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', (e) => {
        if (e.target !== removeBtn && !e.target.closest('#mRemoveProofBtn')) {
          fileInput.click();
        }
      });
      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleModalProof(e.dataTransfer.files[0]);
        }
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleModalProof(e.target.files[0]);
        }
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modalProofDataUrl = null;
        renderPaymentMethodContent();
      });
    }
  }

  function handleModalProof(file) {
    if (!file.type.startsWith('image/')) {
      toast('Please upload an image file (JPG, PNG, Screenshot).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      modalProofDataUrl = e.target.result;
      toast('Proof of payment attached!', 'success');
      renderPaymentMethodContent();
    };
    reader.readAsDataURL(file);
  }

  const methodSelect = modal.querySelector('#modalPaymentMethodSelect');
  if (methodSelect) {
    methodSelect.value = selectedMethod === 'visa' || selectedMethod === 'mastercard' || selectedMethod === 'applepay' ? 'card' : selectedMethod;
    selectedMethod = methodSelect.value;
    methodSelect.addEventListener('change', () => {
      selectedMethod = methodSelect.value;
      renderPaymentMethodContent();
    });

    // Bind interactive payment method cards in customer modal
    modal.querySelectorAll('#modalPaymentMethodGrid .pay-method-card').forEach(card => {
      card.addEventListener('click', () => {
        modal.querySelectorAll('#modalPaymentMethodGrid .pay-method-card').forEach(c => {
          c.classList.remove('active');
          const ic = c.querySelector('.pm-radio i');
          if (ic) ic.className = 'fa-regular fa-circle';
        });
        card.classList.add('active');
        const activeIc = card.querySelector('.pm-radio i');
        if (activeIc) activeIc.className = 'fa-solid fa-circle-check';
        methodSelect.value = card.dataset.method;
        methodSelect.dispatchEvent(new Event('change'));
      });
    });
  }

  renderPaymentMethodContent();

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
      payBtn.textContent = selectedMethod === 'cash' ? 'Confirming Meetup Reservation…' : 'Submitting Payment…';

      const methodName = selectedMethod === 'cash' ? 'Via Meetup'
        : selectedMethod === 'gcash' ? 'GCash'
        : selectedMethod === 'bank_qr' ? 'Bank Transfer (QR Ph)'
        : 'Card';

      const newTotalPaid = selectedMethod === 'cash' ? currentPaid : (currentPaid + payNow);
      const newBalance = selectedMethod === 'cash' ? (totalAmount - currentPaid) : Math.max(0, totalAmount - newTotalPaid);
      const newPaymentType = newBalance === 0 ? 'full' : 'partial';
      const finalRefNo = selectedMethod === 'cash' ? `CASH-${bookingId}-${Date.now().toString().slice(-4)}`
        : selectedMethod === 'card' ? `CARD-${Date.now().toString().slice(-6)}`
        : (refNo || `RCPT-${bookingId}`);

      // Determine target reservation and payment status
      let targetStatus = 'pending_verification';
      let targetPaymentStatus = 'pending_verification';

      if (selectedMethod === 'cash') {
        targetStatus = 'cash_on_pickup';
        targetPaymentStatus = 'unpaid';
      } else if (selectedMethod === 'gcash' || selectedMethod === 'bank_qr') {
        targetStatus = 'pending_verification';
        targetPaymentStatus = 'pending_verification';
      } else {
        targetStatus = 'confirmed';
        targetPaymentStatus = 'verified';
      }

      const updatePayload = {
        status: targetStatus,
        payment_status: targetPaymentStatus,
        paid_amount: newTotalPaid,
        balance_due: newBalance,
        payment_type: newPaymentType,
        downpayment_percent: selectedPct,
        ref_number: finalRefNo,
        payment_ref: finalRefNo,
        receipt_no: finalRefNo,
        payment_method: methodName,
        proof_image: modalProofDataUrl || b.proof_image || null,
        review_notes: selectedMethod === 'cash' ? 'Via Meetup selected. Pay upon meetup / handover.' : (selectedMethod === 'gcash' || selectedMethod === 'bank_qr' ? 'Payment submitted with reference number. Awaiting staff review.' : 'Payment authorized and verified.')
      };

      // Update local storage booking immediately
      updateLocalBookingStatus(bookingId, targetStatus, updatePayload);

      // Update in-memory booking
      if (b) {
        Object.assign(b, updatePayload);
      }

      // If DB booking, save to Supabase
      if (!isNaN(Number(bookingId))) {
        try {
          await supabase.from('payments').insert({
            booking_id: Number(bookingId),
            amount: payNow,
            status: targetPaymentStatus === 'verified' ? 'successful' : 'pending',
            method: methodName,
            paid_at: new Date().toISOString(),
          });
          const dbBookingStatus = targetStatus === 'confirmed' ? 'approved' : 'pending';
          await supabase.from('bookings').update({
            status: dbBookingStatus,
            paid_amount: newTotalPaid,
            balance_due: newBalance,
            payment_type: newPaymentType,
            downpayment_percent: selectedPct
          }).eq('id', Number(bookingId));
        } catch (e) {
          console.warn('DB payment update notice:', e);
        }
      }

      // Broadcast live to staff and admin dashboards
      broadcastBookingStatusChange(bookingId, targetStatus);

      if (targetStatus === 'pending_verification') {
        toast(`Payment submitted! Reference #${finalRefNo}. Reservation status is now Pending Verification.`, 'success');
      } else if (targetStatus === 'cash_on_pickup') {
        toast(`Reservation confirmed! Status: Cash on Pickup. Pay cash upon vehicle meetup.`, 'success');
      } else {
        toast(`Payment verified via ${methodName}! Reservation confirmed, vehicle is ready for release.`, 'success');
      }

      closeModal();
      await loadVehicles();
      if (targetStatus === 'confirmed') {
        await openPaidReceiptModal(bookingId, methodName, finalRefNo);
      }
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
  b.ref_number = refCode;
  b.payment_ref = refCode;
  updateLocalBookingStatus(b.id, b.status || 'active', { ref_number: refCode, payment_ref: refCode });
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
    <div class="clean-receipt-modal">
      <div class="clean-receipt-header">
        <div class="clean-receipt-brand">
          <span class="brand-pill">Vehicle Rental System</span>
          <h2 class="clean-receipt-title">Booking Confirmation &amp; Digital Pass</h2>
          <span class="clean-receipt-ref">Reference Code: <strong>${refCode}</strong></span>
        </div>
        <button type="button" class="modal-close" id="mClose" onclick="window.closeModal && window.closeModal()" aria-label="Close Receipt">&times;</button>
      </div>

      <div class="clean-receipt-status ${isFullPaid ? 'is-paid' : 'is-partial'}">
        <div class="status-icon-circle">
          <i class="fa-solid fa-${isFullPaid ? 'circle-check' : 'clock-rotate-left'}"></i>
        </div>
        <div class="status-content">
          <div class="status-title">${isFullPaid ? 'Payment Verified &amp; Confirmed' : (payMethod.includes('Cash') ? 'Reservation Confirmed (Pay on Pickup)' : `Downpayment (${b.downpayment_percent || 20}%) Confirmed`)}</div>
          <div class="status-subtitle">Payment Method: ${payMethod} &bull; Issued: ${fmtDate(b.created_at || new Date())}</div>
        </div>
      </div>

      <div class="clean-receipt-body-grid">
        <!-- Digital QR Pass Card -->
        <div class="clean-pass-card">
          <div class="pass-header-tag">
            <i class="fa-solid fa-qrcode"></i> Express Venue Pass
          </div>
          <div class="pass-qr-frame">
            <img src="${qrImageUrl}" alt="Venue QR Pass" class="pass-qr-image" />
          </div>
          <div class="pass-code-display">${refCode}</div>
          <p class="pass-instruction">
            Present this QR pass upon vehicle collection at <strong>${comp.address || '123 PPC Main Branch Venue'}</strong>.
          </p>
        </div>

        <!-- Reservation & Payment Details -->
        <div class="clean-details-card">
          <div class="details-section-heading">Reservation Details</div>
          <div class="details-row"><span class="d-label">Vehicle</span><strong class="d-val">${vehicleName}</strong></div>
          <div class="details-row"><span class="d-label">Category &amp; Plate</span><span class="d-val">${categoryName} &bull; ${plateNo}</span></div>
          <div class="details-row"><span class="d-label">Rental Schedule</span><span class="d-val">${fmtDate(b.start_date)} &rarr; ${fmtDate(b.end_date)} (${days} day${days > 1 ? 's' : ''})</span></div>
          <div class="details-row"><span class="d-label">Renter Name</span><span class="d-val">${customerName} (${customerPhone})</span></div>

          <div class="details-separator"></div>

          <div class="details-section-heading">Payment Summary</div>
          <div class="details-row"><span class="d-label">Total Rental Cost</span><strong class="d-val">PHP ${fmtMoney(b.total_amount)}</strong></div>
          <div class="details-row"><span class="d-label">Amount Paid</span><strong class="d-val" style="color:#059669;">PHP ${fmtMoney(paidAmount)}</strong></div>
          ${!isFullPaid && balDue > 0 ? `
            <div class="details-row balance-highlight-row">
              <span class="d-label">Remaining Balance Due at Pickup</span>
              <strong class="d-val" style="color:var(--accent, #5B4B8A);">PHP ${fmtMoney(balDue)}</strong>
            </div>
          ` : `
            <div class="details-row">
              <span class="d-label">Payment Status</span>
              <strong class="d-val" style="color:#059669;">Paid in Full (PHP 0.00 Due)</strong>
            </div>
          `}
        </div>
      </div>

      <div class="clean-receipt-actions">
        <button type="button" class="btn btn-ghost" id="printPaidReceiptBtn" onclick="window.print()">
          <i class="fa-solid fa-print"></i> Print Receipt
        </button>
        <button type="button" class="btn btn-primary" id="closePaidReceiptBtn" onclick="window.closeModal && window.closeModal()">
          Done &amp; View Bookings
        </button>
      </div>
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
        <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-hi);">Request Refund</h3>
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
      <div class="field" style="margin-bottom:14px;">
        <label>Refund Transfer Method</label>
        <div class="refund-method-pills" id="refMethodPills">
          <button type="button" class="bank-pill active" data-ref="GCash"><img src="assets/gcash-logo.webp" alt="GCash" style="width:16px;height:16px;border-radius:3px;vertical-align:middle;object-fit:cover;margin-right:4px;" /> GCash</button>
          <button type="button" class="bank-pill" data-ref="Maya"><i class="fa-solid fa-wallet"></i> Maya</button>
          <button type="button" class="bank-pill" data-ref="BDO"><i class="fa-solid fa-building-columns"></i> BDO</button>
          <button type="button" class="bank-pill" data-ref="BPI"><i class="fa-solid fa-building-columns"></i> BPI</button>
          <button type="button" class="bank-pill" data-ref="UnionBank"><i class="fa-solid fa-building-columns"></i> UnionBank</button>
          <button type="button" class="bank-pill" data-ref="Cash"><i class="fa-solid fa-money-bill-wave"></i> Office Cash</button>
        </div>
        <select id="refMethod" style="display:none;">
          <option value="GCash" selected>GCash</option>
          <option value="Maya">Maya</option>
          <option value="BDO">BDO</option>
          <option value="BPI">BPI</option>
          <option value="UnionBank">UnionBank</option>
          <option value="Cash">Cash</option>
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

    // Bind refund method pills
  const refMethodSelect = $('#refMethod');
  $$('#refMethodPills .bank-pill', modal).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      $$('#refMethodPills .bank-pill', modal).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (refMethodSelect) refMethodSelect.value = btn.dataset.ref;
    });
  });

  $('#refundReqForm')?.addEventListener('submit', async (e) => {
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
      <div style="font-weight:700;font-size:0.9rem;color:var(--text-mid);">Official Refund &amp; Disbursement Voucher</div>
      <div class="modal-close" onclick="window.closeModal()">Close</div>
    </div>
    <div style="text-align:center;margin-bottom:18px;">
      <h2 style="font-size:1.35rem;font-weight:800;color:var(--text-hi);margin-bottom:4px;">Refund Disbursed Successfully</h2>
      <span class="badge badge-refunded" style="font-size:0.75rem;">Transfer Completed</span>
      <p class="muted" style="margin-top:8px;font-size:0.82rem;color:var(--text-mid);">Voucher / Claim No: <strong style="color:var(--text-hi);font-family:monospace;">${refCode}</strong></p>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:var(--text-hi);font-size:0.9rem;">Beneficiary Details</h4>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;">
      <div class="receipt-row"><span style="color:var(--text-mid);">Customer Name</span><span style="font-weight:700;color:var(--text-hi);">${cName}</span></div>
      <div class="receipt-row"><span style="color:var(--text-mid);">Phone Number</span><span style="color:var(--text-hi);">${cPhone}</span></div>
      <div class="receipt-row"><span style="color:var(--text-mid);">Vehicle</span><span style="font-weight:700;color:var(--text-hi);">${v.name ?? 'Vehicle'}</span></div>
      <div class="receipt-row"><span style="color:var(--text-mid);">Rental Dates</span><span style="color:var(--text-hi);">${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</span></div>
      ${b.review_notes ? `<div class="receipt-row" style="flex-direction:column;align-items:flex-start;gap:4px;margin-top:4px;"><span style="color:var(--text-mid);">Refund Transfer Notes</span><span style="color:#b45309;font-weight:600;">${b.review_notes}</span></div>` : ''}
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:var(--text-hi);font-size:0.9rem;">Financial Summary</h4>
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
