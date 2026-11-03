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

  // Auto-bind any close buttons inside the modal
  overlay.querySelectorAll('.modal-close, #mClose, [data-modal-close], #pClose').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });
  });

  // ESC key to close modal
  const onEsc = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', onEsc);
    }
  };
  document.addEventListener('keydown', onEsc);

  document.body.appendChild(overlay);
  return overlay;
}

export function closeModal() {
  const overlays = document.querySelectorAll('.modal-overlay');
  overlays.forEach(m => m.remove());
}
window.closeModal = closeModal;

export function getTheme() {
  try {
    return localStorage.getItem('rentflow_theme') || 'light';
  } catch (e) {
    return 'light';
  }
}

export function applyTheme(theme) {
  const currentTheme = theme || getTheme();
  try {
    localStorage.setItem('rentflow_theme', currentTheme);
  } catch (e) {}

  if (currentTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.body.removeAttribute('data-theme');
  }
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  toast(next === 'dark' ? 'Dark mode enabled' : 'Light mode enabled', 'info');
  if (window.renderShell) {
    window.renderShell();
  }
}
applyTheme();

export function getLang() {
  try {
    return localStorage.getItem('rentflow_lang') || 'en';
  } catch (e) {
    return 'en';
  }
}

export function setLang(lang) {
  const chosen = (lang === 'fil' || lang === 'tl') ? 'fil' : 'en';
  try {
    localStorage.setItem('rentflow_lang', chosen);
  } catch (e) {}
  toast(chosen === 'fil' ? 'Pinalitan ang wika sa Filipino' : 'Language switched to English', 'info');
  if (window.renderShell) {
    window.renderShell();
  }
}

export const TRANSLATIONS = {
  en: {
    browse: 'Browse',
    bookings: 'My bookings',
    favorites: 'Favorites',
    account: 'Account',
    dashboard: 'Dashboard',
    overview: 'Overview',
    scanner: 'Scan QR',
    requests: 'Requests',
    active: 'Active rentals',
    returns: 'Returns',
    refunds: 'Refunds & Claims',
    history: 'History',
    vehicles: 'Vehicles',
    rentals: 'Bookings',
    customers: 'Customers',
    reports: 'Reports',
    users: 'Users',
    categories: 'Categories & Rates',
    settings: 'Settings',
    logout: 'Log Out',
    welcome_back: 'Welcome back',
    good_morning: 'Good morning',
    good_afternoon: 'Good afternoon',
    good_evening: 'Good evening',
    upcoming: 'Upcoming',
    show_qr: 'Show QR',
    view_booking: 'View booking',
    all: 'All',
    sedan: 'Sedan',
    suv: 'SUV',
    mpv: 'MPV',
    van: 'Van',
    motorcycle: 'Motorcycle',
    day: 'day',
    days: 'days',
    view: 'View',
    few_left: 'Few left',
    available_now: 'Available now',
    rented_out: 'Rented out',
    maintenance: 'Maintenance',
    menu: 'Menu',
    renter: 'Renter',
    staff: 'Staff',
    admin: 'Admin'
  },
  fil: {
    browse: 'Mag-browse',
    bookings: 'Aking Bookings',
    favorites: 'Mga Paborito',
    account: 'Aking Account',
    dashboard: 'Dashboard',
    overview: 'Pangkalahatan',
    scanner: 'I-scan ang QR',
    requests: 'Mga Kahilingan',
    active: 'Aktibong Upa',
    returns: 'Mga Pagbabalik',
    refunds: 'Refund at Claims',
    history: 'Kasaysayan',
    vehicles: 'Mga Sasakyan',
    rentals: 'Mga Booking',
    customers: 'Mga Kliyente',
    reports: 'Mga Ulat',
    users: 'Mga Gumagamit',
    categories: 'Kategorya at Presyo',
    settings: 'Mga Setting',
    logout: 'Mag-logout',
    welcome_back: 'Maligayang pagbabalik',
    good_morning: 'Magandang umaga',
    good_afternoon: 'Magandang hapon',
    good_evening: 'Magandang gabi',
    upcoming: 'Paparating',
    show_qr: 'Ipakita ang QR',
    view_booking: 'Tingnan ang booking',
    all: 'Lahat',
    sedan: 'Sedan',
    suv: 'SUV',
    mpv: 'MPV',
    van: 'Van',
    motorcycle: 'Motorsiklo',
    day: 'araw',
    days: 'mga araw',
    view: 'Tingnan',
    few_left: 'Kakaunti na lang',
    available_now: 'Available ngayon',
    rented_out: 'Naka-renta',
    maintenance: 'Kinukumpuni',
    menu: 'Menu',
    renter: 'Umuupa',
    staff: 'Kawani',
    admin: 'Admin'
  }
};

export function t(key, fallback = '') {
  const lang = getLang();
  return TRANSLATIONS[lang]?.[key] || fallback || key;
}

export function getRoleDisplayName(role) {
  const r = (role || '').toLowerCase();
  const lang = getLang();
  if (r === 'admin') return lang === 'fil' ? 'Tagapangasiwa (Admin)' : 'Administrator';
  if (r === 'staff') return lang === 'fil' ? 'Kawani (Staff)' : 'Staff Member';
  return lang === 'fil' ? 'Umuupa (Renter)' : 'Renter';
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
        title: `VEHICLE RETURN DAY TODAY`,
        time: 'Due by 12:00 PM',
        desc: `Your ${vName} (${shortId}) is scheduled for return today! Please ensure fuel matches pickup level. Need more time? Request a rental extension instantly.`,
        read: false,
        isReturnAlert: true,
        bookingId: b.id
      };
    } else if (endStr < todayStr) {
      return {
        id: `return-overdue-${b.id}`,
        title: `OVERDUE RETURN NOTICE`,
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
  $('#mClose')?.addEventListener('click', closeModal);

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

  $('#mClose')?.addEventListener('click', closeModal);

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

// Floating real-time notification pop-up for new guest booking (Removed per user request)
export function showBookingAlertPopup(b) {
  const existing = document.getElementById('activeBookingPopup');
  if (existing) existing.remove();
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


