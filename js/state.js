export const state = {
  user: null,
  profile: null,
  categories: [],
  vehicles: [],
  drivers: [],
  portal: null,
  tab: null,
};

export const DEMO_ACCOUNTS = {
  customer: {
    id: '8bebdf37-d488-4e10-bb84-63a01c157c3a',
    email: 'mark.ramos@gmail.com',
    full_name: 'Mark Lester Ramos',
    displayName: 'Mark Lester Ramos',
    role: 'customer',
    phone: '0917 582 9140',
    address: 'Blk 14 Lot 8, San Pedro, Puerto Princesa City',
    license_number: 'N02-19-482019'
  },
  customer1: {
    id: '8bebdf37-d488-4e10-bb84-63a01c157c3a',
    email: 'mark.ramos@gmail.com',
    full_name: 'Mark Lester Ramos',
    displayName: 'Mark Lester Ramos',
    role: 'customer',
    phone: '0917 582 9140',
    address: 'Blk 14 Lot 8, San Pedro, Puerto Princesa City',
    license_number: 'N02-19-482019'
  },
  staff: {
    id: 'ee609b2f-be1e-4551-99e3-d61977ccb578',
    email: 'staff@rentflow.ph',
    full_name: 'Sarah Jane Villanueva',
    displayName: 'Sarah Villanueva (Staff)',
    role: 'staff',
    phone: '0917 882 1450'
  },
  admin: {
    id: '10f2d761-ab31-4490-944d-456af33759ba',
    email: 'admin@rentflow.ph',
    full_name: 'Roland S. Bautista',
    displayName: 'Roland Bautista (Admin)',
    role: 'admin',
    phone: '0917 992 3341'
  }
};

export function getActiveRole() {
  return localStorage.getItem('rentflow_active_role') || 'customer';
}

export function setActiveRole(role) {
  localStorage.setItem('rentflow_active_role', role);
}

export function getActiveCustomerKey() {
  return localStorage.getItem('rentflow_active_customer_key') || 'customer1';
}

export function setActiveCustomerKey(key) {
  localStorage.setItem('rentflow_active_customer_key', key);
}

// Vehicle persistent overrides (status, rates, etc.)
export function getVehicleOverrides() {
  try {
    const raw = localStorage.getItem('rentflow_vehicle_overrides');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveVehicleOverride(idOrPlate, patch) {
  if (!idOrPlate) return;
  try {
    const overrides = getVehicleOverrides();
    const key = String(idOrPlate);
    overrides[key] = { ...(overrides[key] || {}), ...patch };
    localStorage.setItem('rentflow_vehicle_overrides', JSON.stringify(overrides));
  } catch (e) {
    console.warn('saveVehicleOverride error:', e);
  }
}

// Local multi-user bookings storage helpers
export function getLocalBookings() {
  try {
    const raw = localStorage.getItem('rentflow_local_bookings');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveLocalBooking(b) {
  try {
    const list = getLocalBookings();
    const existingIdx = list.findIndex(x => x.id === b.id);
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...b };
    } else {
      list.unshift(b);
    }
    localStorage.setItem('rentflow_local_bookings', JSON.stringify(list));
  } catch (e) {
    console.warn('saveLocalBooking error:', e);
  }
}

export function updateLocalBookingStatus(bookingId, status, extraOrNotes = null) {
  try {
    const list = getLocalBookings();
    let b = list.find(x => String(x.id) === String(bookingId));
    if (!b && typeof window !== 'undefined' && window._activeCustomerBookings) {
      const fromActive = window._activeCustomerBookings.find(x => String(x.id) === String(bookingId));
      if (fromActive) {
        b = JSON.parse(JSON.stringify(fromActive));
        list.push(b);
      }
    }
    if (!b) {
      b = { id: bookingId };
      list.push(b);
    }

    b.status = status;
    if (typeof extraOrNotes === 'string') {
      b.review_notes = extraOrNotes;
    } else if (extraOrNotes && typeof extraOrNotes === 'object') {
      Object.assign(b, extraOrNotes);
    }
    localStorage.setItem('rentflow_local_bookings', JSON.stringify(list));

    if (typeof window !== 'undefined' && window._activeCustomerBookings) {
      const inMem = window._activeCustomerBookings.find(x => String(x.id) === String(bookingId));
      if (inMem) {
        inMem.status = status;
        if (typeof extraOrNotes === 'string') inMem.review_notes = extraOrNotes;
        else if (extraOrNotes && typeof extraOrNotes === 'object') Object.assign(inMem, extraOrNotes);
      }
    }
    return b;
  } catch (e) {
    console.warn('updateLocalBookingStatus error:', e);
  }
  return null;
}

export const DEFAULT_SETTINGS = {
  company: {
    name: 'Vehicle Rental Management System',
    phone: '+63 67676767',
    mobile: '+63 917 123 4567',
    email: 'vehicleretal.ph',
    address: '123 PPC MAIN BRANCH VENUE',
    currency: '₱ (PHP)',
    hours: '8:00 AM - 8:00 PM Daily',
  },
  policy: {
    cancellationWindow: 24,
    defaultDownpayment: 20,
    lateFeePerHour: 300,
    requireLicense: false,
    requireGovernmentId: false,
  },
  notifications: {
    bookingAlerts: true,
    pickupReminders: true,
    paymentReceipts: true,
    autoEmailConfirmations: true,
  },
  appearance: {
    theme: 'light',
    accentColor: '#2563eb',
    fontFamily: 'Plus Jakarta Sans',
  },
  promoCodes: []
};

export function getPromoCodes() {
  return [];
}

export function savePromoCodes() {}

export function validatePromoCode() {
  return { valid: false, message: 'Promo codes are disabled.' };
}

export function incrementPromoCodeUsage() {}

export function getSystemSettings() {
  try {
    const raw = localStorage.getItem('rentflow_system_settings');
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const company = { ...DEFAULT_SETTINGS.company, ...(parsed.company || {}) };

    if (!company.address || company.address === '123 Main Avenue, Metro Manila, Philippines' || company.address === '123 Main Ave, Makati City') {
      company.address = '123 PPC MAIN BRANCH VENUE';
    }
    if (!company.phone || company.phone === '+63 (2) 8888-RENT') {
      company.phone = '+63 67676767';
    }
    if (!company.email || company.email === 'vehiclerental@gmail.com' || company.email === 'support@rentflow.ph') {
      company.email = 'vehicleretal.ph';
    }

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      company,
      policy: { ...DEFAULT_SETTINGS.policy, ...(parsed.policy || {}) },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications || {}) },
      appearance: { ...DEFAULT_SETTINGS.appearance, ...(parsed.appearance || {}) },
      promoCodes: Array.isArray(parsed.promoCodes) && parsed.promoCodes.length > 0 ? parsed.promoCodes : DEFAULT_SETTINGS.promoCodes
    };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export function saveSystemSettings(newSettings) {
  localStorage.setItem('rentflow_system_settings', JSON.stringify(newSettings));
  if (typeof document !== 'undefined' && newSettings.appearance?.accentColor) {
    document.documentElement.style.setProperty('--accent', newSettings.appearance.accentColor);
  }
}

export const PORTAL_TABS = {
  customer: [
    { id: 'browse', label: '<i class="fa-solid fa-car"></i> Browse' },
    { id: 'bookings', label: '<i class="fa-solid fa-calendar-check" style="color:#059669;"></i> Bookings' },
    { id: 'favorites', label: '<i class="fa-solid fa-heart" style="color:#e11d48;"></i> Favorites' },
    { id: 'profile', label: '<i class="fa-solid fa-id-card"></i> Profile' },
  ],
  staff: [
    { id: 'dashboard', label: '<i class="fa-solid fa-chart-pie"></i> Operations Dashboard' },
    { id: 'requests', label: '<i class="fa-solid fa-clipboard-question"></i> Booking Requests' },
    { id: 'active', label: '<i class="fa-solid fa-key"></i> Active Rentals' },
    { id: 'returns', label: '<i class="fa-solid fa-rotate-left"></i> Returns' },
    { id: 'refunds', label: '<i class="fa-solid fa-hand-holding-dollar"></i> Refunds & Claims' },
    { id: 'history', label: '<i class="fa-solid fa-clock-rotate-left"></i> History' },
  ],
  admin: [
    { id: 'dashboard', label: '<i class="fa-solid fa-chart-pie"></i> Dashboard' },
    { id: 'customers', label: '<i class="fa-solid fa-users"></i> Customers' },
    { id: 'vehicles', label: '<i class="fa-solid fa-car-side"></i> Vehicles' },
    { id: 'categories', label: '<i class="fa-solid fa-tags"></i> Categories & Rates' },
    { id: 'users', label: '<i class="fa-solid fa-user-gear"></i> System Roles' },
    { id: 'rentals', label: '<i class="fa-solid fa-list-check"></i> Rentals & Transactions' },
    { id: 'reports', label: '<i class="fa-solid fa-file-invoice-dollar"></i> Reports' },
    { id: 'settings', label: '<i class="fa-solid fa-gear"></i> System Settings' },
  ],
};


