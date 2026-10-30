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
  customer2: {
    id: '8bebdf37-d488-4e10-bb84-63a01c157c3b',
    email: 'maria.santos@gmail.com',
    full_name: 'Maria Santos',
    displayName: 'Maria Santos (Unverified)',
    role: 'customer',
    phone: '',
    address: '',
    license_number: '',
    is_verified: false
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
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}

  // Initial realistic sample bookings for multi-device / phone testing
  const now = Date.now();
  const mockReceiptGCash = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520"><rect width="400" height="520" rx="16" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="2"/><rect x="24" y="24" width="352" height="70" rx="12" fill="%23005ce6"/><text x="200" y="54" fill="%23ffffff" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle">GCash Express Payment</text><text x="200" y="76" fill="%23b8d5ff" font-family="sans-serif" font-size="12" text-anchor="middle">OFFICIAL TRANSACTION RECEIPT</text><circle cx="200" cy="140" r="32" fill="%23ecfdf5"/><path d="M188 140l8 8 16-16" stroke="%23059669" stroke-width="4" fill="none" stroke-linecap="round"/><text x="200" y="200" fill="%230f172a" font-family="sans-serif" font-size="24" font-weight="bold" text-anchor="middle">PHP 8,400.00</text><text x="200" y="222" fill="%23059669" font-family="sans-serif" font-size="13" font-weight="600" text-anchor="middle">PAYMENT SUCCESSFUL</text><line x1="40" y1="245" x2="360" y2="245" stroke="%23e2e8f0" stroke-dasharray="6,6"/><text x="44" y="275" fill="%2364748b" font-family="sans-serif" font-size="13">Merchant:</text><text x="356" y="275" fill="%230f172a" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="end">RentFlow Vehicles Inc.</text><text x="44" y="305" fill="%2364748b" font-family="sans-serif" font-size="13">Ref Number:</text><text x="356" y="305" fill="%23005ce6" font-family="monospace" font-size="14" font-weight="bold" text-anchor="end">274828482919491</text><text x="44" y="335" fill="%2364748b" font-family="sans-serif" font-size="13">Sender Account:</text><text x="356" y="335" fill="%230f172a" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="end">0917 •••• 9140</text><text x="44" y="365" fill="%2364748b" font-family="sans-serif" font-size="13">Payment Method:</text><text x="356" y="365" fill="%230f172a" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="end">GCash QR Express</text><text x="44" y="395" fill="%2364748b" font-family="sans-serif" font-size="13">Date &amp; Time:</text><text x="356" y="395" fill="%230f172a" font-family="sans-serif" font-size="13" text-anchor="end">Oct 30, 2026 · 09:14 PM</text><rect x="40" y="425" width="320" height="60" rx="8" fill="%23eff6ff" stroke="%23bfdbfe"/><text x="200" y="450" fill="%231e40af" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">BANGKO SENTRAL NG PILIPINAS REGULATED</text><text x="200" y="468" fill="%233b82f6" font-family="sans-serif" font-size="10" text-anchor="middle">Digital E-Money Issuer &bull; Trace ID: GC-89102-PP</text></svg>`;

  const sampleBookings = [
    {
      id: '1',
      ref_number: '274828482919491',
      payment_ref: '274828482919491',
      customer_id: '8bebdf37-d488-4e10-bb84-63a01c157c3a',
      customer_name: 'Mark Lester Ramos',
      customer_phone: '0917 582 9140',
      driver_license: 'N02-19-482019',
      vehicle_id: 1,
      vehicles: {
        id: 1,
        name: 'Toyota Fortuner 2.8 V',
        plate_number: 'NBD-8842',
        categories: { name: 'SUV' }
      },
      start_date: new Date(now + 86400000).toISOString().split('T')[0],
      end_date: new Date(now + 86400000 * 3).toISOString().split('T')[0],
      total_amount: 8400,
      paid_amount: 8400,
      balance_due: 0,
      status: 'pending_verification',
      payment_status: 'pending_verification',
      payment_method: 'GCash QR',
      payment_type: 'full',
      proof_image: mockReceiptGCash,
      review_notes: 'GCash QR payment proof submitted by customer. Awaiting staff review.',
      created_at: new Date(now - 3600000 * 1).toISOString()
    },
    {
      id: '2',
      ref_number: 'CASH-20261022',
      payment_ref: 'CASH-20261022',
      customer_id: '8bebdf37-d488-4e10-bb84-63a01c157c3b',
      customer_name: 'Maria Santos',
      customer_phone: '0918 333 4411',
      driver_license: 'D01-18-291048',
      vehicle_id: 2,
      vehicles: {
        id: 2,
        name: 'Toyota Vios 1.5 G CVT',
        plate_number: 'NCO-2914',
        categories: { name: 'Sedan' }
      },
      start_date: new Date(now + 86400000 * 2).toISOString().split('T')[0],
      end_date: new Date(now + 86400000 * 4).toISOString().split('T')[0],
      total_amount: 5000,
      paid_amount: 0,
      balance_due: 5000,
      status: 'cash_on_pickup',
      payment_status: 'unpaid',
      payment_method: 'Pay on Cash',
      payment_type: 'full',
      review_notes: 'Pay on Cash selected. Customer to pay at counter upon pickup.',
      created_at: new Date(now - 3600000 * 4).toISOString()
    },
    {
      id: '3',
      ref_number: 'BK-20261023',
      payment_ref: 'APAY-441029',
      customer_id: '8bebdf37-d488-4e10-bb84-63a01c157c3a',
      customer_name: 'Mark Lester Ramos',
      customer_phone: '0917 582 9140',
      driver_license: 'N02-19-482019',
      vehicle_id: 4,
      vehicles: {
        id: 4,
        name: 'Ford Ranger Raptor',
        plate_number: 'NDB-5591',
        categories: { name: 'Pickup' }
      },
      start_date: new Date(now + 86400000).toISOString().split('T')[0],
      end_date: new Date(now + 86400000 * 3).toISOString().split('T')[0],
      total_amount: 9000,
      paid_amount: 9000,
      balance_due: 0,
      status: 'confirmed',
      payment_status: 'verified',
      payment_method: 'Apple Pay',
      payment_type: 'full',
      review_notes: 'Payment verified. Vehicle ready for release upon pickup.',
      created_at: new Date(now - 3600000 * 8).toISOString()
    },
    {
      id: '4',
      ref_number: 'BK-20261024',
      payment_ref: 'VISA-914820',
      customer_id: '8bebdf37-d488-4e10-bb84-63a01c157c3a',
      customer_name: 'Mark Lester Ramos',
      customer_phone: '0917 582 9140',
      driver_license: 'N02-19-482019',
      vehicle_id: 3,
      vehicles: {
        id: 3,
        name: 'Mitsubishi Xpander Cross',
        plate_number: 'NCL-3921',
        categories: { name: 'MPV' }
      },
      start_date: new Date(now - 86400000).toISOString().split('T')[0],
      end_date: new Date(now + 86400000 * 2).toISOString().split('T')[0],
      total_amount: 7000,
      paid_amount: 7000,
      balance_due: 0,
      status: 'vehicle_released',
      payment_status: 'verified',
      payment_method: 'Visa Card',
      payment_type: 'full',
      review_notes: 'Vehicle released to customer. Active rental on road.',
      created_at: new Date(now - 86400000 * 2).toISOString()
    },
    {
      id: '5',
      ref_number: 'BK-20261025',
      payment_ref: 'TXN-991823',
      customer_id: '8bebdf37-d488-4e10-bb84-63a01c157c3a',
      customer_name: 'Mark Lester Ramos',
      customer_phone: '0917 582 9140',
      driver_license: 'N02-19-482019',
      vehicle_id: 5,
      vehicles: {
        id: 5,
        name: 'Honda ADV 160 (Motorcycle)',
        plate_number: 'MC-7712',
        categories: { name: 'Motorcycles' }
      },
      start_date: new Date(now + 86400000 * 3).toISOString().split('T')[0],
      end_date: new Date(now + 86400000 * 5).toISOString().split('T')[0],
      total_amount: 1200,
      paid_amount: 0,
      balance_due: 1200,
      status: 'awaiting_payment',
      payment_status: 'rejected',
      payment_method: 'Bank QR',
      payment_type: 'full',
      review_notes: 'Payment Rejected: Reference number not found in merchant bank records. Please resubmit your payment details.',
      created_at: new Date(now - 3600000 * 12).toISOString()
    }
  ];
  try {
    localStorage.setItem('rentflow_local_bookings', JSON.stringify(sampleBookings));
  } catch (e) {}
  return sampleBookings;
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
    currency: 'PHP',
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
    accentColor: '#7c3aed',
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
    if (company.currency && /[\u20B1]/.test(company.currency)) {
      company.currency = company.currency.replace(/[\u20B1]\s*/g, '').replace(/[()]/g, '').trim() || 'PHP';
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
    { id: 'browse', label: 'Browse' },
    { id: 'bookings', label: 'Bookings' },
    { id: 'favorites', label: 'Favorites' },
    { id: 'account', label: 'My Account' },
  ],
  staff: [
    { id: 'dashboard', label: 'Operations Dashboard' },
    { id: 'scanner', label: 'QR Scanner' },
    { id: 'requests', label: 'Booking Requests' },
    { id: 'active', label: 'Active Rentals' },
    { id: 'returns', label: 'Returns & Damages' },
    { id: 'refunds', label: 'Refunds & Claims' },
    { id: 'history', label: 'History' },
  ],
  admin: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'customers', label: 'Manage Users' },
    { id: 'users', label: 'Manage Staff' },
    { id: 'vehicles', label: 'Manage Vehicles' },
    { id: 'rentals', label: 'Monitor Reservations' },
    { id: 'reports', label: 'View Reports' },
    { id: 'categories', label: 'Categories & Rates' },
    { id: 'settings', label: 'System Settings' },
  ],
};

// ---------------------------------------------------------------------------
// Role-Based Access Control (RBAC) System
// ---------------------------------------------------------------------------
export const RBAC_DEFINITIONS = [
  { key: 'canManageFleet', label: 'Fleet Management', desc: 'Add, update, or decommission rental vehicles.' },
  { key: 'canModifyRates', label: 'Adjust Pricing & Rates', desc: 'Change daily rates, weekend surge, and category tiers.' },
  { key: 'canApproveBookings', label: 'Approve Bookings', desc: 'Confirm pending renter booking requests.' },
  { key: 'canRejectBookings', label: 'Reject Bookings', desc: 'Decline reservations with customer feedback.' },
  { key: 'canRecordDamage', label: 'Record Damage Pay', desc: 'Inspect vehicles, assess component damage, and bill repair charges.' },
  { key: 'canAddCustomFees', label: 'Add Additional Fees', desc: 'Attach late fees, fuel surcharges, tolls, and remote delivery items.' },
  { key: 'canInspectReturns', label: 'Process Vehicle Returns', desc: 'Check in returned cars, log mileage, and update fleet availability.' },
  { key: 'canDisburseRefunds', label: 'Disburse Refunds', desc: 'Approve and release cash/voucher refund disbursements.' },
  { key: 'canManageUsers', label: 'Promote/Manage Users', desc: 'Change system roles between Renter, Staff, and Admin.' },
  { key: 'canManageRBAC', label: 'Configure RBAC Matrix', desc: 'Toggle fine-grained permission flags across portals.' },
  { key: 'canEditSettings', label: 'System Settings', desc: 'Modify company information and legal policies.' },
  { key: 'canViewFinancials', label: 'Financial & Audit Reports', desc: 'Access comprehensive revenue summaries and transaction histories.' },
];

export const DEFAULT_PERMISSIONS = {
  admin: {
    canManageFleet: true,
    canModifyRates: true,
    canApproveBookings: true,
    canRejectBookings: true,
    canRecordDamage: true,
    canAddCustomFees: true,
    canInspectReturns: true,
    canDisburseRefunds: true,
    canManageUsers: true,
    canManageRBAC: true,
    canEditSettings: true,
    canViewFinancials: true,
  },
  staff: {
    canManageFleet: false,
    canModifyRates: false,
    canApproveBookings: true,
    canRejectBookings: true,
    canRecordDamage: true,
    canAddCustomFees: true,
    canInspectReturns: true,
    canDisburseRefunds: false,
    canManageUsers: false,
    canManageRBAC: false,
    canEditSettings: false,
    canViewFinancials: true,
  }
};

export function getRBACPermissions() {
  try {
    const raw = localStorage.getItem('rentflow_rbac_permissions');
    if (!raw) return DEFAULT_PERMISSIONS;
    const parsed = JSON.parse(raw);
    return {
      admin: { ...DEFAULT_PERMISSIONS.admin, ...(parsed.admin || {}) },
      staff: { ...DEFAULT_PERMISSIONS.staff, ...(parsed.staff || {}) }
    };
  } catch (e) {
    return DEFAULT_PERMISSIONS;
  }
}

export function saveRBACPermissions(perms) {
  try {
    localStorage.setItem('rentflow_rbac_permissions', JSON.stringify(perms));
  } catch (e) {
    console.warn('saveRBACPermissions error:', e);
  }
}

export function hasPermission(permKey, forcedRole = null) {
  const role = forcedRole || state.portal || state.profile?.role || 'customer';
  if (role === 'admin') {
    const perms = getRBACPermissions();
    return perms.admin?.[permKey] !== false;
  }
  if (role === 'staff') {
    const perms = getRBACPermissions();
    return Boolean(perms.staff?.[permKey]);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Damage Assessments & Custom Fees Local Persistence
// ---------------------------------------------------------------------------
export function getLocalDamages() {
  try {
    const raw = localStorage.getItem('rentflow_damage_records');
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  // Initial realistic sample damage records for demo
  const sample = [
    {
      id: 'DMG-8801',
      booking_id: '1',
      vehicle_name: 'Toyota Fortuner 2.8 V',
      plate_number: 'NBD-8842',
      customer_name: 'Mark Lester Ramos',
      customer_phone: '0917 582 9140',
      component: 'Front Bumper & Grille',
      severity: 'minor',
      description: 'Minor curb scratches on passenger side bumper lip. Requires wet sanding & spot paint buffing.',
      repair_cost: 2500,
      deductible_coverage: 1000,
      amount_due: 1500,
      payment_method: 'GCash',
      status: 'billed',
      assessed_by: 'Sarah Villanueva (Staff)',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'DMG-8802',
      booking_id: '2',
      vehicle_name: 'Toyota Vios 1.5 G CVT',
      plate_number: 'NCO-2914',
      customer_name: 'Sophia Martinez',
      customer_phone: '0918 333 4411',
      component: 'Interior Upholstery',
      severity: 'minor',
      description: 'Deep beverage stain on rear passenger fabric seat. Requires professional interior steam detailing.',
      repair_cost: 1200,
      deductible_coverage: 0,
      amount_due: 1200,
      payment_method: 'Visa Card',
      status: 'paid',
      assessed_by: 'Sarah Villanueva (Staff)',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    }
  ];
  try {
    localStorage.setItem('rentflow_damage_records', JSON.stringify(sample));
  } catch (e) {}
  return sample;
}

export function saveLocalDamage(record) {
  try {
    const list = getLocalDamages();
    const idx = list.findIndex(d => d.id === record.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...record };
    else list.unshift(record);
    localStorage.setItem('rentflow_damage_records', JSON.stringify(list));
  } catch (e) {
    console.warn('saveLocalDamage error:', e);
  }
}

export function updateDamageStatus(id, newStatus) {
  try {
    const list = getLocalDamages();
    const item = list.find(d => d.id === id);
    if (item) {
      item.status = newStatus;
      item.updated_at = new Date().toISOString();
      localStorage.setItem('rentflow_damage_records', JSON.stringify(list));
      return item;
    }
  } catch (e) {}
  return null;
}

export function getLocalCustomFees() {
  try {
    const raw = localStorage.getItem('rentflow_custom_fees');
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  const sample = [
    {
      id: 'FEE-201',
      booking_id: '1',
      vehicle_name: 'Toyota Fortuner 2.8 V',
      customer_name: 'Mark Lester Ramos',
      fee_type: 'late_return',
      fee_label: 'Late Return Fee (2 hrs)',
      amount: 1000,
      payment_method: 'Apple Pay',
      notes: 'Vehicle returned 2 hours past agreed cutoff due to expressway traffic.',
      status: 'paid',
      assessed_by: 'Sarah Villanueva (Staff)',
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      id: 'FEE-202',
      booking_id: '2',
      vehicle_name: 'Toyota Vios 1.5 G CVT',
      customer_name: 'Sophia Martinez',
      fee_type: 'fuel_surcharge',
      fee_label: 'Fuel Tank Top-Up Shortage',
      amount: 650,
      payment_method: 'Visa Card',
      notes: 'Returned 1/4 tank short of initial full level.',
      status: 'paid',
      assessed_by: 'Sarah Villanueva (Staff)',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: 'FEE-203',
      booking_id: '3',
      vehicle_name: 'Ford Ranger Raptor',
      customer_name: 'David Santos',
      fee_type: 'cleaning_fee',
      fee_label: 'Heavy Mud Off-Road Detailing',
      amount: 1200,
      payment_method: 'GCash',
      notes: 'Chassis and undercarriage mud detailing required after mountain trail.',
      status: 'billed',
      assessed_by: 'Sarah Villanueva (Staff)',
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    }
  ];
  try {
    localStorage.setItem('rentflow_custom_fees', JSON.stringify(sample));
  } catch (e) {}
  return sample;
}

export function saveLocalCustomFee(fee) {
  try {
    const list = getLocalCustomFees();
    list.unshift(fee);
    localStorage.setItem('rentflow_custom_fees', JSON.stringify(list));
  } catch (e) {
    console.warn('saveLocalCustomFee error:', e);
  }
}

export function updateCustomFeeStatus(id, newStatus) {
  try {
    const list = getLocalCustomFees();
    const item = list.find(f => f.id === id);
    if (item) {
      item.status = newStatus;
      item.updated_at = new Date().toISOString();
      localStorage.setItem('rentflow_custom_fees', JSON.stringify(list));
      return item;
    }
  } catch (e) {}
  return null;
}




