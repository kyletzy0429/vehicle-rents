import { supabase } from './config.js';
import { state, getLocalBookings, updateLocalBookingStatus } from './state.js';
import { $, playNotificationChime, showBookingAlertPopup, updateNotificationBadge, toast, fmtMoney } from './utils.js';

// ==========================================
// REAL-TIME BROADCAST & SYNCHRONIZATION BUS
// ==========================================

const BROADCAST_CHANNEL_NAME = 'rentflow_realtime_sync';
let bc = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch (e) {
  console.warn('BroadcastChannel unavailable:', e);
}

// Track alerted booking IDs in this session to prevent duplicate popups/chimes
const alertedBookingIds = new Set();
let lastKnownPendingIds = null;
let pollIntervalId = null;
let isPollingActive = false;
let supabaseRealtimeChannel = null;

// AudioContext unlocker on user interaction
function setupAudioUnlocker() {
  const unlock = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const dummy = new AudioCtx();
        dummy.resume().then(() => dummy.close()).catch(() => {});
      }
    } catch (e) {}
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('click', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
}

// Request Desktop / Native Browser Notification permission
export function requestBrowserNotificationPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

// ----------------------------------------------------
// 1. BROADCAST FUNCTIONS (Outbound)
// ----------------------------------------------------

/**
 * Broadcast when a customer submits a new booking request
 */
export function broadcastNewBookingRequest(booking) {
  if (!booking) return;
  const strId = String(booking.id);

  // 1. Send through BroadcastChannel (instant zero-delay for other tabs)
  if (bc) {
    try {
      bc.postMessage({
        type: 'NEW_BOOKING_REQUEST',
        booking,
        timestamp: Date.now()
      });
    } catch (e) {}
  }

  // 2. LocalStorage trigger (fallback for other tabs/windows)
  try {
    localStorage.setItem('rentflow_live_new_booking', JSON.stringify({
      id: strId,
      booking,
      time: Date.now()
    }));
  } catch (e) {}

  // 3. If the current tab itself is already in staff or admin portal, show alert right away
  if (state.portal === 'staff' || state.portal === 'admin') {
    triggerLiveBookingAlert(booking);
  }
}

/**
 * Broadcast when booking status changes (approved, rejected, active, completed, etc.)
 */
export function broadcastBookingStatusChange(bookingId, status, extra = {}) {
  const payload = {
    type: 'BOOKING_STATUS_CHANGED',
    bookingId: String(bookingId),
    status,
    extra,
    timestamp: Date.now()
  };

  if (bc) {
    try {
      bc.postMessage(payload);
    } catch (e) {}
  }

  try {
    localStorage.setItem('rentflow_live_status_change', JSON.stringify(payload));
  } catch (e) {}

  updateNotificationBadge();
}

// ----------------------------------------------------
// 2. INCOMING ALERT HANDLERS (Inbound)
// ----------------------------------------------------

/**
 * Handles incoming booking request: plays chime, shows floating alert,
 * updates badge, and updates dashboard metrics live.
 */
export async function triggerLiveBookingAlert(booking) {
  if (!booking) return;
  const strId = String(booking.id);

  // Avoid spamming if already alerted in this session
  if (alertedBookingIds.has(strId)) return;
  alertedBookingIds.add(strId);

  // Check if current user is staff or admin
  const isStaffOrAdmin = state.portal === 'staff' || state.portal === 'admin';

  if (!isStaffOrAdmin) {
    // If not staff/admin, just update notification badge
    updateNotificationBadge();
    return;
  }

  // Hydrate vehicle & customer info if needed
  let hydrated = { ...booking };
  if (!hydrated.vehicles || !hydrated.vehicles.name) {
    const vMatch = state.vehicles?.find(x => String(x.id) === String(booking.vehicle_id));
    if (vMatch) {
      hydrated.vehicles = vMatch;
    }
  }

  const custName = hydrated.customer_name || hydrated.profiles?.full_name || 'Guest Customer';
  const vehName = hydrated.vehicles?.name || 'Rental Vehicle';

  // 1. Play loud clear audio chime
  playNotificationChime();

  // 2. Show floating heads-up alert banner with Quick Approve button
  showBookingAlertPopup(hydrated);

  // 3. Update topbar notification count badge
  updateNotificationBadge();

  // 4. Show friendly live toast banner
  toast(`🔔 Bagong booking request mula kay ${custName} para sa ${vehName}!`, 'info');

  // 5. Desktop Notification if allowed
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification('Bagong Booking Request!', {
        body: `${custName} nag-request para sa ${vehName} (${fmtMoney(hydrated.total_amount || 0)}).`,
        tag: `bk-request-${strId}`,
        icon: hydrated.vehicles?.image_url || undefined
      });
    } catch (e) {}
  }

  // 6. Smoothly update current dashboard view without flickering
  if (window.renderTab) {
    window.renderTab(true);
  }
}

/**
 * Handles live status changes (e.g. staff approved customer booking)
 */
export async function handleLiveStatusChange(data) {
  if (!data || !data.bookingId) return;

  updateNotificationBadge();

  // If currently customer portal, inform customer
  if (state.portal === 'customer') {
    updateLocalBookingStatus(data.bookingId, data.status);

    if (data.status === 'approved') {
      playNotificationChime();
      toast('🎉 Na-approve na ang iyong booking ng staff! Maaari ka nang magbayad o mag-check in.', 'success');
    } else if (data.status === 'rejected') {
      toast('⚠️ Hindi na-approve ang booking request. Pakitingnan ang detalye sa My Bookings.', 'warning');
    }

    if (window.renderTab && state.tab === 'bookings') {
      window.renderTab(true);
    }
  } else if (state.portal === 'staff' || state.portal === 'admin') {
    if (window.renderTab) {
      window.renderTab(true);
    }
  }
}

// ----------------------------------------------------
// 3. BACKGROUND POLLING LOOP (Fail-safe for all networks)
// ----------------------------------------------------

async function runPollingTick() {
  if (isPollingActive) return;
  isPollingActive = true;

  try {
    const { fetchMergedBookings } = await import('./admin.js');
    const allBookings = await fetchMergedBookings();
    const currentPending = allBookings.filter(b => b.status === 'pending');
    const currentPendingIds = new Set(currentPending.map(b => String(b.id)));

    if (lastKnownPendingIds === null) {
      // First tick on portal load: snapshot existing pending IDs
      lastKnownPendingIds = currentPendingIds;
    } else {
      // Detect newly incoming pending requests
      for (const b of currentPending) {
        const sid = String(b.id);
        if (!lastKnownPendingIds.has(sid)) {
          console.log('⚡ New booking request caught via live poller:', b);
          triggerLiveBookingAlert(b);
        }
      }

      // Check if pending count changed (e.g. approved / rejected / deleted)
      const countChanged = currentPendingIds.size !== lastKnownPendingIds.size;
      if (countChanged) {
        lastKnownPendingIds = currentPendingIds;
        updateNotificationBadge();
        if ((state.portal === 'staff' || state.portal === 'admin') && window.renderTab) {
          window.renderTab(true);
        }
      }
    }
  } catch (err) {
    console.warn('Live polling notice:', err);
  } finally {
    isPollingActive = false;
  }
}

function startPollingLoop() {
  if (pollIntervalId) clearInterval(pollIntervalId);

  // Initial poll
  runPollingTick();

  // Poll every 3.5 seconds when active, 6 seconds when document hidden
  const getIntervalMs = () => (document.hidden ? 6000 : 3500);

  const scheduleNext = () => {
    pollIntervalId = setTimeout(async () => {
      await runPollingTick();
      scheduleNext();
    }, getIntervalMs());
  };

  scheduleNext();
}

// ----------------------------------------------------
// 4. SUPABASE REALTIME WEB-SOCKET SUBSCRIPTION
// ----------------------------------------------------

function setupSupabaseRealtime() {
  try {
    if (supabaseRealtimeChannel) {
      supabase.removeChannel(supabaseRealtimeChannel).catch(() => {});
    }

    supabaseRealtimeChannel = supabase
      .channel('public_bookings_live_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings' },
        async (payload) => {
          console.log('⚡ Supabase Realtime: New booking INSERT', payload.new);
          const { fetchMergedBookings } = await import('./admin.js');
          const all = await fetchMergedBookings();
          const match = all.find(b => String(b.id) === String(payload.new?.id));
          triggerLiveBookingAlert(match || payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        async (payload) => {
          console.log('⚡ Supabase Realtime: Booking UPDATE', payload.new);
          handleLiveStatusChange({
            bookingId: payload.new?.id,
            status: payload.new?.status,
            booking: payload.new
          });
        }
      )
      .subscribe((status, err) => {
        if (err) console.warn('Supabase Realtime subscribe note:', err);
        else console.log('⚡ Supabase Realtime connected:', status);
      });
  } catch (e) {
    console.warn('Supabase Realtime setup exception:', e);
  }
}

// ----------------------------------------------------
// 5. MASTER INITIALIZATION
// ----------------------------------------------------

export function initRealtimeSync() {
  setupAudioUnlocker();

  // 1. BroadcastChannel Listener (Cross-Tab Instant 0ms)
  if (bc) {
    bc.onmessage = (event) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'NEW_BOOKING_REQUEST') {
        triggerLiveBookingAlert(msg.booking);
      } else if (msg.type === 'BOOKING_STATUS_CHANGED') {
        handleLiveStatusChange(msg);
      }
    };
  }

  // 2. Storage Event Listener (Cross-Tab Fallback)
  window.addEventListener('storage', (e) => {
    if (e.key === 'rentflow_live_new_booking' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed?.booking) {
          triggerLiveBookingAlert(parsed.booking);
        }
      } catch (err) {}
    } else if (e.key === 'rentflow_pending_manager_alert' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        triggerLiveBookingAlert(parsed);
      } catch (err) {}
    } else if (e.key === 'rentflow_live_status_change' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        handleLiveStatusChange(parsed);
      } catch (err) {}
    }
  });

  // 3. Supabase Realtime Channel
  setupSupabaseRealtime();

  // 4. Background Polling Fallback Loop
  startPollingLoop();

  // 5. Auto-request notification permission on desktop
  if (state.portal === 'staff' || state.portal === 'admin') {
    requestBrowserNotificationPermission();
  }
}

// Global hook for debug & testing
if (typeof window !== 'undefined') {
  window.triggerLiveBookingAlert = triggerLiveBookingAlert;
  window.broadcastNewBookingRequest = broadcastNewBookingRequest;
}
