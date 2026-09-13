import { supabase } from './config.js';
import { state, DEFAULT_SETTINGS, getSystemSettings, saveSystemSettings, getPromoCodes, savePromoCodes, getLocalBookings, updateLocalBookingStatus } from './state.js';
import { $, $$, fmtMoney, fmtDate, maskPlate, toast, openModal, closeModal, emptyState, getRoleDisplayName, applyTheme } from './utils.js';
import { getExactVehicleImage, getVehicleDailyRate, setVehicleCustomRate, getVehicleCategoryName, loadVehicles, loadCategories, PH_CATEGORIES } from './vehicles.js';
import { openRefundVoucherModal } from './customer.js';

export async function renderStaff(tab, view) {
  if (tab === 'dashboard') return renderStaffDashboard(view);
  if (tab === 'requests') return renderStaffRequests(view);
  if (tab === 'active') return renderStaffActive(view);
  if (tab === 'returns') return renderStaffReturns(view);
  if (tab === 'refunds') return renderStaffRefunds(view);
  if (tab === 'history') return renderStaffHistory(view);
}

export async function renderStaffDashboard(view) {
  const bookings = await fetchMergedBookings();
  const todayStr = new Date().toISOString().slice(0, 10);

  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const activeBookings = bookings.filter(b => b.status === 'active');
  const approvedBookings = bookings.filter(b => b.status === 'approved');
  const todayReturns = bookings.filter(b => b.status === 'active' && b.end_date <= todayStr);
  const refundClaims = bookings.filter(b => b.status === 'refund_requested');

  const totalVehicles = state.vehicles.length;
  const availableVehicles = state.vehicles.filter(v => v.status === 'available').length;
  const rentedVehicles = state.vehicles.filter(v => v.status === 'rented').length;
  const maintenanceVehicles = state.vehicles.filter(v => v.status === 'maintenance').length;

  view.innerHTML = `
    <div class="view">
      <div class="section-head" style="margin-bottom:20px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <h2 style="margin:0;font-size:1.4rem;font-weight:800;color:#0f172a;">Operations Dashboard</h2>
            <span class="badge" style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;font-size:0.75rem;padding:3px 8px;">
              <i class="fa-solid fa-circle" style="font-size:0.5rem;margin-right:4px;"></i> Live Operations
            </span>
          </div>
          <p style="color:#64748b;font-size:0.85rem;margin:0;">
            Manager: <strong>${state.profile?.full_name || 'Sarah Manager'}</strong> · Real-time booking queue, dispatches, returns, and fleet status.
          </p>
        </div>
      </div>

      <!-- Quick Metrics Bar -->
      <div class="grid grid-stats" style="margin-bottom:24px;">
        <div class="glass stat-card" style="border-left:4px solid #f59e0b;cursor:pointer;" id="cardPendingReqs" title="Click to view pending requests">
          <div class="stat-label" style="display:flex;align-items:center;justify-content:space-between;">
            <span>Pending Approvals</span>
            <i class="fa-solid fa-clipboard-question" style="color:#f59e0b;"></i>
          </div>
          <div class="stat-value" style="color:#d97706;display:flex;align-items:baseline;gap:8px;">
            ${pendingBookings.length}
            ${pendingBookings.length > 0 ? `<span class="badge badge-pending" style="font-size:0.7rem;animation:pulse 2s infinite;">Action Required</span>` : ''}
          </div>
          <div class="stat-sub">Incoming reservation requests</div>
        </div>

        <div class="glass stat-card" style="border-left:4px solid #2563eb;cursor:pointer;" id="cardActiveRentals" title="Click to view active rentals">
          <div class="stat-label" style="display:flex;align-items:center;justify-content:space-between;">
            <span>Active Rentals</span>
            <i class="fa-solid fa-key" style="color:#2563eb;"></i>
          </div>
          <div class="stat-value" style="color:#2563eb;">${activeBookings.length}</div>
          <div class="stat-sub">Vehicles currently on the road</div>
        </div>

        <div class="glass stat-card" style="border-left:4px solid #059669;cursor:pointer;" id="cardReturnsDue" title="Click to process returns">
          <div class="stat-label" style="display:flex;align-items:center;justify-content:space-between;">
            <span>Returns Due</span>
            <i class="fa-solid fa-rotate-left" style="color:#059669;"></i>
          </div>
          <div class="stat-value" style="color:#059669;">${todayReturns.length || activeBookings.length}</div>
          <div class="stat-sub">Scheduled check-ins</div>
        </div>

        <div class="glass stat-card" style="border-left:4px solid #7c3aed;">
          <div class="stat-label" style="display:flex;align-items:center;justify-content:space-between;">
            <span>Fleet Availability</span>
            <i class="fa-solid fa-car" style="color:#7c3aed;"></i>
          </div>
          <div class="stat-value" style="color:#7c3aed;">${availableVehicles} <span style="font-size:0.85rem;color:#64748b;font-weight:500;">/ ${totalVehicles}</span></div>
          <div class="stat-sub">${rentedVehicles} Rented · ${maintenanceVehicles} Service</div>
        </div>
      </div>

      <!-- Quick Action Shortcuts -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:24px;">
        <button type="button" class="btn btn-ghost" id="quickNavRequests" style="justify-content:flex-start;background:#fff;border:1px solid #e2e8f0;padding:12px 14px;border-radius:12px;">
          <div style="width:36px;height:36px;border-radius:10px;background:#fef3c7;display:flex;align-items:center;justify-content:center;margin-right:10px;">
            <i class="fa-solid fa-clipboard-check" style="color:#d97706;font-size:1.1rem;"></i>
          </div>
          <div style="text-align:left;">
            <div style="font-weight:700;font-size:0.88rem;color:#0f172a;">Review Requests</div>
            <div style="font-size:0.75rem;color:#64748b;">${pendingBookings.length} pending review</div>
          </div>
        </button>

        <button type="button" class="btn btn-ghost" id="quickNavActive" style="justify-content:flex-start;background:#fff;border:1px solid #e2e8f0;padding:12px 14px;border-radius:12px;">
          <div style="width:36px;height:36px;border-radius:10px;background:#dbeafe;display:flex;align-items:center;justify-content:center;margin-right:10px;">
            <i class="fa-solid fa-wallet" style="color:#2563eb;font-size:1.1rem;"></i>
          </div>
          <div style="text-align:left;">
            <div style="font-weight:700;font-size:0.88rem;color:#0f172a;">Collect Balance</div>
            <div style="font-size:0.75rem;color:#64748b;">Pickup balance collection</div>
          </div>
        </button>

        <button type="button" class="btn btn-ghost" id="quickNavReturns" style="justify-content:flex-start;background:#fff;border:1px solid #e2e8f0;padding:12px 14px;border-radius:12px;">
          <div style="width:36px;height:36px;border-radius:10px;background:#dcfce7;display:flex;align-items:center;justify-content:center;margin-right:10px;">
            <i class="fa-solid fa-rotate-left" style="color:#059669;font-size:1.1rem;"></i>
          </div>
          <div style="text-align:left;">
            <div style="font-weight:700;font-size:0.88rem;color:#0f172a;">Process Return</div>
            <div style="font-size:0.75rem;color:#64748b;">Inspect &amp; release deposits</div>
          </div>
        </button>

        <button type="button" class="btn btn-ghost" id="quickNavRefunds" style="justify-content:flex-start;background:#fff;border:1px solid #e2e8f0;padding:12px 14px;border-radius:12px;">
          <div style="width:36px;height:36px;border-radius:10px;background:#f3e8ff;display:flex;align-items:center;justify-content:center;margin-right:10px;">
            <i class="fa-solid fa-hand-holding-dollar" style="color:#7c3aed;font-size:1.1rem;"></i>
          </div>
          <div style="text-align:left;">
            <div style="font-weight:700;font-size:0.88rem;color:#0f172a;">Refund Claims</div>
            <div style="font-size:0.75rem;color:#64748b;">${refundClaims.length} pending transfer</div>
          </div>
        </button>
      </div>

      <!-- Main Operations Grid: Urgent Requests & Fleet Status -->
      <div class="grid grid-2" style="gap:20px;margin-bottom:24px;">
        <!-- Priority Booking Approval Queue -->
        <div class="glass card" style="padding:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <h3 style="font-size:1rem;font-weight:800;color:#0f172a;margin:0;display:flex;align-items:center;gap:8px;">
              <i class="fa-solid fa-bell" style="color:#f59e0b;"></i> Incoming Priority Requests
            </h3>
            <span class="badge ${pendingBookings.length > 0 ? 'badge-pending' : 'badge-available'}">
              ${pendingBookings.length} waiting
            </span>
          </div>

          <div style="display:flex;flex-direction:column;gap:12px;">
            ${pendingBookings.length ? pendingBookings.slice(0, 4).map(b => {
              const cName = getBookingCustomerName(b);
              const cPhone = getBookingCustomerPhone(b);
              const v = b.vehicles || {};
              return `
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:800;font-size:0.92rem;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      ${v.name || 'Vehicle'} <span class="muted" style="font-size:0.75rem;">(${v.plate_number || 'N/A'})</span>
                    </div>
                    <div style="font-size:0.8rem;color:#2563eb;font-weight:700;margin-top:2px;">
                      <i class="fa-solid fa-user" style="font-size:0.72rem;margin-right:3px;"></i> ${cName} ${cPhone ? `<span style="color:#64748b;font-weight:400;">(${cPhone})</span>` : ''}
                    </div>
                    <div style="font-size:0.76rem;color:#64748b;margin-top:2px;">
                      <i class="fa-solid fa-calendar" style="margin-right:3px;"></i> ${fmtDate(b.start_date)} → ${fmtDate(b.end_date)} · <strong style="color:#059669;">${fmtMoney(b.total_amount)}</strong>
                    </div>
                  </div>
                  <div style="display:flex;gap:6px;flex-shrink:0;">
                    <button type="button" class="btn btn-primary btn-sm" data-dash-approve="${b.id}" style="padding:6px 12px;font-size:0.78rem;">
                      <i class="fa-solid fa-check"></i> Approve
                    </button>
                    <button type="button" class="btn btn-danger btn-sm" data-dash-reject="${b.id}" style="padding:6px 10px;font-size:0.78rem;">
                      Reject
                    </button>
                  </div>
                </div>
              `;
            }).join('') : `
              <div class="empty-box" style="padding:28px 14px;">
                <div class="empty-icon"><i class="fa-solid fa-clipboard-check" style="font-size:2rem;color:#059669;"></i></div>
                <div style="font-weight:700;color:#0f172a;margin-top:6px;">All Booking Requests Processed</div>
                <p style="font-size:0.8rem;color:#64748b;margin:4px 0 0 0;">New customer booking requests will appear here in real-time.</p>
              </div>
            `}
          </div>
        </div>

        <!-- Fleet Status Breakdown & Live Operations -->
        <div class="glass card" style="padding:20px;">
          <h3 style="font-size:1rem;font-weight:800;color:#0f172a;margin:0 0 14px 0;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-car-side" style="color:#2563eb;"></i> Fleet Operations Status
          </h3>

          <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:18px;">
            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.82rem;font-weight:700;margin-bottom:4px;">
                <span style="color:#059669;"><i class="fa-solid fa-circle-check"></i> Ready &amp; Available</span>
                <span style="color:#0f172a;">${availableVehicles} of ${totalVehicles} units</span>
              </div>
              <div style="width:100%;height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden;">
                <div style="width:${totalVehicles > 0 ? (availableVehicles / totalVehicles) * 100 : 0}%;height:100%;background:#059669;border-radius:99px;"></div>
              </div>
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.82rem;font-weight:700;margin-bottom:4px;">
                <span style="color:#2563eb;"><i class="fa-solid fa-road"></i> Rented On Road</span>
                <span style="color:#0f172a;">${rentedVehicles} units</span>
              </div>
              <div style="width:100%;height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden;">
                <div style="width:${totalVehicles > 0 ? (rentedVehicles / totalVehicles) * 100 : 0}%;height:100%;background:#2563eb;border-radius:99px;"></div>
              </div>
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.82rem;font-weight:700;margin-bottom:4px;">
                <span style="color:#d97706;"><i class="fa-solid fa-wrench"></i> Periodic Maintenance</span>
                <span style="color:#0f172a;">${maintenanceVehicles} units</span>
              </div>
              <div style="width:100%;height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden;">
                <div style="width:${totalVehicles > 0 ? (maintenanceVehicles / totalVehicles) * 100 : 0}%;height:100%;background:#d97706;border-radius:99px;"></div>
              </div>
            </div>
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
            <div style="font-size:0.8rem;font-weight:800;color:#475569;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.03em;">
              Shift Manager Checklist
            </div>
            <div style="font-size:0.8rem;color:#334155;display:flex;flex-direction:column;gap:6px;">
              <div><i class="fa-solid fa-check" style="color:#059669;margin-right:6px;"></i> Inspect incoming vehicles before refunding deposit.</div>
              <div><i class="fa-solid fa-check" style="color:#059669;margin-right:6px;"></i> Validate customer license ID at meetup release.</div>
              <div><i class="fa-solid fa-check" style="color:#059669;margin-right:6px;"></i> Collect remaining balance prior to vehicle handover.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Rental Operations Feed -->
      <div class="glass card" style="padding:20px;">
        <h3 style="font-size:1rem;font-weight:800;color:#0f172a;margin:0 0 14px 0;">
          <i class="fa-solid fa-clock-rotate-left" style="color:#64748b;"></i> Recent Rental Operations Feed
        </h3>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${bookings.slice(0, 6).map(b => {
            const cName = getBookingCustomerName(b);
            const vName = b.vehicles?.name || 'Vehicle';
            return `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-size:0.84rem;">
                <div>
                  <strong style="color:#0f172a;">${cName}</strong>
                  <span style="color:#64748b;">— booked ${vName}</span>
                  <div style="font-size:0.75rem;color:#94a3b8;margin-top:2px;">
                    ${fmtDate(b.start_date)} to ${fmtDate(b.end_date)} · <strong style="color:#059669;">${fmtMoney(b.total_amount)}</strong>
                  </div>
                </div>
                <span class="badge badge-${b.status}">${b.status.replace('_', ' ')}</span>
              </div>
            `;
          }).join('') || emptyState('fa-regular fa-file-lines', 'No recent operations activity.')}
        </div>
      </div>
    </div>
  `;

  // Bind Quick Navigation Buttons
  const navReq = $('#quickNavRequests');
  if (navReq) navReq.addEventListener('click', () => { state.tab = 'requests'; window.renderShell(); });
  const cardReq = $('#cardPendingReqs');
  if (cardReq) cardReq.addEventListener('click', () => { state.tab = 'requests'; window.renderShell(); });

  const navAct = $('#quickNavActive');
  if (navAct) navAct.addEventListener('click', () => { state.tab = 'active'; window.renderShell(); });
  const cardAct = $('#cardActiveRentals');
  if (cardAct) cardAct.addEventListener('click', () => { state.tab = 'active'; window.renderShell(); });

  const navRet = $('#quickNavReturns');
  if (navRet) navRet.addEventListener('click', () => { state.tab = 'returns'; window.renderShell(); });
  const cardRet = $('#cardReturnsDue');
  if (cardRet) cardRet.addEventListener('click', () => { state.tab = 'returns'; window.renderShell(); });

  const navRef = $('#quickNavRefunds');
  if (navRef) navRef.addEventListener('click', () => { state.tab = 'refunds'; window.renderShell(); });

  // Bind Approve and Reject buttons right on the dashboard
  $$('[data-dash-approve]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.dashApprove;
    btn.disabled = true;
    updateLocalBookingStatus(id, 'approved');
    try {
      await supabase.from('bookings').update({ status: 'approved', reviewed_by: state.user.id }).eq('id', id);
    } catch (e) {}
    toast('Booking approved right from Operations Dashboard!', 'success');
    renderStaffDashboard(view);
  }));

  $$('[data-dash-reject]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.dashReject;
    const reason = prompt('Reason for rejecting this request:', 'Vehicle unavailable for requested dates.');
    if (reason === null) return;
    updateLocalBookingStatus(id, 'rejected', { review_notes: reason });
    try {
      await supabase.from('bookings').update({ status: 'rejected', reviewed_by: state.user.id, review_notes: reason }).eq('id', id);
    } catch (e) {}
    toast('Booking rejected.', 'info');
    renderStaffDashboard(view);
  }));
}

export async function fetchMergedBookings(filterFn = null) {
  let dbBookings = [];
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, vehicles(name, plate_number, status, current_odometer), profiles!customer_id(full_name, phone), payments(amount, status, method)')
      .order('created_at', { ascending: false });
    if (!error && data) dbBookings = data;
  } catch (e) {
    console.warn('DB bookings load notice:', e);
  }

  const localBookings = getLocalBookings();
  const dbIds = new Set(dbBookings.map(b => String(b.id)));
  const merged = [...dbBookings];

  for (const lb of localBookings) {
    if (!dbIds.has(String(lb.id))) {
      merged.push({
        ...lb,
        profiles: lb.profiles || {
          full_name: lb.customer_name || 'Guest Customer',
          phone: lb.customer_phone || ''
        },
        vehicles: lb.vehicles || state.vehicles?.find(v => v.id === lb.vehicle_id) || { name: 'Vehicle', plate_number: 'N/A' },
        payments: lb.paid_amount > 0 ? [{ amount: lb.paid_amount, status: 'successful', method: 'Online Payment' }] : []
      });
    }
  }

  merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  return filterFn ? merged.filter(filterFn) : merged;
}

export async function renderStaffRefunds(view) {
  const allBookings = await fetchMergedBookings();
  const bookings = allBookings.filter(b =>
    ['refund_requested', 'refunded'].includes(b.status) ||
    (b.review_notes && b.review_notes.includes('REFUND REQUESTED'))
  );

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2>Refunds &amp; Claims</h2>
          <p>Review customer refund claims and disburse digital transfers.</p>
        </div>
      </div>
      <div class="row-list">
        ${bookings.length ? bookings.map(b => `
          <div class="glass item-row">
            <div class="item-main">
              <div class="item-title">${b.vehicles?.name ?? 'Vehicle'} <span class="muted">(${maskPlate(b.vehicles?.plate_number ?? '')})</span></div>
              <div class="item-sub">Customer: <strong>${getBookingCustomerName(b)}</strong> ${getBookingCustomerPhone(b) ? '· ' + getBookingCustomerPhone(b) : ''}</div>
              <div class="item-sub">${fmtDate(b.start_date)} → ${fmtDate(b.end_date)} · <strong style="color:#059669;">${fmtMoney(b.total_amount)}</strong></div>
              ${b.review_notes ? `<div class="item-sub" style="color:#b45309;margin-top:4px;font-size:0.8rem;"><i class="fa-solid fa-comment-dots"></i> ${b.review_notes}</div>` : ''}
            </div>
            <span class="badge badge-${b.status}">${b.status.replace('_', ' ')}</span>
            <div class="item-actions">
              ${b.status === 'refund_requested' ? `
                <button class="btn btn-primary btn-sm" data-disburse-id="${b.id}"><i class="fa-solid fa-hand-holding-dollar"></i> Disburse Refund</button>
              ` : `
                <button class="btn btn-ghost btn-sm" data-refund-voucher-id="${b.id}"><i class="fa-solid fa-receipt"></i> Voucher</button>
              `}
            </div>
          </div>
        `).join('') : emptyState('fa-solid fa-hand-holding-dollar', 'No active refund requests.')}
      </div>
    </div>
  `;

  $$('[data-disburse-id]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.disburseId;
    if (!confirm('Confirm disbursement of this refund to the customer?')) return;

    btn.disabled = true;
    btn.textContent = 'Processing…';

    updateLocalBookingStatus(id, 'refunded');

    try {
      await supabase.from('bookings').update({
        status: 'refunded',
        reviewed_by: state.user.id,
      }).eq('id', id);
    } catch (e) {
      console.warn('DB disburse notice:', e);
    }

    toast('Refund disbursed successfully!', 'success');
    await openRefundVoucherModal(id);
    if (window.renderTab) window.renderTab();
  }));

  $$('[data-refund-voucher-id]').forEach(btn => btn.addEventListener('click', () => openRefundVoucherModal(btn.dataset.refundVoucherId)));
}

export function getBookingCustomerName(b) {
  if (b.customer_name) return b.customer_name;
  if (b.profiles?.full_name && b.profiles.full_name !== 'Customer') return b.profiles.full_name;
  if (b.review_notes) {
    const m = b.review_notes.match(/Contact:\s*([^|(]+)/);
    if (m && m[1]) return m[1].trim();
  }
  return b.profiles?.full_name || 'Online Guest Customer';
}

export function getBookingCustomerPhone(b) {
  if (b.customer_phone) return b.customer_phone;
  if (b.profiles?.phone) return b.profiles.phone;
  if (b.review_notes) {
    const m = b.review_notes.match(/\(([^,)]+)/);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

export async function renderStaffRequests(view) {
  const bookings = await fetchMergedBookings(b => b.status === 'pending');

  view.innerHTML = `
    <div class="view">
      <div class="section-head"><div><h2>Booking Requests</h2><p>Review requirements and approve or reject incoming requests.</p></div></div>
      <div class="row-list">
        ${bookings.length ? bookings.map(b => {
    const cName = getBookingCustomerName(b);
    const cPhone = getBookingCustomerPhone(b);
    return `
          <div class="glass item-row">
            <div class="item-main">
              <div class="item-title">${b.vehicles?.name || 'Vehicle'} <span class="muted">(${b.vehicles?.plate_number || 'N/A'})</span></div>
              <div class="item-sub">Requested by <strong>${cName}</strong> ${cPhone ? '· ' + cPhone : ''}</div>
              <div class="item-sub">${fmtDate(b.start_date)} → ${fmtDate(b.end_date)} · <strong style="color:#059669;">${fmtMoney(b.total_amount)}</strong></div>
              ${b.vehicles && b.vehicles.status !== 'available' ? `<div class="item-sub" style="color:var(--coral);"><i class="fa-solid fa-triangle-exclamation"></i> Vehicle currently ${b.vehicles.status}</div>` : ''}
              ${b.review_notes ? `<div class="item-sub" style="color:#64748b;font-size:0.78rem;margin-top:4px;"><i class="fa-solid fa-circle-info"></i> ${b.review_notes}</div>` : ''}
            </div>
            <span class="badge badge-pending">pending</span>
            <div class="item-actions">
              <button class="btn btn-primary btn-sm" data-approve="${b.id}">Approve</button>
              <button class="btn btn-danger btn-sm" data-reject="${b.id}">Reject</button>
            </div>
          </div>
        `;
  }).join('') : emptyState('fa-regular fa-envelope-open', 'No pending requests right now.')}
      </div>
    </div>
  `;

  $$('[data-approve]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.approve;
    btn.disabled = true;

    updateLocalBookingStatus(id, 'approved');

    try {
      await supabase.from('bookings').update({
        status: 'approved', reviewed_by: state.user.id, review_notes: null,
      }).eq('id', id);
    } catch (e) {
      console.warn('DB approve notice:', e);
    }

    toast('Booking approved. Customer notified to pay.', 'success');
    if (window.renderTab) window.renderTab();
  }));

  $$('[data-reject]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.reject;
    const reason = prompt('Reason for rejecting this request (shown to the customer):', 'Vehicle unavailable for the requested dates.');
    if (reason === null) return;

    updateLocalBookingStatus(id, 'rejected', { review_notes: reason });

    try {
      await supabase.from('bookings').update({
        status: 'rejected', reviewed_by: state.user.id, review_notes: reason,
      }).eq('id', id);
    } catch (e) {
      console.warn('DB reject notice:', e);
    }

    toast('Request rejected. Customer notified.', 'info');
    if (window.renderTab) window.renderTab();
  }));
}

export async function renderStaffActive(view) {
  const bookings = await fetchMergedBookings(b => ['approved', 'active'].includes(b.status));

  view.innerHTML = `
    <div class="view">
      <div class="section-head"><div><h2>Active Rentals &amp; Reservations</h2><p>Approved bookings, partial reservations, and vehicles currently out.</p></div></div>
      <div class="row-list">
        ${bookings.length ? bookings.map(b => {
    const cName = getBookingCustomerName(b);
    const isPartial = b.balance_due && Number(b.balance_due) > 0 && Number(b.paid_amount || 0) > 0;
    const badgeHTML = isPartial
      ? `<span class="badge badge-reserved"><i class="fa-solid fa-bookmark"></i> Reserved (${fmtMoney(b.paid_amount)} Paid)</span>`
      : `<span class="badge badge-${b.status}">${b.status}</span>`;

    let actionBtn = '';
    if (b.status === 'approved') {
      actionBtn = `<button class="btn btn-amber btn-sm" data-record-payment="${b.id}">Record Payment (${fmtMoney(b.total_amount)})</button>`;
    } else if (isPartial) {
      actionBtn = `<button class="btn btn-amber btn-sm" data-record-payment="${b.id}"><i class="fa-solid fa-hand-holding-dollar"></i> Collect Balance (${fmtMoney(b.balance_due)})</button>`;
    } else {
      actionBtn = `<span class="muted"><i class="fa-solid fa-circle-check" style="color:#059669;"></i> Fully Paid &amp; Active</span>`;
    }

    return `
            <div class="glass item-row">
              <div class="item-main">
                <div class="item-title">${b.vehicles?.name || 'Vehicle'} <span class="muted">(${b.vehicles?.plate_number || 'N/A'})</span></div>
                <div class="item-sub">
                  ${cName} · ${fmtDate(b.start_date)} → ${fmtDate(b.end_date)} · Total: ${fmtMoney(b.total_amount)}
                  ${isPartial ? ` · <span style="color:#2563eb;font-weight:700;">Balance Due at Pickup: ${fmtMoney(b.balance_due)}</span>` : ''}
                </div>
              </div>
              ${badgeHTML}
              <div class="item-actions">${actionBtn}</div>
            </div>
          `;
  }).join('') : emptyState('fa-solid fa-key', 'No approved or active rentals.')}
      </div>
    </div>
  `;

  $$('[data-record-payment]').forEach(btn => btn.addEventListener('click', () => openStaffPaymentModal(btn.dataset.recordPayment)));
}

export async function openStaffPaymentModal(bookingId) {
  let b = null;
  try {
    const { data } = await supabase.from('bookings').select('*, vehicles(name)').eq('id', bookingId).single();
    if (data) b = data;
  } catch (e) {}
  if (!b) {
    b = getLocalBookings().find(item => String(item.id) === String(bookingId)) || { vehicles: { name: 'Vehicle' }, total_amount: 0 };
  }

  const isPartial = b.balance_due && Number(b.balance_due) > 0;
  const amountDue = isPartial ? Number(b.balance_due) : Number(b.total_amount);

  openModal(`
    <div class="modal-head"><h3>${isPartial ? 'Collect Remaining Balance' : 'Record Payment'}</h3><div class="modal-close" id="mClose">✕</div></div>
    <p class="muted" style="margin-bottom:14px;">
      ${b.vehicles?.name || 'Vehicle'} · ${isPartial ? `Remaining balance due: <strong style="color:#2563eb;">${fmtMoney(amountDue)}</strong>` : `Total amount due: <strong>${fmtMoney(amountDue)}</strong>`}
    </p>
    <div class="field"><label>Method</label>
      <select id="payMethod"><option value="cash">Cash</option><option value="card">Card Terminal / POS</option><option value="bank_transfer">Bank Transfer / QR</option></select>
    </div>
    <div style="display:flex;gap:10px;margin-top:8px;">
      <button class="btn btn-primary btn-block" id="markSuccess">${isPartial ? `Mark Balance Paid (${fmtMoney(amountDue)})` : 'Mark Successful'}</button>
      <button class="btn btn-danger btn-block" id="markFailed">Cancel / Failed</button>
    </div>
  `);
  $('#mClose').addEventListener('click', closeModal);

  $('#markSuccess').addEventListener('click', async () => {
    const methodVal = $('#payMethod').value;
    const methodName = methodVal === 'cash' ? 'Cash at Counter' : methodVal === 'card' ? 'Card Terminal' : 'Bank Transfer';

    updateLocalBookingStatus(bookingId, 'active', {
      paid_amount: Number(b.total_amount || 0),
      balance_due: 0,
      payment_type: 'full'
    });

    try {
      await supabase.from('payments').insert({
        booking_id: bookingId, amount: amountDue, method: methodName, status: 'successful', paid_at: new Date().toISOString(),
      });

      let updatePayload = {
        status: 'active',
        paid_amount: Number(b.total_amount || 0),
        balance_due: 0,
        payment_type: 'full'
      };

      let { error: updateErr } = await supabase.from('bookings').update(updatePayload).eq('id', bookingId);
      if (updateErr) {
        delete updatePayload.paid_amount;
        delete updatePayload.balance_due;
        delete updatePayload.payment_type;
        await supabase.from('bookings').update(updatePayload).eq('id', bookingId);
      }

      await supabase.from('vehicles').update({ status: 'rented' }).eq('id', b.vehicle_id);
    } catch (e) {
      console.warn('DB payment record notice:', e);
    }

    toast(isPartial ? `Balance of ${fmtMoney(amountDue)} collected! Booking fully paid.` : 'Payment recorded — vehicle confirmed & released.', 'success');
    closeModal();
    await loadVehicles();
    if (window.renderTab) window.renderTab();
  });

  $('#markFailed').addEventListener('click', async () => {
    try {
      await supabase.from('payments').insert({
        booking_id: bookingId, amount: amountDue, method: $('#payMethod').value, status: 'failed',
      });
    } catch (e) {}
    toast('Payment marked failed.', 'error');
    closeModal();
    if (window.renderTab) window.renderTab();
  });
}

export async function renderStaffReturns(view) {
  const bookings = await fetchMergedBookings(b => b.status === 'active');

  view.innerHTML = `
    <div class="view">
      <div class="section-head"><div><h2>Return Process</h2><p>Inspect returned vehicles, record damage, and finalize the rental.</p></div></div>
      <div class="row-list">
        ${bookings.length ? bookings.map(b => `
          <div class="glass item-row">
            <div class="item-main">
              <div class="item-title">${b.vehicles?.name || 'Vehicle'} <span class="muted">(${b.vehicles?.plate_number || 'N/A'})</span></div>
              <div class="item-sub">${getBookingCustomerName(b)} · Due back ${fmtDate(b.end_date)}</div>
            </div>
            <div class="item-actions"><button class="btn btn-primary btn-sm" data-return="${b.id}">Process Return</button></div>
          </div>
        `).join('') : emptyState('fa-solid fa-road', 'No vehicles currently out for rental.')}
      </div>
    </div>
  `;
  $$('[data-return]').forEach(btn => btn.addEventListener('click', () => openReturnModal(btn.dataset.return)));
}

export async function openReturnModal(bookingId) {
  let b = null;
  try {
    const { data } = await supabase.from('bookings').select('*, vehicles(name)').eq('id', bookingId).single();
    if (data) b = data;
  } catch (e) {}
  if (!b) {
    b = getLocalBookings().find(item => String(item.id) === String(bookingId)) || { vehicles: { name: 'Vehicle' }, total_amount: 0 };
  }

  openModal(`
    <div class="modal-head"><h3>Inspect Vehicle Condition</h3><div class="modal-close" id="mClose">✕</div></div>
    <p class="muted" style="margin-bottom:14px;">${b.vehicles?.name || 'Vehicle'}</p>
    <div class="field"><label>Condition notes</label><textarea id="condNotes" rows="3" placeholder="General condition, mileage, fuel level…"></textarea></div>
    <div class="field">
      <label>Any damage or issue?</label>
      <div class="role-picker" id="damagePicker">
        <div class="role-opt selected" data-damage="no">No</div>
        <div class="role-opt" data-damage="yes">Yes</div>
      </div>
    </div>
    <div class="field hidden" id="chargeField"><label>Additional charges</label><input type="number" id="chargeAmt" min="0" step="0.01" placeholder="0.00" /></div>
    <div class="field hidden" id="maintDaysField"><label>Maintenance Duration (Days)</label><input type="number" id="maintDays" min="1" max="90" value="3" placeholder="e.g. 3 days" /></div>
    <button class="btn btn-primary btn-block" id="finalizeBtn">Finalize Return &amp; Generate Receipt</button>
  `);
  $('#mClose').addEventListener('click', closeModal);
  $$('#damagePicker .role-opt').forEach(opt => opt.addEventListener('click', () => {
    $$('#damagePicker .role-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    const isDamaged = opt.dataset.damage === 'yes';
    $('#chargeField').classList.toggle('hidden', !isDamaged);
    $('#maintDaysField').classList.toggle('hidden', !isDamaged);
  }));

  $('#finalizeBtn').addEventListener('click', async () => {
    const hasDamage = $('#damagePicker .selected').dataset.damage === 'yes';
    const charges = hasDamage ? Number($('#chargeAmt').value || 0) : 0;
    const maintDays = hasDamage ? Math.max(1, Number($('#maintDays').value || 3)) : 0;
    const maintUntil = hasDamage ? new Date(Date.now() + maintDays * 86400000).toISOString() : null;

    const btn = $('#finalizeBtn');
    btn.disabled = true; btn.textContent = 'Processing…';

    updateLocalBookingStatus(bookingId, 'completed');

    try {
      await supabase.from('rental_returns').insert({
        booking_id: bookingId,
        condition_notes: $('#condNotes').value,
        has_damage: hasDamage,
        additional_charges: charges,
        inspected_by: state.user.id,
      });

      if (charges > 0) {
        await supabase.from('payments').insert({
          booking_id: bookingId, amount: charges, method: 'card', status: 'successful',
          paid_at: new Date().toISOString(),
        });
      }

      await supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingId);

      const nextVehicleStatus = hasDamage ? 'maintenance' : 'available';
      const vehicleUpdatePayload = {
        status: nextVehicleStatus,
        maintenance_days: hasDamage ? maintDays : null,
        maintenance_until: maintUntil,
      };

      if (b.vehicle_id) {
        const { error: vErr } = await supabase.from('vehicles').update(vehicleUpdatePayload).eq('id', b.vehicle_id);
        if (vErr) {
          await supabase.from('vehicles').update({ status: nextVehicleStatus }).eq('id', b.vehicle_id);
        }
      }

      const receiptNumber = `RCPT-${bookingId}-${Date.now().toString().slice(-5)}`;
      await supabase.from('receipts').insert({
        booking_id: bookingId,
        receipt_number: receiptNumber,
        total_amount: Number(b.total_amount) + charges,
      }).then(() => {}).catch(() => {});
    } catch (e) {
      console.warn('DB return notice:', e);
    }

    const nextVehicleStatus = hasDamage ? 'maintenance' : 'available';
    toast(`Return finalized. Vehicle set to ${nextVehicleStatus.toUpperCase()}${hasDamage ? ` (${maintDays} days maintenance)` : '.'}`, hasDamage ? 'info' : 'success');
    closeModal();
    await loadVehicles();
    if (window.renderTab) window.renderTab();
  });
}

export async function renderStaffHistory(view) {
  const bookings = await fetchMergedBookings(b => ['completed', 'rejected', 'cancelled'].includes(b.status));

  view.innerHTML = `
    <div class="view">
      <div class="section-head"><div><h2>History</h2><p>Completed and closed bookings.</p></div></div>
      <div class="glass" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Vehicle</th><th>Customer</th><th>Dates</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            ${bookings.map(b => `
              <tr>
                <td>${b.vehicles.name} <span class="muted">(${b.vehicles.plate_number})</span></td>
                <td>${b.profiles?.full_name ?? '—'}</td>
                <td>${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</td>
                <td>${fmtMoney(b.total_amount)}</td>
                <td><span class="badge badge-${b.status}">${b.status}</span></td>
              </tr>
            `).join('') || `<tr><td colspan="5" class="center muted">No history yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export async function renderAdmin(tab, view) {
  if (tab === 'dashboard') return renderAdminDashboard(view);
  if (tab === 'customers') return renderAdminCustomers(view);
  if (tab === 'vehicles') return renderAdminVehicles(view);
  if (tab === 'categories') return renderAdminCategories(view);
  if (tab === 'users') return renderAdminUsers(view);
  if (tab === 'rentals') return renderAdminRentals(view);
  if (tab === 'reports') return renderAdminReports(view);
  if (tab === 'settings') return renderAdminSettings(view);
}

export async function renderAdminDashboard(view) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let monthPayments = [];
  try {
    const { data } = await supabase.from('payments').select('amount, created_at').eq('status', 'successful').gte('created_at', startOfMonth);
    if (data) monthPayments = data;
  } catch (e) {}

  const bookingsList = await fetchMergedBookings();

  const totalVehiclesCount = state.vehicles.length;
  const activeRentalsCount = state.vehicles.filter(v => v.status === 'rented').length || bookingsList.filter(b => b.status === 'active').length;
  const availableRentalsCount = state.vehicles.filter(v => v.status === 'available').length;
  const revenueThisMonth = (monthPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0) ||
    bookingsList.filter(b => b.created_at >= startOfMonth && ['active', 'completed', 'approved'].includes(b.status)).reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

  const vehicleStatsMap = {};
  state.vehicles.forEach(v => {
    vehicleStatsMap[v.id] = { vehicle: v, totalEarnings: 0, rentalCount: 0 };
  });

  bookingsList.forEach(b => {
    if (b.vehicle_id && vehicleStatsMap[b.vehicle_id] && ['active', 'completed', 'approved'].includes(b.status)) {
      vehicleStatsMap[b.vehicle_id].totalEarnings += Number(b.total_amount || 0);
      vehicleStatsMap[b.vehicle_id].rentalCount += 1;
    }
  });

  const topEarners = Object.values(vehicleStatsMap)
    .sort((a, b) => b.totalEarnings - a.totalEarnings)
    .slice(0, 4);

  const recentActivities = bookingsList.slice(0, 6);

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2>Dashboard</h2>
          <p>Fleet metrics, monthly revenue, top performing vehicles, and customer activity.</p>
        </div>
      </div>

      <div class="grid grid-stats" style="margin-bottom:24px;">
        <div class="glass stat-card">
          <div class="stat-label">Total Vehicle Fleet</div>
          <div class="stat-value">${totalVehiclesCount}</div>
          <div class="stat-sub">Registered vehicles</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Active Rentals</div>
          <div class="stat-value" style="color:#059669;">${activeRentalsCount}</div>
          <div class="stat-sub">Currently on road</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Available Rentals</div>
          <div class="stat-value" style="color:#2563eb;">${availableRentalsCount}</div>
          <div class="stat-sub">Ready for booking</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Revenue This Month</div>
          <div class="stat-value" style="color:#059669;">${fmtMoney(revenueThisMonth)}</div>
          <div class="stat-sub">${now.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
        </div>
      </div>

      <div class="grid grid-2" style="gap:20px;">
        <div class="glass card" style="padding:20px;">
          <h3 style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:14px;">Top Earning Vehicles</h3>
          <div style="overflow-x:auto;">
            <table style="width:100%;font-size:0.85rem;border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:1px solid #e2e8f0;text-align:left;">
                  <th style="padding:8px 0;color:#64748b;font-weight:600;">Vehicle</th>
                  <th style="padding:8px 0;color:#64748b;font-weight:600;">Category</th>
                  <th style="padding:8px 0;color:#64748b;font-weight:600;text-align:center;">Rentals</th>
                  <th style="padding:8px 0;color:#64748b;font-weight:600;text-align:right;">Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${topEarners.map(({ vehicle: v, totalEarnings, rentalCount }) => `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px 0;font-weight:700;color:#0f172a;">${v.name}</td>
                    <td style="padding:10px 0;color:#64748b;">${v.categories?.name ?? 'Standard'}</td>
                    <td style="padding:10px 0;text-align:center;font-weight:600;">${rentalCount}</td>
                    <td style="padding:10px 0;text-align:right;font-weight:700;color:#059669;">${fmtMoney(totalEarnings)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="glass card" style="padding:20px;">
          <h3 style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:14px;">Recent Customer Activity</h3>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${recentActivities.length ? recentActivities.map(b => {
    const cName = getBookingCustomerName(b);
    const vName = b.vehicles?.name ?? 'Vehicle';
    let actionText = `Requested ${vName}`;
    if (b.status === 'active') actionText = `Renting ${vName}`;
    else if (b.status === 'completed') actionText = `Returned ${vName}`;
    else if (b.status === 'approved') actionText = `Approved for ${vName}`;
    else if (b.status === 'cancelled') actionText = `Cancelled ${vName}`;

    return `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:0.85rem;">
                  <div>
                    <div style="font-weight:700;color:#0f172a;">${cName}</div>
                    <div style="color:#64748b;font-size:0.8rem;">${actionText} · <span style="color:#94a3b8;">${fmtDate(b.created_at)}</span></div>
                  </div>
                  <span class="badge badge-${b.status}" style="font-size:0.7rem;">${b.status}</span>
                </div>
              `;
  }).join('') : emptyState('fa-regular fa-clock', 'No recent activity.')}
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function renderAdminVehicles(view) {
  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div><h2>Manage Fleet &amp; Maintenance</h2><p>Add, edit, or track vehicle service history and fleet availability.</p></div>
        <button class="btn btn-primary" id="addVehicleBtn">+ Add Vehicle</button>
      </div>
      <div class="grid grid-vehicles" id="adminVehicleGrid">
        ${state.vehicles.map(v => {
    const statusBadge = v.status === 'available'
      ? `<span class="badge badge-available"><i class="fa-solid fa-circle-check"></i> Available</span>`
      : v.status === 'in_service' || v.status === 'maintenance'
        ? `<span class="badge badge-in_service"><i class="fa-solid fa-wrench"></i> In Service</span>`
        : v.status === 'scheduled_maint'
          ? `<span class="badge badge-scheduled_maint"><i class="fa-solid fa-calendar-day"></i> Scheduled Maint</span>`
          : v.status === 'off_the_road'
            ? `<span class="badge badge-off_the_road"><i class="fa-solid fa-ban"></i> Off the Road</span>`
            : `<span class="badge badge-${v.status}">${v.status}</span>`;

    return `
            <div class="glass vehicle-card" style="cursor:default;">
              <div class="vehicle-img-wrapper">
                <img class="vehicle-img" src="${getExactVehicleImage(v)}" alt="${v.name}" />
                <div class="vehicle-badge-pos">
                  ${statusBadge}
                </div>
              </div>
              <div class="vehicle-body">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                  <div class="vehicle-name" style="margin:0;">${v.name}</div>
                  <span class="vehicle-cat-tag">${getVehicleCategoryName(v)}</span>
                </div>
                <div class="vehicle-meta">
                  <span><i class="fa-solid fa-id-card"></i> ${maskPlate(v.plate_number)}</span>
                  <span><i class="fa-solid fa-tag" style="color:#2563eb;"></i> ${fmtMoney(getVehicleDailyRate(v))}/day</span>
                </div>
                <div class="item-actions" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;">
                  <button class="btn btn-ghost btn-sm" data-edit="${v.id}"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                  <button class="btn btn-primary btn-sm" data-service-history="${v.id}"><i class="fa-solid fa-screwdriver-wrench"></i> Service</button>
                  <button class="btn btn-warning btn-sm" data-log-service="${v.id}"><i class="fa-solid fa-plus"></i> Work Order</button>
                  <button class="btn btn-danger btn-sm" data-del="${v.id}"><i class="fa-solid fa-trash"></i> Delete</button>
                </div>
              </div>
            </div>
          `;
  }).join('')}
      </div>
    </div>
  `;
  $('#addVehicleBtn').addEventListener('click', () => openVehicleForm());
  $$('[data-edit]').forEach(b => b.addEventListener('click', () => openVehicleForm(Number(b.dataset.edit))));
  $$('[data-service-history]').forEach(b => b.addEventListener('click', () => openServiceHistoryModal(Number(b.dataset.serviceHistory))));
  $$('[data-log-service]').forEach(b => b.addEventListener('click', () => openLogServiceModal(Number(b.dataset.logService))));
  $$('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this vehicle? This cannot be undone.')) return;
    const { error } = await supabase.from('vehicles').delete().eq('id', Number(b.dataset.del));
    if (error) { toast(error.message, 'error'); return; }
    toast('Vehicle deleted.', 'success');
    await loadVehicles();
    if (window.renderTab) window.renderTab();
  }));
}

export function openVehicleForm(id) {
  const v = id ? state.vehicles.find(v => v.id === id) : null;
  const hasAC = v?.has_ac !== undefined ? v.has_ac : true;
  const currentRate = v ? getVehicleDailyRate(v) : (state.categories?.[0]?.daily_rate || 2000);

  openModal(`
    <div class="modal-head"><h3>${v ? 'Edit' : 'Add'} Vehicle</h3><div class="modal-close" id="mClose">✕</div></div>
    <div class="field"><label>Name</label><input id="fName" value="${v?.name ?? ''}" placeholder="Toyota Corolla" /></div>
    <div class="detail-grid">
      <div class="field"><label>Plate number</label><input id="fPlate" value="${v?.plate_number ?? ''}" placeholder="ABC-1234" /></div>
      <div class="field"><label>Category</label>
        <select id="fCat">${state.categories.map(c => `<option value="${c.id}" ${v?.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Seats</label><input id="fSeats" type="number" value="${v?.seats ?? 5}" /></div>
      <div class="field"><label>Transmission</label>
        <select id="fTrans"><option ${v?.transmission === 'Automatic' ? 'selected' : ''}>Automatic</option><option ${v?.transmission === 'Manual' ? 'selected' : ''}>Manual</option></select>
      </div>
      <div class="field"><label>Fuel Type</label>
        <select id="fFuel"><option ${v?.fuel_type === 'Gasoline' ? 'selected' : ''}>Gasoline</option><option ${v?.fuel_type === 'Diesel' ? 'selected' : ''}>Diesel</option><option ${v?.fuel_type === 'Hybrid' ? 'selected' : ''}>Hybrid</option><option ${v?.fuel_type === 'Electric' ? 'selected' : ''}>Electric</option><option ${v?.fuel_type === 'LPG' ? 'selected' : ''}>LPG</option></select>
      </div>
      <div class="field"><label>Air Conditioning</label>
        <select id="fAC"><option value="true" ${hasAC ? 'selected' : ''}>With AC</option><option value="false" ${!hasAC ? 'selected' : ''}>Non-AC</option></select>
      </div>
      <div class="field"><label>Status</label>
        <select id="fStatus">
          <option value="available" ${v?.status === 'available' ? 'selected' : ''}>Available</option>
          <option value="rented" ${v?.status === 'rented' ? 'selected' : ''}>Rented</option>
          <option value="in_service" ${v?.status === 'in_service' || v?.status === 'maintenance' ? 'selected' : ''}>In Service (Repairs)</option>
          <option value="scheduled_maint" ${v?.status === 'scheduled_maint' ? 'selected' : ''}>Scheduled Maintenance</option>
          <option value="off_the_road" ${v?.status === 'off_the_road' ? 'selected' : ''}>Off the Road / Decommissioned</option>
        </select>
      </div>
      <div class="field">
        <label>Daily Rental Rate (₱ / day)</label>
        <input id="fRate" type="number" step="50" min="100" value="${currentRate}" placeholder="e.g. 2500" required />
      </div>
      <div class="field" id="fMaintDaysBox" style="${(v?.status === 'in_service' || v?.status === 'maintenance' || v?.status === 'scheduled_maint') ? '' : 'display:none;'}">
        <label>Maintenance Duration (Days)</label>
        <input id="fMaintDays" type="number" min="1" max="90" value="${v?.maintenance_days ?? 3}" />
      </div>
    </div>
    <div class="field">
      <label style="font-weight:700;color:#0f172a;"><i class="fa-solid fa-image" style="color:#2563eb;margin-right:4px;"></i> Vehicle Photo</label>
      <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;margin-top:4px;">
        <div id="vImgPreviewBox" style="margin-bottom:10px;">
          ${(v?.image_url || getExactVehicleImage(v || {})) ? `
            <img src="${v?.image_url || getExactVehicleImage(v || {})}" id="vImgPreview" style="max-width:100%;max-height:160px;border-radius:10px;border:1px solid #cbd5e1;object-fit:cover;" />
          ` : `
            <div style="padding:12px 6px;">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size:2rem;color:#94a3b8;margin-bottom:6px;"></i>
              <div style="font-size:0.85rem;font-weight:700;color:#334155;">Upload Vehicle Photo</div>
              <div style="font-size:0.75rem;color:#64748b;">Select image file from your computer (JPG, PNG, WEBP)</div>
            </div>
          `}
        </div>
        <input type="file" id="vFileInput" accept="image/*" style="display:none;" />
        <input type="hidden" id="fImg" value="${v?.image_url ?? ''}" />
        <button type="button" class="btn btn-ghost btn-sm" id="uploadVImgBtn" style="border:1px solid #cbd5e1;background:#ffffff;">
          <i class="fa-solid fa-file-image" style="margin-right:5px;color:#2563eb;"></i> Choose Image File
        </button>
      </div>
    </div>
    <div class="field"><label>Description</label><textarea id="fDesc" rows="2">${v?.description ?? ''}</textarea></div>
    <button class="btn btn-primary btn-block" id="saveVehicle">${v ? 'Save Changes' : 'Add Vehicle'}</button>
  `);
  $('#mClose').addEventListener('click', closeModal);

  $('#uploadVImgBtn').addEventListener('click', () => $('#vFileInput').click());
  $('#vFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast('Image file is too large (max 8MB).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target.result;
      $('#fImg').value = dataUrl;
      $('#vImgPreviewBox').innerHTML = `<img src="${dataUrl}" id="vImgPreview" style="max-width:100%;max-height:160px;border-radius:10px;border:2px solid #2563eb;object-fit:cover;" />`;
      toast('Photo selected! Click Save to apply.', 'info');
    };
    reader.readAsDataURL(file);
  });

  $('#fCat').addEventListener('change', (e) => {
    const catId = Number(e.target.value);
    const cat = state.categories.find(c => c.id === catId);
    if (cat && cat.daily_rate && !v) {
      $('#fRate').value = cat.daily_rate;
    }
  });

  $('#fStatus').addEventListener('change', (e) => {
    $('#fMaintDaysBox').style.display = e.target.value === 'maintenance' ? 'block' : 'none';
  });

  $('#saveVehicle').addEventListener('click', async () => {
    const selectedStatus = $('#fStatus').value;
    const maintDays = selectedStatus === 'maintenance' ? Math.max(1, Number($('#fMaintDays').value || 3)) : null;
    const maintUntil = selectedStatus === 'maintenance' ? new Date(Date.now() + maintDays * 86400000).toISOString() : null;
    const inputRate = Math.max(100, Number($('#fRate').value) || currentRate);

    const payload = {
      name: $('#fName').value.trim(),
      plate_number: $('#fPlate').value.trim(),
      category_id: Number($('#fCat').value),
      daily_rate: inputRate,
      seats: Number($('#fSeats').value),
      transmission: $('#fTrans').value,
      fuel_type: $('#fFuel').value,
      has_ac: $('#fAC').value === 'true',
      status: selectedStatus,
      maintenance_days: maintDays,
      maintenance_until: maintUntil,
      image_url: $('#fImg').value.trim(),
      description: $('#fDesc').value.trim(),
    };
    if (!payload.name || !payload.plate_number) { toast('Name and plate number are required.', 'error'); return; }

    let { error } = v
      ? await supabase.from('vehicles').update(payload).eq('id', v.id)
      : await supabase.from('vehicles').insert(payload);

    if (error && (error.message.includes('daily_rate') || error.message.includes('column'))) {
      delete payload.daily_rate;
      const res = v
        ? await supabase.from('vehicles').update(payload).eq('id', v.id)
        : await supabase.from('vehicles').insert(payload);
      error = res.error;
    }

    if (error && (error.message.includes('vehicles_category_id_fkey') || error.message.includes('foreign key constraint'))) {
      delete payload.category_id;
      const res = v
        ? await supabase.from('vehicles').update(payload).eq('id', v.id)
        : await supabase.from('vehicles').insert(payload);
      error = res.error;
    }

    if (error && error.message.includes('maintenance')) {
      delete payload.maintenance_days;
      delete payload.maintenance_until;
      const res = v
        ? await supabase.from('vehicles').update(payload).eq('id', v.id)
        : await supabase.from('vehicles').insert(payload);
      error = res.error;
    }

    if (error) { toast(error.message, 'error'); return; }

    // Save custom rate persistently
    if (v) {
      setVehicleCustomRate(v.id, inputRate);
      if (v.plate_number) setVehicleCustomRate(v.plate_number, inputRate);
    }
    if (payload.plate_number) setVehicleCustomRate(payload.plate_number, inputRate);
    if (payload.name) setVehicleCustomRate(payload.name.trim().toLowerCase(), inputRate);

    toast(`Vehicle ${v ? 'updated' : 'added'}.`, 'success');
    closeModal();
    await loadVehicles();
    if (window.renderTab) window.renderTab();
  });
}

export async function renderAdminCategories(view) {
  if (!state.categories || state.categories.length === 0) {
    await loadCategories();
  }
  const displayCats = (state.categories && state.categories.length) ? state.categories : PH_CATEGORIES.map((c, i) => ({ id: i + 1, ...c }));

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div><h2>Categories &amp; Rates</h2><p>Manage vehicle categories and daily rental rates.</p></div>
        <button class="btn btn-primary" id="addCatBtn">+ Add Category</button>
      </div>
      <div class="row-list">
        ${displayCats.map(c => `
          <div class="glass item-row">
            <div class="item-main">
              <div class="item-title">${c.name}</div>
              <div class="item-sub">${c.description ?? ''}</div>
            </div>
            <div class="rate">${fmtMoney(c.daily_rate)} <span>/ day</span></div>
            <div class="item-actions">
              <button class="btn btn-ghost btn-sm" data-editcat="${c.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-delcat="${c.id}">Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  $('#addCatBtn').addEventListener('click', () => openCategoryForm());
  $$('[data-editcat]').forEach(b => b.addEventListener('click', () => openCategoryForm(Number(b.dataset.editcat))));
  $$('[data-delcat]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this category?')) return;
    const { error } = await supabase.from('categories').delete().eq('id', Number(b.dataset.delcat));
    if (error) { toast(error.message, 'error'); return; }
    toast('Category deleted.', 'success');
    await loadCategories();
    if (window.renderTab) window.renderTab();
  }));
}

export function openCategoryForm(id) {
  const c = id ? state.categories.find(c => c.id === id) : null;
  openModal(`
    <div class="modal-head"><h3>${c ? 'Edit' : 'Add'} Category</h3><div class="modal-close" id="mClose">✕</div></div>
    <div class="field"><label>Name</label><input id="cName" value="${c?.name ?? ''}" placeholder="Economy" /></div>
    <div class="field"><label>Daily rate</label><input id="cRate" type="number" step="0.01" value="${c?.daily_rate ?? ''}" placeholder="35.00" /></div>
    <div class="field"><label>Description</label><textarea id="cDesc" rows="2">${c?.description ?? ''}</textarea></div>
    <button class="btn btn-primary btn-block" id="saveCat">${c ? 'Save Changes' : 'Add Category'}</button>
  `);
  $('#mClose').addEventListener('click', closeModal);
  $('#saveCat').addEventListener('click', async () => {
    const payload = { name: $('#cName').value.trim(), daily_rate: Number($('#cRate').value), description: $('#cDesc').value.trim() };
    if (!payload.name || !(payload.daily_rate >= 0)) { toast('Valid name and rate required.', 'error'); return; }
    const { error } = c
      ? await supabase.from('categories').update(payload).eq('id', c.id)
      : await supabase.from('categories').insert(payload);
    if (error) { toast(error.message, 'error'); return; }
    toast(`Category ${c ? 'updated' : 'added'}.`, 'success');
    closeModal();
    await loadCategories();
    if (window.renderTab) window.renderTab();
  });
}

let customerStatusFilter = 'all';
let customerSearchQuery = '';

export async function renderAdminCustomers(view) {
  const [{ data: customers, error: profErr }, { data: bookings, error: bookErr }] = await Promise.all([
    supabase.from('profiles').select('*').eq('role', 'customer').order('created_at', { ascending: false }),
    supabase.from('bookings').select('*, vehicles(name, plate_number)').order('created_at', { ascending: false }),
  ]);

  if (profErr) throw profErr;

  const customerList = (customers || []).map(c => {
    const cBookings = (bookings || []).filter(b => b.customer_id === c.id);
    const activeRental = cBookings.find(b => b.status === 'active');
    const pendingBooking = cBookings.find(b => b.status === 'pending');
    const approvedBooking = cBookings.find(b => b.status === 'approved');
    const totalSpent = cBookings
      .filter(b => ['active', 'completed', 'approved'].includes(b.status))
      .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

    let liveStatus = 'idle';
    if (activeRental) liveStatus = 'active_renter';
    else if (approvedBooking) liveStatus = 'approved';
    else if (pendingBooking) liveStatus = 'pending';

    const hasLicense = Boolean(c.license_number || c.license_id_url);

    return {
      ...c,
      bookings: cBookings,
      totalBookings: cBookings.length,
      totalSpent,
      activeRental,
      pendingBooking,
      approvedBooking,
      liveStatus,
      hasLicense
    };
  });

  const activeRentersCount = customerList.filter(c => c.liveStatus === 'active_renter').length;
  const pendingCount = customerList.filter(c => c.liveStatus === 'pending').length;
  const verifiedLicenseCount = customerList.filter(c => c.hasLicense).length;
  const noLicenseCount = customerList.filter(c => !c.hasLicense).length;

  const filteredCustomers = customerList.filter(c => {
    let matchesFilter = true;
    if (customerStatusFilter === 'with_license') matchesFilter = c.hasLicense;
    else if (customerStatusFilter === 'no_license') matchesFilter = !c.hasLicense;
    else if (customerStatusFilter === 'active_renter') matchesFilter = c.liveStatus === 'active_renter';
    else if (customerStatusFilter === 'pending') matchesFilter = c.liveStatus === 'pending';
    else if (customerStatusFilter === 'idle') matchesFilter = c.liveStatus === 'idle';

    const searchLower = customerSearchQuery.toLowerCase();
    const matchesSearch =
      (c.full_name || '').toLowerCase().includes(searchLower) ||
      (c.phone || '').toLowerCase().includes(searchLower) ||
      (c.license_number || '').toLowerCase().includes(searchLower) ||
      (c.address || '').toLowerCase().includes(searchLower);
    return matchesFilter && matchesSearch;
  });

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2>Customers &amp; Driver License Verification</h2>
          <p>Manage customer profiles, verify driver's licenses, and track booking histories.</p>
        </div>
      </div>

      <div class="grid grid-stats" style="margin-bottom:22px;">
        <div class="glass stat-card">
          <div class="stat-label">Total Customers</div>
          <div class="stat-value">${customerList.length}</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">With Driver License</div>
          <div class="stat-value" style="color:#059669;">${verifiedLicenseCount}</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">No License Provided</div>
          <div class="stat-value" style="color:#dc2626;">${noLicenseCount}</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Active Renters</div>
          <div class="stat-value" style="color:#2563eb;">${activeRentersCount}</div>
        </div>
      </div>

      <div class="search-bar" style="margin-bottom:14px;">
        <div style="position:relative;flex:1;">
          <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8;"></i>
          <input type="text" id="custSearchInput" style="padding-left:40px;" placeholder="Search by name, phone, or license number..." value="${customerSearchQuery}" />
        </div>
      </div>

      <div class="pill-row" id="custFilterPills" style="margin-bottom:18px;">
        <div class="pill ${customerStatusFilter === 'all' ? 'active' : ''}" data-cfilter="all">All (${customerList.length})</div>
        <div class="pill ${customerStatusFilter === 'with_license' ? 'active' : ''}" data-cfilter="with_license" style="${customerStatusFilter === 'with_license' ? 'background:#059669;color:#fff;border-color:#059669;' : 'border-color:#a7f3d0;color:#047857;background:#ecfdf5;'}">
          <i class="fa-solid fa-id-card"></i> With License (${verifiedLicenseCount})
        </div>
        <div class="pill ${customerStatusFilter === 'no_license' ? 'active' : ''}" data-cfilter="no_license" style="${customerStatusFilter === 'no_license' ? 'background:#dc2626;color:#fff;border-color:#dc2626;' : 'border-color:#fecdd3;color:#e11d48;background:#fff1f2;'}">
          <i class="fa-solid fa-triangle-exclamation"></i> No License (${noLicenseCount})
        </div>
        <div class="pill ${customerStatusFilter === 'active_renter' ? 'active' : ''}" data-cfilter="active_renter">Active Renters (${activeRentersCount})</div>
        <div class="pill ${customerStatusFilter === 'pending' ? 'active' : ''}" data-cfilter="pending">Pending Requests (${pendingCount})</div>
      </div>

      <div class="row-list">
        ${filteredCustomers.length ? filteredCustomers.map(c => {
    let badgeHTML = '<span class="badge badge-available">Idle</span>';
    if (c.liveStatus === 'active_renter') badgeHTML = '<span class="badge badge-completed"><i class="fa-solid fa-car-side"></i> Active Renter</span>';
    else if (c.liveStatus === 'approved') badgeHTML = '<span class="badge badge-approved">Approved</span>';
    else if (c.liveStatus === 'pending') badgeHTML = '<span class="badge badge-pending">Pending Request</span>';

    const licenseBadge = c.hasLicense
      ? `<span class="badge badge-completed" style="font-size:0.75rem;"><i class="fa-solid fa-id-card"></i> ${c.license_number ? c.license_number : 'ID Photo Provided'}</span>`
      : `<span class="badge badge-rejected" style="font-size:0.75rem;"><i class="fa-solid fa-circle-exclamation"></i> No License Provided</span>`;

    const initials = (c.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    return `
            <div class="glass item-row" style="padding:16px 20px;cursor:pointer;" data-cust-click-id="${c.id}">
              <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;flex-shrink:0;">
                ${initials}
              </div>
              <div class="item-main">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                  <div class="item-title" style="font-size:1rem;">${c.full_name}</div>
                  ${badgeHTML}
                  ${licenseBadge}
                </div>
                <div class="item-sub" style="margin-top:2px;">
                  <span><i class="fa-solid fa-phone" style="color:#059669;margin-right:4px;"></i> ${c.phone ?? 'No phone'}</span>
                  <span style="margin:0 6px;">·</span>
                  <span><i class="fa-solid fa-location-dot" style="color:#64748b;margin-right:4px;"></i> ${c.address ?? 'No address'}</span>
                </div>
                <div class="item-sub" style="margin-top:2px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                  <span>Total Bookings: <strong>${c.totalBookings}</strong></span>
                  <span>Total Spent: <strong style="color:#059669;">${fmtMoney(c.totalSpent)}</strong></span>
                  ${c.license_expiry ? `<span>Expiry: <strong>${fmtDate(c.license_expiry)}</strong></span>` : ''}
                </div>
                ${c.activeRental ? `
                  <div style="margin-top:4px;font-size:0.78rem;color:#047857;font-weight:600;">
                    <i class="fa-solid fa-key" style="margin-right:4px;"></i> Current Vehicle: <strong>${c.activeRental.vehicles?.name ?? 'Vehicle'}</strong> (${maskPlate(c.activeRental.vehicles?.plate_number ?? '')}) · ${fmtDate(c.activeRental.start_date)} → ${fmtDate(c.activeRental.end_date)}
                  </div>
                ` : ''}
              </div>
              <div class="item-actions">
                <button class="btn btn-ghost btn-sm" data-cust-manage-id="${c.id}" style="color:#2563eb;border:1px solid #cbd5e1;">
                  <i class="fa-solid fa-user-pen"></i> Manage &amp; View
                </button>
              </div>
            </div>
          `;
  }).join('') : emptyState('fa-solid fa-users', 'No customers match the filter.')}
      </div>
    </div>
  `;

  $('#custSearchInput').addEventListener('input', (e) => {
    customerSearchQuery = e.target.value;
    renderAdminCustomers(view);
  });

  $$('#custFilterPills .pill').forEach(p => p.addEventListener('click', () => {
    customerStatusFilter = p.dataset.cfilter;
    renderAdminCustomers(view);
  }));

  function openCustomerManageModal(cId) {
    const c = customerList.find(usr => usr.id === cId);
    if (!c) return;

    openModal(`
      <div class="modal-head">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;">
            ${(c.full_name || '?').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-hi);margin:0;">${c.full_name}</h3>
            <span style="font-size:0.75rem;color:var(--text-mid);">Customer &amp; Driver License Record</span>
          </div>
        </div>
        <div class="modal-close" id="mClose">✕</div>
      </div>

      <form id="adminCustForm" style="margin-top:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;background:${c.hasLicense ? 'var(--green-soft)' : 'var(--coral-soft)'};border:1px solid ${c.hasLicense ? 'var(--green-border)' : 'var(--coral-border)'};border-radius:10px;padding:12px 14px;margin-bottom:16px;">
          <div>
            <div style="font-weight:700;font-size:0.9rem;color:${c.hasLicense ? '#047857' : '#e11d48'};">
              <i class="fa-solid fa-${c.hasLicense ? 'circle-check' : 'circle-exclamation'}"></i> ${c.hasLicense ? 'Driver License Provided' : 'No Driver License On File'}
            </div>
            <div style="font-size:0.75rem;color:var(--text-mid);margin-top:2px;">
              ${c.hasLicense ? 'Customer has submitted license details.' : 'Customer has not submitted a valid license yet.'}
            </div>
          </div>
        </div>

        <div class="detail-grid" style="margin-bottom:14px;">
          <div class="field">
            <label>Customer Full Name</label>
            <input type="text" id="admCustName" value="${c.full_name ?? ''}" required />
          </div>
          <div class="field">
            <label>Phone Number</label>
            <input type="text" id="admCustPhone" value="${c.phone ?? ''}" placeholder="+63 917 123 4567" />
          </div>
        </div>

        <div class="detail-grid" style="margin-bottom:14px;">
          <div class="field">
            <label>Driver's License Number</label>
            <input type="text" id="admCustLicense" value="${c.license_number ?? ''}" placeholder="e.g. N02-18-984012 (Leave blank if None)" />
          </div>
          <div class="field">
            <label>License Expiration Date</label>
            <input type="date" id="admCustLicenseExpiry" value="${c.license_expiry ?? ''}" />
          </div>
        </div>

        <div class="field" style="margin-bottom:14px;">
          <label>Address</label>
          <input type="text" id="admCustAddress" value="${c.address ?? ''}" placeholder="Complete street address, city" />
        </div>

        <div class="field" style="margin-bottom:16px;">
          <label>Driver's License ID Photo Document</label>
          <div style="background:var(--bg-dark);border:2px dashed var(--glass-border);border-radius:10px;padding:14px;text-align:center;">
            <div id="admLimPreviewBox" style="margin-bottom:10px;">
              ${c.license_id_url ? `
                <div style="position:relative;display:inline-block;">
                  <img src="${c.license_id_url}" style="max-width:100%;max-height:220px;border-radius:8px;border:2px solid var(--accent);box-shadow:0 4px 12px rgba(0,0,0,0.15);" />
                </div>
              ` : `
                <div style="font-size:0.8rem;color:var(--text-mid);padding:10px 0;"><i class="fa-solid fa-id-card" style="font-size:2rem;display:block;margin-bottom:6px;opacity:0.6;"></i>No license ID card photo uploaded.</div>
              `}
            </div>
            <input type="file" id="admFileLicense" accept="image/*" style="display:none;" />
            <input type="hidden" id="admHiddenLicenseUrl" value="${c.license_id_url ?? ''}" />
            <button type="button" class="btn btn-ghost btn-sm" id="admUploadLicenseBtn" style="border:1px solid var(--glass-border);">
              <i class="fa-solid fa-camera"></i> ${c.license_id_url ? 'Replace License Photo' : 'Upload License Photo'}
            </button>
          </div>
        </div>

        <div style="background:var(--bg-dark);border:1px solid var(--glass-border);border-radius:10px;padding:12px;margin-bottom:18px;font-size:0.82rem;display:flex;justify-content:space-around;">
          <div><span style="color:var(--text-mid);">Total Bookings:</span> <strong style="color:var(--text-hi);">${c.totalBookings}</strong></div>
          <div><span style="color:var(--text-mid);">Total Spent:</span> <strong style="color:#059669;">${fmtMoney(c.totalSpent)}</strong></div>
        </div>

        <div style="display:flex;gap:10px;">
          <button type="button" class="btn btn-ghost" onclick="window.closeModal()" style="flex:1;">Cancel</button>
          <button type="submit" class="btn btn-primary" id="saveCustAdminBtn" style="flex:2;">
            <i class="fa-solid fa-floppy-disk"></i> Save Customer Details
          </button>
        </div>
      </form>
    `, true);

    $('#mClose').addEventListener('click', closeModal);

    const uploadBtn = $('#admUploadLicenseBtn');
    const fileInput = $('#admFileLicense');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target.result;
          $('#admHiddenLicenseUrl').value = dataUrl;
          $('#admLimPreviewBox').innerHTML = `
            <img src="${dataUrl}" style="max-width:100%;max-height:220px;border-radius:8px;border:2px solid var(--accent);" />
          `;
          toast('New license photo selected', 'info');
        };
        reader.readAsDataURL(file);
      });
    }

    $('#adminCustForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = $('#saveCustAdminBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      const updated = {
        full_name: $('#admCustName').value.trim(),
        phone: $('#admCustPhone').value.trim(),
        license_number: $('#admCustLicense').value.trim() || null,
        license_expiry: $('#admCustLicenseExpiry').value || null,
        license_id_url: $('#admHiddenLicenseUrl').value || null,
        address: $('#admCustAddress').value.trim() || null,
      };

      let { error } = await supabase.from('profiles').update(updated).eq('id', c.id);
      if (error) {
        const standardPayload = { full_name: updated.full_name, phone: updated.phone };
        await supabase.from('profiles').update(standardPayload).eq('id', c.id).catch(() => { });
      }

      toast('Customer details updated successfully!', 'success');
      closeModal();
      renderAdminCustomers(view);
    });
  }

  $$('[data-cust-click-id]').forEach(row => row.addEventListener('click', () => openCustomerManageModal(row.dataset.custClickId)));
  $$('[data-cust-manage-id]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openCustomerManageModal(btn.dataset.custManageId);
  }));
}

let userRoleFilter = 'all';
let userSearchQuery = '';

export async function renderAdminUsers(view) {
  const { data: users, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;

  const customersCount = users.filter(u => u.role === 'customer').length;
  const staffCount = users.filter(u => u.role === 'staff').length;
  const adminCount = users.filter(u => u.role === 'admin').length;

  const filteredUsers = users.filter(u => {
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const nameStr = (u.full_name || '').toLowerCase();
    const phoneStr = (u.phone || '').toLowerCase();
    const licenseStr = (u.license_number || '').toLowerCase();
    const searchLower = userSearchQuery.toLowerCase();
    const matchesSearch = nameStr.includes(searchLower) || phoneStr.includes(searchLower) || licenseStr.includes(searchLower);
    return matchesRole && matchesSearch;
  });

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2>Customers &amp; User Management</h2>
          <p>View registered customers, inspect driver's licenses, and manage staff/admin access.</p>
        </div>
      </div>

      <div class="search-bar" style="margin-bottom:14px;">
        <div style="position:relative;flex:1;">
          <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8;"></i>
          <input type="text" id="userSearchInput" style="padding-left:40px;" placeholder="Search customers by name, phone, or license number…" value="${userSearchQuery}" />
        </div>
      </div>

      <div class="pill-row" id="userRolePills" style="margin-bottom:18px;">
        <div class="pill ${userRoleFilter === 'all' ? 'active' : ''}" data-role="all">All Users (${users.length})</div>
        <div class="pill ${userRoleFilter === 'customer' ? 'active' : ''}" data-role="customer">Guests (${customersCount})</div>
        <div class="pill ${userRoleFilter === 'staff' ? 'active' : ''}" data-role="staff">Managers (${staffCount})</div>
        <div class="pill ${userRoleFilter === 'admin' ? 'active' : ''}" data-role="admin">Administrators (${adminCount})</div>
      </div>

      <div class="glass" style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Customer / User</th>
              <th>Contact Phone</th>
              <th>Driver's License</th>
              <th>Address</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${filteredUsers.length ? filteredUsers.map(u => `
              <tr>
                <td>
                  <div style="font-weight:700;color:#0f172a;">${u.full_name}${u.id === state.user.id ? ' <span class="muted">(you)</span>' : ''}</div>
                </td>
                <td>${u.phone ? `<span style="font-weight:600;"><i class="fa-solid fa-phone" style="color:#059669;font-size:0.75rem;margin-right:4px;"></i> ${u.phone}</span>` : '<span class="muted">—</span>'}</td>
                <td>
                  ${u.license_number ? `
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span class="badge badge-completed" style="font-size:0.74rem;font-family:monospace;"><i class="fa-solid fa-id-card"></i> ${u.license_number}</span>
                      ${u.license_id_url ? `
                        <button class="btn btn-ghost btn-sm" data-view-id="${u.id}" style="padding:2px 8px;font-size:0.72rem;color:#2563eb;">
                          <i class="fa-solid fa-eye"></i> View ID
                        </button>
                      ` : ''}
                    </div>
                  ` : '<span class="muted">—</span>'}
                </td>
                <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.8rem;color:#475569;">${u.address ?? '—'}</td>
                <td><span class="badge badge-${u.role === 'admin' ? 'approved' : u.role === 'staff' ? 'pending' : 'available'}">${getRoleDisplayName(u.role)}</span></td>
                <td style="font-size:0.8rem;color:#64748b;">${fmtDate(u.created_at)}</td>
                <td>
                  <select data-role-select="${u.id}" ${u.id === state.user.id ? 'disabled' : ''} style="font-size:0.8rem;padding:4px 8px;">
                    <option value="customer" ${u.role === 'customer' ? 'selected' : ''}>Guest</option>
                    <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Manager</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrator</option>
                  </select>
                </td>
              </tr>
            `).join('') : `<tr><td colspan="7">${emptyState('fa-solid fa-users', 'No users found matching your search.')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('#userSearchInput').addEventListener('input', (e) => {
    userSearchQuery = e.target.value;
    renderAdminUsers(view);
  });

  $$('#userRolePills .pill').forEach(p => p.addEventListener('click', () => {
    userRoleFilter = p.dataset.role;
    renderAdminUsers(view);
  }));

  $$('[data-role-select]').forEach(sel => sel.addEventListener('change', async () => {
    const { error } = await supabase.from('profiles').update({ role: sel.value }).eq('id', sel.dataset.roleSelect);
    if (error) { toast(error.message, 'error'); return; }
    toast('User role updated.', 'success');
  }));

  $$('[data-view-id]').forEach(btn => btn.addEventListener('click', () => {
    const u = users.find(usr => usr.id === btn.dataset.viewId);
    if (!u || !u.license_id_url) return;
    openModal(`
      <div class="modal-head">
        <div>
          <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;">Driver's License Photo Verification</h3>
          <span class="muted" style="font-size:0.78rem;">Customer: ${u.full_name} · License: ${u.license_number ?? 'N/A'}</span>
        </div>
        <div class="modal-close" onclick="window.closeModal()">✕</div>
      </div>
      <div style="text-align:center;padding:10px 0;">
        <img src="${u.license_id_url}" style="max-width:100%;max-height:360px;border-radius:12px;border:2px solid #2563eb;box-shadow:0 8px 24px rgba(0,0,0,0.15);" />
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-top:12px;" class="detail-grid">
        <div><label>Customer Name</label><div style="font-weight:700;color:#0f172a;">${u.full_name}</div></div>
        <div><label>Contact Phone</label><div style="font-weight:600;color:#0f172a;">${u.phone ?? '—'}</div></div>
        <div><label>License No.</label><div style="font-weight:700;font-family:monospace;color:#2563eb;">${u.license_number ?? '—'}</div></div>
        <div><label>Expiry Date</label><div style="font-weight:600;color:#0f172a;">${u.license_expiry ? fmtDate(u.license_expiry) : '—'}</div></div>
        <div style="grid-column:1/-1;"><label>Address</label><div style="font-weight:600;color:#0f172a;">${u.address ?? '—'}</div></div>
      </div>
      <button class="btn btn-primary btn-block" onclick="window.closeModal()" style="margin-top:14px;">Done</button>
    `);
  }));
}

export async function renderAdminRentals(view) {
  const bookings = await fetchMergedBookings();

  view.innerHTML = `
    <div class="view">
      <div class="section-head"><div><h2>Rentals &amp; Transactions</h2><p>Every booking and its payment status.</p></div></div>
      <div class="glass" style="overflow-x:auto;">
        <table>
          <thead><tr><th>Vehicle</th><th>Customer</th><th>Dates</th><th>Amount</th><th>Status</th><th>Payments</th></tr></thead>
          <tbody>
            ${bookings.map(b => `
              <tr>
                <td>${b.vehicles?.name || 'Vehicle'} <span class="muted">(${b.vehicles?.plate_number || 'N/A'})</span></td>
                <td>${getBookingCustomerName(b)}</td>
                <td>${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</td>
                <td>${fmtMoney(b.total_amount)}</td>
                <td><span class="badge badge-${b.status}">${b.status}</span></td>
                <td>${(b.payments || []).map(p => `<span class="badge badge-${p.status}" style="margin-right:4px;">${fmtMoney(p.amount)}</span>`).join('') || '—'}</td>
              </tr>
            `).join('') || `<tr><td colspan="6" class="center muted">No bookings yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export async function renderAdminReports(view) {
  const [{ data: payments }, { data: bookings }] = await Promise.all([
    supabase.from('payments').select('amount, status, created_at').eq('status', 'successful'),
    supabase.from('bookings').select('*, vehicles(name, plate_number, categories(name))'),
  ]);

  const bookingsList = bookings || [];
  const revenue = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

  const totalFleet = state.vehicles.length;
  const rentedCount = state.vehicles.filter(v => v.status === 'rented').length;
  const availableCount = state.vehicles.filter(v => v.status === 'available').length;
  const maintenanceCount = state.vehicles.filter(v => v.status === 'maintenance').length;
  const utilizationPercent = totalFleet > 0 ? Math.round((rentedCount / totalFleet) * 100) : 0;

  const vehicleEarningsMap = {};
  state.vehicles.forEach(v => {
    vehicleEarningsMap[v.id] = {
      name: v.name,
      plate: v.plate_number,
      category: v.categories?.name ?? 'Standard',
      rentals: 0,
      revenue: 0,
      status: v.status
    };
  });

  bookingsList.forEach(b => {
    if (b.vehicle_id && vehicleEarningsMap[b.vehicle_id] && ['active', 'completed', 'approved'].includes(b.status)) {
      vehicleEarningsMap[b.vehicle_id].revenue += Number(b.total_amount || 0);
      vehicleEarningsMap[b.vehicle_id].rentals += 1;
    }
  });

  const topVehicles = Object.values(vehicleEarningsMap)
    .sort((a, b) => b.revenue - a.revenue);

  const statusCounts = ['pending', 'approved', 'active', 'completed', 'rejected', 'cancelled'].map(s => ({
    status: s, count: bookingsList.filter(b => b.status === s).length,
  }));

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2>Analytics &amp; Reports</h2>
          <p>Fleet utilization, revenue metrics, and vehicle performance reports.</p>
        </div>
      </div>

      <div class="grid grid-stats" style="margin-bottom:22px;">
        <div class="glass stat-card">
          <div class="stat-label">Fleet Utilization Rate</div>
          <div class="stat-value" style="color:#2563eb;">${utilizationPercent}%</div>
          <div class="stat-sub">${rentedCount} of ${totalFleet} vehicles currently out</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Net Realized Revenue</div>
          <div class="stat-value" style="color:#059669;">${fmtMoney(revenue)}</div>
          <div class="stat-sub">Verified payments</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Available Fleet</div>
          <div class="stat-value" style="color:#059669;">${availableCount}</div>
          <div class="stat-sub">Ready for rental</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-label">Vehicles in Maintenance</div>
          <div class="stat-value" style="color:#d97706;">${maintenanceCount}</div>
          <div class="stat-sub">Under repair/service</div>
        </div>
      </div>

      <div class="grid grid-2" style="gap:20px;margin-bottom:22px;">
        <div class="glass card">
          <h3 style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:14px;">Fleet Utilization Breakdown</h3>
          <div style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:6px;">
              <span style="font-weight:600;color:#0f172a;">Active Rental Utilization</span>
              <span style="font-weight:700;color:#2563eb;">${utilizationPercent}%</span>
            </div>
            <div style="background:#e2e8f0;border-radius:6px;height:12px;overflow:hidden;">
              <div style="width:${utilizationPercent}%;height:100%;background:linear-gradient(90deg, #2563eb, #1d4ed8);border-radius:6px;"></div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.85rem;padding:6px 0;border-bottom:1px solid #f1f5f9;">
              <span>Rented Vehicles (Active)</span>
              <span class="badge badge-completed" style="font-weight:700;">${rentedCount}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.85rem;padding:6px 0;border-bottom:1px solid #f1f5f9;">
              <span>Available Vehicles</span>
              <span class="badge badge-available" style="font-weight:700;">${availableCount}</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.85rem;padding:6px 0;">
              <span>Under Maintenance</span>
              <span class="badge badge-pending" style="font-weight:700;color:#b45309;">${maintenanceCount}</span>
            </div>
          </div>
        </div>

        <div class="glass card">
          <h3 style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:14px;">Reservation Breakdown</h3>
          ${statusCounts.map(s => `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
              <span class="badge badge-${s.status}" style="width:90px;justify-content:center;font-size:0.7rem;">${s.status}</span>
              <div style="flex:1;background:#e2e8f0;border-radius:6px;height:8px;overflow:hidden;">
                <div style="width:${Math.min(100, s.count * 15)}%;height:100%;background:#2563eb;border-radius:6px;"></div>
              </div>
              <span style="width:24px;text-align:right;font-weight:700;font-size:0.85rem;color:#0f172a;">${s.count}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="glass card">
        <h3 style="font-size:1rem;font-weight:700;color:#0f172a;margin-bottom:14px;">Top Earning Vehicles Report</h3>
        <div style="overflow-x:auto;">
          <table style="width:100%;font-size:0.85rem;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid #e2e8f0;text-align:left;">
                <th style="padding:8px 0;color:#64748b;font-weight:600;">Vehicle Name</th>
                <th style="padding:8px 0;color:#64748b;font-weight:600;">Category</th>
                <th style="padding:8px 0;color:#64748b;font-weight:600;">Plate No.</th>
                <th style="padding:8px 0;color:#64748b;font-weight:600;text-align:center;">Total Rentals</th>
                <th style="padding:8px 0;color:#64748b;font-weight:600;">Fleet Status</th>
                <th style="padding:8px 0;color:#64748b;font-weight:600;text-align:right;">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${topVehicles.length ? topVehicles.map(v => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:10px 0;font-weight:700;color:#0f172a;">${v.name}</td>
                  <td style="padding:10px 0;color:#64748b;">${v.category}</td>
                  <td style="padding:10px 0;color:#64748b;font-family:monospace;">${maskPlate(v.plate)}</td>
                  <td style="padding:10px 0;text-align:center;font-weight:600;">${v.rentals}</td>
                  <td style="padding:10px 0;"><span class="badge badge-${v.status}">${v.status}</span></td>
                  <td style="padding:10px 0;text-align:right;font-weight:700;color:#059669;">${fmtMoney(v.revenue)}</td>
                </tr>
              `).join('') : `<tr><td colspan="6" class="center muted">No vehicle data available.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export async function openLogServiceModal(vehicleId) {
  const v = state.vehicles.find(item => item.id === vehicleId) || { id: vehicleId, name: 'Vehicle' };

  openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;"><i class="fa-solid fa-wrench" style="color:#0284c7;margin-right:6px;"></i> Log Maintenance Work Order</h3>
        <span class="muted" style="font-size:0.78rem;">${v.name} · Plate: ${v.plate_number || '—'}</span>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    <div class="field">
      <label>Service Type / Category</label>
      <select id="srvType">
        <option value="Routine Oil & Filter Change">Routine Oil &amp; Filter Change</option>
        <option value="Brake System Service & Pads">Brake System Service &amp; Pads</option>
        <option value="Tire Replacement & Alignment">Tire Replacement &amp; Alignment</option>
        <option value="Engine Repair & Tune-up">Engine Repair &amp; Tune-up</option>
        <option value="Air Conditioning Overhaul">Air Conditioning Overhaul</option>
        <option value="Transmission Service">Transmission Service</option>
        <option value="Bodywork & Paint Touch-up">Bodywork &amp; Paint Touch-up</option>
        <option value="Comprehensive Safety Inspection">Comprehensive Safety Inspection</option>
      </select>
    </div>

    <div class="detail-grid">
      <div class="field">
        <label>Service Status</label>
        <select id="srvStatus">
          <option value="in_service">In Service (Currently in shop)</option>
          <option value="scheduled">Scheduled Maintenance (Upcoming)</option>
        </select>
      </div>
      <div class="field">
        <label>Estimated Cost (₱)</label>
        <input type="number" id="srvCost" placeholder="e.g. 4500" value="3500" />
      </div>
      <div class="field">
        <label>Mechanic / Auto Shop Name</label>
        <input type="text" id="srvShop" placeholder="e.g. Toyota Casa Service Center" value="Toyota Casa Service Center" />
      </div>
      <div class="field">
        <label>Start Date</label>
        <input type="date" id="srvStartDate" value="${new Date().toISOString().slice(0, 10)}" />
      </div>
    </div>

    <div class="field">
      <label>Service Details / Work Order Description</label>
      <textarea id="srvDesc" rows="3" placeholder="Specify parts replaced, issues inspected, or technician recommendations…">Replaced engine oil, oil filter, and performed 10,000 km multi-point safety inspection.</textarea>
    </div>

    <button class="btn btn-primary btn-block" id="saveSrvBtn" style="background:#0284c7;border-color:#0284c7;margin-top:8px;">
      <i class="fa-solid fa-floppy-disk"></i> Log Work Order &amp; Update Status
    </button>
  `);

  $('#mClose').addEventListener('click', closeModal);

  $('#saveSrvBtn').addEventListener('click', async () => {
    const srvType = $('#srvType').value;
    const srvStatus = $('#srvStatus').value;
    const srvCost = Number($('#srvCost').value || 0);
    const srvShop = $('#srvShop').value.trim();
    const startDate = $('#srvStartDate').value;
    const desc = $('#srvDesc').value.trim();

    const saveBtn = $('#saveSrvBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving Work Order…';

    const { error: insErr } = await supabase.from('service_history').insert({
      vehicle_id: vehicleId,
      service_type: srvType,
      service_status: srvStatus,
      cost: srvCost,
      serviced_by: srvShop,
      start_date: startDate,
      description: desc
    });

    if (insErr) {
      console.warn('Service history table notice:', insErr);
    }

    const vehicleNextStatus = srvStatus === 'in_service' ? 'in_service' : 'scheduled_maint';
    await supabase.from('vehicles').update({ status: vehicleNextStatus }).eq('id', vehicleId);

    toast(`Work order logged for ${v.name}. Vehicle set to ${vehicleNextStatus.replace('_', ' ')}.`, 'success');
    closeModal();
    await loadVehicles();
    if (window.renderTab) window.renderTab();
  });
}

export async function openServiceHistoryModal(vehicleId) {
  const v = state.vehicles.find(item => item.id === vehicleId) || { id: vehicleId, name: 'Vehicle' };

  let historyLogs = [];
  try {
    const { data } = await supabase
      .from('service_history')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });
    historyLogs = data || [];
  } catch (e) {
    historyLogs = [];
  }

  const activeOrders = historyLogs.filter(h => h.service_status === 'in_service' || h.service_status === 'scheduled');
  const completedOrders = historyLogs.filter(h => h.service_status === 'completed');
  const totalCostSpent = historyLogs.reduce((sum, h) => sum + Number(h.cost || 0), 0);

  const statusBadge = v.status === 'available'
    ? `<span class="badge badge-available"><i class="fa-solid fa-circle-check"></i> Available</span>`
    : v.status === 'in_service'
      ? `<span class="badge badge-in_service"><i class="fa-solid fa-wrench"></i> In Service</span>`
      : v.status === 'scheduled_maint'
        ? `<span class="badge badge-scheduled_maint"><i class="fa-solid fa-calendar-day"></i> Scheduled Maint</span>`
        : v.status === 'off_the_road'
          ? `<span class="badge badge-off_the_road"><i class="fa-solid fa-ban"></i> Off the Road</span>`
          : `<span class="badge badge-${v.status}">${v.status}</span>`;

  const modal = openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.15rem;font-weight:800;color:#0f172a;"><i class="fa-solid fa-screwdriver-wrench" style="color:#2563eb;margin-right:6px;"></i> Maintenance &amp; Complete Works</h3>
        <span class="muted" style="font-size:0.78rem;">${v.name} · Plate: ${v.plate_number || '—'}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        ${statusBadge}
        <div class="modal-close" id="mClose">✕</div>
      </div>
    </div>

    <div class="receipt" style="margin-bottom:16px;background:#f8fafc;">
      <div class="receipt-row"><span>Active Work Orders</span><span style="font-weight:700;color:#0f172a;">${activeOrders.length} order(s)</span></div>
      <div class="receipt-row"><span>Completed Work Orders</span><span style="font-weight:700;color:#059669;">${completedOrders.length} finished job(s)</span></div>
      <div class="receipt-row receipt-total"><span>Total Maintenance Invested</span><span style="color:#2563eb;">${fmtMoney(totalCostSpent)}</span></div>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;color:#0f172a;font-size:0.92rem;">
      <span><i class="fa-solid fa-wrench" style="color:#c2410c;margin-right:4px;"></i> Active Maintenance Work Orders</span>
      <button class="btn btn-primary btn-sm" id="btnLogNewSrv" style="background:#0284c7;border-color:#0284c7;font-size:0.75rem;"><i class="fa-solid fa-plus"></i> Log Work Order</button>
    </h4>

    <div style="margin-bottom:18px;">
      ${activeOrders.length ? activeOrders.map(h => `
        <div style="background:#fff7ed;border:1px solid #ffedd5;border-radius:12px;padding:12px 14px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <span style="font-weight:800;font-size:0.9rem;color:#9a3412;">${h.service_type}</span>
            <span class="badge ${h.service_status === 'in_service' ? 'badge-in_service' : 'badge-scheduled_maint'}">${h.service_status.replace('_', ' ')}</span>
          </div>
          <div style="font-size:0.8rem;color:#475569;margin-bottom:6px;">
            Shop: <strong>${h.serviced_by || 'Auto Repair Shop'}</strong> · Started: ${fmtDate(h.start_date)} · Est. Cost: <strong>${fmtMoney(h.cost)}</strong>
          </div>
          ${h.description ? `<p style="font-size:0.78rem;color:#64748b;margin:0 0 10px 0;line-height:1.4;">${h.description}</p>` : ''}
          <button class="btn btn-primary btn-sm" data-complete-srv-id="${h.id}" style="background:#059669;border-color:#059669;color:#fff;">
            <i class="fa-solid fa-circle-check"></i> Complete Work Order &amp; Release Vehicle
          </button>
        </div>
      `).join('') : `
        <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:14px;text-align:center;color:#64748b;font-size:0.82rem;">
          <i class="fa-solid fa-circle-check" style="color:#059669;margin-right:4px;"></i> No active repairs or maintenance needed for this vehicle.
        </div>
      `}
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.92rem;">
      <i class="fa-solid fa-clock-rotate-left" style="color:#059669;"></i> Complete Works &amp; Service History
    </h4>

    <div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
      ${completedOrders.length ? completedOrders.map(h => `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:0.82rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">
            <span style="font-weight:700;color:#0f172a;">${h.service_type}</span>
            <span style="font-weight:700;color:#059669;">${fmtMoney(h.cost)}</span>
          </div>
          <div style="color:#64748b;font-size:0.76rem;">
            Completed on ${fmtDate(h.completion_date || h.created_at)} by <strong>${h.serviced_by || 'Casa / Shop'}</strong>
          </div>
          ${h.description ? `<div style="font-size:0.75rem;color:#475569;margin-top:2px;">${h.description}</div>` : ''}
        </div>
      `).join('') : `
        <div style="padding:10px;text-align:center;color:#94a3b8;font-size:0.8rem;">No completed service history recorded yet.</div>
      `}
    </div>
  `, true);

  $('#mClose').addEventListener('click', closeModal);
  $('#btnLogNewSrv').addEventListener('click', () => { closeModal(); openLogServiceModal(vehicleId); });

  $$('[data-complete-srv-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const srvId = Number(btn.dataset.completeSrvId);
      if (!confirm('Mark this service work order as complete and release vehicle back to Available status?')) return;

      btn.disabled = true;
      btn.textContent = 'Completing Order…';

      await supabase.from('service_history').update({
        service_status: 'completed',
        completion_date: new Date().toISOString()
      }).eq('id', srvId);

      await supabase.from('vehicles').update({ status: 'available' }).eq('id', vehicleId);

      toast('Service work order completed! Vehicle returned to Available fleet.', 'success');
      closeModal();
      await loadVehicles();
      await openServiceHistoryModal(vehicleId);
      if (window.renderTab) window.renderTab();
    });
  });
}

let activeSettingsSubTab = 'company';

export async function renderAdminSettings(view) {
  const currentSettings = getSystemSettings();
  const comp = currentSettings.company || DEFAULT_SETTINGS.company;
  const pol = currentSettings.policy || DEFAULT_SETTINGS.policy;
  const notif = currentSettings.notifications || DEFAULT_SETTINGS.notifications;
  const appr = currentSettings.appearance || DEFAULT_SETTINGS.appearance;

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2><i class="fa-solid fa-gear" style="color:#2563eb;margin-right:8px;"></i> System Settings &amp; Configuration</h2>
          <p>Customize company profile, rental policies, notification preferences, and system appearance.</p>
        </div>
      </div>

      <div class="pill-row" style="margin-bottom:20px;">
        <div class="pill ${activeSettingsSubTab === 'company' ? 'active' : ''}" data-cfg-tab="company">
          <i class="fa-solid fa-building" style="margin-right:4px;"></i> Company Profile
        </div>
        <div class="pill ${activeSettingsSubTab === 'policy' ? 'active' : ''}" data-cfg-tab="policy">
          <i class="fa-solid fa-file-contract" style="margin-right:4px;"></i> Rental Policy &amp; Terms
        </div>
        <div class="pill ${activeSettingsSubTab === 'notifs' ? 'active' : ''}" data-cfg-tab="notifs">
          <i class="fa-solid fa-bell" style="margin-right:4px;"></i> Notification Preferences
        </div>
        <div class="pill ${activeSettingsSubTab === 'appearance' ? 'active' : ''}" data-cfg-tab="appearance">
          <i class="fa-solid fa-palette" style="margin-right:4px;"></i> Appearance &amp; Theme
        </div>
        <div class="pill ${activeSettingsSubTab === 'promos' ? 'active' : ''}" data-cfg-tab="promos">
          <i class="fa-solid fa-tags" style="margin-right:4px;"></i> Promo Codes &amp; Discounts
        </div>
      </div>

      <div id="settingsTabContent">
        ${renderSettingsSubTabContent(activeSettingsSubTab, comp, pol, notif, appr)}
      </div>
    </div>
  `;

  $$('[data-cfg-tab]').forEach(pill => {
    pill.addEventListener('click', () => {
      activeSettingsSubTab = pill.dataset.cfgTab;
      renderAdminSettings(view);
    });
  });

  attachSettingsFormListeners(view, currentSettings);
}

export function renderSettingsSubTabContent(tab, comp, pol, notif, appr) {
  if (tab === 'company') {
    return `
      <div class="setting-card">
        <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <i class="fa-solid fa-building" style="color:#2563eb;"></i> Company Profile &amp; Contact Details
        </h3>
        
        <div class="field">
          <label>Company / Organization Name</label>
          <input type="text" id="cfgCompName" value="${comp.name || ''}" placeholder="Vehicle Rental Management System" />
        </div>

        <div class="detail-grid">
          <div class="field">
            <label>Support Hotline Landline</label>
            <input type="text" id="cfgCompPhone" value="${comp.phone || ''}" placeholder="+63 67676767" />
          </div>
          <div class="field">
            <label>Support Mobile Hotline</label>
            <input type="text" id="cfgCompMobile" value="${comp.mobile || ''}" placeholder="+63 917 123 4567" />
          </div>
          <div class="field">
            <label>Official Support Email</label>
            <input type="email" id="cfgCompEmail" value="${comp.email || ''}" placeholder="vehicleretal.ph" />
          </div>
          <div class="field">
            <label>Operating Currency</label>
            <input type="text" id="cfgCompCurrency" value="${comp.currency || '₱ (PHP)'}" placeholder="₱ (PHP)" />
          </div>
        </div>

        <div class="field">
          <label>Main Branch Office Address</label>
          <input type="text" id="cfgCompAddress" value="${comp.address || ''}" placeholder="123 PPC MAIN BRANCH VENUE" />
        </div>

        <div class="field">
          <label>Business Operating Hours</label>
          <input type="text" id="cfgCompHours" value="${comp.hours || ''}" placeholder="8:00 AM - 8:00 PM Daily" />
        </div>

        <button class="btn btn-primary" id="btnSaveCompany" style="margin-top:10px;">
          <i class="fa-solid fa-floppy-disk"></i> Save Company Profile
        </button>
      </div>
    `;
  } else if (tab === 'policy') {
    return `
      <div class="setting-card">
        <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <i class="fa-solid fa-file-contract" style="color:#059669;"></i> Rental Policies &amp; Penalty Terms
        </h3>

        <div class="detail-grid">
          <div class="field">
            <label>Free Cancellation Notice (Hours before pickup)</label>
            <input type="number" id="cfgCancelWin" value="${pol.cancellationWindow || 24}" min="0" max="72" />
          </div>
          <div class="field">
            <label>Default Reservation Deposit (%)</label>
            <select id="cfgDefDep">
              <option value="20" ${pol.defaultDownpayment === 20 ? 'selected' : ''}>20% Partial Downpayment</option>
              <option value="30" ${pol.defaultDownpayment === 30 ? 'selected' : ''}>30% Partial Downpayment</option>
              <option value="50" ${pol.defaultDownpayment === 50 ? 'selected' : ''}>50% Partial Downpayment</option>
              <option value="100" ${pol.defaultDownpayment === 100 ? 'selected' : ''}>100% Full Payment Only</option>
            </select>
          </div>
          <div class="field">
            <label>Overdue / Late Return Fee (₱ per hour)</label>
            <input type="number" id="cfgLateFee" value="${pol.lateFeePerHour || 300}" min="0" step="50" />
          </div>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Require Valid Professional Driver's License</div>
            <div class="setting-sub">Mandatory driver license submission for booking approvals.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="cfgReqLicense" ${pol.requireLicense ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Require Secondary Government Photo ID</div>
            <div class="setting-sub">Verify secondary identification prior to key handover.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="cfgReqGovId" ${pol.requireGovernmentId ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </div>

        <button class="btn btn-primary" id="btnSavePolicy" style="margin-top:14px;background:#059669;border-color:#059669;">
          <i class="fa-solid fa-floppy-disk"></i> Save Rental Policies
        </button>
      </div>
    `;
  } else if (tab === 'notifs') {
    return `
      <div class="setting-card">
        <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <i class="fa-solid fa-bell" style="color:#d97706;"></i> System Notification Preferences
        </h3>

        <div class="setting-row">
          <div>
            <div class="setting-label">Instant Booking Request &amp; Approval Alerts</div>
            <div class="setting-sub">Send live alerts to staff when new booking requests arrive.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="cfgNtfBooking" ${notif.bookingAlerts ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Vehicle Pickup &amp; Return Reminders</div>
            <div class="setting-sub">Notify customers 1 hour prior to scheduled vehicle pickup.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="cfgNtfPickup" ${notif.pickupReminders ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Instant Payment Receipts</div>
            <div class="setting-sub">Display digital receipt voucher immediately upon verified payment.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="cfgNtfReceipts" ${notif.paymentReceipts ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-label">Automated Email Confirmations</div>
            <div class="setting-sub">Dispatch booking confirmation emails to customer addresses.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="cfgNtfAutoEmail" ${notif.autoEmailConfirmations ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </div>

        <button class="btn btn-primary" id="btnSaveNotifs" style="margin-top:14px;background:#d97706;border-color:#d97706;">
          <i class="fa-solid fa-floppy-disk"></i> Save Notification Preferences
        </button>
      </div>
    `;
  } else if (tab === 'appearance') {
    const currentAccent = appr.accentColor || '#2563eb';
    return `
      <div class="setting-card">
        <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <i class="fa-solid fa-palette" style="color:#4f46e5;"></i> Appearance &amp; System Theme
        </h3>

        <div class="field">
          <label>Theme Mode</label>
          <select id="cfgThemeMode">
            <option value="light" ${appr.theme === 'light' ? 'selected' : ''}>Light Mode (Warm Clean)</option>
            <option value="dark" ${appr.theme === 'dark' ? 'selected' : ''}>Dark Mode (Sleek Night)</option>
          </select>
        </div>

        <div class="field">
          <label>Brand Accent Color Palette</label>
          <div class="color-swatch-grid">
            <div class="color-swatch ${currentAccent === '#2563eb' ? 'active' : ''}" data-color="#2563eb" style="background:#2563eb;" title="Friendly Blue">&#10003;</div>
            <div class="color-swatch ${currentAccent === '#059669' ? 'active' : ''}" data-color="#059669" style="background:#059669;" title="Emerald Green">&#10003;</div>
            <div class="color-swatch ${currentAccent === '#4f46e5' ? 'active' : ''}" data-color="#4f46e5" style="background:#4f46e5;" title="Royal Indigo">&#10003;</div>
            <div class="color-swatch ${currentAccent === '#d97706' ? 'active' : ''}" data-color="#d97706" style="background:#d97706;" title="Amber Bronze">&#10003;</div>
            <div class="color-swatch ${currentAccent === '#e11d48' ? 'active' : ''}" data-color="#e11d48" style="background:#e11d48;" title="Deep Coral">&#10003;</div>
          </div>
          <input type="hidden" id="cfgAccentColor" value="${currentAccent}" />
        </div>

        <div class="field">
          <label>System Typography Font Family</label>
          <select id="cfgFontFamily">
            <option value="Plus Jakarta Sans" ${appr.fontFamily === 'Plus Jakarta Sans' ? 'selected' : ''}>Plus Jakarta Sans (Modern Geometric)</option>
            <option value="Inter" ${appr.fontFamily === 'Inter' ? 'selected' : ''}>Inter (High Legibility)</option>
            <option value="Space Grotesk" ${appr.fontFamily === 'Space Grotesk' ? 'selected' : ''}>Space Grotesk (Tech Accent)</option>
          </select>
        </div>

        <button class="btn btn-primary" id="btnSaveAppr" style="margin-top:14px;background:#4f46e5;border-color:#4f46e5;">
          <i class="fa-solid fa-palette"></i> Apply Theme &amp; Appearance
        </button>
      </div>
    `;
  } else if (tab === 'promos') {
    const promos = getPromoCodes();
    return `
      <div class="setting-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
          <div>
            <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:4px;display:flex;align-items:center;gap:8px;">
              <i class="fa-solid fa-tags" style="color:#2563eb;"></i> Multi-Use Promo Codes &amp; Discounts
            </h3>
            <p style="font-size:0.82rem;color:#64748b;margin:0;">
              Manage promotional discount vouchers. All active codes are <strong>multi-use</strong> and can be used by multiple customers across multiple bookings.
            </p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" id="btnOpenNewPromoModal">
            <i class="fa-solid fa-plus"></i> Add New Promo Code
          </button>
        </div>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">
          <i class="fa-solid fa-infinity" style="color:#059669;font-size:1.1rem;"></i>
          <div style="font-size:0.8rem;color:#166534;">
            <strong>Multi-Use Policy Active:</strong> Promo codes remain available for all customers and do not lock out after a single use. Usage counts are tracked in real-time.
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table class="data-table" style="width:100%;font-size:0.85rem;">
            <thead>
              <tr style="text-align:left;border-bottom:2px solid #e2e8f0;">
                <th style="padding:10px 12px;">Promo Code</th>
                <th style="padding:10px 12px;">Discount Type</th>
                <th style="padding:10px 12px;">Discount Value</th>
                <th style="padding:10px 12px;">Description</th>
                <th style="padding:10px 12px;">Min. Booking</th>
                <th style="padding:10px 12px;">Usage Count</th>
                <th style="padding:10px 12px;">Status</th>
                <th style="padding:10px 12px;text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${promos.map((p, idx) => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:10px 12px;font-weight:800;color:#2563eb;font-family:monospace;font-size:0.95rem;">${p.code}</td>
                  <td style="padding:10px 12px;"><span class="badge ${p.type === 'percent' ? 'badge-info' : 'badge-available'}" style="font-size:0.75rem;">${p.type === 'percent' ? '% Percentage' : '₱ Fixed Amount'}</span></td>
                  <td style="padding:10px 12px;font-weight:700;color:#059669;">${p.type === 'percent' ? `${p.value}% OFF` : fmtMoney(p.value) + ' OFF'}</td>
                  <td style="padding:10px 12px;color:#475569;">${p.description || '—'}</td>
                  <td style="padding:10px 12px;color:#64748b;">${p.minAmount ? fmtMoney(p.minAmount) : 'None'}</td>
                  <td style="padding:10px 12px;"><span style="font-weight:700;color:#0f172a;"><i class="fa-solid fa-users" style="color:#64748b;margin-right:4px;"></i> ${p.usageCount || 0} used</span></td>
                  <td style="padding:10px 12px;">
                    <span class="badge ${p.isActive ? 'badge-available' : 'badge-maintenance'}" style="font-size:0.72rem;">${p.isActive ? 'Active (Multi-use)' : 'Inactive'}</span>
                  </td>
                  <td style="padding:10px 12px;text-align:right;">
                    <button type="button" class="btn btn-ghost btn-sm" data-toggle-promo="${idx}" style="padding:4px 8px;font-size:0.75rem;margin-right:4px;">
                      ${p.isActive ? '<i class="fa-solid fa-pause" style="color:#d97706;"></i> Disable' : '<i class="fa-solid fa-play" style="color:#059669;"></i> Activate'}
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm" data-delete-promo="${idx}" style="padding:4px 8px;font-size:0.75rem;color:#dc2626;" title="Delete">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}

export function attachSettingsFormListeners(view, currentSettings) {
  $$('.color-swatch', view).forEach(sw => {
    sw.addEventListener('click', () => {
      $$('.color-swatch', view).forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      const selectedColor = sw.dataset.color;
      const hiddenInput = $('#cfgAccentColor', view);
      if (hiddenInput) hiddenInput.value = selectedColor;
      document.documentElement.style.setProperty('--accent', selectedColor);
    });
  });

  const btnComp = $('#btnSaveCompany', view);
  if (btnComp) {
    btnComp.addEventListener('click', () => {
      currentSettings.company = {
        name: $('#cfgCompName').value.trim(),
        phone: $('#cfgCompPhone').value.trim(),
        mobile: $('#cfgCompMobile').value.trim(),
        email: $('#cfgCompEmail').value.trim(),
        currency: $('#cfgCompCurrency').value.trim(),
        address: $('#cfgCompAddress').value.trim(),
        hours: $('#cfgCompHours').value.trim(),
      };
      saveSystemSettings(currentSettings);
      toast('Company profile details saved successfully!', 'success');
      renderAdminSettings(view);
    });
  }

  const btnPol = $('#btnSavePolicy', view);
  if (btnPol) {
    btnPol.addEventListener('click', () => {
      currentSettings.policy = {
        cancellationWindow: Number($('#cfgCancelWin').value || 24),
        defaultDownpayment: Number($('#cfgDefDep').value || 20),
        lateFeePerHour: Number($('#cfgLateFee').value || 300),
        requireLicense: $('#cfgReqLicense').checked,
        requireGovernmentId: $('#cfgReqGovId').checked,
      };
      saveSystemSettings(currentSettings);
      toast('Rental policies updated successfully!', 'success');
      renderAdminSettings(view);
    });
  }

  const btnNotifs = $('#btnSaveNotifs', view);
  if (btnNotifs) {
    btnNotifs.addEventListener('click', () => {
      currentSettings.notifications = {
        bookingAlerts: $('#cfgNtfBooking').checked,
        pickupReminders: $('#cfgNtfPickup').checked,
        paymentReceipts: $('#cfgNtfReceipts').checked,
        autoEmailConfirmations: $('#cfgNtfAutoEmail').checked,
      };
      saveSystemSettings(currentSettings);
      toast('Notification preferences saved!', 'success');
      renderAdminSettings(view);
    });
  }

  const btnAppr = $('#btnSaveAppr', view);
  if (btnAppr) {
    btnAppr.addEventListener('click', () => {
      const themeVal = $('#cfgThemeMode').value;
      const colorVal = $('#cfgAccentColor').value;
      const fontVal = $('#cfgFontFamily').value;

      currentSettings.appearance = {
        theme: themeVal,
        accentColor: colorVal,
        fontFamily: fontVal,
      };

      saveSystemSettings(currentSettings);

      localStorage.setItem('rentflow_theme', themeVal);
      applyTheme();
      document.documentElement.style.setProperty('--accent', colorVal);
      document.body.style.fontFamily = `'${fontVal}', sans-serif`;

      toast(`Appearance updated! Theme set to ${themeVal}.`, 'success');
      if (window.renderShell) window.renderShell();
    });
  }

  const btnOpenNewPromo = $('#btnOpenNewPromoModal', view);
  if (btnOpenNewPromo) {
    btnOpenNewPromo.addEventListener('click', () => openNewPromoModal(view));
  }

  $$('[data-toggle-promo]', view).forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.togglePromo);
      const codes = getPromoCodes();
      if (codes[idx]) {
        codes[idx].isActive = !codes[idx].isActive;
        savePromoCodes(codes);
        toast(`Promo code "${codes[idx].code}" is now ${codes[idx].isActive ? 'Active' : 'Disabled'}.`, 'info');
        renderAdminSettings(view);
      }
    });
  });

  $$('[data-delete-promo]', view).forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.deletePromo);
      const codes = getPromoCodes();
      if (codes[idx]) {
        const name = codes[idx].code;
        if (confirm(`Are you sure you want to delete promo code "${name}"?`)) {
          codes.splice(idx, 1);
          savePromoCodes(codes);
          toast(`Promo code "${name}" deleted.`, 'info');
          renderAdminSettings(view);
        }
      }
    });
  });
}

export function openNewPromoModal(view) {
  openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.15rem;font-weight:800;color:#0f172a;margin:0;">
          <i class="fa-solid fa-tags" style="color:#2563eb;margin-right:6px;"></i> Create Multi-Use Promo Code
        </h3>
        <span class="muted" style="font-size:0.75rem;">Reusable discount voucher for all rental customers</span>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    <form id="newPromoForm" style="padding-top:10px;">
      <div class="field">
        <label>Promo Code Text (Uppercase)</label>
        <input type="text" id="npCode" placeholder="e.g. FLASH500" required style="text-transform:uppercase;font-weight:800;letter-spacing:0.05em;" />
      </div>

      <div class="detail-grid">
        <div class="field">
          <label>Discount Type</label>
          <select id="npType">
            <option value="fixed">Fixed Amount (₱ Off)</option>
            <option value="percent">Percentage (% Off)</option>
          </select>
        </div>
        <div class="field">
          <label>Discount Value</label>
          <input type="number" id="npValue" placeholder="e.g. 500 or 15" min="1" required />
        </div>
      </div>

      <div class="field">
        <label>Description / Headline</label>
        <input type="text" id="npDesc" placeholder="e.g. ₱500 Off Any Weekend Booking" required />
      </div>

      <div class="field">
        <label>Minimum Booking Amount (₱) <span style="font-weight:normal;color:#64748b;">(0 for none)</span></label>
        <input type="number" id="npMin" placeholder="0" min="0" value="0" />
      </div>

      <div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:10px;padding:10px 12px;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
        <i class="fa-solid fa-infinity" style="color:#059669;font-size:1.1rem;"></i>
        <span style="font-size:0.78rem;color:#065f46;font-weight:600;">
          Multi-Use Enabled: Multiple customers can use this promo code repeatedly across multiple bookings.
        </span>
      </div>

      <div style="display:flex;gap:10px;">
        <button type="button" class="btn btn-ghost" id="npCancel" style="flex:1;">Cancel</button>
        <button type="submit" class="btn btn-primary" style="flex:2;">
          <i class="fa-solid fa-plus"></i> Save Promo Code
        </button>
      </div>
    </form>
  `);

  $('#mClose').onclick = closeModal;
  $('#npCancel').onclick = closeModal;

  $('#newPromoForm').onsubmit = (e) => {
    e.preventDefault();
    const code = $('#npCode').value.trim().toUpperCase();
    const type = $('#npType').value;
    const value = Number($('#npValue').value || 0);
    const desc = $('#npDesc').value.trim();
    const minAmt = Number($('#npMin').value || 0);

    const codes = getPromoCodes();
    if (codes.some(c => c.code.toUpperCase() === code)) {
      toast(`Promo code "${code}" already exists.`, 'error');
      return;
    }

    codes.push({
      code,
      type,
      value,
      description: desc,
      minAmount: minAmt,
      isActive: true,
      isSingleUse: false,
      usageCount: 0,
    });

    savePromoCodes(codes);
    toast(`Promo code "${code}" created successfully!`, 'success');
    closeModal();
    if (view) renderAdminSettings(view);
  };
}
