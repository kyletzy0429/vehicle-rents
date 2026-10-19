import { supabase } from './config.js';
import { state, PORTAL_TABS, DEFAULT_SETTINGS, getSystemSettings, DEMO_ACCOUNTS } from './state.js';
import {
  $, $$, toast, openModal, closeModal,
  getTheme, toggleTheme, applyTheme,
  getRoleDisplayName, getNotifications, openNotificationsModal, updateNotificationBadge
} from './utils.js';
import { renderAuth, renderLandingPage, logout, bootstrapSession, switchSystemRole, checkCustomerVerificationStatus, promptRenterVerificationModal } from './auth.js';
import { renderCustomer } from './customer.js?v=2.6';
import { renderStaff, renderAdmin } from './admin.js?v=2.6';
import { initRealtimeSync } from './realtime.js';
import { openRentalExtensionModal } from './rental-extension.js';

if (typeof window !== 'undefined') {
  window.openRentalExtensionModal = openRentalExtensionModal;
}

export function renderRoleSwitcherHTML(currentRole) {
  const roleLabels = {
    customer: 'Renter',
    staff: 'Staff',
    admin: 'Admin'
  };
  const currentLabel = roleLabels[currentRole] || 'Role';

  return `
    <div class="role-dropdown-container" id="roleDropdownContainer">
      <button type="button" class="role-dropdown-trigger" id="roleDropdownToggle" aria-haspopup="true" aria-expanded="false" title="Switch Role">
        <strong class="role-dropdown-val">${currentLabel}</strong>
        <i class="fa-solid fa-chevron-down" style="font-size:0.65rem;color:#64748b;margin-left:4px;"></i>
      </button>

      <div class="role-dropdown-menu" id="roleDropdownMenu" style="display:none;">
        <div class="role-menu-heading">Switch Role</div>
        
        <div class="role-menu-item ${currentRole === 'customer' ? 'active' : ''}" data-role-choice="customer">
          <span class="role-item-title">Renter</span>
          ${currentRole === 'customer' ? '<i class="fa-solid fa-check" style="font-size:0.75rem;color:var(--accent);"></i>' : ''}
        </div>

        <div class="role-menu-item ${currentRole === 'staff' ? 'active' : ''}" data-role-choice="staff">
          <span class="role-item-title">Staff</span>
          ${currentRole === 'staff' ? '<i class="fa-solid fa-check" style="font-size:0.75rem;color:var(--accent);"></i>' : ''}
        </div>

        <div class="role-menu-item ${currentRole === 'admin' ? 'active' : ''}" data-role-choice="admin">
          <span class="role-item-title">Admin</span>
          ${currentRole === 'admin' ? '<i class="fa-solid fa-check" style="font-size:0.75rem;color:var(--accent);"></i>' : ''}
        </div>
      </div>
    </div>
  `;
}

export function bindRoleSwitcherEvents() {
  const container = $('#roleDropdownContainer');
  const toggleBtn = $('#roleDropdownToggle');
  const menu = $('#roleDropdownMenu');

  if (toggleBtn && menu) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.style.display === 'flex' || menu.style.display === 'block';
      menu.style.display = isOpen ? 'none' : 'flex';
      toggleBtn.setAttribute('aria-expanded', String(!isOpen));
      toggleBtn.classList.toggle('active', !isOpen);
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (container && !container.contains(e.target)) {
        menu.style.display = 'none';
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.classList.remove('active');
      }
    });

    // Handle role choice
    menu.querySelectorAll('[data-role-choice]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const role = item.dataset.roleChoice;
        menu.style.display = 'none';
        if (role) switchSystemRole(role);
      });
    });
  }
}

export function openUserMenuModal() {
  const p = state.profile || {};
  const initials = (p.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const currentRole = state.portal || p.role || 'customer';
  const roleTitle = getRoleDisplayName(currentRole);
  const comp = getSystemSettings().company || DEFAULT_SETTINGS.company;

  let modalContent = '';

  if (currentRole === 'admin') {
    modalContent = `
      <div class="modal-head">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:46px;height:46px;border-radius:50%;background:var(--primary-gradient);color:#fff;font-weight:800;font-size:1.1rem;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px var(--accent-glow);">${initials}</div>
          <div>
            <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:0;">${p.full_name || 'Roland S. Bautista'}</h3>
            <span style="font-size:0.78rem;color:var(--accent);font-weight:700;">System Administrator</span>
          </div>
        </div>
        <div class="modal-close" id="mClose">Close</div>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:16px;">
        <div class="receipt-row"><span style="color:#64748b;">Admin Email</span><span style="font-weight:600;color:#0f172a;">${p.email || state.user?.email || 'roland.bautista@rentflow.ph'}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Contact Phone</span><span style="font-weight:600;color:#0f172a;">${p.phone || '0917 992 3341'}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Access Level</span><span style="font-weight:700;color:var(--accent);">Full System &amp; Financial Control</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Department</span><span style="font-weight:600;color:#0f172a;">Executive Fleet Management</span></div>
      </div>

      <h4 style="font-size:0.88rem;font-weight:700;color:#0f172a;margin-bottom:10px;">Administrator Controls &amp; Shortcuts</h4>
      
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
        <button class="btn btn-ghost" id="adminGoSettings" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">System Settings &amp; Policies</div>
            <div style="font-size:0.75rem;color:#64748b;">Configure company profile, rental policies, and pricing rules</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="adminGoVehicles" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">Fleet &amp; Vehicle Inventory</div>
            <div style="font-size:0.75rem;color:#64748b;">Manage vehicle fleet, daily rental rates, and categories</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="adminGoReports" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">Reports &amp; Financial Analytics</div>
            <div style="font-size:0.75rem;color:#64748b;">View revenue summaries, payment breakdown, and accounting audit logs</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="adminGoCustomers" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">Customer Directory &amp; Licenses</div>
            <div style="font-size:0.75rem;color:#64748b;">Inspect verified customer records and driver licenses</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="adminGoUsers" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">System Roles &amp; Permissions</div>
            <div style="font-size:0.75rem;color:#64748b;">Manage Administrator and Staff access</div>
          </div>
        </button>
      </div>

      <div style="padding-top:14px;border-top:1px solid #e2e8f0;display:flex;gap:10px;">
        <button class="btn btn-danger btn-block" id="umLogout" style="padding:10px;">Log Out of Admin</button>
      </div>
    `;
  } else if (currentRole === 'staff') {
    modalContent = `
      <div class="modal-head">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#059669,#047857);color:#fff;font-weight:800;font-size:1.1rem;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(5,150,105,0.25);">${initials}</div>
          <div>
            <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:0;">${p.full_name || 'Sarah Jane Villanueva'}</h3>
            <span style="font-size:0.78rem;color:#059669;font-weight:700;">Operations Staff</span>
          </div>
        </div>
        <div class="modal-close" id="mClose">Close</div>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:16px;">
        <div class="receipt-row"><span style="color:#64748b;">Email</span><span style="font-weight:600;color:#0f172a;">${p.email || state.user?.email || 'sarah.villanueva@rentflow.ph'}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Phone</span><span style="font-weight:600;color:#0f172a;">${p.phone || '0917 882 1450'}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Operations Role</span><span style="font-weight:700;color:#059669;">Fleet Dispatch &amp; Booking Approvals</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Station</span><span style="font-weight:600;color:#0f172a;">RentFlow Main Hub Operations</span></div>
      </div>

      <h4 style="font-size:0.88rem;font-weight:700;color:#0f172a;margin-bottom:10px;">Operations Shortcuts</h4>
      
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
        <button class="btn btn-ghost" id="staffGoDashboard" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">Operations Dashboard</div>
            <div style="font-size:0.75rem;color:#64748b;">Overview of booking queue and fleet status</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="staffGoScanner" style="justify-content:flex-start;padding:12px 14px;border:1px solid rgba(124,58,237,0.3);background:rgba(124,58,237,0.04);border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:var(--accent);font-size:0.9rem;"><i class="fa-solid fa-qrcode" style="margin-right:6px;"></i> Venue QR Pass Scanner</div>
            <div style="font-size:0.75rem;color:#64748b;">Instant camera scanner &amp; pass verification</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="staffGoRequests" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">Booking Requests &amp; Approvals</div>
            <div style="font-size:0.75rem;color:#64748b;">Review and approve incoming reservations</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="staffGoActive" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">Active Rentals &amp; Dispatches</div>
            <div style="font-size:0.75rem;color:#64748b;">Manage vehicles currently on road and key release</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="staffGoReturns" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">Vehicle Returns &amp; Inspections</div>
            <div style="font-size:0.75rem;color:#64748b;">Check-in returned vehicles and verify fuel level</div>
          </div>
        </button>
      </div>

      <div style="padding-top:14px;border-top:1px solid #e2e8f0;display:flex;gap:10px;">
        <button class="btn btn-danger btn-block" id="umLogout" style="padding:10px;">Log Out</button>
      </div>
    `;
  } else {
    // Customer (Renter)
    const renterName = (p.full_name && p.full_name !== 'Guest Customer' && p.full_name !== 'User') ? p.full_name : 'Renter';
    modalContent = `
      <div class="modal-head">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:46px;height:46px;border-radius:50%;background:var(--primary-gradient);color:#fff;font-weight:800;font-size:1.1rem;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px var(--accent-glow);">${initials}</div>
          <div>
            <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:0;">${renterName}</h3>
            <span style="font-size:0.78rem;color:var(--accent);font-weight:700;">Verified Renter</span>
          </div>
        </div>
        <div class="modal-close" id="mClose">Close</div>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:16px;">
        <div class="receipt-row"><span style="color:#64748b;">Email</span><span style="font-weight:600;color:#0f172a;">${p.email || state.user?.email || 'renter@rentflow.ph'}</span></div>
        <div class="receipt-row"><span style="color:#64748b;">Phone</span><span style="font-weight:600;color:#0f172a;">${p.phone || '0917 582 9140'}</span></div>
      </div>

      <h4 style="font-size:0.88rem;font-weight:700;color:#0f172a;margin-bottom:10px;">Renter Menu</h4>
      
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">

        <button class="btn btn-ghost" id="umAccount" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;"><i class="fa-solid fa-circle-user" style="color:var(--accent);margin-right:6px;"></i> My Account &amp; Profile</div>
            <div style="font-size:0.75rem;color:#64748b;">Manage personal details, contact info, and driver's license</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="umBookings" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">My Reservations &amp; Rentals</div>
            <div style="font-size:0.75rem;color:#64748b;">View active reservations, receipts, and refund requests</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="umFavorites" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">My Favorites</div>
            <div style="font-size:0.75rem;color:#64748b;">View your saved cars &amp; motorcycles</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="umSupport" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">Support Contact</div>
            <div style="font-size:0.75rem;color:#64748b;">Hotline: ${comp.phone || '+63 67676767'} | Email: ${comp.email || 'vehicleretal.ph'}</div>
          </div>
        </button>
      </div>

      <div style="padding-top:14px;border-top:1px solid #e2e8f0;display:flex;gap:10px;">
        <button class="btn btn-danger btn-block" id="umLogout" style="padding:10px;">Log Out of Account</button>
      </div>
    `;
  }

  openModal(modalContent);

  $('#mClose').addEventListener('click', closeModal);
  $('#umLogout').addEventListener('click', () => { closeModal(); logout(); });

  // Admin shortcuts
  const aSet = $('#adminGoSettings');
  if (aSet) aSet.addEventListener('click', () => { closeModal(); state.tab = 'settings'; renderShell(); });
  const aVeh = $('#adminGoVehicles');
  if (aVeh) aVeh.addEventListener('click', () => { closeModal(); state.tab = 'vehicles'; renderShell(); });
  const aRep = $('#adminGoReports');
  if (aRep) aRep.addEventListener('click', () => { closeModal(); state.tab = 'reports'; renderShell(); });
  const aCus = $('#adminGoCustomers');
  if (aCus) aCus.addEventListener('click', () => { closeModal(); state.tab = 'customers'; renderShell(); });
  const aUsr = $('#adminGoUsers');
  if (aUsr) aUsr.addEventListener('click', () => { closeModal(); state.tab = 'users'; renderShell(); });

  // Staff shortcuts
  const sDsh = $('#staffGoDashboard');
  if (sDsh) sDsh.addEventListener('click', () => { closeModal(); state.tab = 'dashboard'; renderShell(); });
  const sScn = $('#staffGoScanner');
  if (sScn) sScn.addEventListener('click', () => { closeModal(); state.tab = 'scanner'; renderShell(); });
  const sReq = $('#staffGoRequests');
  if (sReq) sReq.addEventListener('click', () => { closeModal(); state.tab = 'requests'; renderShell(); });
  const sAct = $('#staffGoActive');
  if (sAct) sAct.addEventListener('click', () => { closeModal(); state.tab = 'active'; renderShell(); });
  const sRet = $('#staffGoReturns');
  if (sRet) sRet.addEventListener('click', () => { closeModal(); state.tab = 'returns'; renderShell(); });

  // Customer shortcuts
  const aAcc = $('#umAccount');
  if (aAcc) aAcc.addEventListener('click', () => { closeModal(); state.tab = 'account'; renderShell(); });
  const bBtn = $('#umBookings');
  if (bBtn) bBtn.addEventListener('click', () => { closeModal(); state.tab = 'bookings'; renderShell(); });
  const fBtn = $('#umFavorites');
  if (fBtn) fBtn.addEventListener('click', () => { closeModal(); state.tab = 'favorites'; renderShell(); });
  const sBtn = $('#umSupport');
  if (sBtn) sBtn.addEventListener('click', () => {
    const curComp = getSystemSettings().company || DEFAULT_SETTINGS.company;
    toast(`Support Hotline: ${curComp.phone || '+63 67676767'} | Email: ${curComp.email || 'vehicleretal.ph'}`, 'info');
  });
}

export function openPricingModal() {
  const comp = getSystemSettings().company || DEFAULT_SETTINGS.company;
  const pol = getSystemSettings().policy || DEFAULT_SETTINGS.policy;
  openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.2rem;font-weight:800;color:var(--text-hi);">Rental Pricing &amp; Policies</h3>
        <span class="muted" style="font-size:0.75rem;">100% Transparent · No Hidden Fees</span>
      </div>
      <div class="modal-close" id="pClose">Close</div>
    </div>
    <div style="line-height:1.6;color:var(--text-mid);font-size:0.88rem;">
      <div style="margin-bottom:14px;background:var(--bg-subtle);padding:14px;border-radius:12px;border:1px solid var(--glass-border);">
        <h4 style="font-size:0.95rem;font-weight:700;color:var(--text-hi);margin-bottom:4px;">Security Deposit &amp; Fuel Policy</h4>
        <p>Standard security deposit of ${Number(pol.deposit || 3000).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} is fully refundable upon return in good condition. Vehicles are provided full-to-full.</p>
      </div>
      <div style="margin-bottom:14px;background:var(--bg-subtle);padding:14px;border-radius:12px;border:1px solid var(--glass-border);">
        <h4 style="font-size:0.95rem;font-weight:700;color:var(--text-hi);margin-bottom:4px;">Flexible Down Payment Options</h4>
        <p>Reserve with either 100% full payment, 50% partial, or 20% reservation fee. Remaining balance settled upon vehicle handover.</p>
      </div>
      <div style="margin-bottom:14px;background:var(--bg-subtle);padding:14px;border-radius:12px;border:1px solid var(--glass-border);">
        <h4 style="font-size:0.95rem;font-weight:700;color:var(--text-hi);margin-bottom:4px;">Driver Verification</h4>
        <p>Zero hassle: No complex online document verification required. Simply show your physical driver's license upon vehicle pickup.</p>
      </div>
      <div style="margin-top:20px;text-align:right;">
        <button type="button" class="btn btn-primary btn-sm" id="pDismissBtn" style="border-radius:99px;padding:8px 24px;">Got it</button>
      </div>
    </div>
  `);
  const pc = $('#pClose'), pd = $('#pDismissBtn');
  if (pc) pc.addEventListener('click', closeModal);
  if (pd) pd.addEventListener('click', closeModal);
}

export function renderRenterNoticeHTML() {
  if (state.portal !== 'customer') return '';
  if (sessionStorage.getItem('rentflow_dismiss_reg_notif')) return '';

  const p = state.profile || {};
  const isCustomUser = Boolean(localStorage.getItem('rentflow_custom_user'));
  const activeCustKey = localStorage.getItem('rentflow_active_customer_key');

  // Check if renter is fully registered and verified
  const hasLicense = Boolean(p.license_number && p.license_number.trim());
  const isVerifiedRenter = Boolean(
    hasLicense && p.is_verified !== false && activeCustKey !== 'customer2'
  );

  // If user is already a verified registered account, don't show
  const isNewOrNonRegistered = !isCustomUser || !isVerifiedRenter || activeCustKey === 'customer2' || p.is_new_renter || !hasLicense;
  if (!isNewOrNonRegistered) return '';

  const isUnregistered = !isCustomUser && (!state.user || state.user.id === 'guest' || !state.user.email);
  const title = isUnregistered ? 'Account Registration' : 'Renter Verification';
  const desc = isUnregistered
    ? 'Register your renter account to unlock instant approvals and express vehicle key pickup.'
    : 'New renter? Complete your driver details to activate your official Digital Renter Pass.';
  const btnText = isUnregistered ? 'Register Account' : 'Complete Profile';

  return `
    <div class="renter-toast-dock" id="renterToastDock" role="alert" aria-live="polite">
      <div class="renter-toast-inner">
        <div class="renter-toast-icon-wrap">
          <i class="fa-solid fa-${isUnregistered ? 'user-plus' : 'id-card'}"></i>
        </div>
        <div class="renter-toast-content">
          <div class="renter-toast-header">
            <span class="renter-toast-tag">Notice</span>
            <span class="renter-toast-title">${title}</span>
          </div>
          <p class="renter-toast-desc">${desc}</p>
          <div class="renter-toast-actions">
            <button type="button" class="renter-toast-cta" id="renterNoticeActionBtn">
              ${btnText} <i class="fa-solid fa-arrow-right" style="font-size:0.65rem;margin-left:4px;"></i>
            </button>
          </div>
        </div>
        <button type="button" class="renter-toast-dismiss" id="renterNoticeCloseBtn" title="Dismiss" aria-label="Dismiss">&times;</button>
      </div>
    </div>
  `;
}

export function renderShell() {
  const tabs = PORTAL_TABS[state.portal] || [];
  if (!state.tab || !tabs.find(t => t.id === state.tab)) state.tab = tabs[0]?.id;

  const rawName = state.profile?.full_name || '';
  const isGeneric = !rawName || rawName === 'Guest Customer' || rawName === 'User' || rawName === 'Customer';
  const displayName = isGeneric ? 'Renter' : rawName;
  const initials = isGeneric ? 'R' : displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const firstName = isGeneric ? 'Renter' : displayName.split(' ')[0];
  const roleTitle = getRoleDisplayName(state.portal);
  const activeTabObj = tabs.find(t => t.id === state.tab);

  const isDark = getTheme() === 'dark';
  const unreadNotifs = getNotifications().filter(n => !n.read).length;

  if (state.portal === 'customer') {
    $('#app').innerHTML = `
      <div style="min-height:100vh;background:var(--bg-dark);overflow-x:hidden;width:100%;max-width:100vw;">
        <header class="portal-header">
          <div class="portal-header-left">
            <button type="button" class="guest-menu-btn" id="guestMenuBtn" title="Navigation Menu" aria-label="Navigation Menu">
              <i class="fa-solid fa-bars"></i>
            </button>

            <div style="cursor:pointer;" id="brandHomeBtn">
              <div class="brand-title">Vehicle Rental Management System</div>
              <div class="brand-portal-sub">RENTER PORTAL</div>
            </div>

            <!-- Sleek Dropdown Menu (Screenshot 3 style) -->
            <div class="guest-dropdown-menu hidden" id="guestDropdownMenu">
              <div class="g-menu-items">
                <button type="button" class="g-menu-item ${state.tab === 'browse' ? 'active' : ''}" data-nav="browse">
                  <i class="fa-solid fa-magnifying-glass"></i>
                  <span>Search Vehicles</span>
                </button>
                <button type="button" class="g-menu-item ${state.tab === 'bookings' ? 'active' : ''}" data-nav="bookings">
                  <i class="fa-solid fa-calendar-check"></i>
                  <span>My Bookings</span>
                </button>
                <button type="button" class="g-menu-item ${state.tab === 'favorites' ? 'active' : ''}" data-nav="favorites">
                  <i class="fa-regular fa-heart"></i>
                  <span>My Favorites</span>
                </button>
                <button type="button" class="g-menu-item ${state.tab === 'account' ? 'active' : ''}" data-nav="account">
                  <i class="fa-solid fa-circle-user"></i>
                  <span>My Account</span>
                </button>
                <button type="button" class="g-menu-item" id="gMenuPricing">
                  <i class="fa-solid fa-tag"></i>
                  <span>Pricing &amp; Terms</span>
                </button>
                <button type="button" class="g-menu-item" id="gMenuSupport">
                  <i class="fa-solid fa-headset"></i>
                  <span>Support</span>
                </button>
              </div>
              <div class="g-menu-divider"></div>
              <div class="g-menu-user-row">
                <div class="g-menu-user-info">
                  <div class="g-menu-user-name">${displayName}</div>
                  <div class="g-menu-user-sub">${state.user?.email || 'Renter Access'}</div>
                </div>
                <button type="button" class="btn btn-ghost btn-sm" id="gMenuLogout" style="color:#ef4444;border-radius:99px;font-size:0.75rem;padding:4px 10px;">Sign out</button>
              </div>
            </div>
          </div>

          <!-- Customer Header Center Navigation -->
          <nav class="portal-header-nav" id="portalHeaderNav" aria-label="Customer Navigation">
            <button type="button" class="portal-nav-link ${state.tab === 'browse' ? 'active' : ''}" data-nav="browse">
              <i class="fa-solid fa-magnifying-glass"></i> Browse Fleet
            </button>
            <button type="button" class="portal-nav-link ${state.tab === 'bookings' ? 'active' : ''}" data-nav="bookings">
              <i class="fa-solid fa-calendar-check"></i> My Bookings
            </button>
            <button type="button" class="portal-nav-link ${state.tab === 'favorites' ? 'active' : ''}" data-nav="favorites">
              <i class="fa-regular fa-heart"></i> Favorites
            </button>
            <button type="button" class="portal-nav-link ${state.tab === 'account' ? 'active' : ''}" data-nav="account">
              <i class="fa-regular fa-user"></i> My Account
            </button>
          </nav>

          <div class="portal-header-right">
            <div class="lang-select-pill" title="Language: English">
              <span>EN</span>
              <i class="fa-solid fa-chevron-down" style="font-size:0.65rem;opacity:0.6;"></i>
            </div>

            <button type="button" id="topThemeBtn" class="topbar-icon-btn" title="Toggle Light/Dark Mode" aria-label="Toggle Light/Dark Mode">
              <i class="fa-solid fa-${isDark ? 'sun' : 'moon'}" style="color:${isDark ? '#f59e0b' : '#3b82f6'};"></i>
            </button>

            <button type="button" id="topNotifBtn" class="topbar-icon-btn" title="View Notifications" aria-label="View Notifications">
              <i class="fa-solid fa-bell" style="color:${isDark ? '#94a3b8' : '#475569'};"></i>
              ${unreadNotifs > 0 ? `<div class="notif-badge">${unreadNotifs}</div>` : ''}
            </button>

            ${renderRoleSwitcherHTML(state.portal)}

            <button type="button" id="topUserMenuBtn" class="topbar-user-pill" title="${displayName}">
              <div class="topbar-user-avatar">${initials}</div>
              <span class="topbar-user-name">${firstName}</span>
              <i class="fa-solid fa-chevron-down" style="font-size:0.65rem;opacity:0.6;"></i>
            </button>
          </div>
        </header>

        <main id="mainView" class="customer-main-view"><div class="loading-spin"></div></main>
        ${renderRenterNoticeHTML()}
      </div>
    `;

    $('#brandHomeBtn').addEventListener('click', () => { state.tab = 'browse'; renderShell(); });
    $('#topThemeBtn').addEventListener('click', toggleTheme);
    $('#topNotifBtn').addEventListener('click', openNotificationsModal);
    $('#topUserMenuBtn').addEventListener('click', openUserMenuModal);
    bindRoleSwitcherEvents();

    const regActionBtn = $('#renterNoticeActionBtn');
    if (regActionBtn) {
      regActionBtn.addEventListener('click', () => {
        const isCustomUser = Boolean(localStorage.getItem('rentflow_custom_user'));
        const isUnregistered = !isCustomUser && (!state.user || state.user.id === 'guest' || !state.user.email);
        if (isUnregistered) {
          renderAuth('signup');
        } else {
          promptRenterVerificationModal(true);
        }
      });
    }

    const regCloseBtn = $('#renterNoticeCloseBtn');
    if (regCloseBtn) {
      regCloseBtn.addEventListener('click', () => {
        sessionStorage.setItem('rentflow_dismiss_reg_notif', '1');
        const dock = $('#renterToastDock');
        if (dock) {
          dock.style.transition = 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
          dock.style.opacity = '0';
          dock.style.transform = 'translateY(16px) scale(0.95)';
          dock.style.pointerEvents = 'none';
          setTimeout(() => dock.remove(), 260);
        }
      });
    }

    const gMenuBtn = $('#guestMenuBtn');
    const gDropdown = $('#guestDropdownMenu');
    if (gMenuBtn && gDropdown) {
      gMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        gDropdown.classList.toggle('hidden');
      });
      document.addEventListener('click', (e) => {
        if (!gDropdown.contains(e.target) && e.target !== gMenuBtn) {
          gDropdown.classList.add('hidden');
        }
      });
    }

    $$('.g-menu-item[data-nav], .portal-nav-link[data-nav]').forEach(item => {
      item.addEventListener('click', () => {
        if (gDropdown) gDropdown.classList.add('hidden');
        state.tab = item.dataset.nav;
        renderShell();
      });
    });

    const gPricing = $('#gMenuPricing');
    if (gPricing) {
      gPricing.addEventListener('click', () => {
        if (gDropdown) gDropdown.classList.add('hidden');
        openPricingModal();
      });
    }

    const gSupport = $('#gMenuSupport');
    if (gSupport) {
      gSupport.addEventListener('click', () => {
        if (gDropdown) gDropdown.classList.add('hidden');
        const curComp = getSystemSettings().company || DEFAULT_SETTINGS.company;
        toast(`Support Hotline: ${curComp.phone || '+63 917 123 4567'} | Email: ${curComp.email || 'support@vehiclerental.ph'}`, 'info');
      });
    }

    const gLogout = $('#gMenuLogout');
    if (gLogout) {
      gLogout.addEventListener('click', logout);
    }

    updateNotificationBadge();
    renderTab();
    return;
  }

  $('#app').innerHTML = `
    <div class="app-shell">
      <div class="sidebar-overlay" id="sidebarOverlay"></div>
      <aside class="sidebar" id="sidebarMenu">
        <div class="sidebar-brand" style="display:flex;align-items:center;gap:10px;">
          <div style="flex:1;">
            <div style="font-weight:800;font-size:0.88rem;line-height:1.2;color:#0f172a;letter-spacing:-0.01em;">Vehicle Rental Management System</div>
            <div style="font-size:0.7rem;color:#64748b;font-weight:600;margin-top:2px;">${roleTitle} Portal</div>
          </div>
          <button type="button" class="sidebar-close-btn" id="sidebarCloseBtn" title="Close Menu" aria-label="Close Menu">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <nav class="sidebar-nav">
          ${tabs.map(t => `<div class="sidebar-nav-btn ${t.id === state.tab ? 'active' : ''}" data-tab="${t.id}">${t.label}</div>`).join('')}
        </nav>

        <div class="sidebar-footer">
          <div class="user-chip" id="userProfileChip" title="Click for User Menu" style="width:100%;cursor:pointer;">
            <div class="user-avatar">${initials}</div>
            <div class="user-meta" style="flex:1;">
              <div class="user-name">${state.profile?.full_name || 'User'}</div>
              <div class="user-role">${getRoleDisplayName(state.profile?.role)} · Menu</div>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm btn-block" id="logoutBtn" style="color:#dc2626;">Log Out</button>
        </div>
      </aside>

      <div class="main-wrapper">
        <div class="main-topbar">
          <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" class="hamburger-btn" id="hamburgerBtn" title="Open Navigation Menu" aria-label="Open Navigation Menu">
              <i class="fa-solid fa-bars"></i>
            </button>
            <div style="font-weight:800;font-size:1.05rem;color:#0f172a;display:flex;align-items:center;gap:10px;">
              ${activeTabObj?.label ?? 'Dashboard'}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="lang-select-pill" title="Language: English">
              <span>EN</span>
              <i class="fa-solid fa-chevron-down" style="font-size:0.65rem;opacity:0.6;"></i>
            </div>

            <button type="button" id="topThemeBtn" class="topbar-icon-btn" title="Toggle Light/Dark Mode" aria-label="Toggle Light/Dark Mode">
              <i class="fa-solid fa-${isDark ? 'sun' : 'moon'}" style="color:${isDark ? '#f59e0b' : 'var(--accent)'};"></i>
            </button>

            <button type="button" id="topNotifBtn" class="topbar-icon-btn" title="View Notifications" aria-label="View Notifications">
              <i class="fa-solid fa-bell" style="color:${isDark ? '#94a3b8' : '#475569'};"></i>
              ${unreadNotifs > 0 ? `<div class="notif-badge">${unreadNotifs}</div>` : ''}
            </button>

            ${renderRoleSwitcherHTML(state.portal)}

            <button type="button" id="topUserMenuBtn" class="topbar-user-pill" title="${state.profile?.full_name || 'User'}">
              <div class="topbar-user-avatar">${initials}</div>
              <span class="topbar-user-name">${firstName}</span>
              <i class="fa-solid fa-chevron-down" style="font-size:0.65rem;opacity:0.6;"></i>
            </button>
          </div>
        </div>
        <main id="mainView" class="admin-main-view"><div class="loading-spin"></div></main>
      </div>
    </div>
  `;

  function openSidebar() {
    const sidebar = $('#sidebarMenu');
    const overlay = $('#sidebarOverlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('active');
  }
  function closeSidebar() {
    const sidebar = $('#sidebarMenu');
    const overlay = $('#sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  }

  const hamburgerBtn = $('#hamburgerBtn');
  if (hamburgerBtn) hamburgerBtn.addEventListener('click', openSidebar);

  const sidebarCloseBtn = $('#sidebarCloseBtn');
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);

  const sidebarOverlay = $('#sidebarOverlay');
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

  $('#logoutBtn').addEventListener('click', logout);
  $('#topThemeBtn').addEventListener('click', toggleTheme);
  $('#topNotifBtn').addEventListener('click', openNotificationsModal);
  $('#topUserMenuBtn').addEventListener('click', openUserMenuModal);
  bindRoleSwitcherEvents();
  const uChip = $('#userProfileChip');
  if (uChip) uChip.addEventListener('click', openUserMenuModal);
  $$('.sidebar-nav-btn').forEach(btn => btn.addEventListener('click', () => { closeSidebar(); state.tab = btn.dataset.tab; renderShell(); }));

  updateNotificationBadge();
  renderTab();
  checkPendingManagerAlert();
}

function checkPendingManagerAlert() {
  if (state.portal === 'staff' || state.portal === 'admin') {
    try {
      const raw = localStorage.getItem('rentflow_pending_manager_alert');
      if (raw) {
        localStorage.removeItem('rentflow_pending_manager_alert');
        const alertData = JSON.parse(raw);
        import('./utils.js').then(({ showBookingAlertPopup }) => {
          setTimeout(() => showBookingAlertPopup(alertData), 450);
        });
      }
    } catch (e) {}
  }
}

export async function renderTab(silent = false) {
  const view = $('#mainView');
  if (!view) return;
  if (!silent) {
    view.innerHTML = '<div class="loading-spin"></div>';
  }
  try {
    if (state.portal === 'customer') await renderCustomer(state.tab, view);
    else if (state.portal === 'staff') await renderStaff(state.tab, view);
    else if (state.portal === 'admin') await renderAdmin(state.tab, view);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="empty-state"><p style="color:#dc2626;font-weight:700;">${err.message}</p></div>`;
  }
}

window.renderShell = renderShell;
window.renderTab = renderTab;
window.closeModal = closeModal;

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    state.user = null;
    state.profile = null;
    localStorage.removeItem('rentflow_active_role');
    renderLandingPage();
  }
});

bootstrapSession().then(() => {
  initRealtimeSync();
}).catch(() => {
  initRealtimeSync();
});
