import { supabase } from './config.js';
import {
  state, DEFAULT_SETTINGS, getSystemSettings, saveSystemSettings,
  getLocalBookings, updateLocalBookingStatus, DEMO_ACCOUNTS,
  getVehicleOverrides, saveVehicleOverride,
  getLocalDamages, saveLocalDamage, updateDamageStatus,
  getLocalCustomFees, saveLocalCustomFee, updateCustomFeeStatus,
  getRBACPermissions, saveRBACPermissions, RBAC_DEFINITIONS, hasPermission
} from './state.js';
import { $, $$, fmtMoney, fmtDate, maskPlate, toast, openModal, closeModal, emptyState, getRoleDisplayName, applyTheme } from './utils.js';
import { getExactVehicleImage, getVehicleDailyRate, setVehicleCustomRate, getVehicleCategoryName, loadVehicles, loadCategories, PH_CATEGORIES } from './vehicles.js';
import { openRefundVoucherModal } from './customer.js';
import { broadcastBookingStatusChange } from './realtime.js';

export async function renderStaff(tab, view) {
  if (window._activeStaffPageScanner) {
    try {
      if (window._activeStaffPageScanner.isScanning) await window._activeStaffPageScanner.stop();
      window._activeStaffPageScanner.clear();
    } catch(e) {}
    window._activeStaffPageScanner = null;
  }
  if (tab === 'dashboard') return renderStaffDashboard(view);
  if (tab === 'scanner') return renderStaffScanner(view);
  if (tab === 'requests') return renderStaffRequests(view);
  if (tab === 'active') return renderStaffActive(view);
  if (tab === 'returns') return renderStaffReturns(view);
  if (tab === 'damages') return renderStaffDamages(view);
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
          </div>
          <div class="stat-value" style="color:#d97706;display:flex;align-items:baseline;gap:8px;">
            ${pendingBookings.length}
            ${pendingBookings.length > 0 ? `<span class="badge badge-pending" style="font-size:0.7rem;animation:pulse 2s infinite;">Action Required</span>` : ''}
          </div>
          <div class="stat-sub">Incoming reservation requests</div>
        </div>

        <div class="glass stat-card" style="border-left:4px solid var(--accent);cursor:pointer;" id="cardActiveRentals" title="Click to view active rentals">
          <div class="stat-label" style="display:flex;align-items:center;justify-content:space-between;">
            <span>Active Rentals</span>
          </div>
          <div class="stat-value" style="color:var(--accent);">${activeBookings.length}</div>
          <div class="stat-sub">Vehicles currently on the road</div>
        </div>

        <div class="glass stat-card" style="border-left:4px solid #059669;cursor:pointer;" id="cardReturnsDue" title="Click to process returns">
          <div class="stat-label" style="display:flex;align-items:center;justify-content:space-between;">
            <span>Returns Due</span>
          </div>
          <div class="stat-value" style="color:#059669;">${todayReturns.length || activeBookings.length}</div>
          <div class="stat-sub">Scheduled check-ins</div>
        </div>

        <div class="glass stat-card" style="border-left:4px solid #7c3aed;">
          <div class="stat-label" style="display:flex;align-items:center;justify-content:space-between;">
            <span>Fleet Availability</span>
          </div>
          <div class="stat-value" style="color:#7c3aed;">${availableVehicles} <span style="font-size:0.85rem;color:#64748b;font-weight:500;">/ ${totalVehicles}</span></div>
          <div class="stat-sub">${rentedVehicles} Rented · ${maintenanceVehicles} Service</div>
        </div>
      </div>

      <!-- Quick Action Shortcuts -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:24px;">
        <button type="button" class="btn btn-ghost" id="quickNavRequests" style="justify-content:flex-start;background:#fff;border:1px solid #e2e8f0;padding:12px 14px;border-radius:12px;">
          <div style="text-align:left;">
            <div style="font-weight:700;font-size:0.88rem;color:#0f172a;">Review Requests</div>
            <div style="font-size:0.75rem;color:#64748b;">${pendingBookings.length} pending review</div>
          </div>
        </button>

        <button type="button" class="btn btn-ghost" id="quickNavActive" style="justify-content:flex-start;background:#fff;border:1px solid #e2e8f0;padding:12px 14px;border-radius:12px;">
          <div style="text-align:left;">
            <div style="font-weight:700;font-size:0.88rem;color:#0f172a;">Collect Balance</div>
            <div style="font-size:0.75rem;color:#64748b;">Pickup balance collection</div>
          </div>
        </button>

        <button type="button" class="btn btn-ghost" id="quickNavReturns" style="justify-content:flex-start;background:#fff;border:1px solid #e2e8f0;padding:12px 14px;border-radius:12px;">
          <div style="text-align:left;">
            <div style="font-weight:700;font-size:0.88rem;color:#0f172a;">Process Return</div>
            <div style="font-size:0.75rem;color:#64748b;">Inspect &amp; release deposits</div>
          </div>
        </button>

        <button type="button" class="btn btn-ghost" id="quickNavRefunds" style="justify-content:flex-start;background:#fff;border:1px solid #e2e8f0;padding:12px 14px;border-radius:12px;">
          <div style="text-align:left;">
            <div style="font-weight:700;font-size:0.88rem;color:#0f172a;">Refund Claims</div>
            <div style="font-size:0.75rem;color:#64748b;">${refundClaims.length} pending transfer</div>
          </div>
        </button>

        <button type="button" class="btn btn-ghost" id="quickVerifyPass" style="justify-content:flex-start;background:linear-gradient(135deg,rgba(124,58,237,0.08),rgba(99,102,241,0.08));border:1.5px dashed #a78bfa;padding:12px 14px;border-radius:12px;">
          <div style="text-align:left;">
            <div style="font-weight:700;font-size:0.88rem;color:var(--accent);"><i class="fa-solid fa-qrcode" style="margin-right:4px;"></i> Verify QR Pass</div>
            <div style="font-size:0.75rem;color:#64748b;">Venue scan &amp; check-in</div>
          </div>
        </button>
      </div>

      <!-- Main Operations Grid: Urgent Requests & Fleet Status -->
      <div class="grid grid-2" style="gap:20px;margin-bottom:24px;">
        <!-- Priority Booking Approval Queue -->
        <div class="glass card" style="padding:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <h3 style="font-size:1rem;font-weight:800;color:#0f172a;margin:0;">
              Incoming Priority Requests
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
                    <div style="font-size:0.8rem;color:var(--accent);font-weight:700;margin-top:2px;">
                      ${cName} ${cPhone ? `<span style="color:#64748b;font-weight:400;">(${cPhone})</span>` : ''}
                    </div>
                    <div style="font-size:0.76rem;color:#64748b;margin-top:2px;">
                      ${fmtDate(b.start_date)} → ${fmtDate(b.end_date)} · <strong style="color:#059669;">${fmtMoney(b.total_amount)}</strong>
                    </div>
                  </div>
                  <div style="display:flex;gap:6px;flex-shrink:0;">
                    <button type="button" class="btn btn-primary btn-sm" data-dash-approve="${b.id}" style="padding:6px 12px;font-size:0.78rem;">
                      Approve
                    </button>
                    <button type="button" class="btn btn-danger btn-sm" data-dash-reject="${b.id}" style="padding:6px 10px;font-size:0.78rem;">
                      Reject
                    </button>
                  </div>
                </div>
              `;
            }).join('') : `
              <div class="empty-box" style="padding:28px 14px;">
                <div style="font-weight:700;color:#0f172a;margin-top:6px;">All Booking Requests Processed</div>
                <p style="font-size:0.8rem;color:#64748b;margin:4px 0 0 0;">New customer booking requests will appear here in real-time.</p>
              </div>
            `}
          </div>
        </div>

        <!-- Fleet Status Breakdown & Live Operations -->
        <div class="glass card" style="padding:20px;">
          <h3 style="font-size:1rem;font-weight:800;color:#0f172a;margin:0 0 14px 0;">
            Fleet Operations Status
          </h3>

          <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:18px;">
            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.82rem;font-weight:700;margin-bottom:4px;">
                <span style="color:#059669;font-weight:700;">Ready &amp; Available</span>
                <span style="color:#0f172a;">${availableVehicles} of ${totalVehicles} units</span>
              </div>
              <div style="width:100%;height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden;">
                <div style="width:${totalVehicles > 0 ? (availableVehicles / totalVehicles) * 100 : 0}%;height:100%;background:#059669;border-radius:99px;"></div>
              </div>
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.82rem;font-weight:700;margin-bottom:4px;">
                <span style="color:var(--accent);font-weight:700;">Rented On Road</span>
                <span style="color:#0f172a;">${rentedVehicles} units</span>
              </div>
              <div style="width:100%;height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden;">
                <div style="width:${totalVehicles > 0 ? (rentedVehicles / totalVehicles) * 100 : 0}%;height:100%;background:var(--accent);border-radius:99px;"></div>
              </div>
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.82rem;font-weight:700;margin-bottom:4px;">
                <span style="color:#d97706;font-weight:700;">Periodic Maintenance</span>
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
              <div>Inspect incoming vehicles before refunding deposit.</div>
              <div>Validate customer license ID at meetup release.</div>
              <div>Collect remaining balance prior to vehicle handover.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Rental Operations Feed -->
      <div class="glass card" style="padding:20px;">
        <h3 style="font-size:1rem;font-weight:800;color:#0f172a;margin:0 0 14px 0;">
          Recent Rental Operations Feed
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
          }).join('') || emptyState('', 'No recent operations activity.')}
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

  const navQr = $('#quickVerifyPass');
  if (navQr) navQr.addEventListener('click', () => openVenuePassVerificationModal(bookings));

  // Bind Approve and Reject buttons right on the dashboard
  $$('[data-dash-approve]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.dashApprove;
    btn.disabled = true;
    updateLocalBookingStatus(id, 'approved');
    broadcastBookingStatusChange(id, 'approved');
    const currentUserId = state.user?.id || 'ee609b2f-be1e-4551-99e3-d61977ccb578';
    try {
      await supabase.from('bookings').update({ status: 'approved', reviewed_by: currentUserId }).eq('id', id);
    } catch (e) {}
    toast('Booking approved right from Operations Dashboard!', 'success');
    renderStaffDashboard(view);
  }));

  $$('[data-dash-reject]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.dashReject;
    const reason = prompt('Reason for rejecting this request:', 'Vehicle unavailable for requested dates.');
    if (reason === null) return;
    updateLocalBookingStatus(id, 'rejected', { review_notes: reason });
    broadcastBookingStatusChange(id, 'rejected', { reason });
    const currentUserId = state.user?.id || 'ee609b2f-be1e-4551-99e3-d61977ccb578';
    try {
      await supabase.from('bookings').update({ status: 'rejected', reviewed_by: currentUserId, review_notes: reason }).eq('id', id);
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
          full_name: lb.customer_name || 'Renter',
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

function getSavedUserRoles() {
  try {
    return JSON.parse(localStorage.getItem('rentflow_user_roles') || '{}');
  } catch (e) {
    return {};
  }
}

function saveUserRole(userId, role) {
  try {
    const roles = getSavedUserRoles();
    roles[userId] = role;
    localStorage.setItem('rentflow_user_roles', JSON.stringify(roles));
  } catch (e) {}
}

function getCustomProfiles() {
  try {
    return JSON.parse(localStorage.getItem('rentflow_custom_profiles') || '{}');
  } catch (e) {
    return {};
  }
}

function saveCustomProfile(userId, data) {
  try {
    const profiles = getCustomProfiles();
    profiles[userId] = { ...(profiles[userId] || {}), ...data };
    localStorage.setItem('rentflow_custom_profiles', JSON.stringify(profiles));
  } catch (e) {}
}

export function getSystemDemoAccounts() {
  const roles = getSavedUserRoles();
  const custom = getCustomProfiles();
  const custCustom = custom[DEMO_ACCOUNTS.customer.id] || {};
  const staffCustom = custom[DEMO_ACCOUNTS.staff.id] || {};
  const adminCustom = custom[DEMO_ACCOUNTS.admin.id] || {};

  return [
    {
      id: DEMO_ACCOUNTS.customer.id,
      full_name: custCustom.full_name || DEMO_ACCOUNTS.customer.full_name,
      email: custCustom.email || DEMO_ACCOUNTS.customer.email,
      phone: custCustom.phone || DEMO_ACCOUNTS.customer.phone,
      address: custCustom.address || DEMO_ACCOUNTS.customer.address,
      license_number: custCustom.license_number !== undefined ? custCustom.license_number : DEMO_ACCOUNTS.customer.license_number,
      license_expiry: custCustom.license_expiry || '2028-11-20',
      license_id_url: custCustom.license_id_url || null,
      role: roles[DEMO_ACCOUNTS.customer.id] || DEMO_ACCOUNTS.customer.role || 'customer',
      created_at: '2026-08-15T08:00:00.000Z'
    },
    {
      id: DEMO_ACCOUNTS.staff.id,
      full_name: staffCustom.full_name || DEMO_ACCOUNTS.staff.full_name,
      email: staffCustom.email || DEMO_ACCOUNTS.staff.email,
      phone: staffCustom.phone || DEMO_ACCOUNTS.staff.phone,
      address: staffCustom.address || 'RentFlow Operations Hub, Puerto Princesa City',
      license_number: staffCustom.license_number || null,
      license_expiry: staffCustom.license_expiry || null,
      license_id_url: staffCustom.license_id_url || null,
      role: roles[DEMO_ACCOUNTS.staff.id] || DEMO_ACCOUNTS.staff.role || 'staff',
      created_at: '2026-07-10T09:30:00.000Z'
    },
    {
      id: DEMO_ACCOUNTS.admin.id,
      full_name: adminCustom.full_name || DEMO_ACCOUNTS.admin.full_name,
      email: adminCustom.email || DEMO_ACCOUNTS.admin.email,
      phone: adminCustom.phone || DEMO_ACCOUNTS.admin.phone,
      address: adminCustom.address || 'RentFlow Executive Office, Palawan HQ',
      license_number: adminCustom.license_number || null,
      license_expiry: adminCustom.license_expiry || null,
      license_id_url: adminCustom.license_id_url || null,
      role: roles[DEMO_ACCOUNTS.admin.id] || DEMO_ACCOUNTS.admin.role || 'admin',
      created_at: '2026-06-01T08:00:00.000Z'
    }
  ];
}

export async function fetchMergedProfiles() {
  let dbProfiles = [];
  try {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (!error && data) dbProfiles = data;
  } catch (e) {
    console.warn('Profiles load notice:', e);
  }

  const systemAccounts = getSystemDemoAccounts();
  const dbIds = new Set(dbProfiles.map(p => String(p.id)));
  const merged = [...dbProfiles];

  for (const sa of systemAccounts) {
    if (!dbIds.has(String(sa.id))) {
      merged.push(sa);
    }
  }

  merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  return merged;
}

export async function renderStaffRefunds(view) {
  const canDisburse = hasPermission('canDisburseRefunds');
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
              ${b.review_notes ? `<div class="item-sub" style="color:#b45309;margin-top:4px;font-size:0.8rem;">Note: ${b.review_notes}</div>` : ''}
            </div>
            <span class="badge badge-${b.status}">${b.status.replace('_', ' ')}</span>
            <div class="item-actions">
              ${b.status === 'refund_requested' ? `
                <button class="btn btn-primary btn-sm" data-disburse-id="${b.id}" ${!canDisburse ? 'disabled title="Requires canDisburseRefunds RBAC permission"' : ''}>Disburse Refund</button>
              ` : `
                <button class="btn btn-ghost btn-sm" data-refund-voucher-id="${b.id}">Voucher</button>
              `}
            </div>
          </div>
        `).join('') : emptyState('', 'No active refund requests.')}
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
        reviewed_by: state.user?.id || '10f2d761-ab31-4490-944d-456af33759ba',
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
  return b.profiles?.full_name || 'Online Renter';
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
  const canApprove = hasPermission('canApproveBookings');
  const canReject = hasPermission('canRejectBookings');
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
              ${b.vehicles && b.vehicles.status !== 'available' ? `<div class="item-sub" style="color:var(--coral);">Vehicle currently ${b.vehicles.status}</div>` : ''}
              ${b.review_notes ? `<div class="item-sub" style="color:#64748b;font-size:0.78rem;margin-top:4px;">${b.review_notes}</div>` : ''}
            </div>
            <span class="badge badge-pending">pending</span>
            <div class="item-actions">
              <button class="btn btn-primary btn-sm" data-approve="${b.id}" ${!canApprove ? 'disabled title="Requires canApproveBookings RBAC permission"' : ''}>Approve</button>
              <button class="btn btn-danger btn-sm" data-reject="${b.id}" ${!canReject ? 'disabled title="Requires canRejectBookings RBAC permission"' : ''}>Reject</button>
            </div>
          </div>
        `;
  }).join('') : emptyState('', 'No pending requests right now.')}
      </div>
    </div>
  `;

  $$('[data-approve]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.approve;
    btn.disabled = true;

    updateLocalBookingStatus(id, 'approved');
    broadcastBookingStatusChange(id, 'approved');

    const currentUserId = state.user?.id || 'ee609b2f-be1e-4551-99e3-d61977ccb578';
    try {
      await supabase.from('bookings').update({
        status: 'approved', reviewed_by: currentUserId, review_notes: null,
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
    broadcastBookingStatusChange(id, 'rejected', { reason });

    const currentUserId = state.user?.id || 'ee609b2f-be1e-4551-99e3-d61977ccb578';
    try {
      await supabase.from('bookings').update({
        status: 'rejected', reviewed_by: currentUserId, review_notes: reason,
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
      ? `<span class="badge badge-reserved">Reserved (${fmtMoney(b.paid_amount)} Paid)</span>`
      : `<span class="badge badge-${b.status}">${b.status}</span>`;

    let actionBtn = '';
    if (b.status === 'approved') {
      actionBtn = `<button class="btn btn-amber btn-sm" data-record-payment="${b.id}">Record Payment (${fmtMoney(b.total_amount)})</button>`;
    } else if (isPartial) {
      actionBtn = `<button class="btn btn-amber btn-sm" data-record-payment="${b.id}">Collect Balance (${fmtMoney(b.balance_due)})</button>`;
    } else {
      actionBtn = `<span class="muted" style="color:#059669;font-weight:700;">Fully Paid &amp; Active</span>`;
    }

    return `
            <div class="glass item-row">
              <div class="item-main">
                <div class="item-title">${b.vehicles?.name || 'Vehicle'} <span class="muted">(${b.vehicles?.plate_number || 'N/A'})</span></div>
                <div class="item-sub">
                  ${cName} · ${fmtDate(b.start_date)} → ${fmtDate(b.end_date)} · Total: ${fmtMoney(b.total_amount)}
                  ${isPartial ? ` · <span style="color:var(--accent);font-weight:700;">Balance Due at Pickup: ${fmtMoney(b.balance_due)}</span>` : ''}
                </div>
              </div>
              ${badgeHTML}
              <div class="item-actions">
                ${actionBtn}
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.openRentalExtensionModal && window.openRentalExtensionModal('${b.id}')"><i class="fa-solid fa-clock-rotate-left"></i> Extend</button>
              </div>
            </div>
          `;
  }).join('') : emptyState('', 'No approved or active rentals.')}
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
    <div class="modal-head"><h3>${isPartial ? 'Collect Remaining Balance' : 'Record Payment'}</h3><div class="modal-close" id="mClose">Close</div></div>
    <p class="muted" style="margin-bottom:14px;">
      ${b.vehicles?.name || 'Vehicle'} · ${isPartial ? `Remaining balance due: <strong style="color:var(--accent);">${fmtMoney(amountDue)}</strong>` : `Total amount due: <strong>${fmtMoney(amountDue)}</strong>`}
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

export async function renderStaffReturns(view, activeSubTab = 'returns') {
  const canRecord = hasPermission('canRecordDamage');
  const canAddFees = hasPermission('canAddCustomFees');
  const canInspect = hasPermission('canInspectReturns');

  const activeBookings = await fetchMergedBookings(b => b.status === 'active');
  const damages = getLocalDamages();
  const customFees = getLocalCustomFees();
  const allBookings = await fetchMergedBookings();

  const totalDamageBilled = damages.reduce((acc, d) => acc + (Number(d.amount_due) || 0), 0);
  const totalDeductibleProtected = damages.reduce((acc, d) => acc + (Number(d.deductible_coverage) || 0), 0);
  const totalFeesBilled = customFees.reduce((acc, f) => acc + (Number(f.amount) || 0), 0);

  view.innerHTML = `
    <div class="view">
      <div class="section-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;margin-bottom:20px;">
        <div>
          <h2 style="margin:0;font-size:1.4rem;font-weight:800;color:var(--text-hi);display:flex;align-items:center;gap:10px;">
            <i class="fa-solid fa-rotate-left" style="color:var(--accent);"></i> Returns, Damage &amp; Fee Management
          </h2>
          <p style="color:var(--text-mid);font-size:0.85rem;margin:4px 0 0 0;">
            Inspect returned vehicles, complete return handovers, record damage pay assessments, and bill extra fees.
          </p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="btn btn-primary btn-sm" id="btnRecordDamage" ${!canRecord ? 'disabled title="Requires canRecordDamage RBAC permission"' : ''} style="display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-car-burst"></i> Record Damage Pay
          </button>
          <button type="button" class="btn btn-ghost btn-sm" id="btnAddCustomFee" ${!canAddFees ? 'disabled title="Requires canAddCustomFees RBAC permission"' : ''} style="border:1px solid #cbd5e1;display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-receipt"></i> Add Additional Fee
          </button>
        </div>
      </div>

      ${(!canRecord && !canAddFees) ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px;color:#991b1b;font-size:0.85rem;">
          <i class="fa-solid fa-shield-halved" style="font-size:1.1rem;"></i>
          <div><strong>RBAC Permission Notice:</strong> Your account role has view-only access to recording damage or fees. Inspecting returns requires canInspectReturns permission.</div>
        </div>
      ` : ''}

      <!-- Metric Stats Bar -->
      <div class="grid grid-stats" style="margin-bottom:24px;">
        <div class="glass stat-card" style="border-left:4px solid var(--accent);">
          <div class="stat-label">Active Rentals to Return</div>
          <div class="stat-value" style="color:var(--accent);">${activeBookings.length}</div>
          <div style="font-size:0.72rem;color:var(--text-mid);margin-top:2px;">Vehicles out on rental</div>
        </div>
        <div class="glass stat-card" style="border-left:4px solid #ef4444;">
          <div class="stat-label">Total Damage Billed</div>
          <div class="stat-value" style="color:#dc2626;">₱${fmtMoney(totalDamageBilled)}</div>
          <div style="font-size:0.72rem;color:var(--text-mid);margin-top:2px;">${damages.length} Incidents recorded</div>
        </div>
        <div class="glass stat-card" style="border-left:4px solid #10b981;">
          <div class="stat-label">Deductible Protected</div>
          <div class="stat-value" style="color:#059669;">₱${fmtMoney(totalDeductibleProtected)}</div>
          <div style="font-size:0.72rem;color:var(--text-mid);margin-top:2px;">Covered under Zero-Surprise policy</div>
        </div>
        <div class="glass stat-card" style="border-left:4px solid #3b82f6;">
          <div class="stat-label">Additional Surcharges</div>
          <div class="stat-value" style="color:#2563eb;">₱${fmtMoney(totalFeesBilled)}</div>
          <div style="font-size:0.72rem;color:var(--text-mid);margin-top:2px;">${customFees.length} Extra fees billed</div>
        </div>
      </div>

      <!-- Tab Switcher for Returns vs Damage vs Custom Fees -->
      <div class="pill-row" style="margin-bottom:20px;">
        <div class="pill ${activeSubTab === 'returns' ? 'active' : ''}" id="pillTabReturns" style="cursor:pointer;">
          <i class="fa-solid fa-key"></i> Active Returns &amp; Inspections (${activeBookings.length})
        </div>
        <div class="pill ${activeSubTab === 'damages' ? 'active' : ''}" id="pillTabDamages" style="cursor:pointer;">
          <i class="fa-solid fa-car-burst"></i> Damage Assessments (${damages.length})
        </div>
        <div class="pill ${activeSubTab === 'fees' ? 'active' : ''}" id="pillTabFees" style="cursor:pointer;">
          <i class="fa-solid fa-receipt"></i> Additional Operational Fees (${customFees.length})
        </div>
      </div>

      <!-- Section 1: Active Returns to Inspect -->
      <div id="sectionReturnsList" style="display:${activeSubTab === 'returns' ? 'block' : 'none'};">
        <div class="row-list">
          ${activeBookings.length ? activeBookings.map(b => {
            const todayStr = new Date().toISOString().slice(0, 10);
            const isOverdue = (b.end_date || '').slice(0, 10) < todayStr;
            const isDueToday = (b.end_date || '').slice(0, 10) === todayStr;
            return `
              <div class="glass item-row" style="padding:16px 20px;border-radius:14px;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:16px;flex:1;min-width:280px;">
                  <div style="width:88px;height:64px;border-radius:10px;overflow:hidden;background:#f8fafc;border:1px solid #e2e8f0;flex-shrink:0;">
                    <img src="${getExactVehicleImage(b.vehicles || {})}" style="width:100%;height:100%;object-fit:cover;" />
                  </div>
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
                      <strong style="font-size:1.02rem;color:var(--text-hi);">${b.vehicles?.name || 'Vehicle'}</strong>
                      <span style="font-family:monospace;font-size:0.75rem;padding:2px 7px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:5px;color:#475569;font-weight:600;">
                        ${maskPlate(b.vehicles?.plate_number || 'N/A')}
                      </span>
                      ${isOverdue 
                        ? '<span class="badge badge-rejected" style="font-size:0.7rem;"><i class="fa-solid fa-triangle-exclamation"></i> OVERDUE RETURN</span>' 
                        : isDueToday 
                        ? '<span class="badge badge-pending" style="font-size:0.7rem;"><i class="fa-solid fa-clock"></i> DUE TODAY</span>' 
                        : '<span class="badge badge-available" style="font-size:0.7rem;"><i class="fa-solid fa-car"></i> ON RENTAL</span>'
                      }
                    </div>
                    <div style="font-size:0.83rem;color:var(--text-mid);display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                      <span><i class="fa-solid fa-user" style="margin-right:4px;color:#94a3b8;"></i>${getBookingCustomerName(b)}</span>
                      <span style="color:#cbd5e1;">&bull;</span>
                      <span><i class="fa-regular fa-calendar-days" style="margin-right:4px;color:#94a3b8;"></i>Due: <strong>${fmtDate(b.end_date)}</strong></span>
                      <span style="color:#cbd5e1;">&bull;</span>
                      <span>Total: <strong>₱${fmtMoney(b.total_amount)}</strong></span>
                    </div>
                  </div>
                </div>
                <div class="item-actions" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <button type="button" class="btn btn-primary btn-sm" data-return="${b.id}" style="display:flex;align-items:center;gap:6px;">
                    <i class="fa-solid fa-clipboard-check"></i> Inspect &amp; Process Return
                  </button>
                  <button type="button" class="btn btn-ghost btn-sm data-quick-damage" data-id="${b.id}" style="border:1px solid #fecaca;color:#dc2626;display:flex;align-items:center;gap:5px;">
                    <i class="fa-solid fa-car-burst"></i> Damage
                  </button>
                  <button type="button" class="btn btn-ghost btn-sm data-quick-fee" data-id="${b.id}" style="border:1px solid #cbd5e1;display:flex;align-items:center;gap:5px;">
                    <i class="fa-solid fa-plus"></i> Fee
                  </button>
                </div>
              </div>
            `;
          }).join('') : emptyState('', 'No vehicles currently out for rental — all active rentals have been returned.')}
        </div>
      </div>

      <!-- Section 2: Damage Assessments Section -->
      <div id="sectionDamagesList" style="display:${activeSubTab === 'damages' ? 'block' : 'none'};">
        <div class="glass" style="overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Vehicle &amp; Customer</th>
                <th>Damage Component &amp; Severity</th>
                <th>Repair Estimate</th>
                <th>Deductible Covered</th>
                <th>Amount Due</th>
                <th>Payment Option</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${damages.length ? damages.map(d => `
                <tr>
                  <td>
                    <span style="font-weight:700;font-family:monospace;font-size:0.85rem;color:var(--text-hi);">${d.id}</span>
                    <div style="font-size:0.7rem;color:var(--text-mid);">${fmtDate(d.created_at)}</div>
                  </td>
                  <td>
                    <div style="font-weight:700;color:var(--text-hi);">${d.vehicle_name || 'Vehicle'}</div>
                    <div style="font-size:0.75rem;color:var(--text-mid);">
                      ${d.plate_number ? `<span style="font-family:monospace;font-weight:700;">${maskPlate(d.plate_number)}</span> · ` : ''}${d.customer_name || 'Customer'}
                    </div>
                  </td>
                  <td>
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span class="badge ${d.severity === 'severe' ? 'badge-rejected' : d.severity === 'moderate' ? 'badge-pending' : 'badge-approved'}" style="text-transform:capitalize;font-size:0.68rem;">
                        ${d.severity || 'Minor'}
                      </span>
                      <strong style="font-size:0.82rem;color:var(--text-hi);">${d.component || 'General Body'}</strong>
                    </div>
                    <div style="font-size:0.72rem;color:var(--text-mid);margin-top:2px;max-width:240px;line-height:1.3;">
                      ${d.description || 'Assessed upon vehicle inspection.'}
                    </div>
                  </td>
                  <td style="font-size:0.85rem;color:var(--text-mid);">₱${fmtMoney(d.repair_cost || 0)}</td>
                  <td style="font-size:0.85rem;color:#059669;font-weight:600;">-₱${fmtMoney(d.deductible_coverage || 0)}</td>
                  <td>
                    <strong style="font-size:0.95rem;color:#dc2626;">₱${fmtMoney(d.amount_due || 0)}</strong>
                  </td>
                  <td>
                    <span style="font-size:0.8rem;background:var(--accent-glow);color:var(--accent);padding:3px 8px;border-radius:12px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
                      ${d.payment_method === 'Apple Pay' ? '<i class=\"fa-brands fa-apple\"></i> Apple Pay' : d.payment_method === 'Visa Card' ? '<i class=\"fa-brands fa-cc-visa\"></i> Visa' : d.payment_method || 'GCash'}
                    </span>
                  </td>
                  <td>
                    <span class="badge badge-${d.status === 'paid' ? 'available' : d.status === 'waived' ? 'maintenance' : 'rejected'}" style="text-transform:capitalize;">
                      ${d.status || 'billed'}
                    </span>
                  </td>
                  <td>
                    <div style="display:flex;gap:6px;">
                      ${d.status !== 'paid' ? `
                        <button type="button" class="btn btn-primary btn-sm btn-mark-damage-paid" data-id="${d.id}" style="padding:3px 8px;font-size:0.72rem;" title="Mark as Paid">
                          Mark Paid
                        </button>
                      ` : ''}
                      <button type="button" class="btn btn-ghost btn-sm btn-print-damage-slip" data-id="${d.id}" style="padding:3px 8px;font-size:0.72rem;border:1px solid #cbd5e1;" title="Print Assessment Slip">
                        <i class="fa-solid fa-receipt"></i> Slip
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('') : `<tr><td colspan="9" class="center muted" style="padding:28px;">No damage assessments recorded yet.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Section 3: Custom Operational Fees List -->
      <div id="sectionFeesList" style="display:${activeSubTab === 'fees' ? 'block' : 'none'};">
        <div class="glass" style="overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th>Fee ID</th>
                <th>Booking &amp; Customer</th>
                <th>Fee Type &amp; Notes</th>
                <th>Amount</th>
                <th>Payment Option</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${customFees.length ? customFees.map(f => `
                <tr>
                  <td>
                    <span style="font-weight:700;font-family:monospace;font-size:0.85rem;color:var(--text-hi);">${f.id}</span>
                    <div style="font-size:0.7rem;color:var(--text-mid);">${fmtDate(f.created_at)}</div>
                  </td>
                  <td>
                    <div style="font-weight:700;color:var(--text-hi);">${f.vehicle_name || 'Vehicle'}</div>
                    <div style="font-size:0.75rem;color:var(--text-mid);">${f.customer_name || 'Customer'} · #${f.booking_id || 'N/A'}</div>
                  </td>
                  <td>
                    <strong style="font-size:0.82rem;color:var(--text-hi);">${f.fee_label || f.category}</strong>
                    <div style="font-size:0.72rem;color:var(--text-mid);">${f.notes || 'Additional fee applied'}</div>
                  </td>
                  <td>
                    <strong style="font-size:0.95rem;color:var(--accent);">₱${fmtMoney(f.amount || 0)}</strong>
                  </td>
                  <td>
                    <span style="font-size:0.8rem;background:var(--accent-glow);color:var(--accent);padding:3px 8px;border-radius:12px;font-weight:700;">
                      ${f.payment_method || 'Card / GCash'}
                    </span>
                  </td>
                  <td>
                    <span class="badge badge-${f.status === 'paid' ? 'available' : 'rejected'}" style="text-transform:capitalize;">
                      ${f.status || 'billed'}
                    </span>
                  </td>
                  <td>
                    ${f.status !== 'paid' ? `
                      <button type="button" class="btn btn-primary btn-sm btn-mark-fee-paid" data-id="${f.id}" style="padding:3px 8px;font-size:0.72rem;">
                        Mark Paid
                      </button>
                    ` : '<span style="font-size:0.75rem;color:#059669;font-weight:700;"><i class=\"fa-solid fa-check\"></i> Settled</span>'}
                  </td>
                </tr>
              `).join('') : `<tr><td colspan="7" class="center muted" style="padding:28px;">No custom operational fees billed.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Bind Subtab Switching
  const pillReturns = $('#pillTabReturns');
  const pillDamages = $('#pillTabDamages');
  const pillFees = $('#pillTabFees');
  const secReturns = $('#sectionReturnsList');
  const secDamages = $('#sectionDamagesList');
  const secFees = $('#sectionFeesList');

  pillReturns?.addEventListener('click', () => {
    pillReturns.classList.add('active');
    pillDamages?.classList.remove('active');
    pillFees?.classList.remove('active');
    if (secReturns) secReturns.style.display = 'block';
    if (secDamages) secDamages.style.display = 'none';
    if (secFees) secFees.style.display = 'none';
  });

  pillDamages?.addEventListener('click', () => {
    pillDamages.classList.add('active');
    pillReturns?.classList.remove('active');
    pillFees?.classList.remove('active');
    if (secReturns) secReturns.style.display = 'none';
    if (secDamages) secDamages.style.display = 'block';
    if (secFees) secFees.style.display = 'none';
  });

  pillFees?.addEventListener('click', () => {
    pillFees.classList.add('active');
    pillReturns?.classList.remove('active');
    pillDamages?.classList.remove('active');
    if (secReturns) secReturns.style.display = 'none';
    if (secDamages) secDamages.style.display = 'none';
    if (secFees) secFees.style.display = 'block';
  });

  // Action Buttons
  $('#btnRecordDamage')?.addEventListener('click', () => openRecordDamageModal(allBookings, view));
  $('#btnAddCustomFee')?.addEventListener('click', () => openAddCustomFeeModal(allBookings, view));

  // Active returns listeners
  $$('[data-return]', view).forEach(btn => btn.addEventListener('click', () => openReturnModal(btn.dataset.return)));
  $$('.data-quick-damage', view).forEach(btn => btn.addEventListener('click', () => openRecordDamageModal(allBookings, view, btn.dataset.id)));
  $$('.data-quick-fee', view).forEach(btn => btn.addEventListener('click', () => openAddCustomFeeModal(allBookings, view, btn.dataset.id)));

  // Mark Paid & Slip
  $$('.btn-mark-damage-paid', view).forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.id;
    updateDamageStatus(id, 'paid');
    toast(`Damage payment for #${id} confirmed and marked as Paid!`, 'success');
    renderStaffReturns(view, 'damages');
  }));

  $$('.btn-mark-fee-paid', view).forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.id;
    updateCustomFeeStatus(id, 'paid');
    toast(`Fee payment for #${id} confirmed and settled!`, 'success');
    renderStaffReturns(view, 'fees');
  }));

  $$('.btn-print-damage-slip', view).forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.id;
    const item = damages.find(d => d.id === id);
    if (item) openDamageAssessmentSlipModal(item);
  }));
}

export async function openReturnModal(bookingId) {
  if (!hasPermission('canInspectReturns')) {
    toast('Your account lacks canInspectReturns permission to process vehicle returns.', 'error');
    return;
  }
  let b = null;
  try {
    const { data } = await supabase.from('bookings').select('*, vehicles(name)').eq('id', bookingId).single();
    if (data) b = data;
  } catch (e) {}
  if (!b) {
    b = getLocalBookings().find(item => String(item.id) === String(bookingId)) || { vehicles: { name: 'Vehicle' }, total_amount: 0 };
  }

  openModal(`
    <div class="modal-head"><h3>Inspect Vehicle Condition</h3><div class="modal-close" id="mClose">Close</div></div>
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
        inspected_by: state.user?.id || 'ee609b2f-be1e-4551-99e3-d61977ccb578',
      });

      if (charges > 0) {
        await supabase.from('payments').insert({
          booking_id: bookingId, amount: charges, method: 'card', status: 'successful',
          paid_at: new Date().toISOString(),
        });
      }

      if (hasDamage && charges > 0) {
        saveLocalDamage({
          id: `DMG-${Date.now().toString().slice(-4)}`,
          booking_id: String(bookingId),
          vehicle_name: b.vehicles?.name || 'Vehicle',
          plate_number: b.vehicles?.plate_number || '',
          customer_name: b.profiles?.full_name || 'Customer',
          customer_phone: b.profiles?.phone || '',
          component: 'Return Inspection Finding',
          severity: charges > 3000 ? 'severe' : charges > 1500 ? 'moderate' : 'minor',
          description: $('#condNotes').value || 'Damage assessed during vehicle return inspection.',
          repair_cost: charges + 1000,
          deductible_coverage: 1000,
          amount_due: charges,
          payment_method: 'Card / Checkout',
          status: 'paid',
          assessed_by: state.profile?.full_name || 'Staff Inspector',
          created_at: new Date().toISOString()
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

// ---------------------------------------------------------------------------
// Staff Damage Pay & Custom Fee Management
// ---------------------------------------------------------------------------
export async function renderStaffDamages(view) {
  return renderStaffReturns(view, 'damages');
}

export function openRecordDamageModal(allBookings, view, preSelectedBookingId = '') {
  const activeAndCompleted = allBookings.filter(b => ['active', 'completed', 'approved'].includes(b.status));

  openModal(`
    <div style="max-height:82vh;overflow-y:auto;padding-right:4px;">
      <div class="modal-head" style="margin-bottom:14px;">
        <div>
          <h3 style="font-size:1.25rem;font-weight:800;color:var(--text-hi);display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-car-burst" style="color:#ef4444;"></i> Record Vehicle Damage Pay
          </h3>
          <span style="font-size:0.78rem;color:var(--text-mid);">Assess incident, apply fair-wear deductible coverage, and issue invoice.</span>
        </div>
        <div class="modal-close" id="mClose">Close</div>
      </div>

      <div class="field">
        <label>Select Rental Booking</label>
        <select id="dmgBookingSelect" style="font-size:0.85rem;">
          <option value="">-- Choose active or recent rental --</option>
          ${activeAndCompleted.map(b => `
            <option value="${b.id}" ${String(b.id) === String(preSelectedBookingId) ? 'selected' : ''} data-vname="${b.vehicles?.name || 'Vehicle'}" data-vplate="${b.vehicles?.plate_number || ''}" data-cname="${b.profiles?.full_name || 'Customer'}" data-cphone="${b.profiles?.phone || ''}">
              #${b.id} - ${b.vehicles?.name || 'Vehicle'} (${b.vehicles?.plate_number || 'No plate'}) · ${b.profiles?.full_name || 'Customer'}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="detail-grid">
        <div class="field">
          <label>Vehicle Model</label>
          <input type="text" id="dmgVehicleName" placeholder="e.g. Toyota Fortuner 2.8 V" required />
        </div>
        <div class="field">
          <label>Plate Number</label>
          <input type="text" id="dmgPlateNumber" placeholder="e.g. NBD-8842" />
        </div>
      </div>

      <div class="detail-grid">
        <div class="field">
          <label>Customer Name</label>
          <input type="text" id="dmgCustomerName" placeholder="Customer Name" required />
        </div>
        <div class="field">
          <label>Contact Phone</label>
          <input type="text" id="dmgCustomerPhone" placeholder="0917 xxx xxxx" />
        </div>
      </div>

      <div class="detail-grid">
        <div class="field">
          <label>Damage Component</label>
          <select id="dmgComponent">
            <option value="Front Bumper & Lip" data-cost="2500">Front Bumper &amp; Lip</option>
            <option value="Rear Bumper & Sensors" data-cost="2500">Rear Bumper &amp; Sensors</option>
            <option value="Door Panel Dent / Ding" data-cost="3500">Door Panel Dent / Ding</option>
            <option value="Windshield Chip / Crack" data-cost="2500">Windshield Chip / Crack (Deductible Capped)</option>
            <option value="Side Mirror Housing / Glass" data-cost="1800">Side Mirror Housing / Glass</option>
            <option value="Alloy Wheels / Tire Scuff" data-cost="1500">Alloy Wheels / Tire Scuff</option>
            <option value="Headlight / Taillight Assembly" data-cost="4500">Headlight / Taillight Assembly</option>
            <option value="Interior Stain / Steam Detailing" data-cost="1200">Interior Deep Stain / Detailing</option>
            <option value="Lost Key Fob / Immobilizer" data-cost="4000">Lost Key Fob / Remote</option>
            <option value="Custom Body Damage" data-cost="3000">Other Custom Body Damage</option>
          </select>
        </div>
        <div class="field">
          <label>Severity Level</label>
          <select id="dmgSeverity">
            <option value="minor" data-mult="1.0">Minor (Surface mark / spot repair)</option>
            <option value="moderate" data-mult="1.4">Moderate (Deep scratch / small dent)</option>
            <option value="severe" data-mult="2.0">Severe (Cracked component / replace)</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label>Incident &amp; Inspection Description</label>
        <textarea id="dmgDescription" rows="2" placeholder="Describe the damage location, depth, and inspection findings..."></textarea>
      </div>

      <div style="background:var(--glass-card);border:1px solid var(--glass-border);border-radius:12px;padding:14px;margin-bottom:16px;">
        <div style="font-size:0.82rem;font-weight:800;color:var(--text-hi);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-calculator" style="color:var(--accent);"></i> Damage Pay &amp; Deductible Breakdown
        </div>
        <div class="detail-grid" style="margin-bottom:10px;">
          <div class="field" style="margin:0;">
            <label style="font-size:0.75rem;">Gross Repair Cost (₱)</label>
            <input type="number" id="dmgRepairCost" value="2500" min="0" step="50" style="font-weight:700;" />
          </div>
          <div class="field" style="margin:0;">
            <label style="font-size:0.75rem;">Deductible Policy Coverage (₱)</label>
            <input type="number" id="dmgDeductible" value="1000" min="0" step="50" style="font-weight:700;color:#059669;" />
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px dashed var(--glass-border);">
          <span style="font-size:0.85rem;font-weight:800;color:var(--text-hi);">Customer Amount Due:</span>
          <strong id="dmgAmountDueDisplay" style="font-size:1.25rem;color:#dc2626;">₱1,500.00</strong>
        </div>
      </div>

      <div class="detail-grid">
        <div class="field">
          <label>Payment Method</label>
          <select id="dmgPaymentMethod">
            <option value="GCash">GCash QR</option>
            <option value="Visa Card">Visa Card (3D Secure)</option>
            <option value="Apple Pay">Apple Pay</option>
            <option value="Cash">Cash on Handover</option>
            <option value="Bank Transfer">Bank QR Ph / Transfer</option>
            <option value="Mastercard">Mastercard</option>
          </select>
        </div>
        <div class="field">
          <label>Payment Status</label>
          <select id="dmgStatus">
            <option value="billed">Billed (Unpaid / On Invoice)</option>
            <option value="paid" selected>Paid &amp; Settled Immediately</option>
          </select>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:10px;">
        <button type="button" class="btn btn-ghost btn-block" onclick="window.closeModal && window.closeModal();">Cancel</button>
        <button type="button" class="btn btn-primary btn-block" id="btnSaveDamageRecord">
          <i class="fa-solid fa-check"></i> Confirm &amp; Save Damage Pay
        </button>
      </div>
    </div>
  `);

  $('#mClose')?.addEventListener('click', closeModal);

  const bSelect = $('#dmgBookingSelect');
  const vNameInp = $('#dmgVehicleName');
  const vPlateInp = $('#dmgPlateNumber');
  const cNameInp = $('#dmgCustomerName');
  const cPhoneInp = $('#dmgCustomerPhone');
  const compSelect = $('#dmgComponent');
  const sevSelect = $('#dmgSeverity');
  const repairCostInp = $('#dmgRepairCost');
  const deductibleInp = $('#dmgDeductible');
  const amtDueDisp = $('#dmgAmountDueDisplay');

  function recalc() {
    const cost = Number(repairCostInp.value || 0);
    const ded = Number(deductibleInp.value || 0);
    const net = Math.max(0, cost - ded);
    amtDueDisp.textContent = fmtMoney(net);
    return net;
  }

  bSelect?.addEventListener('change', () => {
    const opt = bSelect.options[bSelect.selectedIndex];
    if (opt && opt.value) {
      vNameInp.value = opt.dataset.vname || '';
      vPlateInp.value = opt.dataset.vplate || '';
      cNameInp.value = opt.dataset.cname || '';
      cPhoneInp.value = opt.dataset.cphone || '';
    }
  });

  if (preSelectedBookingId && bSelect) {
    bSelect.dispatchEvent(new Event('change'));
  }

  compSelect?.addEventListener('change', () => {
    const baseCost = Number(compSelect.options[compSelect.selectedIndex]?.dataset.cost || 2500);
    const mult = Number(sevSelect.options[sevSelect.selectedIndex]?.dataset.mult || 1.0);
    repairCostInp.value = Math.round(baseCost * mult);
    recalc();
  });

  sevSelect?.addEventListener('change', () => {
    const baseCost = Number(compSelect.options[compSelect.selectedIndex]?.dataset.cost || 2500);
    const mult = Number(sevSelect.options[sevSelect.selectedIndex]?.dataset.mult || 1.0);
    repairCostInp.value = Math.round(baseCost * mult);
    recalc();
  });

  repairCostInp?.addEventListener('input', recalc);
  deductibleInp?.addEventListener('input', recalc);

  $('#btnSaveDamageRecord')?.addEventListener('click', () => {
    const vName = vNameInp.value.trim() || 'Vehicle';
    const cName = cNameInp.value.trim() || 'Customer';
    const netDue = recalc();

    const record = {
      id: `DMG-${Date.now().toString().slice(-4)}`,
      booking_id: bSelect.value || '1',
      vehicle_name: vName,
      plate_number: vPlateInp.value.trim(),
      customer_name: cName,
      customer_phone: cPhoneInp.value.trim(),
      component: compSelect.value,
      severity: sevSelect.value,
      description: $('#dmgDescription').value.trim() || 'Damage assessed and billed per Zero-Surprise policy.',
      repair_cost: Number(repairCostInp.value || 0),
      deductible_coverage: Number(deductibleInp.value || 0),
      amount_due: netDue,
      payment_method: $('#dmgPaymentMethod').value,
      status: $('#dmgStatus').value,
      assessed_by: state.profile?.full_name || 'Sarah Villanueva (Staff)',
      created_at: new Date().toISOString()
    };

    saveLocalDamage(record);
    toast(`Damage Assessment #${record.id} recorded (${fmtMoney(netDue)} billed via ${record.payment_method})!`, 'success');
    closeModal();
    renderStaffDamages(view);
  });
}

export function openAddCustomFeeModal(allBookings, view, preSelectedBookingId = '') {
  const activeAndCompleted = allBookings.filter(b => ['active', 'completed', 'approved'].includes(b.status));

  openModal(`
    <div style="max-height:82vh;overflow-y:auto;padding-right:4px;">
      <div class="modal-head" style="margin-bottom:14px;">
        <div>
          <h3 style="font-size:1.25rem;font-weight:800;color:var(--text-hi);display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-receipt" style="color:var(--accent);"></i> Add Additional Operational Fee
          </h3>
          <span style="font-size:0.78rem;color:var(--text-mid);">Attach late fees, fuel shortage, expressway tolls, or detailing surcharges.</span>
        </div>
        <div class="modal-close" id="mClose">Close</div>
      </div>

      <div class="field">
        <label>Select Rental Booking</label>
        <select id="feeBookingSelect" style="font-size:0.85rem;">
          <option value="">-- Choose active or recent rental --</option>
          ${activeAndCompleted.map(b => `
            <option value="${b.id}" ${String(b.id) === String(preSelectedBookingId) ? 'selected' : ''} data-vname="${b.vehicles?.name || 'Vehicle'}" data-cname="${b.profiles?.full_name || 'Customer'}">
              #${b.id} - ${b.vehicles?.name || 'Vehicle'} · ${b.profiles?.full_name || 'Customer'}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="detail-grid">
        <div class="field">
          <label>Customer Name</label>
          <input type="text" id="feeCustomerName" placeholder="Customer Name" required />
        </div>
        <div class="field">
          <label>Vehicle Name</label>
          <input type="text" id="feeVehicleName" placeholder="Vehicle Name" required />
        </div>
      </div>

      <div class="detail-grid">
        <div class="field">
          <label>Fee Category</label>
          <select id="feeCategorySelect">
            <option value="late_return" data-amount="1000" data-label="Late Return Penalty (2 hrs)">Late Return Penalty (₱500/hr)</option>
            <option value="fuel_surcharge" data-amount="650" data-label="Fuel Tank Shortage Top-Up">Fuel Shortage Surcharge</option>
            <option value="excess_km" data-amount="750" data-label="Excess Mileage Surcharge">Excess Mileage (₱15/km over limit)</option>
            <option value="cleaning_fee" data-amount="1200" data-label="Heavy Mud &amp; Interior Detailing">Cleaning &amp; Detailing Fee</option>
            <option value="toll_violation" data-amount="500" data-label="Expressway RFID Toll &amp; Traffic">Expressway RFID / Toll Surcharge</option>
            <option value="remote_delivery" data-amount="1000" data-label="Remote Airport / Meetup Fee">Remote Delivery &amp; Retrieval</option>
            <option value="custom" data-amount="500" data-label="Other Operational Surcharge">Other Custom Fee</option>
          </select>
        </div>
        <div class="field">
          <label>Fee Amount (₱)</label>
          <input type="number" id="feeAmount" value="1000" min="0" step="50" required style="font-weight:700;color:var(--accent);" />
        </div>
      </div>

      <div class="field">
        <label>Reason &amp; Operational Notes</label>
        <textarea id="feeNotes" rows="2" placeholder="e.g. Returned 2 hours past agreed cutoff time due to expressway traffic delay..."></textarea>
      </div>

      <div class="detail-grid">
        <div class="field">
          <label>Payment Method Option</label>
          <select id="feePaymentMethod">
            <option value="Apple Pay">Apple Pay</option>
            <option value="Visa Card" selected>Visa Card</option>
            <option value="GCash">GCash QR</option>
            <option value="Cash">Cash on Handover</option>
            <option value="Bank Transfer">Bank Transfer / QR Ph</option>
            <option value="Mastercard">Mastercard</option>
          </select>
        </div>
        <div class="field">
          <label>Settlement Status</label>
          <select id="feeStatus">
            <option value="paid" selected>Paid &amp; Settled Immediately</option>
            <option value="billed">Billed (Pending Customer Payment)</option>
          </select>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:10px;">
        <button type="button" class="btn btn-ghost btn-block" onclick="window.closeModal && window.closeModal();">Cancel</button>
        <button type="button" class="btn btn-primary btn-block" id="btnSaveFeeRecord">
          <i class="fa-solid fa-check"></i> Add Fee to Rental
        </button>
      </div>
    </div>
  `);

  $('#mClose')?.addEventListener('click', closeModal);

  const bSelect = $('#feeBookingSelect');
  const cNameInp = $('#feeCustomerName');
  const vNameInp = $('#feeVehicleName');
  const catSelect = $('#feeCategorySelect');
  const amtInp = $('#feeAmount');

  bSelect?.addEventListener('change', () => {
    const opt = bSelect.options[bSelect.selectedIndex];
    if (opt && opt.value) {
      cNameInp.value = opt.dataset.cname || '';
      vNameInp.value = opt.dataset.vname || '';
    }
  });

  if (preSelectedBookingId && bSelect) {
    bSelect.dispatchEvent(new Event('change'));
  }

  catSelect?.addEventListener('change', () => {
    const opt = catSelect.options[catSelect.selectedIndex];
    if (opt && opt.dataset.amount) {
      amtInp.value = opt.dataset.amount;
    }
  });

  $('#btnSaveFeeRecord')?.addEventListener('click', () => {
    const amt = Number(amtInp.value || 0);
    const catOpt = catSelect.options[catSelect.selectedIndex];

    const fee = {
      id: `FEE-${Date.now().toString().slice(-4)}`,
      booking_id: bSelect.value || '1',
      vehicle_name: vNameInp.value.trim() || 'Vehicle',
      customer_name: cNameInp.value.trim() || 'Customer',
      fee_type: catSelect.value,
      fee_label: catOpt?.dataset.label || catSelect.value,
      amount: amt,
      payment_method: $('#feePaymentMethod').value,
      notes: $('#feeNotes').value.trim() || 'Additional fee attached to rental.',
      status: $('#feeStatus').value,
      assessed_by: state.profile?.full_name || 'Sarah Villanueva (Staff)',
      created_at: new Date().toISOString()
    };

    saveLocalCustomFee(fee);
    toast(`Fee #${fee.id} for ${fmtMoney(amt)} recorded via ${fee.payment_method}!`, 'success');
    closeModal();
    renderStaffDamages(view);
  });
}

export function openDamageAssessmentSlipModal(record) {
  openModal(`
    <div style="max-height:82vh;overflow-y:auto;padding-right:4px;">
      <div class="modal-head" style="margin-bottom:14px;">
        <div>
          <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-hi);margin:0;">Vehicle Damage Assessment Slip</h3>
          <span style="font-size:0.75rem;color:var(--text-mid);">Official Incident Assessment &amp; Deductible Statement</span>
        </div>
        <div class="modal-close" id="mClose">Close</div>
      </div>

      <div style="background:var(--glass-card);border:1px solid var(--glass-border);border-radius:12px;padding:16px;margin-bottom:14px;font-size:0.82rem;">
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--glass-border);">
          <div>
            <div style="font-size:0.7rem;color:var(--text-mid);text-transform:uppercase;">ASSESSMENT VOUCHER</div>
            <strong style="font-family:monospace;font-size:1rem;color:var(--text-hi);">${record.id}</strong>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.7rem;color:var(--text-mid);text-transform:uppercase;">DATE &amp; TIME</div>
            <div style="font-weight:600;color:var(--text-hi);">${fmtDate(record.created_at)}</div>
          </div>
        </div>

        <div class="detail-grid" style="margin-bottom:12px;">
          <div>
            <span style="color:var(--text-mid);font-size:0.75rem;">Vehicle:</span>
            <div style="font-weight:700;color:var(--text-hi);">${record.vehicle_name}</div>
            ${record.plate_number ? `<span style="font-family:monospace;font-size:0.78rem;background:var(--accent-glow);padding:1px 6px;border-radius:4px;">${record.plate_number}</span>` : ''}
          </div>
          <div>
            <span style="color:var(--text-mid);font-size:0.75rem;">Customer:</span>
            <div style="font-weight:700;color:var(--text-hi);">${record.customer_name}</div>
            <div style="font-size:0.75rem;color:var(--text-mid);">${record.customer_phone || 'No phone'}</div>
          </div>
        </div>

        <div style="margin-bottom:12px;background:var(--bg-dark);padding:10px 12px;border-radius:8px;">
          <div style="font-size:0.72rem;color:var(--text-mid);text-transform:uppercase;font-weight:700;margin-bottom:4px;">DAMAGE FINDINGS</div>
          <div style="font-weight:700;color:#dc2626;font-size:0.88rem;">${record.component} (${record.severity?.toUpperCase() || 'MINOR'})</div>
          <p style="margin:4px 0 0 0;font-size:0.78rem;color:var(--text-mid);line-height:1.4;">${record.description}</p>
        </div>

        <div style="border-top:1px dashed var(--glass-border);padding-top:10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;color:var(--text-mid);">
            <span>Gross Repair Estimate:</span>
            <span>${fmtMoney(record.repair_cost)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;color:#059669;">
            <span>Zero-Surprise Deductible Coverage:</span>
            <span>-${fmtMoney(record.deductible_coverage)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--glass-border);font-weight:800;font-size:1.05rem;">
            <span style="color:var(--text-hi);">Net Customer Due:</span>
            <span style="color:#dc2626;">${fmtMoney(record.amount_due)}</span>
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--accent-glow);border-radius:10px;margin-bottom:16px;">
        <div>
          <span style="font-size:0.72rem;color:var(--text-mid);display:block;">SETTLEMENT METHOD</span>
          <strong style="color:var(--accent);font-size:0.85rem;">${record.payment_method} · <span style="text-transform:uppercase;">${record.status}</span></strong>
        </div>
        <div style="text-align:right;">
          <span style="font-size:0.72rem;color:var(--text-mid);display:block;">ASSESSED BY</span>
          <span style="font-size:0.8rem;font-weight:700;color:var(--text-hi);">${record.assessed_by || 'Operations Staff'}</span>
        </div>
      </div>

      <div style="display:flex;gap:10px;">
        <button type="button" class="btn btn-ghost btn-block" onclick="window.print();" style="border:1px solid var(--glass-border);">
          <i class="fa-solid fa-print"></i> Print Slip
        </button>
        <button type="button" class="btn btn-primary btn-block" onclick="window.closeModal && window.closeModal();">
          <i class="fa-solid fa-check"></i> Close
        </button>
      </div>
    </div>
  `);

  $('#mClose')?.addEventListener('click', closeModal);
}

// ---------------------------------------------------------------------------
// Admin Role-Based Access Control (RBAC) Permissions Matrix
// ---------------------------------------------------------------------------
export async function renderAdminRBAC(view) {
  const currentPerms = getRBACPermissions();
  const staffPerms = { ...currentPerms.staff };
  const adminPerms = { ...currentPerms.admin };

  const grantedCount = Object.values(staffPerms).filter(Boolean).length;

  view.innerHTML = `
    <div class="view">
      <div class="section-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;margin-bottom:20px;">
        <div>
          <h2 style="margin:0;font-size:1.4rem;font-weight:800;color:var(--text-hi);display:flex;align-items:center;gap:10px;">
            <i class="fa-solid fa-user-shield" style="color:var(--accent);"></i> Role-Based Access Control (RBAC)
          </h2>
          <p style="color:var(--text-mid);font-size:0.85rem;margin:4px 0 0 0;">
            Define granular permission privileges separating Staff and Admin portals for secure operations.
          </p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="btn btn-ghost btn-sm" id="btnResetRBAC" style="border:1px solid #cbd5e1;display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-rotate-left"></i> Reset Defaults
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="btnSaveRBAC" style="display:flex;align-items:center;gap:6px;">
            <i class="fa-solid fa-floppy-disk"></i> Save Permissions Matrix
          </button>
        </div>
      </div>

      <!-- Role Capability Overview Cards -->
      <div class="grid grid-3" style="margin-bottom:24px;">
        <div class="glass stat-card" style="border-top:3px solid var(--accent);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <div style="width:36px;height:36px;background:var(--accent-glow);color:var(--accent);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;">
              <i class="fa-solid fa-crown"></i>
            </div>
            <div>
              <div style="font-weight:800;color:var(--text-hi);font-size:0.95rem;">Administrator</div>
              <div style="font-size:0.72rem;color:var(--text-mid);">Superuser &amp; System Owner</div>
            </div>
          </div>
          <div style="font-size:0.8rem;color:var(--text-mid);line-height:1.4;">
            Unrestricted access to fleet management, price tier adjustments, RBAC permissions, and financial audit logs.
          </div>
        </div>

        <div class="glass stat-card" style="border-top:3px solid #3b82f6;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <div style="width:36px;height:36px;background:#eff6ff;color:#2563eb;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;">
              <i class="fa-solid fa-user-tie"></i>
            </div>
            <div>
              <div style="font-weight:800;color:var(--text-hi);font-size:0.95rem;">Staff &amp; Operations</div>
              <div style="font-size:0.72rem;color:var(--text-mid);">${grantedCount} Active Capabilities</div>
            </div>
          </div>
          <div style="font-size:0.8rem;color:var(--text-mid);line-height:1.4;">
            Vehicle handover, QR scanner pass check-in, return inspection, damage pay billing, and custom fee surcharges.
          </div>
        </div>

        <div class="glass stat-card" style="border-top:3px solid #10b981;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <div style="width:36px;height:36px;background:#ecfdf5;color:#059669;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;">
              <i class="fa-solid fa-user"></i>
            </div>
            <div>
              <div style="font-weight:800;color:var(--text-hi);font-size:0.95rem;">Renter</div>
              <div style="font-size:0.72rem;color:var(--text-mid);">Self-Service Customer</div>
            </div>
          </div>
          <div style="font-size:0.8rem;color:var(--text-mid);line-height:1.4;">
            Browse fleet recommendations, Apple Pay / Visa checkout, view damage policy, digital Renter ID pass, and rental extension.
          </div>
        </div>
      </div>

      <!-- RBAC Permissions Matrix Table -->
      <div class="rbac-matrix-card">
        <table class="rbac-table">
          <thead>
            <tr>
              <th style="width:45%;">Operational Capability &amp; Scope</th>
              <th style="width:25%;text-align:center;">Staff / Operations Role</th>
              <th style="width:30%;text-align:center;">Administrator Role</th>
            </tr>
          </thead>
          <tbody>
            ${RBAC_DEFINITIONS.map(def => `
              <tr>
                <td>
                  <div style="font-weight:700;color:var(--text-hi);font-size:0.88rem;">${def.label}</div>
                  <div style="font-size:0.75rem;color:var(--text-mid);margin-top:2px;">${def.desc}</div>
                </td>
                <td style="text-align:center;">
                  <label class="rbac-switch" title="Toggle ${def.label} for Staff">
                    <input type="checkbox" class="rbac-staff-toggle" data-perm="${def.key}" ${staffPerms[def.key] ? 'checked' : ''} />
                    <span class="rbac-slider"></span>
                  </label>
                </td>
                <td style="text-align:center;">
                  <label class="rbac-switch" title="Administrator permissions are permanently active">
                    <input type="checkbox" class="rbac-admin-toggle" data-perm="${def.key}" checked disabled />
                    <span class="rbac-slider" style="background-color:var(--accent);opacity:0.85;"></span>
                  </label>
                  <span style="font-size:0.7rem;color:var(--text-mid);margin-left:6px;font-weight:600;">Granted</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="text-align:right;margin-top:14px;">
        <button type="button" class="btn btn-primary" id="btnSaveRBACBottom" style="padding:10px 24px;">
          <i class="fa-solid fa-check"></i> Apply &amp; Save RBAC Configuration
        </button>
      </div>
    </div>
  `;

  function saveMatrix() {
    const updatedStaff = {};
    $$('.rbac-staff-toggle').forEach(chk => {
      updatedStaff[chk.dataset.perm] = chk.checked;
    });
    saveRBACPermissions({
      admin: adminPerms,
      staff: updatedStaff
    });
    toast('RBAC permissions matrix successfully saved and active across all portals!', 'success');
    renderAdminRBAC(view);
  }

  $('#btnSaveRBAC')?.addEventListener('click', saveMatrix);
  $('#btnSaveRBACBottom')?.addEventListener('click', saveMatrix);

  $('#btnResetRBAC')?.addEventListener('click', () => {
    saveRBACPermissions(DEFAULT_PERMISSIONS);
    toast('RBAC settings restored to default permissions.', 'info');
    renderAdminRBAC(view);
  });
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
          <div class="stat-value" style="color:var(--accent);">${availableRentalsCount}</div>
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
  }).join('') : emptyState('', 'No recent activity.')}
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function renderAdminVehicles(view) {
  const canManageFleet = hasPermission('canManageFleet');
  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div><h2>Manage Fleet &amp; Maintenance</h2><p>Add, edit, or track vehicle service history and fleet availability.</p></div>
        <button class="btn btn-primary" id="addVehicleBtn" ${!canManageFleet ? 'disabled title="Requires canManageFleet RBAC permission"' : ''}>+ Add Vehicle</button>
      </div>
      <div class="grid grid-vehicles" id="adminVehicleGrid">
        ${state.vehicles.map(v => {
    const statusBadge = v.status === 'available'
      ? `<span class="badge badge-available">Available</span>`
      : v.status === 'in_service' || v.status === 'maintenance'
        ? `<span class="badge badge-in_service">In Service</span>`
        : v.status === 'scheduled_maint'
          ? `<span class="badge badge-scheduled_maint">Scheduled Maint</span>`
          : v.status === 'off_the_road'
            ? `<span class="badge badge-off_the_road">Off the Road</span>`
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
                  <span>Plate: ${maskPlate(v.plate_number)}</span>
                  <span style="color:#2563eb;font-weight:700;">${fmtMoney(getVehicleDailyRate(v))}/day</span>
                </div>
                <div class="item-actions" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;">
                  ${(v.status === 'in_service' || v.status === 'maintenance' || v.status === 'scheduled_maint') ? `
                    <button class="btn btn-sm" data-quick-available="${v.id}" style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;font-weight:700;" title="Instantly return vehicle to Available fleet">
                      Make Available
                    </button>
                  ` : ''}
                  <button class="btn btn-ghost btn-sm" data-edit="${v.id}">Edit</button>
                  <button class="btn btn-primary btn-sm" data-service-history="${v.id}">Service</button>
                  <button class="btn btn-warning btn-sm" data-log-service="${v.id}">Work Order</button>
                  <button class="btn btn-danger btn-sm" data-del="${v.id}">Delete</button>
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
  $$('[data-quick-available]').forEach(b => b.addEventListener('click', async () => {
    const vId = Number(b.dataset.quickAvailable);
    const targetV = state.vehicles.find(item => item.id === vId);
    b.disabled = true;
    b.textContent = 'Updating…';

    saveVehicleOverride(vId, { status: 'available', maintenance_days: null, maintenance_until: null });
    if (targetV) {
      targetV.status = 'available';
      if (targetV.plate_number) saveVehicleOverride(targetV.plate_number, { status: 'available' });
    }

    try {
      await supabase.from('service_history')
        .update({ service_status: 'completed', completion_date: new Date().toISOString() })
        .eq('vehicle_id', vId)
        .in('service_status', ['in_service', 'scheduled']);
    } catch (e) { }

    try {
      await supabase.from('vehicles')
        .update({ status: 'available', maintenance_days: null, maintenance_until: null })
        .eq('id', vId);
    } catch (e) { }

    toast(`Vehicle ${targetV?.name || ''} is now Available!`, 'success');
    await loadVehicles();
    if (window.renderTab) window.renderTab();
  }));
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
    <div class="modal-head"><h3>${v ? 'Edit' : 'Add'} Vehicle</h3><div class="modal-close" id="mClose">Close</div></div>
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
        <label>Daily Rental Rate (per day)</label>
        <input id="fRate" type="number" step="50" min="100" value="${currentRate}" placeholder="e.g. 2500" required />
      </div>
      <div class="field" id="fMaintDaysBox" style="${(v?.status === 'in_service' || v?.status === 'maintenance' || v?.status === 'scheduled_maint') ? '' : 'display:none;'}">
        <label>Maintenance Duration (Days)</label>
        <input id="fMaintDays" type="number" min="1" max="90" value="${v?.maintenance_days ?? 3}" />
      </div>
    </div>
    <div class="field">
      <label style="font-weight:700;color:#0f172a;">Vehicle Photo</label>
      <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;margin-top:4px;">
        <div id="vImgPreviewBox" style="margin-bottom:10px;">
          ${(v?.image_url || getExactVehicleImage(v || {})) ? `
            <img src="${v?.image_url || getExactVehicleImage(v || {})}" id="vImgPreview" style="max-width:100%;max-height:160px;border-radius:10px;border:1px solid #cbd5e1;object-fit:cover;" />
          ` : `
            <div style="padding:12px 6px;">
              <div style="font-size:0.85rem;font-weight:700;color:#334155;">Upload Vehicle Photo</div>
              <div style="font-size:0.75rem;color:#64748b;">Select image file from your computer (JPG, PNG, WEBP)</div>
            </div>
          `}
        </div>
        <input type="file" id="vFileInput" accept="image/*" style="display:none;" />
        <input type="hidden" id="fImg" value="${v?.image_url ?? ''}" />
        <button type="button" class="btn btn-ghost btn-sm" id="uploadVImgBtn" style="border:1px solid #cbd5e1;background:#ffffff;">
          Choose Image File
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
    const val = e.target.value;
    $('#fMaintDaysBox').style.display = (val === 'maintenance' || val === 'in_service' || val === 'scheduled_maint') ? 'block' : 'none';
  });

  $('#saveVehicle').addEventListener('click', async () => {
    const selectedStatus = $('#fStatus').value;
    const isMaint = (selectedStatus === 'maintenance' || selectedStatus === 'in_service' || selectedStatus === 'scheduled_maint');
    const maintDays = isMaint ? Math.max(1, Number($('#fMaintDays').value || 3)) : null;
    const maintUntil = isMaint ? new Date(Date.now() + (maintDays || 3) * 86400000).toISOString() : null;
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

    // Immediate local persistence
    if (v) {
      saveVehicleOverride(v.id, payload);
      if (v.plate_number) saveVehicleOverride(v.plate_number, payload);
      Object.assign(v, payload);
    }
    if (payload.plate_number) saveVehicleOverride(payload.plate_number, payload);

    if (selectedStatus === 'available' && v?.id) {
      try {
        await supabase.from('service_history')
          .update({ service_status: 'completed', completion_date: new Date().toISOString() })
          .eq('vehicle_id', v.id)
          .in('service_status', ['in_service', 'scheduled']);
      } catch (e) { }
    }

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
  const [allProfiles, bookings] = await Promise.all([
    fetchMergedProfiles(),
    fetchMergedBookings()
  ]);

  const customers = allProfiles.filter(p => p.role === 'customer');

  const customerList = (customers || []).map(c => {
    const cBookings = (bookings || []).filter(b => b.customer_id === c.id || (b.profiles && b.profiles.full_name === c.full_name));
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
          <div class="stat-value" style="color:var(--accent);">${activeRentersCount}</div>
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
          With License (${verifiedLicenseCount})
        </div>
        <div class="pill ${customerStatusFilter === 'no_license' ? 'active' : ''}" data-cfilter="no_license" style="${customerStatusFilter === 'no_license' ? 'background:#dc2626;color:#fff;border-color:#dc2626;' : 'border-color:#fecdd3;color:#e11d48;background:#fff1f2;'}">
          No License (${noLicenseCount})
        </div>
        <div class="pill ${customerStatusFilter === 'active_renter' ? 'active' : ''}" data-cfilter="active_renter">Active Renters (${activeRentersCount})</div>
        <div class="pill ${customerStatusFilter === 'pending' ? 'active' : ''}" data-cfilter="pending">Pending Requests (${pendingCount})</div>
      </div>

      <div class="row-list">
        ${filteredCustomers.length ? filteredCustomers.map(c => {
    let badgeHTML = '<span class="badge badge-available">Idle</span>';
    if (c.liveStatus === 'active_renter') badgeHTML = '<span class="badge badge-completed">Active Renter</span>';
    else if (c.liveStatus === 'approved') badgeHTML = '<span class="badge badge-approved">Approved</span>';
    else if (c.liveStatus === 'pending') badgeHTML = '<span class="badge badge-pending">Pending Request</span>';

    const licenseBadge = c.hasLicense
      ? `<span class="badge badge-completed" style="font-size:0.75rem;">${c.license_number ? c.license_number : 'ID Photo Provided'}</span>`
      : `<span class="badge badge-rejected" style="font-size:0.75rem;">No License Provided</span>`;

    const initials = (c.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    return `
            <div class="glass item-row" style="padding:16px 20px;cursor:pointer;" data-cust-click-id="${c.id}">
              <div style="width:42px;height:42px;border-radius:50%;background:var(--primary-gradient);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;flex-shrink:0;">
                ${initials}
              </div>
              <div class="item-main">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                  <div class="item-title" style="font-size:1rem;">${c.full_name}</div>
                  ${badgeHTML}
                  ${licenseBadge}
                </div>
                <div class="item-sub" style="margin-top:2px;">
                  <span>Phone: ${c.phone ?? 'No phone'}</span>
                  <span style="margin:0 6px;">·</span>
                  <span>Address: ${c.address ?? 'No address'}</span>
                </div>
                <div class="item-sub" style="margin-top:2px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                  <span>Total Bookings: <strong>${c.totalBookings}</strong></span>
                  <span>Total Spent: <strong style="color:#059669;">${fmtMoney(c.totalSpent)}</strong></span>
                  ${c.license_expiry ? `<span>Expiry: <strong>${fmtDate(c.license_expiry)}</strong></span>` : ''}
                </div>
                ${c.activeRental ? `
                  <div style="margin-top:4px;font-size:0.78rem;color:#047857;font-weight:600;">
                    Current Vehicle: <strong>${c.activeRental.vehicles?.name ?? 'Vehicle'}</strong> (${maskPlate(c.activeRental.vehicles?.plate_number ?? '')}) · ${fmtDate(c.activeRental.start_date)} → ${fmtDate(c.activeRental.end_date)}
                  </div>
                ` : ''}
              </div>
              <div class="item-actions">
                <button class="btn btn-ghost btn-sm" data-cust-manage-id="${c.id}" style="color:var(--accent);border:1px solid #cbd5e1;">
                  Manage &amp; View
                </button>
              </div>
            </div>
          `;
  }).join('') : emptyState('', 'No customers match the filter.')}
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
          <div style="width:40px;height:40px;border-radius:50%;background:var(--primary-gradient);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;">
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
              ${c.hasLicense ? 'Driver License Provided' : 'No Driver License On File'}
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
                <div style="font-size:0.8rem;color:var(--text-mid);padding:10px 0;">No license ID card photo uploaded.</div>
              `}
            </div>
            <input type="file" id="admFileLicense" accept="image/*" style="display:none;" />
            <input type="hidden" id="admHiddenLicenseUrl" value="${c.license_id_url ?? ''}" />
            <button type="button" class="btn btn-ghost btn-sm" id="admUploadLicenseBtn" style="border:1px solid var(--glass-border);">
              ${c.license_id_url ? 'Replace License Photo' : 'Upload License Photo'}
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
            Save Customer Details
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

      saveCustomProfile(c.id, updated);
      try {
        let { error } = await supabase.from('profiles').update(updated).eq('id', c.id);
        if (error) {
          try {
            await supabase.from('profiles').update(standardPayload).eq('id', c.id);
          } catch (e) { }
        }
      } catch (err) {}

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
  const canManageUsers = hasPermission('canManageUsers');
  const allUsers = await fetchMergedProfiles();

  // In System Roles: strictly Staff and Admin accounts only
  const users = allUsers.filter(u => u.role === 'staff' || u.role === 'admin');

  const staffCount = users.filter(u => u.role === 'staff').length;
  const adminCount = users.filter(u => u.role === 'admin').length;

  const filteredUsers = users.filter(u => {
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const nameStr = (u.full_name || '').toLowerCase();
    const phoneStr = (u.phone || '').toLowerCase();
    const emailStr = (u.email || '').toLowerCase();
    const searchLower = userSearchQuery.toLowerCase();
    const matchesSearch = nameStr.includes(searchLower) || phoneStr.includes(searchLower) || emailStr.includes(searchLower);
    return matchesRole && matchesSearch;
  });

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2>System Roles &amp; Staff Access</h2>
          <p>Manage internal operational staff, assign administrative privileges, and secure role credentials.</p>
        </div>
      </div>

      <div class="search-bar" style="margin-bottom:14px;">
        <div style="position:relative;flex:1;">
          <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8;"></i>
          <input type="text" id="userSearchInput" style="padding-left:40px;" placeholder="Search staff &amp; administrators by name, phone, or email…" value="${userSearchQuery}" />
        </div>
      </div>

      <div class="pill-row" id="userRolePills" style="margin-bottom:18px;">
        <div class="pill ${userRoleFilter === 'all' ? 'active' : ''}" data-role="all">All Roles (${users.length})</div>
        <div class="pill ${userRoleFilter === 'staff' ? 'active' : ''}" data-role="staff">Staff (${staffCount})</div>
        <div class="pill ${userRoleFilter === 'admin' ? 'active' : ''}" data-role="admin">Administrators (${adminCount})</div>
      </div>

      <div class="glass" style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Team Member</th>
              <th>Contact Phone</th>
              <th>Email Address</th>
              <th>Address / Station</th>
              <th>System Role</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${filteredUsers.length ? filteredUsers.map(u => `
              <tr>
                <td>
                  <div style="font-weight:700;color:#0f172a;">${u.full_name}${u.id === state.user?.id ? ' <span class="muted">(you)</span>' : ''}</div>
                </td>
                <td>${u.phone ? `<span style="font-weight:600;">${u.phone}</span>` : '<span class="muted">—</span>'}</td>
                <td style="font-size:0.82rem;color:#475569;">${u.email ?? '—'}</td>
                <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:0.8rem;color:#475569;">${u.address ?? 'Main Branch Hub'}</td>
                <td><span class="badge badge-${u.role === 'admin' ? 'approved' : 'pending'}">${u.role === 'admin' ? 'Administrator' : 'Staff'}</span></td>
                <td style="font-size:0.8rem;color:#64748b;">${fmtDate(u.created_at)}</td>
                <td>
                  <select data-role-select="${u.id}" ${(u.id === state.user?.id || !canManageUsers) ? 'disabled' : ''} style="font-size:0.8rem;padding:4px 8px;">
                    <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Staff</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrator</option>
                  </select>
                </td>
              </tr>
            `).join('') : `<tr><td colspan="7">${emptyState('', 'No staff or administrators found matching your search.')}</td></tr>`}
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

  $$('[data-role-select]').forEach(sel => sel.addEventListener('change', async (e) => {
    const newRole = e.target.value;
    const userId = sel.dataset.roleSelect;
    saveUserRole(userId, newRole);
    try {
      await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    } catch (err) {}
    toast(`User role updated to ${getRoleDisplayName(newRole)}.`, 'success');
    renderAdminUsers(view);
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
        <img src="${u.license_id_url}" style="max-width:100%;max-height:360px;border-radius:12px;border:2px solid var(--accent);box-shadow:0 8px 24px rgba(0,0,0,0.15);" />
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-top:12px;" class="detail-grid">
        <div><label>Customer Name</label><div style="font-weight:700;color:#0f172a;">${u.full_name}</div></div>
        <div><label>Contact Phone</label><div style="font-weight:600;color:#0f172a;">${u.phone ?? '—'}</div></div>
        <div><label>License No.</label><div style="font-weight:700;font-family:monospace;color:var(--accent);">${u.license_number ?? '—'}</div></div>
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
      <div class="section-head">
        <div>
          <h2>Rentals &amp; Transactions</h2>
          <p>Every booking, rental duration, and payment status.</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="window.openRentalExtensionModal && window.openRentalExtensionModal()">
          <i class="fa-solid fa-clock-rotate-left"></i> Extend a Rental
        </button>
      </div>
      <div class="glass" style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Customer</th>
              <th>Dates</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Payments</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${bookings.map(b => `
              <tr>
                <td>${b.vehicles?.name || 'Vehicle'} <span class="muted">(${b.vehicles?.plate_number || 'N/A'})</span></td>
                <td>${getBookingCustomerName(b)}</td>
                <td>${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</td>
                <td>${fmtMoney(b.total_amount)}</td>
                <td><span class="badge badge-${b.status}">${b.status}</span></td>
                <td>${(b.payments || []).map(p => `<span class="badge badge-${p.status}" style="margin-right:4px;">${fmtMoney(p.amount)}</span>`).join('') || '—'}</td>
                <td>
                  ${['approved', 'active', 'reserved'].includes(b.status)
                    ? `<button type="button" class="btn btn-secondary btn-xs" onclick="window.openRentalExtensionModal && window.openRentalExtensionModal('${b.id}')"><i class="fa-solid fa-clock-rotate-left"></i> Extend</button>`
                    : '—'}
                </td>
              </tr>
            `).join('') || `<tr><td colspan="7" class="center muted">No bookings yet.</td></tr>`}
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
          <div class="stat-value" style="color:var(--accent);">${utilizationPercent}%</div>
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
              <span style="font-weight:700;color:var(--accent);">${utilizationPercent}%</span>
            </div>
            <div style="background:#e2e8f0;border-radius:6px;height:12px;overflow:hidden;">
              <div style="width:${utilizationPercent}%;height:100%;background:var(--primary-gradient);border-radius:6px;"></div>
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
                <div style="width:${Math.min(100, s.count * 15)}%;height:100%;background:var(--accent);border-radius:6px;"></div>
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
        <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;">Log Maintenance Work Order</h3>
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
        <label>Estimated Cost</label>
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
      Log Work Order &amp; Update Status
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
    saveVehicleOverride(vehicleId, { status: vehicleNextStatus });
    const targetV = state.vehicles.find(item => item.id === vehicleId);
    if (targetV) {
      targetV.status = vehicleNextStatus;
      if (targetV.plate_number) saveVehicleOverride(targetV.plate_number, { status: vehicleNextStatus });
    }
    try {
      await supabase.from('vehicles').update({ status: vehicleNextStatus }).eq('id', vehicleId);
    } catch (e) {}

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
    ? `<span class="badge badge-available">Available</span>`
    : v.status === 'in_service' || v.status === 'maintenance'
      ? `<span class="badge badge-in_service">In Service</span>`
      : v.status === 'scheduled_maint'
        ? `<span class="badge badge-scheduled_maint">Scheduled Maint</span>`
        : v.status === 'off_the_road'
          ? `<span class="badge badge-off_the_road">Off the Road</span>`
          : `<span class="badge badge-${v.status}">${v.status}</span>`;

  const modal = openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.15rem;font-weight:800;color:#0f172a;">Maintenance &amp; Complete Works</h3>
        <span class="muted" style="font-size:0.78rem;">${v.name} · Plate: ${v.plate_number || '—'}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        ${statusBadge}
        <div class="modal-close" id="mClose">✕</div>
      </div>
    </div>

    ${(v.status === 'in_service' || v.status === 'maintenance' || v.status === 'scheduled_maint' || v.status === 'off_the_road') ? `
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-weight:700;color:#065f46;font-size:0.88rem;">Current Fleet Status: ${statusBadge}</div>
          <div style="font-size:0.76rem;color:#047857;">Mark this vehicle as fully serviced and ready for customer bookings.</div>
        </div>
        <button class="btn btn-primary btn-sm" id="btnMarkAvailableNow" style="background:#059669;border-color:#059669;white-space:nowrap;">
          Return to Available Fleet
        </button>
      </div>
    ` : ''}

    <div class="receipt" style="margin-bottom:16px;background:#f8fafc;">
      <div class="receipt-row"><span>Active Work Orders</span><span style="font-weight:700;color:#0f172a;">${activeOrders.length} order(s)</span></div>
      <div class="receipt-row"><span>Completed Work Orders</span><span style="font-weight:700;color:#059669;">${completedOrders.length} finished job(s)</span></div>
      <div class="receipt-row receipt-total"><span>Total Maintenance Invested</span><span style="color:var(--accent);">${fmtMoney(totalCostSpent)}</span></div>
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;color:#0f172a;font-size:0.92rem;">
      <span>Active Maintenance Work Orders</span>
      <button class="btn btn-primary btn-sm" id="btnLogNewSrv" style="background:#0284c7;border-color:#0284c7;font-size:0.75rem;">Log Work Order</button>
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
            Complete Work Order &amp; Release Vehicle
          </button>
        </div>
      `).join('') : `
        <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:14px;text-align:center;color:#64748b;font-size:0.82rem;">
          No active repairs or maintenance needed for this vehicle.
        </div>
      `}
    </div>

    <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:6px;color:#0f172a;font-size:0.92rem;">
      Complete Works &amp; Service History
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

  const markAvailBtn = $('#btnMarkAvailableNow');
  if (markAvailBtn) {
    markAvailBtn.addEventListener('click', async () => {
      markAvailBtn.disabled = true;
      markAvailBtn.textContent = 'Releasing…';

      saveVehicleOverride(vehicleId, { status: 'available', maintenance_days: null, maintenance_until: null });
      const targetV = state.vehicles.find(item => item.id === vehicleId);
      if (targetV) {
        targetV.status = 'available';
        if (targetV.plate_number) saveVehicleOverride(targetV.plate_number, { status: 'available' });
      }

      try {
        await supabase.from('service_history')
          .update({ service_status: 'completed', completion_date: new Date().toISOString() })
          .eq('vehicle_id', vehicleId)
          .in('service_status', ['in_service', 'scheduled']);
      } catch (e) { }

      try {
        await supabase.from('vehicles')
          .update({ status: 'available', maintenance_days: null, maintenance_until: null })
          .eq('id', vehicleId);
      } catch (e) { }

      toast(`${v.name} is now Available in the rental fleet!`, 'success');
      closeModal();
      await loadVehicles();
      if (window.renderTab) window.renderTab();
    });
  }

  $$('[data-complete-srv-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const srvId = Number(btn.dataset.completeSrvId);
      if (!confirm('Mark this service work order as complete and release vehicle back to Available status?')) return;

      btn.disabled = true;
      btn.textContent = 'Completing Order…';

      saveVehicleOverride(vehicleId, { status: 'available', maintenance_days: null, maintenance_until: null });
      const targetV = state.vehicles.find(item => item.id === vehicleId);
      if (targetV) {
        targetV.status = 'available';
        if (targetV.plate_number) saveVehicleOverride(targetV.plate_number, { status: 'available' });
      }

      try {
        await supabase.from('service_history').update({
          service_status: 'completed',
          completion_date: new Date().toISOString()
        }).eq('id', srvId);
      } catch (e) {}

      try {
        await supabase.from('vehicles').update({ status: 'available', maintenance_days: null, maintenance_until: null }).eq('id', vehicleId);
      } catch (e) {}

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
  const appr = currentSettings.appearance || DEFAULT_SETTINGS.appearance || {};

  view.innerHTML = `
    <div class="view">
      <div class="section-head">
        <div>
          <h2>System Settings &amp; Configuration</h2>
          <p>Customize company profile, rental policies, notification preferences, and system appearance.</p>
        </div>
      </div>

      <div class="pill-row" style="margin-bottom:20px;">
        <div class="pill ${activeSettingsSubTab === 'company' ? 'active' : ''}" data-cfg-tab="company">
          Company Profile
        </div>
        <div class="pill ${activeSettingsSubTab === 'policy' ? 'active' : ''}" data-cfg-tab="policy">
          Rental Policy &amp; Terms
        </div>
        <div class="pill ${activeSettingsSubTab === 'notifs' ? 'active' : ''}" data-cfg-tab="notifs">
          Notification Preferences
        </div>
        <div class="pill ${activeSettingsSubTab === 'appearance' ? 'active' : ''}" data-cfg-tab="appearance">
          Appearance &amp; Theme
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
        <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:16px;">
          Company Profile &amp; Contact Details
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
            <input type="text" id="cfgCompCurrency" value="${comp.currency || 'PHP'}" placeholder="PHP" />
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
          Save Company Profile
        </button>
      </div>
    `;
  } else if (tab === 'policy') {
    return `
      <div class="setting-card">
        <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:16px;">
          Rental Policies &amp; Penalty Terms
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
            <label>Overdue / Late Return Fee (per hour)</label>
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
          Save Rental Policies
        </button>
      </div>
    `;
  } else if (tab === 'notifs') {
    return `
      <div class="setting-card">
        <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:16px;">
          System Notification Preferences
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
          Save Notification Preferences
        </button>
      </div>
    `;
  } else if (tab === 'appearance') {
    const currentAccent = appr.accentColor || '#7c3aed';
    return `
      <div class="setting-card">
        <h3 style="font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:16px;">
          Appearance &amp; System Theme
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
            <div class="color-swatch ${currentAccent === '#7c3aed' ? 'active' : ''}" data-color="#7c3aed" style="background:#7c3aed;" title="Vibrant Purple"></div>
            <div class="color-swatch ${currentAccent === '#2563eb' ? 'active' : ''}" data-color="#2563eb" style="background:#2563eb;" title="Friendly Blue"></div>
            <div class="color-swatch ${currentAccent === '#059669' ? 'active' : ''}" data-color="#059669" style="background:#059669;" title="Emerald Green"></div>
            <div class="color-swatch ${currentAccent === '#4f46e5' ? 'active' : ''}" data-color="#4f46e5" style="background:#4f46e5;" title="Royal Indigo"></div>
            <div class="color-swatch ${currentAccent === '#e11d48' ? 'active' : ''}" data-color="#e11d48" style="background:#e11d48;" title="Deep Coral"></div>
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

        <button class="btn btn-primary" id="btnSaveAppr" style="margin-top:14px;background:#7c3aed;border-color:#7c3aed;">
          Apply Theme &amp; Appearance
        </button>
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
}

// ==========================================
// VENUE EXPRESS QR PASS SCANNER ENGINE
// ==========================================

let activeModalQrScanner = null;
window._activeStaffPageScanner = null;

export function playScanBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {}
}

export function parseScannedQrCode(text) {
  if (!text) return '';
  const str = String(text).trim();

  // 1. REF CODE: BK-... (ID: #...)
  const refCodeMatch = str.match(/REF\s*CODE:\s*([A-Za-z0-9_-]+)/i);
  if (refCodeMatch && refCodeMatch[1]) return refCodeMatch[1];

  // 2. ID: #...
  const idMatch = str.match(/ID:\s*#?([A-Za-z0-9_-]+)/i);
  if (idMatch && idMatch[1]) return idMatch[1];

  // 3. BK-... pattern
  const bkMatch = str.match(/BK-[A-Za-z0-9_-]+/i);
  if (bkMatch) return bkMatch[0];

  // 4. REF-... pattern
  const refMatch = str.match(/REF-[A-Za-z0-9_-]+/i);
  if (refMatch) return refMatch[0];

  // 5. URL parameter match (?ref=... or ?id=...)
  const urlParamMatch = str.match(/[?&](?:ref|id|code)=([A-Za-z0-9_-]+)/i);
  if (urlParamMatch) return urlParamMatch[1];

  return str.split('\n')[0].trim();
}

function renderVerifiedPassCard(b, onScanAgain, onDismiss) {
  const v = b.vehicles || {};
  const cName = getBookingCustomerName(b);
  const cPhone = getBookingCustomerPhone(b);
  const isPartial = b.balance_due && Number(b.balance_due) > 0;

  return `
    <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:14px;padding:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span class="badge badge-completed" style="font-size:0.78rem;">
          <i class="fa-solid fa-circle-check" style="margin-right:4px;"></i> PASS VERIFIED · ${b.status.toUpperCase()}
        </span>
        <span style="font-family:monospace;font-weight:800;color:#0f172a;font-size:0.88rem;">
          ${b.ref_number || ('#' + b.id)}
        </span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.82rem;color:#1e293b;margin-bottom:14px;">
        <div><span style="color:#64748b;">Customer:</span> <strong>${cName}</strong></div>
        <div><span style="color:#64748b;">Phone:</span> <strong>${cPhone || 'N/A'}</strong></div>
        <div><span style="color:#64748b;">Vehicle:</span> <strong>${v.name || 'Vehicle'}</strong></div>
        <div><span style="color:#64748b;">Plate:</span> <strong>${v.plate_number ? maskPlate(v.plate_number) : 'N/A'}</strong></div>
        <div><span style="color:#64748b;">Rental Dates:</span> <strong>${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</strong></div>
        <div><span style="color:#64748b;">Payment:</span> <strong style="color:#059669;">${fmtMoney(b.paid_amount || b.total_amount)} Paid</strong></div>
        <div style="grid-column:span 2;background:#fff;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;margin-top:4px;">
          ${isPartial
            ? `<span style="color:#d97706;font-weight:700;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:4px;"></i> Remaining Balance Due: ${fmtMoney(b.balance_due)}</span> (Collect before key handover)`
            : `<span style="color:#059669;font-weight:700;"><i class="fa-solid fa-check-double" style="margin-right:4px;"></i> Fully Paid (0.00 Balance Due)</span>`}
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="btn btn-ghost btn-sm" id="btnPassViewReceipt" style="flex:1;">
          <i class="fa-solid fa-receipt" style="margin-right:4px;"></i> View Receipt &amp; QR
        </button>
        <button type="button" class="btn btn-primary btn-sm" id="btnPassCheckIn" style="flex:1;">
          <i class="fa-solid fa-key" style="margin-right:4px;"></i> Release Vehicle &amp; Handover
        </button>
        <button type="button" class="btn btn-ghost btn-sm" id="btnPassScanAnother" style="flex:1;background:#fff;border:1px solid #cbd5e1;">
          <i class="fa-solid fa-camera" style="margin-right:4px;"></i> Scan Another
        </button>
      </div>
    </div>
  `;
}

export function openVenuePassVerificationModal(bookings = []) {
  const modal = openModal(`
    <div class="modal-head" style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:38px;height:38px;border-radius:10px;background:rgba(124,58,237,0.1);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:1.15rem;">
          <i class="fa-solid fa-qrcode"></i>
        </div>
        <div>
          <h3 style="margin:0;font-size:1.15rem;font-weight:800;color:#0f172a;">Venue Express QR Pass Verification</h3>
          <span class="muted" style="font-size:0.78rem;">Live camera scanning, image upload, and fast check-in</span>
        </div>
      </div>
      <div class="modal-close" id="mClosePass">Close</div>
    </div>

    <!-- Mode Tabs: Camera, Upload, Manual -->
    <div class="qr-mode-tabs" id="qrModalTabs">
      <button type="button" class="qr-mode-tab active" data-tab="camera">
        <i class="fa-solid fa-camera"></i> Live Camera
      </button>
      <button type="button" class="qr-mode-tab" data-tab="upload">
        <i class="fa-solid fa-image"></i> Upload QR Image
      </button>
      <button type="button" class="qr-mode-tab" data-tab="manual">
        <i class="fa-solid fa-keyboard"></i> Manual Code
      </button>
    </div>

    <!-- Live Camera Scanner -->
    <div id="qrModalCameraSection">
      <div class="qr-reader-wrap" id="qrModalReaderWrap">
        <div id="qrModalReader" style="width:100%;height:100%;"></div>
        <div class="qr-scanner-reticle" id="qrModalReticle" style="display:none;">
          <div class="qr-laser-line"></div>
        </div>
        <div class="qr-cam-toolbar" id="qrModalToolbar" style="display:none;">
          <button type="button" class="qr-cam-btn" id="qrModalFlipBtn" title="Switch Camera">
            <i class="fa-solid fa-camera-rotate"></i> Flip
          </button>
          <button type="button" class="qr-cam-btn" id="qrModalStopBtn" title="Stop Camera" style="color:#ef4444;">
            <i class="fa-solid fa-stop"></i> Stop
          </button>
        </div>
        <div id="qrModalStartOverlay" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(15,23,42,0.85);color:#fff;padding:20px;text-align:center;z-index:4;">
          <i class="fa-solid fa-expand" style="font-size:2.4rem;color:#c084fc;margin-bottom:12px;"></i>
          <div style="font-weight:700;font-size:0.95rem;margin-bottom:4px;">Camera QR Scanner Ready</div>
          <p style="font-size:0.78rem;color:#94a3b8;margin:0 0 16px;max-width:280px;">Align customer QR pass within camera viewfinder to verify instantly.</p>
          <button type="button" class="btn btn-primary btn-sm" id="qrModalStartBtn" style="padding:8px 18px;font-size:0.85rem;">
            <i class="fa-solid fa-video" style="margin-right:6px;"></i> Start Camera
          </button>
        </div>
      </div>
      <div id="qrModalCamNotice" style="text-align:center;font-size:0.75rem;color:#64748b;margin-bottom:12px;">
        Supports smartphone cameras, laptop webcams &amp; physical barcode/QR scans.
      </div>
    </div>

    <!-- Upload Image Section -->
    <div id="qrModalUploadSection" style="display:none;margin-bottom:16px;">
      <div class="qr-dropzone" id="qrModalDropzone">
        <i class="fa-solid fa-cloud-arrow-up" style="font-size:2.2rem;color:var(--accent);margin-bottom:8px;display:block;"></i>
        <div style="font-weight:700;font-size:0.88rem;color:#0f172a;margin-bottom:4px;">Upload or Drop QR Code Photo</div>
        <div style="font-size:0.75rem;color:#64748b;margin-bottom:12px;">Choose a photo or screenshot from the customer's phone</div>
        <input type="file" id="qrModalFileInput" accept="image/*" style="display:none;" />
        <button type="button" class="btn btn-ghost btn-sm" id="qrModalFileSelectBtn" style="border:1px solid #cbd5e1;background:#fff;">
          <i class="fa-solid fa-folder-open" style="margin-right:6px;"></i> Choose Image File
        </button>
      </div>
    </div>

    <!-- Manual Code Section -->
    <div id="qrModalManualSection" style="display:none;margin-bottom:16px;">
      <div class="field" style="margin:0;">
        <label style="font-weight:700;font-size:0.82rem;color:#334155;">Enter Booking Reference / Pass Code</label>
        <div style="display:flex;gap:8px;">
          <input type="text" id="venuePassInput" placeholder="e.g. BK-..., REF-..., or Booking ID" style="flex:1;font-size:0.95rem;font-family:monospace;padding:10px 12px;" />
          <button type="button" class="btn btn-primary" id="btnLookupPass"><i class="fa-solid fa-magnifying-glass" style="margin-right:4px;"></i> Verify</button>
        </div>
      </div>
    </div>

    <!-- Result Area -->
    <div id="venuePassResult" style="min-height:100px;">
      <div style="text-align:center;padding:20px 16px;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;color:#64748b;">
        <i class="fa-solid fa-barcode" style="font-size:1.8rem;margin-bottom:6px;color:#94a3b8;display:block;"></i>
        <div style="font-size:0.85rem;font-weight:600;">Awaiting scan or code entry…</div>
        <div style="font-size:0.75rem;margin-top:4px;">Start camera scanner above, upload a QR photo, or enter reference code.</div>
      </div>
    </div>
  `, true);

  const input = modal.querySelector('#venuePassInput');
  const btn = modal.querySelector('#btnLookupPass');
  const result = modal.querySelector('#venuePassResult');
  const mClose = modal.querySelector('#mClosePass');

  const camSection = modal.querySelector('#qrModalCameraSection');
  const uploadSection = modal.querySelector('#qrModalUploadSection');
  const manualSection = modal.querySelector('#qrModalManualSection');

  const startBtn = modal.querySelector('#qrModalStartBtn');
  const stopBtn = modal.querySelector('#qrModalStopBtn');
  const flipBtn = modal.querySelector('#qrModalFlipBtn');
  const startOverlay = modal.querySelector('#qrModalStartOverlay');
  const reticle = modal.querySelector('#qrModalReticle');
  const toolbar = modal.querySelector('#qrModalToolbar');
  const camNotice = modal.querySelector('#qrModalCamNotice');

  const dropzone = modal.querySelector('#qrModalDropzone');
  const fileInput = modal.querySelector('#qrModalFileInput');
  const fileSelectBtn = modal.querySelector('#qrModalFileSelectBtn');

  let camerasList = [];
  let currentCamIdx = 0;

  // Cleanup helper
  const cleanupCamera = async () => {
    if (activeModalQrScanner) {
      try {
        if (activeModalQrScanner.isScanning) await activeModalQrScanner.stop();
        activeModalQrScanner.clear();
      } catch (e) {}
      activeModalQrScanner = null;
    }
  };

  const closeModalSafe = async () => {
    await cleanupCamera();
    closeModal();
  };

  if (mClose) mClose.addEventListener('click', closeModalSafe);

  // Tab switching
  modal.querySelectorAll('#qrModalTabs .qr-mode-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', async () => {
      modal.querySelectorAll('#qrModalTabs .qr-mode-tab').forEach(t => t.classList.remove('active'));
      tabBtn.classList.add('active');
      const target = tabBtn.dataset.tab;

      if (target === 'camera') {
        camSection.style.display = 'block';
        uploadSection.style.display = 'none';
        manualSection.style.display = 'none';
      } else if (target === 'upload') {
        await stopCamera();
        camSection.style.display = 'none';
        uploadSection.style.display = 'block';
        manualSection.style.display = 'none';
      } else if (target === 'manual') {
        await stopCamera();
        camSection.style.display = 'none';
        uploadSection.style.display = 'none';
        manualSection.style.display = 'block';
        input.focus();
      }
    });
  });

  // Start Camera
  async function startCamera() {
    if (typeof window.Html5Qrcode === 'undefined') {
      toast('Scanner library loading. Please wait a moment.', 'info');
      return;
    }

    try {
      if (!activeModalQrScanner) {
        activeModalQrScanner = new window.Html5Qrcode('qrModalReader');
      }

      try {
        camerasList = await window.Html5Qrcode.getCameras();
      } catch (e) {
        camerasList = [];
      }

      const cameraConfig = camerasList.length > 0 
        ? camerasList[currentCamIdx % camerasList.length].id 
        : { facingMode: 'environment' };

      await activeModalQrScanner.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: { width: 230, height: 230 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          playScanBeep();
          toast('QR Code detected!', 'success');
          stopCamera();
          const parsed = parseScannedQrCode(decodedText);
          input.value = parsed;
          doLookup(parsed);
        },
        () => {}
      );

      if (startOverlay) startOverlay.style.display = 'none';
      if (reticle) reticle.style.display = 'block';
      if (toolbar) toolbar.style.display = 'flex';
      if (camNotice) camNotice.innerHTML = '<span style="color:#059669;font-weight:700;">● Camera Active</span> — Align QR code inside frame.';
    } catch (err) {
      console.warn('Camera failed to start:', err);
      if (startOverlay) startOverlay.style.display = 'flex';
      if (reticle) reticle.style.display = 'none';
      if (toolbar) toolbar.style.display = 'none';
      if (camNotice) camNotice.innerHTML = `<span style="color:#dc2626;font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Camera permission needed or unavailable.</span> Use Upload QR Image or Manual Code.`;
      toast('Camera notice: ' + (err.message || 'Permission denied'), 'error');
    }
  }

  // Stop Camera
  async function stopCamera() {
    if (activeModalQrScanner && activeModalQrScanner.isScanning) {
      try {
        await activeModalQrScanner.stop();
      } catch(e) {}
    }
    if (startOverlay) startOverlay.style.display = 'flex';
    if (reticle) reticle.style.display = 'none';
    if (toolbar) toolbar.style.display = 'none';
    if (camNotice) camNotice.innerHTML = 'Camera paused. Click Start Camera to resume scanning.';
  }

  // Flip Camera
  async function flipCamera() {
    if (camerasList.length > 1) {
      currentCamIdx = (currentCamIdx + 1) % camerasList.length;
      await stopCamera();
      await startCamera();
      toast('Switched camera', 'info');
    } else {
      toast('Only 1 camera detected on this system.', 'info');
    }
  }

  if (startBtn) startBtn.addEventListener('click', startCamera);
  if (stopBtn) stopBtn.addEventListener('click', stopCamera);
  if (flipBtn) flipBtn.addEventListener('click', flipCamera);

  // File Upload handling
  if (fileSelectBtn) fileSelectBtn.addEventListener('click', () => fileInput.click());
  if (dropzone) {
    dropzone.addEventListener('click', (e) => {
      if (e.target !== fileSelectBtn) fileInput.click();
    });
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processUploadedQrFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processUploadedQrFile(e.target.files[0]);
      }
    });
  }

  async function processUploadedQrFile(file) {
    if (typeof window.Html5Qrcode === 'undefined') {
      toast('Scanner library loading. Please try again.', 'info');
      return;
    }
    toast('Scanning uploaded image for QR code…', 'info');
    try {
      const tempScanner = activeModalQrScanner || new window.Html5Qrcode('qrModalReader');
      const decodedText = await tempScanner.scanFile(file, true);
      playScanBeep();
      toast('QR Code verified from image!', 'success');
      const parsed = parseScannedQrCode(decodedText);
      input.value = parsed;
      doLookup(parsed);
    } catch (err) {
      console.warn('QR file decoding failed:', err);
      toast('No readable QR code found in uploaded image. Please try another photo.', 'error');
    }
  }

  // Lookup & Verification logic
  async function doLookup(overrideCode = '') {
    const raw = (overrideCode || input.value || '').trim();
    if (!raw) {
      toast('Please enter or scan a Booking Reference or ID.', 'error');
      return;
    }
    const clean = raw.toLowerCase();
    let allList = bookings && bookings.length ? bookings : await fetchMergedBookings();

    const b = (allList || []).find(item => {
      const idMatch = String(item.id).toLowerCase() === clean;
      const refMatch = String(item.ref_number || '').toLowerCase() === clean;
      const nameMatch = String(item.customer_name || '').toLowerCase().includes(clean);
      const rawContains = clean.includes(String(item.id).toLowerCase()) || (item.ref_number && clean.includes(String(item.ref_number).toLowerCase()));
      return idMatch || refMatch || nameMatch || rawContains;
    });

    if (!b) {
      result.innerHTML = `
        <div style="text-align:center;padding:20px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;color:#991b1b;">
          <i class="fa-solid fa-circle-xmark" style="font-size:1.8rem;margin-bottom:6px;display:block;"></i>
          <strong>Pass Not Found</strong>
          <p style="margin:4px 0 0;font-size:0.8rem;">Walang natagpuang booking para sa "<strong>${raw}</strong>". Pakisuri ang reference code sa resibo.</p>
          <button type="button" class="btn btn-ghost btn-sm" id="btnModalRetryScan" style="margin-top:10px;color:#991b1b;border:1px solid #fca5a5;">
            <i class="fa-solid fa-camera" style="margin-right:4px;"></i> Scan Another Pass
          </button>
        </div>
      `;
      const retryBtn = result.querySelector('#btnModalRetryScan');
      if (retryBtn) retryBtn.onclick = () => {
        input.value = '';
        startCamera();
      };
      return;
    }

    result.innerHTML = renderVerifiedPassCard(b);

    const viewRcpt = result.querySelector('#btnPassViewReceipt');
    if (viewRcpt) {
      viewRcpt.onclick = async () => {
        await closeModalSafe();
        if (window.openPaidReceiptModal) window.openPaidReceiptModal(b.id);
      };
    }

    const scanAnother = result.querySelector('#btnPassScanAnother');
    if (scanAnother) {
      scanAnother.onclick = () => {
        input.value = '';
        result.innerHTML = `
          <div style="text-align:center;padding:20px 16px;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;color:#64748b;">
            <i class="fa-solid fa-barcode" style="font-size:1.8rem;margin-bottom:6px;color:#94a3b8;display:block;"></i>
            <div style="font-size:0.85rem;font-weight:600;">Awaiting scan or code entry…</div>
            <div style="font-size:0.75rem;margin-top:4px;">Start camera scanner above, upload a QR photo, or enter reference code.</div>
          </div>
        `;
        startCamera();
      };
    }

    const checkInBtn = result.querySelector('#btnPassCheckIn');
    if (checkInBtn) {
      checkInBtn.onclick = async () => {
        updateLocalBookingStatus(b.id, 'active');
        broadcastBookingStatusChange(b.id, 'active');
        try {
          await supabase.from('bookings').update({ status: 'active' }).eq('id', b.id);
          if (b.vehicle_id) {
            await supabase.from('vehicles').update({ status: 'rented' }).eq('id', b.vehicle_id);
          }
        } catch (e) {}
        toast(`Vehicle handover confirmed! Booking #${b.id} is now Active.`, 'success');
        await closeModalSafe();
        if (window.renderTab) window.renderTab();
      };
    }
  }

  if (btn) btn.addEventListener('click', () => doLookup());
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLookup();
    });
  }

  // Auto-attempt starting camera if supported
  setTimeout(() => {
    startCamera();
  }, 250);
}

export async function renderStaffScanner(view) {
  const bookings = await fetchMergedBookings();
  const pendingHandovers = bookings.filter(b => (b.status === 'approved' || b.status === 'pending' || b.status === 'active'));

  view.innerHTML = `
    <div class="view">
      <div class="section-head" style="margin-bottom:20px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <h2 style="margin:0;font-size:1.4rem;font-weight:800;color:#0f172a;">Venue QR Pass Scanner</h2>
            <span class="badge badge-completed" style="font-size:0.72rem;"><i class="fa-solid fa-bolt" style="margin-right:4px;"></i> Live Operations</span>
          </div>
          <p style="color:#64748b;font-size:0.85rem;margin:0;">
            Scan customer QR venue passes with camera, upload photos/screenshots, or verify reference codes for fast vehicle handover.
          </p>
        </div>
      </div>

      <div class="grid grid-2" style="gap:24px;align-items:start;">
        <!-- Scanner Column -->
        <div class="glass card qr-scanner-card" style="padding:22px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <h3 style="margin:0;font-size:1.05rem;font-weight:800;color:#0f172a;">
              <i class="fa-solid fa-qrcode" style="color:var(--accent);margin-right:6px;"></i> Scan Customer Pass
            </h3>
            <span style="font-size:0.75rem;color:#64748b;">Zero-delay venue check-in</span>
          </div>

          <!-- Mode Tabs -->
          <div class="qr-mode-tabs" id="pageQrTabs">
            <button type="button" class="qr-mode-tab active" data-tab="camera">
              <i class="fa-solid fa-camera"></i> Live Camera
            </button>
            <button type="button" class="qr-mode-tab" data-tab="upload">
              <i class="fa-solid fa-image"></i> Upload QR Image
            </button>
            <button type="button" class="qr-mode-tab" data-tab="manual">
              <i class="fa-solid fa-keyboard"></i> Manual Code
            </button>
          </div>

          <!-- Live Camera Section -->
          <div id="pageQrCameraSection">
            <div class="qr-reader-wrap" id="pageQrReaderWrap">
              <div id="pageQrReader" style="width:100%;height:100%;"></div>
              <div class="qr-scanner-reticle" id="pageQrReticle" style="display:none;">
                <div class="qr-laser-line"></div>
              </div>
              <div class="qr-cam-toolbar" id="pageQrToolbar" style="display:none;">
                <button type="button" class="qr-cam-btn" id="pageQrFlipBtn" title="Switch Camera">
                  <i class="fa-solid fa-camera-rotate"></i> Flip
                </button>
                <button type="button" class="qr-cam-btn" id="pageQrStopBtn" title="Stop Camera" style="color:#ef4444;">
                  <i class="fa-solid fa-stop"></i> Stop
                </button>
              </div>
              <div id="pageQrStartOverlay" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(15,23,42,0.85);color:#fff;padding:20px;text-align:center;z-index:4;">
                <i class="fa-solid fa-expand" style="font-size:2.4rem;color:#c084fc;margin-bottom:12px;"></i>
                <div style="font-weight:700;font-size:0.95rem;margin-bottom:4px;">Camera Scanner Ready</div>
                <p style="font-size:0.78rem;color:#94a3b8;margin:0 0 16px;max-width:260px;">Point camera at customer smartphone QR code to scan.</p>
                <button type="button" class="btn btn-primary btn-sm" id="pageQrStartBtn" style="padding:8px 18px;font-size:0.85rem;">
                  <i class="fa-solid fa-video" style="margin-right:6px;"></i> Start Camera
                </button>
              </div>
            </div>
            <div id="pageQrCamNotice" style="text-align:center;font-size:0.75rem;color:#64748b;margin-bottom:12px;">
              Supports smartphone rear/front cameras, laptop webcams &amp; QR guns.
            </div>
          </div>

          <!-- Upload Image Section -->
          <div id="pageQrUploadSection" style="display:none;margin-bottom:16px;">
            <div class="qr-dropzone" id="pageQrDropzone">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size:2.2rem;color:var(--accent);margin-bottom:8px;display:block;"></i>
              <div style="font-weight:700;font-size:0.88rem;color:#0f172a;margin-bottom:4px;">Upload or Drop QR Code Photo</div>
              <div style="font-size:0.75rem;color:#64748b;margin-bottom:12px;">Select image or screenshot of the venue pass</div>
              <input type="file" id="pageQrFileInput" accept="image/*" style="display:none;" />
              <button type="button" class="btn btn-ghost btn-sm" id="pageQrFileSelectBtn" style="border:1px solid #cbd5e1;background:#fff;">
                <i class="fa-solid fa-folder-open" style="margin-right:6px;"></i> Choose Image File
              </button>
            </div>
          </div>

          <!-- Manual Code Section -->
          <div id="pageQrManualSection" style="display:none;margin-bottom:16px;">
            <div class="field" style="margin:0;">
              <label style="font-weight:700;font-size:0.82rem;color:#334155;">Enter Booking Reference / Pass Code</label>
              <div style="display:flex;gap:8px;">
                <input type="text" id="pagePassInput" placeholder="e.g. BK-..., REF-..., or Booking ID" style="flex:1;font-size:0.95rem;font-family:monospace;padding:10px 12px;" />
                <button type="button" class="btn btn-primary" id="btnPageLookup"><i class="fa-solid fa-magnifying-glass" style="margin-right:4px;"></i> Verify</button>
              </div>
            </div>
          </div>

          <!-- Result Area -->
          <div id="pagePassResult">
            <div style="text-align:center;padding:24px 16px;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;color:#64748b;">
              <i class="fa-solid fa-barcode" style="font-size:1.8rem;margin-bottom:6px;color:#94a3b8;display:block;"></i>
              <div style="font-size:0.85rem;font-weight:600;">Awaiting scan or reference code…</div>
              <div style="font-size:0.75rem;margin-top:4px;">Point camera, upload photo, or enter reference code.</div>
            </div>
          </div>
        </div>

        <!-- Handover Queue Column -->
        <div class="glass card" style="padding:22px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <div>
              <h3 style="margin:0;font-size:1.05rem;font-weight:800;color:#0f172a;">Awaiting Handover &amp; Pickups</h3>
              <span style="font-size:0.75rem;color:#64748b;">Approved reservations ready for key release</span>
            </div>
            <span class="badge ${pendingHandovers.length > 0 ? 'badge-pending' : 'badge-completed'}">${pendingHandovers.length} records</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;max-height:500px;overflow-y:auto;padding-right:4px;" id="queueListWrap">
            ${pendingHandovers.length ? pendingHandovers.map(b => {
              const v = b.vehicles || {};
              const cName = getBookingCustomerName(b);
              const isFull = !b.balance_due || Number(b.balance_due) === 0;
              return `
                <div class="item-card" style="padding:12px 14px;border:1px solid #e2e8f0;background:#fff;border-radius:10px;cursor:pointer;" data-queue-ref="${b.ref_number || b.id}">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                    <div style="font-weight:700;font-size:0.86rem;color:#0f172a;">${v.name || 'Vehicle'}</div>
                    <span class="badge badge-${b.status}" style="font-size:0.7rem;">${b.status.toUpperCase()}</span>
                  </div>
                  <div style="font-size:0.78rem;color:#64748b;margin-bottom:4px;">
                    <span>Customer: <strong>${cName}</strong></span> · <span>Plate: ${maskPlate(v.plate_number)}</span>
                  </div>
                  <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.75rem;">
                    <span style="font-family:monospace;font-weight:700;color:var(--accent);">${b.ref_number || ('#' + b.id)}</span>
                    <span style="color:${isFull ? '#059669' : '#d97706'};font-weight:700;">${isFull ? 'Paid in Full' : `Bal Due: ${fmtMoney(b.balance_due)}`}</span>
                  </div>
                </div>
              `;
            }).join('') : `
              <div style="text-align:center;padding:32px 16px;color:#94a3b8;">
                <i class="fa-solid fa-calendar-check" style="font-size:2rem;margin-bottom:8px;display:block;"></i>
                <div style="font-size:0.85rem;font-weight:600;">No pending handovers in queue</div>
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;

  const input = view.querySelector('#pagePassInput');
  const btn = view.querySelector('#btnPageLookup');
  const result = view.querySelector('#pagePassResult');

  const camSection = view.querySelector('#pageQrCameraSection');
  const uploadSection = view.querySelector('#pageQrUploadSection');
  const manualSection = view.querySelector('#pageQrManualSection');

  const startBtn = view.querySelector('#pageQrStartBtn');
  const stopBtn = view.querySelector('#pageQrStopBtn');
  const flipBtn = view.querySelector('#pageQrFlipBtn');
  const startOverlay = view.querySelector('#pageQrStartOverlay');
  const reticle = view.querySelector('#pageQrReticle');
  const toolbar = view.querySelector('#pageQrToolbar');
  const camNotice = view.querySelector('#pageQrCamNotice');

  const dropzone = view.querySelector('#pageQrDropzone');
  const fileInput = view.querySelector('#pageQrFileInput');
  const fileSelectBtn = view.querySelector('#pageQrFileSelectBtn');

  let camerasList = [];
  let currentCamIdx = 0;

  // Tab switching
  view.querySelectorAll('#pageQrTabs .qr-mode-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', async () => {
      view.querySelectorAll('#pageQrTabs .qr-mode-tab').forEach(t => t.classList.remove('active'));
      tabBtn.classList.add('active');
      const target = tabBtn.dataset.tab;

      if (target === 'camera') {
        camSection.style.display = 'block';
        uploadSection.style.display = 'none';
        manualSection.style.display = 'none';
      } else if (target === 'upload') {
        await stopCamera();
        camSection.style.display = 'none';
        uploadSection.style.display = 'block';
        manualSection.style.display = 'none';
      } else if (target === 'manual') {
        await stopCamera();
        camSection.style.display = 'none';
        uploadSection.style.display = 'none';
        manualSection.style.display = 'block';
        if (input) input.focus();
      }
    });
  });

  // Start Camera
  async function startCamera() {
    if (typeof window.Html5Qrcode === 'undefined') {
      toast('Scanner library loading. Please wait a moment.', 'info');
      return;
    }

    try {
      if (!window._activeStaffPageScanner) {
        window._activeStaffPageScanner = new window.Html5Qrcode('pageQrReader');
      }

      try {
        camerasList = await window.Html5Qrcode.getCameras();
      } catch (e) {
        camerasList = [];
      }

      const cameraConfig = camerasList.length > 0 
        ? camerasList[currentCamIdx % camerasList.length].id 
        : { facingMode: 'environment' };

      await window._activeStaffPageScanner.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: { width: 230, height: 230 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          playScanBeep();
          toast('QR Code detected!', 'success');
          stopCamera();
          const parsed = parseScannedQrCode(decodedText);
          if (input) input.value = parsed;
          doLookup(parsed);
        },
        () => {}
      );

      if (startOverlay) startOverlay.style.display = 'none';
      if (reticle) reticle.style.display = 'block';
      if (toolbar) toolbar.style.display = 'flex';
      if (camNotice) camNotice.innerHTML = '<span style="color:#059669;font-weight:700;">● Camera Active</span> — Align QR code inside frame.';
    } catch (err) {
      console.warn('Camera failed to start:', err);
      if (startOverlay) startOverlay.style.display = 'flex';
      if (reticle) reticle.style.display = 'none';
      if (toolbar) toolbar.style.display = 'none';
      if (camNotice) camNotice.innerHTML = `<span style="color:#dc2626;font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Camera permission needed or unavailable.</span> Use Upload QR Image or Manual Code.`;
      toast('Camera notice: ' + (err.message || 'Permission denied'), 'error');
    }
  }

  // Stop Camera
  async function stopCamera() {
    if (window._activeStaffPageScanner && window._activeStaffPageScanner.isScanning) {
      try {
        await window._activeStaffPageScanner.stop();
      } catch(e) {}
    }
    if (startOverlay) startOverlay.style.display = 'flex';
    if (reticle) reticle.style.display = 'none';
    if (toolbar) toolbar.style.display = 'none';
    if (camNotice) camNotice.innerHTML = 'Camera paused. Click Start Camera to resume scanning.';
  }

  // Flip Camera
  async function flipCamera() {
    if (camerasList.length > 1) {
      currentCamIdx = (currentCamIdx + 1) % camerasList.length;
      await stopCamera();
      await startCamera();
      toast('Switched camera', 'info');
    } else {
      toast('Only 1 camera detected on this system.', 'info');
    }
  }

  if (startBtn) startBtn.addEventListener('click', startCamera);
  if (stopBtn) stopBtn.addEventListener('click', stopCamera);
  if (flipBtn) flipBtn.addEventListener('click', flipCamera);

  // File Upload handling
  if (fileSelectBtn) fileSelectBtn.addEventListener('click', () => fileInput.click());
  if (dropzone) {
    dropzone.addEventListener('click', (e) => {
      if (e.target !== fileSelectBtn) fileInput.click();
    });
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processUploadedQrFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processUploadedQrFile(e.target.files[0]);
      }
    });
  }

  async function processUploadedQrFile(file) {
    if (typeof window.Html5Qrcode === 'undefined') {
      toast('Scanner library loading. Please try again.', 'info');
      return;
    }
    toast('Scanning uploaded image for QR code…', 'info');
    try {
      const tempScanner = window._activeStaffPageScanner || new window.Html5Qrcode('pageQrReader');
      const decodedText = await tempScanner.scanFile(file, true);
      playScanBeep();
      toast('QR Code verified from image!', 'success');
      const parsed = parseScannedQrCode(decodedText);
      if (input) input.value = parsed;
      doLookup(parsed);
    } catch (err) {
      console.warn('QR file decoding failed:', err);
      toast('No readable QR code found in uploaded image. Please try another photo.', 'error');
    }
  }

  // Lookup & Verification logic
  async function doLookup(overrideCode = '') {
    const raw = (overrideCode || input?.value || '').trim();
    if (!raw) {
      toast('Please enter or scan a Booking Reference or ID.', 'error');
      return;
    }
    const clean = raw.toLowerCase();
    let allList = bookings && bookings.length ? bookings : await fetchMergedBookings();

    const b = (allList || []).find(item => {
      const idMatch = String(item.id).toLowerCase() === clean;
      const refMatch = String(item.ref_number || '').toLowerCase() === clean;
      const nameMatch = String(item.customer_name || '').toLowerCase().includes(clean);
      const rawContains = clean.includes(String(item.id).toLowerCase()) || (item.ref_number && clean.includes(String(item.ref_number).toLowerCase()));
      return idMatch || refMatch || nameMatch || rawContains;
    });

    if (!b) {
      result.innerHTML = `
        <div style="text-align:center;padding:20px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;color:#991b1b;">
          <i class="fa-solid fa-circle-xmark" style="font-size:1.8rem;margin-bottom:6px;display:block;"></i>
          <strong>Pass Not Found</strong>
          <p style="margin:4px 0 0;font-size:0.8rem;">Walang natagpuang booking para sa "<strong>${raw}</strong>". Pakisuri ang reference code sa resibo.</p>
          <button type="button" class="btn btn-ghost btn-sm" id="btnPageRetryScan" style="margin-top:10px;color:#991b1b;border:1px solid #fca5a5;">
            <i class="fa-solid fa-camera" style="margin-right:4px;"></i> Scan Another Pass
          </button>
        </div>
      `;
      const retryBtn = result.querySelector('#btnPageRetryScan');
      if (retryBtn) retryBtn.onclick = () => {
        if (input) input.value = '';
        startCamera();
      };
      return;
    }

    result.innerHTML = renderVerifiedPassCard(b);

    const viewRcpt = result.querySelector('#btnPassViewReceipt');
    if (viewRcpt) {
      viewRcpt.onclick = () => {
        if (window.openPaidReceiptModal) window.openPaidReceiptModal(b.id);
      };
    }

    const scanAnother = result.querySelector('#btnPassScanAnother');
    if (scanAnother) {
      scanAnother.onclick = () => {
        if (input) input.value = '';
        result.innerHTML = `
          <div style="text-align:center;padding:24px 16px;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;color:#64748b;">
            <i class="fa-solid fa-barcode" style="font-size:1.8rem;margin-bottom:6px;color:#94a3b8;display:block;"></i>
            <div style="font-size:0.85rem;font-weight:600;">Awaiting scan or reference code…</div>
            <div style="font-size:0.75rem;margin-top:4px;">Point camera, upload photo, or enter reference code.</div>
          </div>
        `;
        startCamera();
      };
    }

    const checkInBtn = result.querySelector('#btnPassCheckIn');
    if (checkInBtn) {
      checkInBtn.onclick = async () => {
        updateLocalBookingStatus(b.id, 'active');
        broadcastBookingStatusChange(b.id, 'active');
        try {
          await supabase.from('bookings').update({ status: 'active' }).eq('id', b.id);
          if (b.vehicle_id) {
            await supabase.from('vehicles').update({ status: 'rented' }).eq('id', b.vehicle_id);
          }
        } catch (e) {}
        toast(`Vehicle handover confirmed! Booking #${b.id} is now Active.`, 'success');
        renderStaffScanner(view);
      };
    }
  }

  if (btn) btn.addEventListener('click', () => doLookup());
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLookup();
    });
  }

  // Queue click handlers
  view.querySelectorAll('[data-queue-ref]').forEach(card => {
    card.addEventListener('click', () => {
      const ref = card.dataset.queueRef;
      if (input) input.value = ref;
      doLookup(ref);
    });
  });

  // Start camera on view load
  setTimeout(() => {
    startCamera();
  }, 250);
}

window.openVenuePassVerificationModal = openVenuePassVerificationModal;
window.renderStaffScanner = renderStaffScanner;


