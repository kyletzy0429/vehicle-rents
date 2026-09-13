import { supabase } from './config.js';
import { state, PORTAL_TABS, DEFAULT_SETTINGS, getSystemSettings, DEMO_ACCOUNTS } from './state.js';
import {
  $, $$, toast, openModal, closeModal,
  getTheme, toggleTheme, applyTheme,
  getRoleDisplayName, getNotifications, openNotificationsModal, updateNotificationBadge
} from './utils.js';
import { renderAuth, logout, bootstrapSession, switchSystemRole } from './auth.js';
import { renderCustomer } from './customer.js';
import { renderStaff, renderAdmin } from './admin.js';

export function renderRoleSwitcherHTML(currentRole) {
  const roleLabels = {
    customer: 'Guest',
    staff: 'Staff',
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
        <div class="role-menu-heading">Switch Role</div>
        
        <div class="role-menu-item ${currentRole === 'customer' ? 'active' : ''}" data-role-choice="customer">
          <span class="role-item-title">Guest</span>
          ${currentRole === 'customer' ? '<i class="fa-solid fa-check role-item-check"></i>' : ''}
        </div>

        <div class="role-menu-item ${currentRole === 'staff' ? 'active' : ''}" data-role-choice="staff">
          <span class="role-item-title">Staff</span>
          ${currentRole === 'staff' ? '<i class="fa-solid fa-check role-item-check"></i>' : ''}
        </div>

        <div class="role-menu-item ${currentRole === 'admin' ? 'active' : ''}" data-role-choice="admin">
          <span class="role-item-title">Admin</span>
          ${currentRole === 'admin' ? '<i class="fa-solid fa-check role-item-check"></i>' : ''}
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
  const roleTitle = getRoleDisplayName(p.role);
  const comp = getSystemSettings().company || DEFAULT_SETTINGS.company;

  openModal(`
    <div class="modal-head">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-weight:800;font-size:1.1rem;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(37,99,235,0.25);">${initials}</div>
        <div>
          <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin:0;">${p.full_name || 'User Account'}</h3>
          <span style="font-size:0.78rem;color:#2563eb;font-weight:700;"><i class="fa-solid fa-shield-halved" style="margin-right:3px;"></i> ${roleTitle} Account</span>
        </div>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:16px;">
      <div class="receipt-row"><span style="color:#64748b;"><i class="fa-solid fa-envelope" style="margin-right:5px;"></i> Email</span><span style="font-weight:600;color:#0f172a;">${state.user?.email || '—'}</span></div>
      <div class="receipt-row"><span style="color:#64748b;"><i class="fa-solid fa-phone" style="margin-right:5px;"></i> Phone</span><span style="font-weight:600;color:#0f172a;">${p.phone || 'Not set'}</span></div>
      <div class="receipt-row"><span style="color:#64748b;"><i class="fa-solid fa-id-card" style="margin-right:5px;"></i> Driver License</span><span style="font-weight:600;color:#0f172a;">${p.license_number || 'Verify at meetup'}</span></div>
    </div>

    <h4 style="font-size:0.88rem;font-weight:700;color:#0f172a;margin-bottom:10px;"><i class="fa-solid fa-bars-staggered" style="color:#2563eb;margin-right:6px;"></i> User Menu &amp; Quick Actions</h4>
    
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
      <button class="btn btn-ghost" id="umProfile" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
        <i class="fa-solid fa-user-gear" style="color:#2563eb;font-size:1.1rem;margin-right:10px;width:20px;"></i>
        <div>
          <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">My Profile &amp; Contact Details</div>
          <div style="font-size:0.75rem;color:#64748b;">View &amp; update personal info, phone, and address</div>
        </div>
      </button>

      ${state.portal === 'customer' ? `
        <button class="btn btn-ghost" id="umFavorites" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <i class="fa-solid fa-heart" style="color:#e11d48;font-size:1.1rem;margin-right:10px;width:20px;"></i>
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">My Favorites</div>
            <div style="font-size:0.75rem;color:#64748b;">View your saved cars &amp; motorcycles</div>
          </div>
        </button>
        <button class="btn btn-ghost" id="umBookings" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
          <i class="fa-solid fa-calendar-check" style="color:#059669;font-size:1.1rem;margin-right:10px;width:20px;"></i>
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">My Reservations &amp; Rentals</div>
            <div style="font-size:0.75rem;color:#64748b;">View active reservations, receipts, and refund requests</div>
          </div>
        </button>
      ` : ''}

      <button class="btn btn-ghost" id="umSupport" style="justify-content:flex-start;padding:12px 14px;border:1px solid #e2e8f0;background:#ffffff;border-radius:10px;text-align:left;">
        <i class="fa-solid fa-headset" style="color:#0284c7;font-size:1.1rem;margin-right:10px;width:20px;"></i>
        <div>
          <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">Support Contact</div>
          <div style="font-size:0.75rem;color:#64748b;">Hotline: ${comp.phone || '+63 67676767'} | Email: ${comp.email || 'vehicleretal.ph'}</div>
        </div>
      </button>
    </div>

    <div style="padding-top:14px;border-top:1px solid #e2e8f0;display:flex;gap:10px;">
      <button class="btn btn-danger btn-block" id="umLogout" style="padding:10px;"><i class="fa-solid fa-right-from-bracket" style="margin-right:6px;"></i> Log Out of Account</button>
    </div>
  `);

  $('#mClose').addEventListener('click', closeModal);
  $('#umLogout').addEventListener('click', () => { closeModal(); logout(); });

  const pBtn = $('#umProfile');
  if (pBtn) {
    pBtn.addEventListener('click', () => {
      closeModal();
      if (state.portal === 'customer') {
        state.tab = 'profile';
        renderShell();
      } else {
        toast(`Profile info for ${state.profile.full_name}`, 'info');
      }
    });
  }

  const fBtn = $('#umFavorites');
  if (fBtn) {
    fBtn.addEventListener('click', () => {
      closeModal();
      state.tab = 'favorites';
      renderShell();
    });
  }

  const bBtn = $('#umBookings');
  if (bBtn) {
    bBtn.addEventListener('click', () => {
      closeModal();
      state.tab = 'bookings';
      renderShell();
    });
  }

  const sBtn = $('#umSupport');
  if (sBtn) {
    sBtn.addEventListener('click', () => {
      const curComp = getSystemSettings().company || DEFAULT_SETTINGS.company;
      toast(`Support Hotline: ${curComp.phone || '+63 67676767'} | Email: ${curComp.email || 'vehicleretal.ph'}`, 'info');
    });
  }
}

export function renderShell() {
  const tabs = PORTAL_TABS[state.portal] || [];
  if (!state.tab || !tabs.find(t => t.id === state.tab)) state.tab = tabs[0]?.id;

  const initials = (state.profile?.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const firstName = (state.profile?.full_name || 'User').split(' ')[0];
  const roleTitle = getRoleDisplayName(state.portal);
  const activeTabObj = tabs.find(t => t.id === state.tab);

  const isDark = getTheme() === 'dark';
  const unreadNotifs = getNotifications().filter(n => !n.read).length;

  if (state.portal === 'customer') {
    $('#app').innerHTML = `
      <div style="min-height:100vh;background:var(--bg-dark);overflow-x:hidden;width:100%;max-width:100vw;">
        <header class="portal-header">
          <div class="portal-header-left">
            <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" id="brandHomeBtn">
              <div style="width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.95rem;box-shadow:0 2px 5px rgba(37,99,235,0.25);">
                <i class="fa-solid fa-car"></i>
              </div>
              <div>
                <div style="font-weight:800;font-size:0.92rem;line-height:1.15;color:#0f172a;letter-spacing:-0.01em;">Vehicle Rentals</div>
                <div style="font-size:0.68rem;color:#2563eb;font-weight:700;letter-spacing:0.02em;">GUEST PORTAL</div>
              </div>
            </div>

            <nav style="display:flex;align-items:center;gap:6px;">
              ${tabs.filter(t => t.id === 'browse' || t.id === 'bookings').map(t => `
                <button type="button" class="btn nav-tab-btn ${t.id === state.tab ? 'btn-primary' : 'btn-ghost'}" data-tab="${t.id}" style="font-size:0.82rem;padding:6px 14px;border-radius:99px;font-weight:700;">
                  ${t.label}
                </button>
              `).join('')}
            </nav>
          </div>

          <div class="portal-header-right">
            ${renderRoleSwitcherHTML(state.portal)}

            <button type="button" id="topThemeBtn" title="Toggle Light/Dark Mode" style="width:36px;height:36px;min-width:36px;min-height:36px;border-radius:50%;padding:0;border:1px solid #cbd5e1;background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:border-box;flex-shrink:0;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
              <i class="fa-solid fa-${isDark ? 'sun' : 'moon'}" style="color:${isDark ? '#f59e0b' : '#2563eb'};font-size:0.92rem;"></i>
            </button>

            <button type="button" id="topNotifBtn" title="View Notifications" style="position:relative;width:36px;height:36px;min-width:36px;min-height:36px;border-radius:50%;padding:0;border:1px solid #cbd5e1;background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:border-box;flex-shrink:0;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
              <i class="fa-solid fa-bell" style="color:#475569;font-size:0.92rem;"></i>
              ${unreadNotifs > 0 ? `<div class="notif-badge">${unreadNotifs}</div>` : ''}
            </button>

            <button type="button" id="topUserMenuBtn" title="${state.profile?.full_name || 'User'}" style="height:36px;border:1px solid #cbd5e1;background:#fff;display:flex;align-items:center;gap:7px;padding:0 10px 0 5px;border-radius:99px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
              <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-weight:800;font-size:0.72rem;display:flex;align-items:center;justify-content:center;">${initials}</div>
              <span style="font-weight:700;font-size:0.82rem;color:#0f172a;">${firstName}</span>
              <i class="fa-solid fa-chevron-down" style="font-size:0.68rem;color:#64748b;"></i>
            </button>
          </div>
        </header>

        <main id="mainView" class="customer-main-view"><div class="loading-spin"></div></main>
      </div>
    `;

    $('#brandHomeBtn').addEventListener('click', () => { state.tab = 'browse'; renderShell(); });
    $$('.nav-tab-btn').forEach(btn => btn.addEventListener('click', () => { state.tab = btn.dataset.tab; renderShell(); }));
    $('#topThemeBtn').addEventListener('click', toggleTheme);
    $('#topNotifBtn').addEventListener('click', openNotificationsModal);
    $('#topUserMenuBtn').addEventListener('click', openUserMenuModal);
    bindRoleSwitcherEvents();

    updateNotificationBadge();
    renderTab();
    return;
  }

  $('#app').innerHTML = `
    <div class="app-shell">
      <div class="sidebar-overlay" id="sidebarOverlay"></div>
      <aside class="sidebar" id="sidebarMenu">
        <div class="sidebar-brand" style="display:flex;align-items:center;">
          <div style="flex:1;">
            <div style="font-weight:800;font-size:0.92rem;line-height:1.2;color:#0f172a;letter-spacing:-0.01em;">Vehicle Rental Management System</div>
            <div style="font-size:0.7rem;color:#64748b;font-weight:600;margin-top:2px;">${roleTitle} Portal</div>
          </div>
          <button type="button" class="sidebar-close-btn" id="sidebarCloseBtn" title="Close Menu">
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
              <div class="user-role"><i class="fa-solid fa-id-card" style="color:#2563eb;margin-right:2px;"></i> ${getRoleDisplayName(state.profile?.role)} · Menu</div>
            </div>
            <i class="fa-solid fa-ellipsis-vertical" style="color:#94a3b8;font-size:0.9rem;"></i>
          </div>
          <button class="btn btn-ghost btn-sm btn-block" id="logoutBtn" style="color:#dc2626;"><i class="fa-solid fa-right-from-bracket"></i> Log Out</button>
        </div>
      </aside>

      <div class="main-wrapper">
        <div class="main-topbar">
          <div style="display:flex;align-items:center;gap:10px;">
            <button type="button" class="hamburger-btn" id="hamburgerBtn" title="Open Menu">
              <i class="fa-solid fa-bars"></i>
            </button>
            <div style="font-weight:800;font-size:1.05rem;color:#0f172a;display:flex;align-items:center;gap:10px;">
              ${activeTabObj?.label ?? 'Dashboard'}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${renderRoleSwitcherHTML(state.portal)}

            <button type="button" id="topThemeBtn" title="Toggle Light/Dark Mode" style="width:36px;height:36px;min-width:36px;min-height:36px;border-radius:50%;padding:0;border:1px solid #cbd5e1;background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:border-box;flex-shrink:0;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
              <i class="fa-solid fa-${isDark ? 'sun' : 'moon'}" style="color:${isDark ? '#f59e0b' : '#2563eb'};font-size:0.92rem;"></i>
            </button>

            <button type="button" id="topNotifBtn" title="View Notifications" style="position:relative;width:36px;height:36px;min-width:36px;min-height:36px;border-radius:50%;padding:0;border:1px solid #cbd5e1;background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:border-box;flex-shrink:0;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
              <i class="fa-solid fa-bell" style="color:#475569;font-size:0.92rem;"></i>
              ${unreadNotifs > 0 ? `<div class="notif-badge">${unreadNotifs}</div>` : ''}
            </button>

            <button type="button" id="topUserMenuBtn" title="${state.profile?.full_name || 'User'}" style="height:36px;border:1px solid #cbd5e1;background:#fff;display:flex;align-items:center;gap:7px;padding:0 10px 0 5px;border-radius:99px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
              <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-weight:800;font-size:0.72rem;display:flex;align-items:center;justify-content:center;">${initials}</div>
              <span style="font-weight:700;font-size:0.82rem;color:#0f172a;">${firstName}</span>
              <i class="fa-solid fa-chevron-down" style="font-size:0.68rem;color:#64748b;"></i>
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
  if (state.portal === 'staff') {
    try {
      const raw = localStorage.getItem('rentflow_pending_manager_alert');
      if (raw) {
        localStorage.removeItem('rentflow_pending_manager_alert');
        const alertData = JSON.parse(raw);
        import('./utils.js').then(({ showBookingAlertPopup }) => {
          setTimeout(() => showBookingAlertPopup(alertData), 400);
        });
      }
    } catch (e) {}
  }
}

export async function renderTab() {
  const view = $('#mainView');
  if (!view) return;
  view.innerHTML = '<div class="loading-spin"></div>';
  try {
    if (state.portal === 'customer') await renderCustomer(state.tab, view);
    else if (state.portal === 'staff') await renderStaff(state.tab, view);
    else if (state.portal === 'admin') await renderAdmin(state.tab, view);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="empty-state"><div class="icon" style="color:#dc2626;font-size:1.8rem;"><i class="fa-solid fa-circle-exclamation"></i></div><p>${err.message}</p></div>`;
  }
}

window.renderShell = renderShell;
window.renderTab = renderTab;
window.closeModal = closeModal;

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    state.user = null;
    state.profile = null;
    renderAuth();
  }
});

bootstrapSession();
