import { supabase } from './config.js';
import { state, DEFAULT_SETTINGS, getSystemSettings } from './state.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const fmtMoney = (n) => `₱${Number(n ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const isHtml = typeof icon === 'string' && (icon.includes('<') || icon.startsWith('fa-'));
  const iconHtml = isHtml ? (icon.includes('<') ? icon : `<i class="${icon}"></i>`) : icon;
  return `<div class="empty-box"><div class="empty-icon">${iconHtml}</div><p>${text}</p></div>`;
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
  return 'Customer';
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
  const statusMap = {
    'approved': { icon: '<i class="fa-solid fa-circle-check" style="color:#059669;"></i>', title: 'Booking Approved', desc: `Your reservation for ${vName} (${shortId}) has been approved by staff. Please prepare for pickup.` },
    'pending': { icon: '<i class="fa-solid fa-clock" style="color:#d97706;"></i>', title: 'Booking Request Submitted', desc: `Your reservation for ${vName} (${shortId}) is pending staff review.` },
    'active': { icon: '<i class="fa-solid fa-car" style="color:#2563eb;"></i>', title: 'Rental Active & In-Progress', desc: `Your ${vName} (${shortId}) rental is currently active. Have a safe journey!` },
    'completed': { icon: '<i class="fa-solid fa-circle-check" style="color:#059669;"></i>', title: 'Rental Completed & Returned', desc: `Your ${vName} rental (${shortId}) has been successfully completed. Thank you for renting with us!` },
    'rejected': { icon: '<i class="fa-solid fa-circle-xmark" style="color:#dc2626;"></i>', title: 'Booking Rejected', desc: `Your reservation for ${vName} (${shortId}) was not approved. Please contact support.` },
    'cancelled': { icon: '<i class="fa-solid fa-ban" style="color:#64748b;"></i>', title: 'Booking Cancelled', desc: `Your reservation for ${vName} (${shortId}) was cancelled.` },
    'refund_requested': { icon: '<i class="fa-solid fa-hand-holding-dollar" style="color:#7c3aed;"></i>', title: 'Refund Request Received', desc: `Your refund request for ${vName} (${shortId}) is being reviewed by our billing staff.` },
    'refunded': { icon: '<i class="fa-solid fa-credit-card" style="color:#059669;"></i>', title: 'Refund Issued', desc: `Your refund for ${vName} (${shortId}) has been processed successfully.` },
  };

  const info = statusMap[b.status] || { icon: '<i class="fa-solid fa-file-lines" style="color:#64748b;"></i>', title: `Booking Update`, desc: `Your ${vName} booking (${shortId}) status changed to: ${b.status}` };
  return {
    id: `booking-${b.id}`,
    title: `${info.icon} ${info.title}`,
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
    'pending': { icon: '<i class="fa-solid fa-clock" style="color:#d97706;"></i>', title: 'New Booking Request', desc: `${custName} submitted a new request for ${vName} (${shortId}). Action required.` },
    'approved': { icon: '<i class="fa-solid fa-circle-check" style="color:#059669;"></i>', title: 'Booking Approved', desc: `${vName} (${shortId}) for ${custName} is approved and awaiting pickup/payment.` },
    'active': { icon: '<i class="fa-solid fa-car" style="color:#2563eb;"></i>', title: 'Rental Ongoing', desc: `${custName} picked up ${vName} (${shortId}). Vehicle is currently on the road.` },
    'completed': { icon: '<i class="fa-solid fa-circle-check" style="color:#059669;"></i>', title: 'Vehicle Returned', desc: `${custName} returned ${vName} (${shortId}). Inspection & return logged.` },
    'refund_requested': { icon: '<i class="fa-solid fa-hand-holding-dollar" style="color:#7c3aed;"></i>', title: 'Refund Claim Pending', desc: `${custName} submitted a refund request for ${vName} (${shortId}). Please verify.` },
  };

  const info = statusMap[b.status] || { icon: '<i class="fa-solid fa-file-lines" style="color:#64748b;"></i>', title: 'Booking Record Update', desc: `${vName} (${shortId}) — Current status: ${b.status}` };
  return {
    id: `booking-${b.id}`,
    title: `${info.icon} ${info.title}`,
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
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, vehicles(name)')
        .eq('customer_id', state.user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (bookings && bookings.length > 0) {
        bookingNotifs = bookings.map(b => buildCustomerNotif(b));
      }
    } else {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, vehicles(name), profiles!customer_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(25);
      if (bookings && bookings.length > 0) {
        bookingNotifs = bookings.map(b => buildStaffNotif(b));
      }
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
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:38px;height:38px;border-radius:50%;background:var(--accent-glow);display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:1.1rem;">
          <i class="fa-solid fa-bell"></i>
        </div>
        <div>
          <h3 style="font-size:1.1rem;font-weight:800;color:var(--text-hi);margin:0;">Notifications &amp; Alerts</h3>
          <span style="font-size:0.75rem;color:var(--text-mid);">Live system updates &amp; rental alerts</span>
        </div>
      </div>
      <div class="modal-close" id="mClose">✕</div>
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
    <div style="background:${n.read ? readBg : unreadBg};border:1px solid ${n.read ? readBorder : unreadBorder};border-radius:10px;padding:12px 14px;transition:all 0.2s ease;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:8px;">
        <span style="font-weight:700;font-size:0.88rem;color:var(--text-hi);">${n.title}</span>
        <span style="font-size:0.72rem;color:var(--text-mid);flex-shrink:0;">${n.time}</span>
      </div>
      <p style="font-size:0.8rem;color:var(--text-mid);margin:0;line-height:1.4;">${n.desc}</p>
    </div>
  `).join('') : `
    <div style="text-align:center;padding:30px 10px;">
      <div style="font-size:2.2rem;margin-bottom:10px;color:#94a3b8;"><i class="fa-regular fa-bell"></i></div>
      <p style="font-size:0.9rem;font-weight:600;color:var(--text-hi);margin:0;">No notifications yet</p>
      <p style="font-size:0.8rem;color:var(--text-mid);margin-top:6px;">When you make a reservation or your booking is updated, alerts will show here.</p>
    </div>
  `;

  const unreadCount = notifs.filter(n => !n.read).length;

  openModal(`
    <div class="modal-head">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:38px;height:38px;border-radius:50%;background:var(--accent-glow);display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:1.1rem;">
          <i class="fa-solid fa-bell"></i>
        </div>
        <div>
          <h3 style="font-size:1.1rem;font-weight:800;color:var(--text-hi);margin:0;">Notifications &amp; Alerts</h3>
          <span style="font-size:0.75rem;color:var(--text-mid);">${unreadCount > 0 ? `${unreadCount} new update${unreadCount > 1 ? 's' : ''}` : 'All caught up!'} · ${notifs.length} total</span>
        </div>
      </div>
      <div class="modal-close" id="mClose">✕</div>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;max-height:420px;overflow-y:auto;">
      ${notifsHtml}
    </div>

    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost btn-sm btn-block" id="markAllReadBtn" style="border:1px solid var(--glass-border);"><i class="fa-solid fa-check-double"></i> Mark All as Read</button>
      <button class="btn btn-primary btn-sm btn-block" id="refreshNotifsBtn"><i class="fa-solid fa-rotate"></i> Refresh</button>
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

// Floating real-time notification pop-up for new guest booking
export function showBookingAlertPopup(b) {
  if (!b) return;

  // Play audio chime
  playNotificationChime();

  // Remove any existing active popup
  const existing = document.getElementById('activeBookingPopup');
  if (existing) existing.remove();

  const v = b.vehicles || {};
  const vName = v.name || 'Rental Vehicle';
  const vImg = v.image_url || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400';
  const custName = b.customer_name || b.profiles?.full_name || 'Guest Customer';
  const custPhone = b.customer_phone || b.profiles?.phone || '';
  const totalAmt = Number(b.total_amount || 0);
  const promoCode = b.promo_code;

  const popup = document.createElement('div');
  popup.className = 'manager-booking-popup';
  popup.id = 'activeBookingPopup';

  popup.innerHTML = `
    <div class="popup-head">
      <div class="popup-tag">
        <span class="popup-pulse-dot"></span>
        <i class="fa-solid fa-bell" style="color:#f59e0b;"></i>
        <span>New Booking Received!</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span class="popup-badge-time">Just Now</span>
        <button type="button" class="popup-close-btn" id="popupCloseBtn" title="Close Notification">✕</button>
      </div>
    </div>

    <div class="popup-body">
      <img src="${vImg}" class="popup-vehicle-img" alt="${vName}" />
      <div class="popup-details">
        <div class="popup-vehicle-title">${vName}</div>
        <div class="popup-customer-line">
          <i class="fa-solid fa-user" style="color:#2563eb;font-size:0.75rem;"></i>
          <strong>${custName}</strong> ${custPhone ? `<span class="muted">(${custPhone})</span>` : ''}
        </div>
        <div class="popup-meta-line">
          <span><i class="fa-solid fa-calendar-days" style="color:#64748b;"></i> ${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}</span>
          <span class="popup-total">${fmtMoney(totalAmt)}</span>
        </div>
        ${promoCode ? `
          <div style="margin-top:3px;">
            <span class="badge" style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;font-size:0.7rem;padding:2px 6px;">
              <i class="fa-solid fa-tags"></i> Promo: ${promoCode} (-${fmtMoney(b.discount_amount || 0)})
            </span>
          </div>
        ` : ''}
      </div>
    </div>

    <div class="popup-actions">
      <button type="button" class="btn btn-primary btn-sm" id="popupViewBtn" style="font-size:0.78rem;padding:6px 12px;">
        <i class="fa-solid fa-chart-pie"></i> View in Manager
      </button>
      <button type="button" class="btn btn-sm" id="popupApproveBtn" style="background:#059669;color:#fff;border:none;font-size:0.78rem;padding:6px 12px;">
        <i class="fa-solid fa-check"></i> Quick Approve
      </button>
      <button type="button" class="btn btn-ghost btn-sm" id="popupDismissBtn" style="font-size:0.78rem;padding:6px 10px;color:#64748b;">
        Dismiss
      </button>
    </div>
  `;

  document.body.appendChild(popup);

  const dismiss = () => {
    popup.classList.add('popup-fade-out');
    setTimeout(() => popup.remove(), 300);
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
      import('./auth.js').then(({ switchSystemRole }) => {
        switchSystemRole('staff');
      });
    });
  }

  // Quick Approve
  const aBtn = popup.querySelector('#popupApproveBtn');
  if (aBtn) {
    aBtn.addEventListener('click', async () => {
      aBtn.disabled = true;
      aBtn.textContent = 'Approving…';
      const { updateLocalBookingStatus } = await import('./state.js');
      updateLocalBookingStatus(b.id, 'approved');
      try {
        await supabase.from('bookings').update({ status: 'approved' }).eq('id', b.id);
      } catch (e) {}
      toast(`Booking for ${custName} (${vName}) Approved!`, 'success');
      dismiss();
      if (window.renderTab) window.renderTab();
    });
  }

  // Auto-dismiss after 12 seconds
  setTimeout(() => {
    if (document.body.contains(popup)) {
      dismiss();
    }
  }, 12000);
}

