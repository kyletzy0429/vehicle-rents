import { supabase } from './config.js';
import { state, PORTAL_TABS, DEFAULT_SETTINGS, getSystemSettings, DEMO_ACCOUNTS } from './state.js';
import {
  $, $$, toast, openModal, closeModal,
  getTheme, toggleTheme, applyTheme,
  getLang, setLang, t,
  getRoleDisplayName, getNotifications, openNotificationsModal, updateNotificationBadge
} from './utils.js';
import { renderAuth, renderLandingPage, logout, bootstrapSession, switchSystemRole } from './auth.js';
import { renderCustomer } from './customer.js';
import { renderStaff, renderAdmin } from './admin.js';
import { initRealtimeSync } from './realtime.js';
import { openRentalExtensionModal } from './rental-extension.js';
import { openVehicleDetail } from './booking.js';

if (typeof window !== 'undefined') {
  window.setLang = setLang;
  window.getLang = getLang;
  window.toggleTheme = toggleTheme;
  window.openRentalExtensionModal = openRentalExtensionModal;
  window.openVehicleDetail = openVehicleDetail;
  window.switchSystemRole = switchSystemRole;
  window.renderLandingPage = renderLandingPage;
  window.renderAuth = renderAuth;
  window.logout = logout;
  window.openNotificationsModal = openNotificationsModal;
  window.openUserMenuModal = openUserMenuModal;
  window.closeModal = closeModal;
  window.switchTab = function(tab) {
    state.isViewingDetail = false;
    state.tab = (tab === 'vehicles' || tab === 'browse') ? 'browse' : tab;
    renderShell();
  };
}

export function renderRoleSwitcherHTML(currentRole) {
  const lang = getLang();
  const roleLabels = {
    customer: lang === 'fil' ? 'Umuupa' : 'Renter',
    staff: lang === 'fil' ? 'Kawani' : 'Staff',
    admin: 'Admin'
  };
  const currentLabel = roleLabels[currentRole] || 'Role';

  return `
    <div class="role-dropdown-container" id="roleDropdownContainer">
      <button type="button" class="role-dropdown-trigger" id="roleDropdownToggle" aria-haspopup="true" aria-expanded="false" title="Switch Role">
        <strong class="role-dropdown-val">${currentLabel}</strong>
        <i class="fa-solid fa-chevron-down role-dropdown-arrow"></i>
      </button>

      <div class="role-dropdown-menu" id="roleDropdownMenu" style="display:none;">
        <div class="role-menu-heading">${lang === 'fil' ? 'Magpalit ng Role' : 'Switch Role'}</div>
        
        <div class="role-menu-item ${currentRole === 'customer' ? 'active' : ''}" data-role-choice="customer">
          <span class="role-item-title">${lang === 'fil' ? 'Umuupa (Renter)' : 'Renter'}</span>
          ${currentRole === 'customer' ? '<i class="fa-solid fa-check" style="font-size:0.75rem;color:var(--accent);margin-left:auto;"></i>' : ''}
        </div>

        <div class="role-menu-item ${currentRole === 'staff' ? 'active' : ''}" data-role-choice="staff">
          <span class="role-item-title">${lang === 'fil' ? 'Kawani (Staff)' : 'Staff'}</span>
          ${currentRole === 'staff' ? '<i class="fa-solid fa-check" style="font-size:0.75rem;color:var(--accent);margin-left:auto;"></i>' : ''}
        </div>

        <div class="role-menu-item ${currentRole === 'admin' ? 'active' : ''}" data-role-choice="admin">
          <span class="role-item-title">${lang === 'fil' ? 'Tagapangasiwa (Admin)' : 'Admin'}</span>
          ${currentRole === 'admin' ? '<i class="fa-solid fa-check" style="font-size:0.75rem;color:var(--accent);margin-left:auto;"></i>' : ''}
        </div>
      </div>
    </div>
  `;
}

export function bindRoleSwitcherEvents() {
  $$('.role-dropdown-container').forEach(container => {
    const toggleBtn = container.querySelector('.role-dropdown-trigger');
    const menu = container.querySelector('.role-dropdown-menu');

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
        if (!container.contains(e.target)) {
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
  });
}

export function renderLangSwitcherHTML() {
  const currentLang = getLang();
  return `
    <div class="lang-dropdown-container" id="langDropdownContainer">
      <button type="button" class="lang-select-pill" id="langDropdownToggle" aria-haspopup="true" aria-expanded="false" title="Language / Wika">
        <span>${currentLang.toUpperCase()}</span>
        <i class="fa-solid fa-chevron-down" style="font-size:0.65rem;opacity:0.6;"></i>
      </button>

      <div class="lang-dropdown-menu" id="langDropdownMenu" style="display:none;">
        <div class="lang-menu-item ${currentLang === 'en' ? 'active' : ''}" data-lang-choice="en">
          <span>English (EN)</span>
          ${currentLang === 'en' ? '<i class="fa-solid fa-check" style="font-size:0.75rem;color:var(--accent);margin-left:auto;"></i>' : ''}
        </div>
        <div class="lang-menu-item ${currentLang === 'fil' ? 'active' : ''}" data-lang-choice="fil">
          <span>Filipino (FIL)</span>
          ${currentLang === 'fil' ? '<i class="fa-solid fa-check" style="font-size:0.75rem;color:var(--accent);margin-left:auto;"></i>' : ''}
        </div>
      </div>
    </div>
  `;
}

export function bindLangSwitcherEvents() {
  const container = $('#langDropdownContainer');
  if (!container) return;
  const toggleBtn = container.querySelector('#langDropdownToggle');
  const menu = container.querySelector('#langDropdownMenu');

  if (toggleBtn && menu) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.style.display === 'flex' || menu.style.display === 'block';
      menu.style.display = isOpen ? 'none' : 'flex';
      toggleBtn.setAttribute('aria-expanded', String(!isOpen));
      toggleBtn.classList.toggle('active', !isOpen);
    });

    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        menu.style.display = 'none';
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.classList.remove('active');
      }
    });

    menu.querySelectorAll('[data-lang-choice]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const lang = item.dataset.langChoice;
        menu.style.display = 'none';
        if (lang) setLang(lang);
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
            <h3 style="font-size:1.1rem;font-weight:800;color:var(--text-hi);margin:0;">${p.full_name || 'Roland S. Bautista'}</h3>
            <span style="font-size:0.78rem;color:var(--accent);font-weight:700;">System Administrator</span>
          </div>
        </div>
        <div class="modal-close" id="mClose">Close</div>
      </div>

      <div style="background:var(--bg-surface);border:1px solid var(--glass-border);border-radius:12px;padding:14px;margin-bottom:16px;">
        <div class="receipt-row"><span style="color:var(--text-mid);">Admin Email</span><span style="font-weight:600;color:var(--text-hi);">${p.email || state.user?.email || 'roland.bautista@rentflow.ph'}</span></div>
        <div class="receipt-row"><span style="color:var(--text-mid);">Contact Phone</span><span style="font-weight:600;color:var(--text-hi);">${p.phone || '0917 992 3341'}</span></div>
        <div class="receipt-row"><span style="color:var(--text-mid);">Access Level</span><span style="font-weight:700;color:var(--accent);">Full System &amp; Financial Control</span></div>
        <div class="receipt-row"><span style="color:var(--text-mid);">Department</span><span style="font-weight:600;color:var(--text-hi);">Operations &amp; Administration</span></div>
      </div>

      <h4 style="font-size:0.88rem;font-weight:700;color:var(--text-hi);margin-bottom:10px;">Administrator Controls &amp; Shortcuts</h4>
      
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
        <button class="btn btn-ghost" id="adminGoSettings" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:var(--text-hi);font-size:0.9rem;">System Settings &amp; Policies</div>
            <div style="font-size:0.75rem;color:var(--text-mid);">Configure company profile, rental policies, and pricing rules</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="adminGoVehicles" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:var(--text-hi);font-size:0.9rem;">Vehicle Inventory</div>
            <div style="font-size:0.75rem;color:var(--text-mid);">Manage vehicles, daily rental rates, and categories</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="adminGoReports" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:var(--text-hi);font-size:0.9rem;">Reports &amp; Financial Analytics</div>
            <div style="font-size:0.75rem;color:var(--text-mid);">View revenue summaries, payment breakdown, and accounting audit logs</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="adminGoCustomers" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:var(--text-hi);font-size:0.9rem;">Customer Directory &amp; Licenses</div>
            <div style="font-size:0.75rem;color:var(--text-mid);">Inspect verified customer records and driver licenses</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="adminGoUsers" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:var(--text-hi);font-size:0.9rem;">System Roles &amp; Permissions</div>
            <div style="font-size:0.75rem;color:var(--text-mid);">Manage Administrator and Staff access</div>
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
            <h3 style="font-size:1.1rem;font-weight:800;color:var(--text-hi);margin:0;">${p.full_name || 'Sarah Jane Villanueva'}</h3>
            <span style="font-size:0.78rem;color:#059669;font-weight:700;">Operations Staff</span>
          </div>
        </div>
        <div class="modal-close" id="mClose">Close</div>
      </div>

      <div style="background:var(--bg-surface);border:1px solid var(--glass-border);border-radius:12px;padding:14px;margin-bottom:16px;">
        <div class="receipt-row"><span style="color:var(--text-mid);">Email</span><span style="font-weight:600;color:var(--text-hi);">${p.email || state.user?.email || 'sarah.villanueva@rentflow.ph'}</span></div>
        <div class="receipt-row"><span style="color:var(--text-mid);">Phone</span><span style="font-weight:600;color:var(--text-hi);">${p.phone || '0917 882 1450'}</span></div>
        <div class="receipt-row"><span style="color:var(--text-mid);">Operations Role</span><span style="font-weight:700;color:#059669;">Vehicle Dispatch &amp; Booking Approvals</span></div>
        <div class="receipt-row"><span style="color:var(--text-mid);">Station</span><span style="font-weight:600;color:var(--text-hi);">RentFlow Main Hub Operations</span></div>
      </div>

      <h4 style="font-size:0.88rem;font-weight:700;color:var(--text-hi);margin-bottom:10px;">Operations Shortcuts</h4>
      
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
        <button class="btn btn-ghost" id="staffGoDashboard" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:var(--text-hi);font-size:0.9rem;">Operations Dashboard</div>
            <div style="font-size:0.75rem;color:var(--text-mid);">Overview of booking queue and vehicle status</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="staffGoScanner" style="justify-content:flex-start;padding:12px 14px;border:1px solid rgba(124,58,237,0.3);background:rgba(124,58,237,0.04);border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:var(--accent);font-size:0.9rem;"><i class="fa-solid fa-qrcode" style="margin-right:6px;"></i> Venue QR Pass Scanner</div>
            <div style="font-size:0.75rem;color:var(--text-mid);">Instant camera scanner &amp; pass verification</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="staffGoRequests" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:var(--text-hi);font-size:0.9rem;">Booking Requests &amp; Approvals</div>
            <div style="font-size:0.75rem;color:var(--text-mid);">Review and approve incoming reservations</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="staffGoActive" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:var(--text-hi);font-size:0.9rem;">Active Rentals &amp; Dispatches</div>
            <div style="font-size:0.75rem;color:var(--text-mid);">Manage vehicles currently on road and key release</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="staffGoReturns" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:var(--text-hi);font-size:0.9rem;">Vehicle Returns &amp; Inspections</div>
            <div style="font-size:0.75rem;color:var(--text-mid);">Check-in returned vehicles and verify fuel level</div>
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
            <h3 style="font-size:1.1rem;font-weight:800;color:var(--text-hi);margin:0;">${renterName}</h3>
            <span style="font-size:0.78rem;color:var(--accent);font-weight:700;">Verified Renter</span>
          </div>
        </div>
        <div class="modal-close" id="mClose">Close</div>
      </div>

      <div style="background:var(--bg-surface);border:1px solid var(--glass-border);border-radius:12px;padding:14px;margin-bottom:16px;">
        <div class="receipt-row"><span style="color:var(--text-mid);">Email</span><span style="font-weight:600;color:var(--text-hi);">${p.email || state.user?.email || 'renter@rentflow.ph'}</span></div>
        <div class="receipt-row"><span style="color:var(--text-mid);">Phone</span><span style="font-weight:600;color:var(--text-hi);">${p.phone || '0917 582 9140'}</span></div>
      </div>

      <h4 style="font-size:0.88rem;font-weight:700;color:var(--text-hi);margin-bottom:10px;">Renter Menu</h4>
      
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">

        <button class="btn btn-ghost" id="umAccount" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:var(--text-hi);font-size:0.9rem;"><i class="fa-solid fa-circle-user" style="color:var(--accent);margin-right:6px;"></i> My Account &amp; Profile</div>
            <div style="font-size:0.75rem;color:var(--text-mid);">Manage personal details, contact info, and driver's license</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="umBookings" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:var(--text-hi);font-size:0.9rem;">My Reservations &amp; Rentals</div>
            <div style="font-size:0.75rem;color:var(--text-mid);">View active reservations, receipts, and refund requests</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="umFavorites" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:var(--text-hi);font-size:0.9rem;">My Favorites</div>
            <div style="font-size:0.75rem;color:var(--text-mid);">View your saved cars &amp; motorcycles</div>
          </div>
        </button>

        <button class="btn btn-ghost" id="umSupport" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <div>
            <div style="font-weight:700;color:var(--text-hi);font-size:0.9rem;">Support Contact</div>
            <div style="font-size:0.75rem;color:var(--text-mid);">Hotline: ${comp.phone || '+63 67676767'} | Email: ${comp.email || 'vehicleretal.ph'}</div>
          </div>
        </button>
      </div>

      <div style="padding-top:14px;border-top:1px solid #e2e8f0;display:flex;gap:10px;">
        <button class="btn btn-danger btn-block" id="umLogout" style="padding:10px;">Log Out of Account</button>
      </div>
    `;
  }

  openModal(modalContent);

  $('#mClose')?.addEventListener('click', closeModal);
  $('#umLogout')?.addEventListener('click', () => { closeModal(); logout(); });

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
  if (aAcc) aAcc.addEventListener('click', () => { closeModal(); state.isViewingDetail = false; state.tab = 'account'; renderShell(); });
  const bBtn = $('#umBookings');
  if (bBtn) bBtn.addEventListener('click', () => { closeModal(); state.isViewingDetail = false; state.tab = 'bookings'; renderShell(); });
  const fBtn = $('#umFavorites');
  if (fBtn) fBtn.addEventListener('click', () => { closeModal(); state.isViewingDetail = false; state.tab = 'favorites'; renderShell(); });
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



export function renderShell() {
  const comp = getSystemSettings().company || DEFAULT_SETTINGS.company;
  const companyName = (comp.name && comp.name !== 'Palawan Drive') ? comp.name : 'Vehicle Rental System';
  const rawTabs = PORTAL_TABS[state.portal] || [];
  const tabs = rawTabs.map(tObj => ({
    id: tObj.id,
    label: t(tObj.id, tObj.label)
  }));
  if (!state.tab || !tabs.find(t => t.id === state.tab)) state.tab = tabs[0]?.id;

  const rawName = state.profile?.full_name || '';
  const isGeneric = !rawName || rawName === 'Guest Customer' || rawName === 'User' || rawName === 'Customer';
  const displayName = isGeneric ? t('renter', 'Renter') : rawName;
  const initials = isGeneric ? 'R' : displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const firstName = isGeneric ? t('renter', 'Renter') : displayName.split(' ')[0];
  const roleTitle = getRoleDisplayName(state.portal);
  const activeTabObj = tabs.find(t => t.id === state.tab);

  const isDark = getTheme() === 'dark';
  const unreadNotifs = getNotifications().filter(n => !n.read).length;

  $('#app').innerHTML = `
    <div class="app-shell">
      <div class="sidebar-overlay" id="sidebarOverlay"></div>
      <aside class="sidebar" id="sidebarMenu">
        <div class="sidebar-brand">
          <div class="sidebar-brand-icon">${companyName[0]}</div>
          <div class="sidebar-brand-name">${companyName}</div>
          <button type="button" class="sidebar-close-btn" id="sidebarCloseBtn" title="Close Menu" aria-label="Close Menu">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="sidebar-section-tag">${state.portal === 'admin' ? t('admin').toUpperCase() : (state.portal === 'staff' ? t('staff').toUpperCase() : t('renter').toUpperCase())}</div>

        <nav class="sidebar-nav">
          ${tabs.map(t => `<div class="sidebar-nav-btn ${t.id === state.tab ? 'active' : ''}" data-tab="${t.id}">${t.label}</div>`).join('')}
        </nav>

        <div class="sidebar-footer">
          <div class="user-chip" id="userProfileChip" title="Click for User Menu" style="width:100%;cursor:pointer;">
            <div class="user-avatar">${initials}</div>
            <div class="user-meta" style="flex:1;">
              <div class="user-name">${state.profile?.full_name || 'User'}</div>
              <div class="user-role">${getRoleDisplayName(state.profile?.role)} · ${t('menu', 'Menu')}</div>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm btn-block" id="logoutBtn" style="color:#dc2626;">${t('logout', 'Log Out')}</button>
        </div>
      </aside>

      <div class="main-wrapper">
        <div class="main-topbar">
          <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" class="hamburger-btn" id="hamburgerBtn" title="Open Navigation Menu" aria-label="Open Navigation Menu">
              <i class="fa-solid fa-bars"></i>
            </button>
            <div style="font-weight:800;font-size:1.05rem;color:var(--text-hi);display:flex;align-items:center;gap:10px;">
              ${activeTabObj?.label ?? 'Dashboard'}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${renderLangSwitcherHTML()}

            <button type="button" id="topThemeBtn" class="topbar-icon-btn" title="Toggle Light/Dark Mode" aria-label="Toggle Light/Dark Mode">
              <i class="fa-solid fa-${isDark ? 'sun' : 'moon'}" style="color:${isDark ? '#f59e0b' : 'var(--accent)'};"></i>
            </button>

            <button type="button" id="topNotifBtn" class="topbar-icon-btn" title="View Notifications" aria-label="View Notifications">
              <i class="fa-solid fa-bell" style="color:${isDark ? '#94a3b8' : '#475569'};"></i>
              ${unreadNotifs > 0 ? `<div class="notif-badge">${unreadNotifs}</div>` : ''}
            </button>

            ${renderRoleSwitcherHTML(state.portal)}
          </div>
        </div>
        <main id="mainView" class="${state.portal === 'customer' ? 'customer-main-view' : 'admin-main-view'}"><div class="loading-spin"></div></main>
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

  $('#logoutBtn')?.addEventListener('click', logout);
  $('#topThemeBtn')?.addEventListener('click', toggleTheme);
  $('#topNotifBtn')?.addEventListener('click', openNotificationsModal);
  $('#topUserMenuBtn')?.addEventListener('click', openUserMenuModal);
  bindRoleSwitcherEvents();
  bindLangSwitcherEvents();
  const uChip = $('#userProfileChip');
  if (uChip) uChip.addEventListener('click', openUserMenuModal);
  $$('.sidebar-nav-btn').forEach(btn => btn.addEventListener('click', () => { 
    state.isViewingDetail = false;
    closeSidebar(); 
    state.tab = btn.dataset.tab; 
    renderShell(); 
  }));

  updateNotificationBadge();
  renderTab();
  checkPendingManagerAlert();
}

function checkPendingManagerAlert() {
  try {
    localStorage.removeItem('rentflow_pending_manager_alert');
  } catch (e) {}
}

export async function renderTab(silent = false) {
  if (state.isViewingDetail) return;
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
