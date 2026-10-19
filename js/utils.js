import { supabase } from './config.js';
import { state, DEFAULT_SETTINGS, getSystemSettings, getLocalBookings } from './state.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const fmtMoney = (n) => `${Number(n ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (d) => {
  if (!d) return "-";
  const date = new Date(d);
  return isNaN(date.getTime()) ? String(d) : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

export const daysBetween = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000));

export const maskPlate = (p) => {
  if (!p || p.length < 4) return p || "-";
  return p[0] + "***" + p.slice(-2);
};

export function emptyState(icon, text) {
  return `<div class="empty-box"><p>${text}</p></div>`;
}

export function toast(msg, type = 'info') {
  const wrap = $('#toastWrap') || document.body;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

export function openModal(html, wide = false) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'activeModal';
  overlay.innerHTML = `<div class="glass modal ${wide ? 'modal-wide' : ''}">${html}</div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  return overlay;
}

export function closeModal() {
  const overlays = document.querySelectorAll('.modal-overlay');
  overlays.forEach(m => m.remove());
}
window.closeModal = closeModal;

export function getTheme() {
  return localStorage.getItem('rentflow_theme') || 'light';
}

export function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('rentflow_theme', next);
  applyTheme();
  toast(`Switched to ${next === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
}

export function applyTheme() {
  const theme = getTheme();
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.body.removeAttribute('data-theme');
  }
}
applyTheme();

export function getLang() {
  return 'en';
}

export function setLang() {
  // English is the sole system language
}

export function getRoleDisplayName(role) {
  const r = (role || '').toLowerCase();
  if (r === 'admin') return 'Administrator';
  if (r === 'staff') return 'Staff Member';
  return 'Renter';
}

export function getSystemAlerts() {
  const comp = getSystemSettings().company || DEFAULT_SETTINGS.company;
  return [
    { id: 'sys-pickup', title: 'Vehicle Pickup Guidelines', time: 'Notice', desc: `Pickup location: ${comp.address || '123 PPC MAIN BRANCH VENUE'}. Please arrive 15 minutes early with your valid driver license.` },
    { id: 'sys-cancel', title: 'Free Cancellation Notice', time: 'Policy', desc: 'Free cancellation is available up to 24 hours prior to vehicle pickup date.' },
    { id: 'sys-support', title: '24/7 Roadside Assistance', time: 'Support', desc: `Need help during your trip? Call our emergency hotline at ${comp.phone || '+63 67676767'} or email ${comp.email || 'vehicleretal.ph'}` }
  ];
}

let cachedNotifs = [];

export function getReadNotifIds() {
  try {
    const raw = localStorage.getItem(`rentflow_read_notifs_${state.user?.id || 'guest'}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export function markAllNotifsRead(ids) {
  try {
    const existing = getReadNotifIds();
    const updated = Array.from(new Set([...existing, ...ids]));
    localStorage.setItem(`rentflow_read_notifs_${state.user?.id || 'guest'}`, JSON.stringify(updated));
  } catch (e) { }
}

export function getNotifications() {
  const readIds = getReadNotifIds();
  if (cachedNotifs.length > 0) {
    return cachedNotifs.map(n => ({ ...n, read: n.read || readIds.includes(String(n.id)) }));
  }
  return getSystemAlerts().map(a => ({ ...a, read: readIds.includes(String(a.id)) }));
}

export function getRelativeTime(dateInput) {
  if (!dateInput) return 'Recently';
  const created = new Date(dateInput);
  if (isNaN(created.getTime())) return 'Recently';
  const now = new Date();
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays > 0) return diffDays === 1 ? 'Yesterday' : `${diffDays} days ago`;
  if (diffHrs > 0) return `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`;
  if (diffMins > 0) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  return 'Just now';
}

export function buildCustomerNotif(b) {
  const vName = b.vehicles?.name || 'Vehicle';
  const shortId = `BK-${String(b.id).slice(-8).toUpperCase()}`;

  // Automated Vehicle Return Day Checks
  const todayStr = new Date().toISOString().slice(0, 10);
  const endStr = (b.end_date || '').slice(0, 10);

  if (['active', 'approved'].includes(b.status) && endStr) {
    if (endStr === todayStr) {
      return {
        id: `return-today-${b.id}`,
        title: `🚨 VEHICLE RETURN DAY TODAY`,
        time: 'Due by 12:00 PM',
        desc: `Your ${vName} (${shortId}) is scheduled for return today! Please ensure fuel matches pickup level. Need more time? Request a rental extension instantly.`,
        read: false,
        isReturnAlert: true,
        bookingId: b.id
      };
    } else if (endStr < todayStr) {
      return {
        id: `return-overdue-${b.id}`,
        title: `⚠️ OVERDUE RETURN NOTICE`,
        time: 'Immediate Action Required',
        desc: `Your ${vName} (${shortId}) return date was ${fmtDate(endStr)}. Please return vehicle or request extension to avoid late penalty charges.`,
        read: false,
        isOverdue: true,
        bookingId: b.id
      };
    }
  }

  const statusMap = {
    'approved': { title: 'Booking Approved', desc: `Your reservation for ${vName} (${shortId}) has been approved by staff. Please prepare for pickup.` },
    'pending': { title: 'Booking Request Submitted', desc: `Your reservation for ${vName} (${shortId}) is pending staff review.` },
    'active': { title: 'Rental Active & In-Progress', desc: `Your ${vName} (${shortId}) rental is currently active. Have a safe journey!` },
    'completed': { title: 'Rental Completed & Returned', desc: `Your ${vName} rental (${shortId}) has been successfully completed. Thank you for renting with us!` },
    'rejected': { title: 'Booking Rejected', desc: `Your reservation for ${vName} (${shortId}) was not approved. Please contact support.` },
    'cancelled': { title: 'Booking Cancelled', desc: `Your reservation for ${vName} (${shortId}) was cancelled.` },
    'refund_requested': { title: 'Refund Request Received', desc: `Your refund request for ${vName} (${shortId}) is being reviewed by our billing staff.` },
    'refunded': { title: 'Refund Issued', desc: `Your refund for ${vName} (${shortId}) has been processed successfully.` },
  };

  const info = statusMap[b.status] || { title: `Booking Update`, desc: `Your ${vName} booking (${shortId}) status changed to: ${b.status}` };
  return {
    id: `booking-${b.id}`,
    title: info.title,
    time: getRelativeTime(b.updated_at || b.created_at),
    desc: info.desc,
    read: ['completed', 'cancelled', 'refunded'].includes(b.status)
  };
}

export function buildStaffNotif(b) {
  const vName = b.vehicles?.name || 'Vehicle';
  const custName = b.profiles?.full_name || 'Customer';
  const shortId = `BK-${String(b.id).slice(-8).toUpperCase()}`;
  const statusMap = {
    'pending': { title: 'New Booking Request', desc: `${custName} submitted a new request for ${vName} (${shortId}). Action required.` },
    'approved': { title: 'Booking Approved', desc: `${vName} (${shortId}) for ${custName} is approved and awaiting pickup/payment.` },
    'active': { title: 'Rental Ongoing', desc: `${custName} picked up ${vName} (${shortId}). Vehicle is currently on the road.` },
    'completed': { title: 'Vehicle Returned', desc: `${custName} returned ${vName} (${shortId}). Inspection & return logged.` },
    'refund_requested': { title: 'Refund Claim Pending', desc: `${custName} submitted a refund request for ${vName} (${shortId}). Please verify.` },
  };

  const info = statusMap[b.status] || { title: 'Booking Record Update', desc: `${vName} (${shortId}) — Current status: ${b.status}` };
  return {
    id: `booking-${b.id}`,
    title: info.title,
    time: getRelativeTime(b.updated_at || b.created_at),
    desc: info.desc,
    read: ['completed', 'cancelled', 'refunded'].includes(b.status)
  };
}

export async function fetchLiveNotifications() {
  if (!state.user) return getSystemAlerts().map(a => ({ ...a, read: false }));
  try {
    let bookingNotifs = [];
    if (state.portal === 'customer') {
      let dbBookings = [];
      try {
        const { data } = await supabase
          .from('bookings')
          .select('*, vehicles(name)')
          .eq('customer_id', state.user.id)
          .order('created_at', { ascending: false })
          .limit(20);
        if (data) dbBookings = data;
      } catch (e) {}

      const localList = getLocalBookings().filter(b => b.customer_id === state.user.id);
      const dbIds = new Set(dbBookings.map(b => String(b.id)));
      const merged = [...dbBookings];
      for (const lb of localList) {
        if (!dbIds.has(String(lb.id))) {
          merged.push(lb);
        }
      }
      merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      bookingNotifs = merged.map(b => buildCustomerNotif(b));
    } else {
      let dbBookings = [];
      try {
        const { data } = await supabase
          .from('bookings')
          .select('*, vehicles(name), profiles!customer_id(full_name)')
          .order('created_at', { ascending: false })
          .limit(25);
        if (data) dbBookings = data;
      } catch (e) {}

      const localList = getLocalBookings();
      const dbIds = new Set(dbBookings.map(b => String(b.id)));
      const merged = [...dbBookings];
      for (const lb of localList) {
        if (!dbIds.has(String(lb.id))) {
          merged.push({
            ...lb,
            vehicles: lb.vehicles || { name: 'Vehicle' },
            profiles: lb.profiles || { full_name: lb.customer_name || 'Renter' }
          });
        }
      }
      merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      bookingNotifs = merged.map(b => buildStaffNotif(b));
    }

    const readIds = getReadNotifIds();
    const formattedAlerts = getSystemAlerts().map(a => ({
      ...a,
      read: readIds.includes(String(a.id))
    }));

    cachedNotifs = [
      ...bookingNotifs.map(n => ({ ...n, read: n.read || readIds.includes(String(n.id)) })),
      ...formattedAlerts
    ];
    return cachedNotifs;
  } catch (err) {
    console.error('Failed to load notifications from database:', err);
    return getNotifications();
  }
}

export async function updateNotificationBadge() {
  const notifs = await fetchLiveNotifications();
  const unreadCount = notifs.filter(n => !n.read).length;
  const notifBtn = $('#topNotifBtn');
  if (notifBtn) {
    const existingBadge = notifBtn.querySelector('.notif-badge');
    if (unreadCount > 0) {
      if (existingBadge) {
        existingBadge.textContent = unreadCount;
      } else {
        const badge = document.createElement('div');
        badge.className = 'notif-badge';
        badge.textContent = unreadCount;
        notifBtn.appendChild(badge);
      }
    } else if (existingBadge) {
      existingBadge.remove();
    }
  }
}

export async function openNotificationsModal() {
  openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.1rem;font-weight:800;color:var(--text-hi);margin:0;">Notifications &amp; Alerts</h3>
        <span style="font-size:0.75rem;color:var(--text-mid);">Live system updates &amp; rental alerts</span>
      </div>
      <div class="modal-close" id="mClose">Close</div>
    </div>
    <div style="padding:28px 0;text-align:center;"><div class="loading-spin"></div><p style="margin-top:12px;color:var(--text-mid);font-size:0.85rem;">Checking for live updates...</p></div>
  `);
  $('#mClose').addEventListener('click', closeModal);

  const notifs = await fetchLiveNotifications();

  const isDark = getTheme() === 'dark';
  const unreadBg = isDark ? 'rgba(59,130,246,0.14)' : '#eff6ff';
  const unreadBorder = isDark ? 'rgba(59,130,246,0.35)' : '#bfdbfe';
  const readBg = isDark ? 'rgba(30,41,59,0.6)' : '#f8fafc';
  const readBorder = isDark ? '#334155' : '#e2e8f0';

  const notifsHtml = notifs.length > 0 ? notifs.map(n => `
    <div style="background:${n.read ? readBg : (n.isReturnAlert || n.isOverdue ? (isDark ? 'rgba(239,68,68,0.18)' : '#fef2f2') : unreadBg)};border:1px solid ${n.read ? readBorder : (n.isReturnAlert || n.isOverdue ? '#ef4444' : unreadBorder)};border-radius:10px;padding:12px 14px;transition:all 0.2s ease;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:8px;">
        <span style="font-weight:700;font-size:0.88rem;color:${n.isReturnAlert || n.isOverdue ? '#dc2626' : 'var(--text-hi)'};">${n.title}</span>
        <span style="font-size:0.72rem;color:var(--text-mid);flex-shrink:0;">${n.time}</span>
      </div>
      <p style="font-size:0.8rem;color:var(--text-mid);margin:0 0 6px 0;line-height:1.4;">${n.desc}</p>
      ${(n.isReturnAlert || n.isOverdue) ? `
        <div style="margin-top:8px;display:flex;gap:8px;">
          <button type="button" class="btn btn-primary btn-sm" onclick="window.closeModal && window.closeModal(); window.openRentalExtensionModal && window.openRentalExtensionModal('${n.bookingId}');" style="padding:4px 10px;font-size:0.75rem;">
            <i class="fa-solid fa-clock-rotate-left"></i> Extend Rental
          </button>
        </div>
      ` : ''}
    </div>
  `).join('') : `
    <div style="text-align:center;padding:30px 10px;">
      <p style="font-size:0.9rem;font-weight:600;color:var(--text-hi);margin:0;">No notifications yet</p>
      <p style="font-size:0.8rem;color:var(--text-mid);margin-top:6px;">When you make a reservation or your vehicle return day arrives, alerts will show here.</p>
    </div>
  `;

  const unreadCount = notifs.filter(n => !n.read).length;

  openModal(`
    <div class="modal-head">
      <div>
        <h3 style="font-size:1.1rem;font-weight:800;color:var(--text-hi);margin:0;">Notifications &amp; Alerts</h3>
        <span style="font-size:0.75rem;color:var(--text-mid);">${unreadCount > 0 ? `${unreadCount} new update${unreadCount > 1 ? 's' : ''}` : 'All caught up!'} · ${notifs.length} total</span>
      </div>
      <div class="modal-close" id="mClose">Close</div>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;max-height:420px;overflow-y:auto;">
      ${notifsHtml}
    </div>

    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost btn-sm btn-block" id="markAllReadBtn" style="border:1px solid var(--glass-border);">Mark All as Read</button>
      <button class="btn btn-primary btn-sm btn-block" id="refreshNotifsBtn">Refresh</button>
    </div>
  `);

  $('#mClose').addEventListener('click', closeModal);

  const markAllBtn = $('#markAllReadBtn');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', () => {
      const allIds = notifs.map(n => String(n.id));
      markAllNotifsRead(allIds);
      cachedNotifs = cachedNotifs.map(n => ({ ...n, read: true }));
      toast('All notifications marked as read', 'success');
      closeModal();
      updateNotificationBadge();
    });
  }

  const refreshBtn = $('#refreshNotifsBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      closeModal();
      openNotificationsModal();
    });
  }
}

// Pleasant 2-tone audio chime using standard Web Audio API (no external MP3/CDN needed)
export function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // First tone (E5: 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second higher tone (A5: 880 Hz) - creates an elegant friendly ding
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.15, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch (e) {
    console.warn('Audio chime notice:', e);
  }
}

// Floating real-time notification pop-up for new guest booking (Centered Heads-Up Display)
export function showBookingAlertPopup(b) {
  if (!b) return;
  // ONLY show quick approve popup to staff or admin portal
  if (state.portal !== 'staff' && state.portal !== 'admin') return;

  // Play audio chime
  playNotificationChime();

  // Remove any existing active popup
  const existing = document.getElementById('activeBookingPopup');
  if (existing) existing.remove();

  const v = b.vehicles || {};
  const vName = v.name || 'Rental Vehicle';
  const vImg = v.image_url || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400';
  const vPlate = v.plate_number ? maskPlate(v.plate_number) : '';
  const vCategory = v.category ? (v.category.charAt(0).toUpperCase() + v.category.slice(1)) : '';
  const custName = b.customer_name || b.profiles?.full_name || 'Renter';
  const custPhone = b.customer_phone || b.profiles?.phone || '';
  const totalAmt = Number(b.total_amount || 0);

  const popup = document.createElement('div');
  popup.className = 'manager-booking-popup';
  popup.id = 'activeBookingPopup';
  popup.setAttribute('role', 'alert');
  popup.setAttribute('aria-live', 'assertive');

  popup.innerHTML = `
    <div class="popup-head">
      <div class="popup-tag">
        <span class="popup-pulse-dot"></span>
        <span class="popup-tag-text">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          New Booking Received
        </span>
      </div>
      <div class="popup-head-right">
        <span class="popup-badge-time">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          Just Now
        </span>
        <button type="button" class="popup-close-btn" id="popupCloseBtn" aria-label="Close Notification" title="Close Notification">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>

    <div class="popup-body">
      <div class="popup-vehicle-thumb-wrap">
        <img src="${vImg}" class="popup-vehicle-img" alt="${vName}" onerror="this.src='https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400'" />
        ${vCategory ? `<span class="popup-cat-badge">${vCategory}</span>` : ''}
      </div>
      <div class="popup-details">
        <div class="popup-vehicle-header">
          <div class="popup-vehicle-title" title="${vName}">${vName}</div>
          ${vPlate ? `<span class="popup-plate-badge">${vPlate}</span>` : ''}
        </div>
        <div class="popup-customer-line">
          <span class="popup-cust-avatar">${custName.charAt(0).toUpperCase()}</span>
          <span class="popup-cust-name">${custName}</span>
          ${custPhone ? `<span class="popup-cust-phone"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>${custPhone}</span>` : ''}
        </div>
        <div class="popup-meta-line">
          <div class="popup-dates-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span>${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</span>
          </div>
          <div class="popup-total-badge">
            <span class="popup-total-val">${fmtMoney(totalAmt)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="popup-actions">
      <button type="button" class="popup-act-btn popup-btn-approve" id="popupApproveBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>Quick Approve</span>
      </button>
      <button type="button" class="popup-act-btn popup-btn-view" id="popupViewBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        <span>View in Manager</span>
      </button>
      <button type="button" class="popup-act-btn popup-btn-dismiss" id="popupDismissBtn">
        <span>Dismiss</span>
      </button>
    </div>

    <div class="popup-timer-track">
      <div class="popup-timer-bar"></div>
    </div>
  `;

  document.body.appendChild(popup);

  let isDismissed = false;
  const dismiss = () => {
    if (isDismissed) return;
    isDismissed = true;
    popup.classList.add('popup-fade-out');
    setTimeout(() => popup.remove(), 320);
  };

  const cBtn = popup.querySelector('#popupCloseBtn');
  if (cBtn) cBtn.addEventListener('click', dismiss);

  const dBtn = popup.querySelector('#popupDismissBtn');
  if (dBtn) dBtn.addEventListener('click', dismiss);

  // View in Manager Portal
  const vBtn = popup.querySelector('#popupViewBtn');
  if (vBtn) {
    vBtn.addEventListener('click', () => {
      dismiss();
      if (state.portal === 'staff') {
        state.tab = 'requests';
        if (window.renderTab) window.renderTab();
      } else if (state.portal === 'admin') {
        state.tab = 'rentals';
        if (window.renderTab) window.renderTab();
      } else {
        import('./auth.js').then(({ switchSystemRole }) => {
          switchSystemRole('staff').then(() => {
            state.tab = 'requests';
            if (window.renderTab) window.renderTab();
          });
        });
      }
    });
  }

  // Quick Approve
  const aBtn = popup.querySelector('#popupApproveBtn');
  if (aBtn) {
    aBtn.addEventListener('click', async () => {
      aBtn.disabled = true;
      aBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="fa-spin"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
        <span>Approving…</span>
      `;
      const { updateLocalBookingStatus } = await import('./state.js');
      updateLocalBookingStatus(b.id, 'approved');
      try {
        await supabase.from('bookings').update({ status: 'approved' }).eq('id', b.id);
      } catch (e) {}
      import('./realtime.js').then(({ broadcastBookingStatusChange }) => {
        broadcastBookingStatusChange(b.id, 'approved');
      }).catch(() => {});
      toast(`Booking for ${custName} (${vName}) Approved!`, 'success');
      dismiss();
      if (window.renderTab) window.renderTab();
    });
  }

  // Intelligent Countdown Timer with Pause on Hover
  let remainingTime = 12000;
  let timerStart = Date.now();
  let dismissTimeout = null;

  const startTimer = (duration) => {
    timerStart = Date.now();
    dismissTimeout = setTimeout(() => {
      if (document.body.contains(popup)) {
        dismiss();
      }
    }, duration);
  };

  startTimer(remainingTime);

  popup.addEventListener('mouseenter', () => {
    clearTimeout(dismissTimeout);
    remainingTime -= (Date.now() - timerStart);
    if (remainingTime < 1000) remainingTime = 1000;
  });

  popup.addEventListener('mouseleave', () => {
    startTimer(remainingTime);
  });
}

// ---------------------------------------------------------------------------
// Digital Verified Renter ID & Secure Pass (Removed)
// ---------------------------------------------------------------------------
export function openRenterIdModal() {
  // Pass modal removed
}

// ---------------------------------------------------------------------------
// Damage Policy & Fair Wear Protection Modal
// ---------------------------------------------------------------------------
export function openDamagePolicyModal() {
  openModal(`
    <div class="damage-policy-modal-wrap" style="max-height:80vh;overflow-y:auto;padding-right:4px;">
      <div class="modal-head" style="margin-bottom:14px;">
        <div>
          <h3 style="font-size:1.25rem;font-weight:800;color:var(--text-hi);display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-shield-halved" style="color:#059669;"></i> Damage Policy &amp; Fair Wear Coverage
          </h3>
          <span style="font-size:0.78rem;color:var(--text-mid);">Clear, fair, and transparent guidelines for vehicle care and incident protection.</span>
        </div>
        <div class="modal-close" id="mClose">Close</div>
      </div>

      <!-- Trust Assurance Banner -->
      <div style="background:linear-gradient(135deg, rgba(5,150,105,0.1), rgba(16,185,129,0.05));border:1px solid #10b981;border-radius:12px;padding:14px 16px;margin-bottom:18px;">
        <div style="display:flex;align-items:center;gap:8px;font-weight:800;color:#047857;margin-bottom:4px;font-size:0.9rem;">
          <i class="fa-solid fa-circle-check"></i> Zero Surprise Damage Guarantee
        </div>
        <p style="margin:0;font-size:0.8rem;color:#065f46;line-height:1.45;">
          All rentals include standard basic liability protection. Pre-existing marks are digitally documented before handover so you are never charged for prior wear.
        </p>
      </div>

      <!-- Fair Wear vs Damage Schedule -->
      <h4 style="font-size:0.95rem;font-weight:800;color:var(--text-hi);margin-bottom:10px;">
        1. Fair Wear &amp; Tear (₱0 Covered by Rental)
      </h4>
      <div style="background:var(--glass-card);border:1px solid var(--glass-border);border-radius:12px;padding:12px 16px;margin-bottom:18px;font-size:0.8rem;line-height:1.6;color:var(--text-mid);">
        <div><i class="fa-solid fa-check" style="color:#059669;margin-right:8px;"></i> Surface hairline scratches under 2 inches (5cm) that can be buffed.</div>
        <div><i class="fa-solid fa-check" style="color:#059669;margin-right:8px;"></i> Tiny lower bumper stone chips under 3mm from highway driving.</div>
        <div><i class="fa-solid fa-check" style="color:#059669;margin-right:8px;"></i> Normal exterior dust and light rain splatters.</div>
        <div><i class="fa-solid fa-check" style="color:#059669;margin-right:8px;"></i> Routine brake dust and tire tread wear.</div>
      </div>

      <h4 style="font-size:0.95rem;font-weight:800;color:var(--text-hi);margin-bottom:10px;">
        2. Billable Damage Rates Schedule
      </h4>
      <div style="border:1px solid var(--glass-border);border-radius:12px;overflow:hidden;margin-bottom:18px;">
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;text-align:left;">
          <thead style="background:var(--accent-glow);color:var(--text-hi);">
            <tr>
              <th style="padding:10px 14px;">Incident / Component</th>
              <th style="padding:10px 14px;">Assessment Standard</th>
              <th style="padding:10px 14px;text-align:right;">Standard Cost</th>
            </tr>
          </thead>
          <tbody style="color:var(--text-mid);">
            <tr style="border-top:1px solid var(--glass-border);">
              <td style="padding:10px 14px;font-weight:700;color:var(--text-hi);">Minor Panel Scratch</td>
              <td style="padding:10px 14px;">Scratch through base coat requiring repainting</td>
              <td style="padding:10px 14px;text-align:right;font-weight:700;color:#dc2626;">₱1,500 - ₱2,500</td>
            </tr>
            <tr style="border-top:1px solid var(--glass-border);">
              <td style="padding:10px 14px;font-weight:700;color:var(--text-hi);">Panel Dent / Ding</td>
              <td style="padding:10px 14px;">Door ding or bumper dent requiring PDR repair</td>
              <td style="padding:10px 14px;text-align:right;font-weight:700;color:#dc2626;">₱3,500</td>
            </tr>
            <tr style="border-top:1px solid var(--glass-border);">
              <td style="padding:10px 14px;font-weight:700;color:var(--text-hi);">Windshield Chip / Crack</td>
              <td style="padding:10px 14px;">Bullseye or star chip requiring resin fill or glass replace</td>
              <td style="padding:10px 14px;text-align:right;font-weight:700;color:#dc2626;">₱2,500 (Deductible cap)</td>
            </tr>
            <tr style="border-top:1px solid var(--glass-border);">
              <td style="padding:10px 14px;font-weight:700;color:var(--text-hi);">Interior Deep Stain / Odor</td>
              <td style="padding:10px 14px;">Seat stains, cigarette smoke, or heavy mud</td>
              <td style="padding:10px 14px;text-align:right;font-weight:700;color:#dc2626;">₱1,200 detailing</td>
            </tr>
            <tr style="border-top:1px solid var(--glass-border);">
              <td style="padding:10px 14px;font-weight:700;color:var(--text-hi);">Lost Smart Key / Fob</td>
              <td style="padding:10px 14px;">OEM key fob replacement &amp; immobilizer re-pairing</td>
              <td style="padding:10px 14px;text-align:right;font-weight:700;color:#dc2626;">₱4,000</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h4 style="font-size:0.95rem;font-weight:800;color:var(--text-hi);margin-bottom:10px;">
        3. Fair Inspection &amp; Claim Process
      </h4>
      <div style="background:var(--glass-card);border:1px solid var(--glass-border);border-radius:12px;padding:12px 16px;margin-bottom:18px;font-size:0.8rem;line-height:1.6;color:var(--text-mid);">
        <div><strong>1. Handover Check:</strong> Staff documents vehicle condition photos before pickup.</div>
        <div><strong>2. Return Review:</strong> Joint walk-around inspection logged right on the Staff Return Portal.</div>
        <div><strong>3. Transparent Invoicing:</strong> If any new damage is recorded, an itemized assessment receipt is issued with deductible coverage applied.</div>
      </div>

      <div style="display:flex;gap:10px;">
        <button type="button" class="btn btn-primary btn-block" onclick="window.closeModal && window.closeModal();">
          <i class="fa-solid fa-check"></i> I Understand &amp; Agree to Policy
        </button>
      </div>
    </div>
  `);

  $('#mClose')?.addEventListener('click', closeModal);
}

// Global window registration
if (typeof window !== 'undefined') {
  window.showBookingAlertPopup = showBookingAlertPopup;
  window.openDamagePolicyModal = openDamagePolicyModal;
  window.openRenterIdModal = openRenterIdModal;
}


