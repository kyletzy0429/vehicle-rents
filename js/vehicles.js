import { supabase } from './config.js';
import { state, getVehicleOverrides, saveVehicleOverride, getLocalBookings } from './state.js';
import { $, $$, fmtMoney, fmtDate, daysBetween, maskPlate, toast, openModal, emptyState, t } from './utils.js';
import { openVehicleDetail } from './booking.js';

export { getVehicleOverrides, saveVehicleOverride };

export const PH_POPULAR_VEHICLES = [
  {
    name: 'Toyota Fortuner 2.8 V 4x2 AT',
    plate_number: 'NBD-8842',
    status: 'available',
    image_url: 'images/fortuner.webp',
    description: 'Midsize 7-seater diesel SUV with dual aircon and high ground clearance. Comfortable for family provincial trips.'
  },
  {
    name: 'Toyota Vios 1.5 G CVT',
    plate_number: 'NCO-2914',
    status: 'available',
    image_url: 'images/vios.webp',
    description: 'Fuel-efficient automatic sedan. Smooth and easy to drive for city travel and daily errands.'
  },
  {
    name: 'Toyota Innova 2.8 E Diesel AT',
    plate_number: 'DAR-4921',
    status: 'available',
    image_url: 'images/innova.webp',
    description: 'Spacious 8-seater diesel MPV with strong rear aircon and ample luggage space.'
  },
  {
    name: 'Mitsubishi Montero Sport GT 4x2',
    plate_number: 'NGF-7102',
    status: 'available',
    image_url: 'images/montero.webp',
    description: 'Comfortable 7-seater turbo diesel SUV with leather seats for long-distance travel.'
  },
  {
    name: 'Ford Ranger Raptor 2.0L Bi-Turbo',
    plate_number: 'CBL-9481',
    status: 'available',
    image_url: 'images/raptor.webp',
    description: 'Heavy-duty 4x4 pickup truck with high ground clearance. Built for provincial roads and large cargo.'
  },
  {
    name: 'Mitsubishi Xpander GLS 1.5 AT',
    plate_number: 'NBF-3910',
    status: 'available',
    image_url: 'images/xpander.webp',
    description: 'Modern 7-seater MPV with foldable seats and comfortable ride for groups.'
  },
  {
    name: 'Mitsubishi Mirage G4 GLX AT',
    plate_number: 'NDB-5012',
    status: 'available',
    image_url: 'images/mirage.webp',
    description: 'Compact and economical sedan with low fuel consumption, easy to park in city traffic.'
  },
  {
    name: 'Toyota Wigo 1.0 G CVT',
    plate_number: 'NCL-1049',
    status: 'available',
    image_url: 'images/wigo.webp',
    description: 'Compact 5-door hatchback, great on gas with cold air conditioning for city trips.'
  },
  {
    name: 'Toyota HiAce Commuter Deluxe 2.8',
    plate_number: 'VAA-8012',
    status: 'available',
    image_url: 'images/hiace.webp',
    description: '14-passenger van with strong dual aircon, ideal for group tours and company transfers.'
  },
  {
    name: 'Yamaha NMAX 155 ABS (Motorcycle)',
    plate_number: '128-NMX',
    status: 'available',
    image_url: 'images/nmax.webp',
    description: 'Automatic 155cc maxi scooter with ABS and large under-seat compartment.'
  },
  {
    name: 'Honda Click 125i (Motorcycle)',
    plate_number: '904-CLK',
    status: 'available',
    image_url: 'images/click.webp',
    description: 'Lightweight 125cc automatic scooter, very agile and economical for daily commute.'
  },
  {
    name: 'Honda ADV 160 (Motorcycle)',
    plate_number: '481-ADV',
    status: 'available',
    image_url: 'images/adv.webp',
    description: 'Smooth 160cc adventure scooter with long-travel suspension for city and weekend rides.'
  }
];

export const PH_CATEGORIES = [
  { name: 'Motorcycles', daily_rate: 500, description: 'Automatic scooters & motorbikes (Honda Click 125i @ 400, Yamaha NMAX 155 @ 500, Honda ADV 160 @ 600)' },
  { name: 'Economy & Hatchbacks', daily_rate: 2200, description: 'Compact fuel-efficient hatchbacks & sedans (Toyota Wigo, Mitsubishi Mirage G4)' },
  { name: 'Sedans', daily_rate: 2500, description: '5-Seater comfortable subcompact sedans (Toyota Vios 1.5 G)' },
  { name: 'MPVs & Crossovers', daily_rate: 3000, description: '7 to 8-Seater family MPVs (Toyota Innova, Mitsubishi Xpander)' },
  { name: 'SUVs & Pickups', daily_rate: 4200, description: 'Midsize 7-Seater SUVs & Pickup Trucks (Toyota Fortuner, Montero Sport, Ford Ranger Raptor)' },
  { name: 'Passenger Vans', daily_rate: 5000, description: '14-Seater full-size passenger vans for tours and group trips (Toyota HiAce Commuter Deluxe)' }
];

export const CURATED_SUGGESTIONS = [
  {
    category: 'family',
    categoryLabel: 'Family Trips',
    badge: '8-Seater',
    name: 'Toyota Innova 2.8 E Diesel AT',
    img: 'images/innova.webp',
    reason: 'Top choice for family vacations with strong dual rear AC and large luggage capacity.'
  },
  {
    category: 'vip',
    categoryLabel: 'Executive & VIP',
    badge: '7-Seater SUV',
    name: 'Toyota Fortuner 2.8 V 4x2 AT',
    img: 'images/fortuner.webp',
    reason: 'Executive presence, leather seats, and high ground clearance for VIP travel.'
  },
  {
    category: 'eco',
    categoryLabel: 'Fuel Savers',
    badge: 'Eco Drive',
    name: 'Toyota Vios 1.5 G CVT',
    img: 'images/vios.webp',
    reason: 'Best gas mileage in class. Smooth automatic CVT for city and daily business.'
  },
  {
    category: 'adventure',
    categoryLabel: 'Adventure & 4x4',
    badge: '4x4 Off-Road',
    name: 'Ford Ranger Raptor 2.0L Bi-Turbo',
    img: 'images/raptor.webp',
    reason: 'Bi-Turbo off-road beast designed for rough terrain, mountain passes, and heavy loads.'
  },
  {
    category: 'family',
    categoryLabel: 'Family & Groups',
    badge: '14-Passenger Van',
    name: 'Toyota HiAce Commuter Deluxe 2.8',
    img: 'images/hiace.webp',
    reason: 'Ideal for group tours, airport pick-up, and provincial excursions.'
  },
  {
    category: 'solo',
    categoryLabel: 'Solo Commute',
    badge: 'Maxi Scooter',
    name: 'Yamaha NMAX 155 ABS',
    img: 'images/nmax.webp',
    reason: 'Fast, fuel-efficient maxi scooter with dual ABS disc brakes and spacious under-seat box.'
  }
];

export function getVehicleDailyRate(v) {
  if (!v) return 0;

  // 1. Check custom rate saved in localStorage by admin
  try {
    const customRates = JSON.parse(localStorage.getItem('rentflow_vehicle_rates') || '{}');
    if (v.id && customRates[v.id] && Number(customRates[v.id]) > 0) return Number(customRates[v.id]);
    if (v.plate_number && customRates[v.plate_number] && Number(customRates[v.plate_number]) > 0) return Number(customRates[v.plate_number]);
    const cleanName = (v.name || '').trim().toLowerCase();
    if (cleanName && customRates[cleanName] && Number(customRates[cleanName]) > 0) return Number(customRates[cleanName]);
  } catch (e) {}

  // 2. Direct database rate on vehicle if set
  if (v.daily_rate !== undefined && v.daily_rate !== null && Number(v.daily_rate) > 0) {
    return Number(v.daily_rate);
  }

  // 3. Category / standard model rate fallbacks
  const name = (v?.name || '').toLowerCase();
  if (name.includes('click')) return 400;
  if (name.includes('nmax')) return 500;
  if (name.includes('adv')) return 600;
  if (name.includes('motor') || name.includes('scooter')) return 500;

  if (v?.categories?.daily_rate && Number(v.categories.daily_rate) > 0) {
    return Number(v.categories.daily_rate);
  }

  if (name.includes('wigo')) return 2200;
  if (name.includes('mirage')) return 2300;
  if (name.includes('vios')) return 2500;
  if (name.includes('innova')) return 3200;
  if (name.includes('xpander')) return 3000;
  if (name.includes('fortuner')) return 4200;
  if (name.includes('montero')) return 4300;
  if (name.includes('ranger') || name.includes('raptor')) return 4500;
  if (name.includes('hiace') || name.includes('van')) return 5000;

  return 2000;
}

export function setVehicleCustomRate(key, rate) {
  try {
    const customRates = JSON.parse(localStorage.getItem('rentflow_vehicle_rates') || '{}');
    customRates[key] = Number(rate);
    localStorage.setItem('rentflow_vehicle_rates', JSON.stringify(customRates));
  } catch (e) {}
}

export function getVehicleCategoryName(v) {
  if (v?.categories?.name) return v.categories.name;
  const name = (v?.name || '').toLowerCase();
  if (name.includes('nmax') || name.includes('click') || name.includes('adv') || name.includes('motor') || name.includes('scooter')) return 'Motorcycles';
  if (name.includes('wigo') || name.includes('mirage')) return 'Economy & Hatchbacks';
  if (name.includes('vios')) return 'Sedans';
  if (name.includes('innova') || name.includes('xpander')) return 'MPVs & Crossovers';
  if (name.includes('fortuner') || name.includes('montero')) return 'SUVs & Pickups';
  if (name.includes('ranger') || name.includes('raptor')) return 'SUVs & Pickups';
  if (name.includes('hiace') || name.includes('van')) return 'Passenger Vans';
  return 'Standard';
}

export function getExactVehicleImage(v) {
  const name = (v?.name || '').toLowerCase();

  if (name.includes('fortuner')) return 'images/fortuner.webp';
  if (name.includes('vios')) return 'images/vios.webp';
  if (name.includes('innova')) return 'images/innova.webp';
  if (name.includes('montero')) return 'images/montero.webp';
  if (name.includes('ranger') || name.includes('raptor') || name.includes('tacoma') || name.includes('pickup')) return 'images/raptor.webp';
  if (name.includes('xpander')) return 'images/xpander.webp';
  if (name.includes('mirage')) return 'images/mirage.webp';
  if (name.includes('wigo')) return 'images/wigo.webp';
  if (name.includes('hiace') || name.includes('van') || name.includes('commuter')) return 'images/hiace.webp';
  if (name.includes('nmax')) return 'images/nmax.webp';
  if (name.includes('click')) return 'images/click.webp';
  if (name.includes('adv')) return 'images/adv.webp';
  if (name.includes('motorcycle') || name.includes('scooter') || name.includes('motor')) return 'images/click.webp';

  if (v && v.image_url && v.image_url.trim() && !v.image_url.includes('unsplash.com')) {
    return v.image_url.trim();
  }

  return 'images/fortuner.webp';
}

export async function loadCategories() {
  let { data } = await supabase.from('categories').select('*').order('daily_rate');

  if (data && data.length) {
    const motorCat = data.find(c => (c.name || '').toLowerCase().includes('motor'));
    if (motorCat && Number(motorCat.daily_rate) > 600) {
      motorCat.daily_rate = 500;
      supabase.from('categories').update({ daily_rate: 500, description: 'Automatic scooters & motorbikes (Honda Click 125i @ 400, Yamaha NMAX 155 @ 500, Honda ADV 160 @ 600)' }).eq('id', motorCat.id).then(() => { }).catch(() => { });
    }
  }

  if (!data || data.length < 4) {
    for (const cat of PH_CATEGORIES) {
      await supabase.from('categories').upsert({
        name: cat.name,
        daily_rate: cat.daily_rate,
        description: cat.description
      }, { onConflict: 'name' }).then(() => { }).catch(async () => {
        await supabase.from('categories').insert({
          name: cat.name,
          daily_rate: cat.daily_rate,
          description: cat.description
        }).then(() => { }).catch(() => { });
      });
    }
    const reFetch = await supabase.from('categories').select('*').order('daily_rate');
    data = reFetch.data || data;
  }

  if (!data || data.length === 0) {
    data = PH_CATEGORIES.map((c, i) => ({ id: i + 1, ...c }));
  }

  state.categories = data || [];
}

export async function loadVehicles() {
  let { data } = await supabase.from('vehicles').select('*, categories(name, daily_rate)').order('name');

  if (!data || data.length < 8) {
    let catList = state.categories;
    if (!catList.length) {
      await loadCategories();
      catList = state.categories;
    }
    const defaultCatId = catList[0]?.id || null;

    for (const v of PH_POPULAR_VEHICLES) {
      const vNameLower = v.name.toLowerCase();
      let targetCatName = 'Sedans';

      if (vNameLower.includes('nmax') || vNameLower.includes('click') || vNameLower.includes('adv') || vNameLower.includes('motorcycle')) {
        targetCatName = 'Motorcycles';
      } else if (vNameLower.includes('wigo') || vNameLower.includes('mirage')) {
        targetCatName = 'Economy & Hatchbacks';
      } else if (vNameLower.includes('vios')) {
        targetCatName = 'Sedans';
      } else if (vNameLower.includes('innova') || vNameLower.includes('xpander')) {
        targetCatName = 'MPVs & Crossovers';
      } else if (vNameLower.includes('fortuner') || vNameLower.includes('montero') || vNameLower.includes('ranger')) {
        targetCatName = 'SUVs & Pickups';
      } else if (vNameLower.includes('hiace') || vNameLower.includes('van')) {
        targetCatName = 'Passenger Vans';
      }

      const catMatch = catList.find(c => c.name.toLowerCase().includes(targetCatName.toLowerCase())) || catList[0];

      await supabase.from('vehicles').upsert({
        name: v.name,
        plate_number: v.plate_number,
        status: v.status,
        image_url: v.image_url,
        description: v.description,
        category_id: catMatch?.id || defaultCatId
      }, { onConflict: 'plate_number' }).then(() => { }).catch(() => { });
    }

    const reFetch = await supabase.from('vehicles').select('*, categories(name, daily_rate)').order('name');
    data = reFetch.data || data;
  }

  if (data && data.length) {
    const seenModelKeys = new Set();
    const uniqueVehicles = [];

    for (const v of data) {
      const lower = (v.name || '').toLowerCase();
      let modelKey = '';
      if (lower.includes('fortuner')) modelKey = 'fortuner';
      else if (lower.includes('vios')) modelKey = 'vios';
      else if (lower.includes('click')) modelKey = 'click';
      else if (lower.includes('nmax')) modelKey = 'nmax';
      else if (lower.includes('adv')) modelKey = 'adv';
      else if (lower.includes('innova')) modelKey = 'innova';
      else if (lower.includes('montero')) modelKey = 'montero';
      else if (lower.includes('raptor') || lower.includes('ranger')) modelKey = 'raptor';
      else if (lower.includes('hiace') || lower.includes('van')) modelKey = 'hiace';
      else if (lower.includes('wigo')) modelKey = 'wigo';
      else if (lower.includes('xpander')) modelKey = 'xpander';
      else if (lower.includes('mirage')) modelKey = 'mirage';
      else modelKey = (v.name || '').trim().toLowerCase();

      if (seenModelKeys.has(modelKey)) {
        continue;
      }

      seenModelKeys.add(modelKey);
      const overrides = getVehicleOverrides();
      const ovr = overrides[v.id] || (v.plate_number ? overrides[v.plate_number] : null);
      if (ovr) {
        Object.assign(v, ovr);
      }
      const correctImg = getExactVehicleImage(v);
      if (v.image_url !== correctImg && (!v.image_url || v.image_url.includes('unsplash.com'))) {
        v.image_url = correctImg;
        supabase.from('vehicles').update({ image_url: correctImg }).eq('id', v.id).then(() => { }).catch(() => { });
      }
      v.daily_rate = getVehicleDailyRate(v);
      uniqueVehicles.push(v);
    }
    data = uniqueVehicles;
  }

  state.vehicles = data || [];
}

export function getFavorites() {
  try {
    const raw = localStorage.getItem(`rentflow_favs_${state.user?.id || 'guest'}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export function toggleFavorite(id) {
  let favs = getFavorites();
  if (favs.includes(id)) {
    favs = favs.filter(fId => fId !== id);
    toast('Removed from your Favorites.', 'info');
  } else {
    favs.push(id);
    toast('Saved to your Favorites!', 'success');
  }
  try {
    localStorage.setItem(`rentflow_favs_${state.user?.id || 'guest'}`, JSON.stringify(favs));
  } catch (e) { }
  if (window.renderTab) {
    window.renderTab();
  }
}

let browseFilter = 'all';
let browseStatusFilter = 'all';
let browseSearch = '';
let browseStartDate = '';
let browseEndDate = '';
let browsePriceMax = 10000;
let browseSeatsFilter = 'all';
let browseTransFilter = 'all';
let browseRatingFilter = 'all';
let browseLocation = 'all';
let browseSort = 'featured';
let showAdvancedFilters = false;

const displayCategoryPills = ['All', 'Pickup', 'Crossover', 'Hatchback', 'Sedan', 'Van', 'Compact SUV', 'SUV', 'Motorcycles'];

function formatDisplayDate(iso) {
  if (!iso) return 'mm/dd/yyyy';
  try {
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
    return iso;
  } catch (e) {
    return iso;
  }
}

let heroCalYear = new Date().getFullYear();
let heroCalMonth = new Date().getMonth();

let availPickUpDate = '';
let availReturnDate = '';
let availVehicleType = 'all';
let availChecked = false;
let availError = '';
let availFreeVehicleIds = null;
let availTotalCount = 0;
let availFreeCount = 0;

export function renderBrowse(view) {
  const cats = ['all', ...state.categories.map(c => c.name)];
  const todayStr = new Date().toISOString().slice(0, 10);
  const rawName = state.profile?.full_name || '';
  const isGeneric = !rawName || rawName === 'Guest Customer' || rawName === 'User' || rawName === 'Customer';
  const firstName = isGeneric ? 'Juan' : rawName.split(' ')[0];

  const availableVehicles = (availChecked && availFreeVehicleIds)
    ? state.vehicles.filter(v => availFreeVehicleIds.has(String(v.id)))
    : state.vehicles;

  const filtered = availableVehicles.filter(v => {
    const vCat = getVehicleCategoryName(v).toLowerCase();
    const vName = (v.name || '').toLowerCase();

    if (browseFilter !== 'all') {
      const f = browseFilter.toLowerCase();
      if (f === 'sedan') return vCat.includes('sedan') || vName.includes('vios') || vName.includes('city') || vName.includes('mirage') || vName.includes('wigo');
      if (f === 'suv') return vCat.includes('suv') || vName.includes('fortuner') || vName.includes('montero') || vName.includes('everest') || vName.includes('raptor') || vName.includes('ranger');
      if (f === 'mpv') return vCat.includes('mpv') || vCat.includes('crossover') || vName.includes('xpander') || vName.includes('innova') || vName.includes('rush') || vName.includes('veloz');
      if (f === 'van') return vCat.includes('van') || vName.includes('hiace') || vName.includes('commuter') || vName.includes('urvan');
      if (f === 'motorcycle' || f === 'motorcycles') return vCat.includes('motor') || vName.includes('click') || vName.includes('nmax') || vName.includes('adv');
      return vCat.includes(f) || vName.includes(f);
    }
    return true;
  });

  const numDays = (availPickUpDate && availReturnDate) ? daysBetween(availPickUpDate, availReturnDate) : 0;

  view.innerHTML = `
    <div class="view" style="max-width:1200px;margin:0 auto;padding:16px 8px 60px 8px;">
      <!-- Eyebrow & Greeting -->
      <div style="margin-bottom:24px;">
        <div class="portal-eyebrow">RENTER PORTAL</div>
        <h1 class="portal-heading">${t('welcome_back') || 'Welcome back'}, ${firstName}</h1>
      </div>

      <!-- ═══ BOOKING AVAILABILITY CARD (Replaces upcoming booking banner) ═══ -->
      <div class="booking-availability-card" style="background:#ffffff;border:1px solid var(--glass-border,#E2DCF0);border-radius:14px;padding:22px 26px;margin-bottom:32px;box-shadow:0 1px 3px rgba(42,35,64,0.03);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:18px;">
          <h2 style="font-family:'Fraunces',serif;font-size:1.25rem;font-weight:700;color:var(--text-hi,#2A2340);margin:0;">
            Booking availability
          </h2>
          <span style="font-size:0.85rem;color:var(--text-mid,#5E5778);">
            Pick your dates to see which vehicles are free
          </span>
        </div>

        <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;">
          <div style="flex:1;min-width:170px;">
            <label for="availPickUp" style="display:block;font-size:0.8rem;font-weight:700;color:var(--text-hi,#2A2340);margin-bottom:6px;">
              Pick-up date
            </label>
            <input 
              type="date" 
              id="availPickUp" 
              class="clean-input" 
              value="${availPickUpDate}" 
              style="width:100%;padding:10px 14px;border:1.5px solid var(--glass-border,#E2DCF0);border-radius:10px;font-size:0.88rem;background:var(--bg-surface,#ffffff);color:var(--text-hi,#2A2340);" 
            />
          </div>

          <div style="flex:1;min-width:170px;">
            <label for="availReturn" style="display:block;font-size:0.8rem;font-weight:700;color:var(--text-hi,#2A2340);margin-bottom:6px;">
              Return date
            </label>
            <input 
              type="date" 
              id="availReturn" 
              class="clean-input" 
              value="${availReturnDate}" 
              style="width:100%;padding:10px 14px;border:1.5px solid var(--glass-border,#E2DCF0);border-radius:10px;font-size:0.88rem;background:var(--bg-surface,#ffffff);color:var(--text-hi,#2A2340);" 
            />
          </div>

          <div style="flex:1;min-width:160px;">
            <label for="availVehicleType" style="display:block;font-size:0.8rem;font-weight:700;color:var(--text-hi,#2A2340);margin-bottom:6px;">
              Vehicle type
            </label>
            <select 
              id="availVehicleType" 
              class="clean-select" 
              style="width:100%;font-size:0.88rem;border-radius:10px;">
              <option value="all" ${availVehicleType === 'all' ? 'selected' : ''}>All types</option>
              <option value="sedan" ${availVehicleType === 'sedan' ? 'selected' : ''}>Sedan</option>
              <option value="suv" ${availVehicleType === 'suv' ? 'selected' : ''}>SUV</option>
              <option value="mpv" ${availVehicleType === 'mpv' ? 'selected' : ''}>MPV</option>
              <option value="van" ${availVehicleType === 'van' ? 'selected' : ''}>Van</option>
              <option value="motorcycle" ${availVehicleType === 'motorcycle' ? 'selected' : ''}>Motorcycle</option>
            </select>
          </div>

          <div style="flex-shrink:0;">
            <button 
              type="button" 
              class="btn btn-primary" 
              id="btnCheckAvailability" 
              style="padding:10px 22px;border-radius:10px;font-weight:700;white-space:nowrap;height:42px;">
              Check availability
            </button>
          </div>
        </div>

        <!-- Validation Error Message -->
        <div id="availErrorMsg" style="display:${availError ? 'block' : 'none'};color:#dc2626;font-size:0.82rem;font-weight:600;margin-top:12px;">
          ${availError || ''}
        </div>

        <!-- Availability Results Bar -->
        ${availChecked && !availError ? `
          <div id="availResultsBar" style="display:flex;align-items:center;gap:12px;margin-top:16px;padding-top:14px;border-top:1px solid var(--glass-border,#E2DCF0);flex-wrap:wrap;">
            <span class="badge" style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;padding:4px 12px;border-radius:9999px;font-weight:700;font-size:0.78rem;">
              ${availFreeCount} of ${availTotalCount} available
            </span>
            <span style="font-size:0.85rem;color:var(--text-hi,#2A2340);font-weight:600;">
              ${fmtDate(availPickUpDate)} to ${fmtDate(availReturnDate)} (${numDays} ${numDays === 1 ? 'day' : 'days'}). Vehicles already booked on these dates are hidden below.
            </span>
          </div>
        ` : ''}
      </div>

      <!-- ═══ BROWSE VEHICLES SECTION ═══ -->
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:16px;">
        <h2 style="font-family:'Fraunces',serif;font-size:1.5rem;font-weight:600;color:var(--text-hi,#2A2340);margin:0;">Browse vehicles</h2>
        <span style="font-size:0.84rem;color:#8C86A3;">${filtered.length} results</span>
      </div>

      <!-- Category Filter Pills -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;overflow-x:auto;" id="catPills">
        ${['All', 'Sedan', 'SUV', 'MPV', 'Van', 'Motorcycle'].map(cat => {
          const isActive = browseFilter.toLowerCase() === cat.toLowerCase() || (cat === 'All' && (!browseFilter || browseFilter === 'all'));
          return `
            <button type="button" class="category-pill-clean ${isActive ? 'active' : ''}" data-cat="${cat}" style="padding:8px 20px;border-radius:9999px;font-size:0.88rem;cursor:pointer;transition:all 0.15s ease;font-weight:${isActive ? '600' : '500'};border:${isActive ? 'none' : '1px solid #E2DCF0'};background:${isActive ? '#2A2340' : '#ffffff'};color:${isActive ? '#ffffff' : '#5E5778'};">
              ${cat}
            </button>
          `;
        }).join('')}
      </div>

      <!-- 4-Column Vehicles Grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:20px;" id="vehicleGrid">
        ${filtered.length ? filtered.map(vehicleCardHTML).join('') : emptyState('', availChecked ? 'No vehicles are free on these dates.' : 'No vehicles available under this category.')}
      </div>
    </div>
  `;

  // Attach filter handlers
  $$('.category-pill-clean', view).forEach(btn => {
    btn.addEventListener('click', () => {
      browseFilter = btn.dataset.cat.toLowerCase();
      renderBrowse(view);
    });
  });

  // Attach card detail open (passes chosen pickUp & return dates to openVehicleDetail)
  $$('#vehicleGrid .renter-vehicle-card, #vehicleGrid .vehicle-card', view).forEach(card => {
    card.addEventListener('click', () => {
      openVehicleDetail(card.dataset.id, availPickUpDate, availReturnDate);
    });
  });

  $$('[data-book-btn]', view).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openVehicleDetail(btn.dataset.bookBtn, availPickUpDate, availReturnDate);
    });
  });

  // Check Availability button handler
  $('#btnCheckAvailability')?.addEventListener('click', async () => {
    const pickUp = $('#availPickUp')?.value;
    const returnDate = $('#availReturn')?.value;
    const vType = $('#availVehicleType')?.value || 'all';

    const errBox = $('#availErrorMsg');
    const todayStr = new Date().toISOString().slice(0, 10);

    if (!pickUp || !returnDate) {
      availError = 'Please select both pick-up and return dates.';
      if (errBox) {
        errBox.textContent = availError;
        errBox.style.display = 'block';
      }
      return;
    }

    if (pickUp < todayStr) {
      availError = 'Pick-up date cannot be in the past.';
      if (errBox) {
        errBox.textContent = availError;
        errBox.style.display = 'block';
      }
      return;
    }

    if (returnDate < pickUp) {
      availError = 'Return date must not be before pick-up date.';
      if (errBox) {
        errBox.textContent = availError;
        errBox.style.display = 'block';
      }
      return;
    }

    availError = '';
    availPickUpDate = pickUp;
    availReturnDate = returnDate;
    availVehicleType = vType;

    // Get bookings from Supabase (one query for all vehicles) plus getLocalBookings()
    let dbBookings = [];
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('vehicle_id, start_date, end_date, status')
        .in('status', ['pending', 'approved', 'active', 'reserved'])
        .lte('start_date', returnDate)
        .gte('end_date', pickUp);
      if (!error && Array.isArray(data)) {
        dbBookings = data;
      }
    } catch (e) {
      console.warn('Availability check Supabase notice:', e);
    }

    const localList = getLocalBookings().filter(b =>
      ['pending', 'approved', 'active', 'reserved'].includes(b.status) &&
      b.start_date && b.end_date
    );

    const allBookings = [
      ...dbBookings.map(b => ({
        vehicle_id: String(b.vehicle_id),
        start_date: (b.start_date || '').slice(0, 10),
        end_date: (b.end_date || '').slice(0, 10)
      })),
      ...localList.map(b => ({
        vehicle_id: String(b.vehicle_id || b.vehicles?.id || ''),
        start_date: (b.start_date || '').slice(0, 10),
        end_date: (b.end_date || '').slice(0, 10)
      }))
    ];

    // Filter free vehicles:
    // A vehicle is NOT free if its status is "maintenance",
    // or if it has a booking with status pending, approved, active or reserved
    // where start_date <= chosen return date AND end_date >= chosen pick-up date.
    const freeVehicles = state.vehicles.filter(v => {
      if (v.status === 'maintenance') return false;
      const isBooked = allBookings.some(b =>
        b.vehicle_id === String(v.id) &&
        b.start_date <= returnDate &&
        b.end_date >= pickUp
      );
      return !isBooked;
    });

    availFreeVehicleIds = new Set(freeVehicles.map(v => String(v.id)));
    availTotalCount = state.vehicles.length;
    availFreeCount = freeVehicles.length;
    availChecked = true;

    if (vType && vType !== 'all') {
      browseFilter = vType;
    }

    renderBrowse(view);
  });
}

export function getCleanVehicleName(raw) {
  if (!raw) return 'Vehicle';
  if (/Ranger\s*Raptor/i.test(raw)) return 'Ford Ranger Raptor';
  if (/Montero\s*Sport/i.test(raw)) return 'Montero Sport GT';
  if (/Vios/i.test(raw)) return 'Toyota Vios';
  if (/Innova/i.test(raw)) return 'Toyota Innova';
  if (/Fortuner/i.test(raw)) return 'Toyota Fortuner 2.8 V';
  if (/Xpander/i.test(raw)) return 'Xpander GLS';
  if (/Mirage/i.test(raw)) return 'Mitsubishi Mirage G4';
  if (/Wigo/i.test(raw)) return 'Toyota Wigo';
  if (/HiAce/i.test(raw)) return 'Toyota HiAce Commuter';
  if (/NMAX/i.test(raw)) return 'Yamaha NMAX 155';
  if (/ADV/i.test(raw)) return 'Honda ADV 160';
  if (/Click/i.test(raw)) return 'Honda Click 125i';

  return String(raw)
    .replace(/\s*\((?:Motorcycle|Van|SUV|Sedan|MPV)\)/gi, '')
    .replace(/\s+(?:2\.0L|1\.5|2\.8|1\.0|2\.4|2\.5)\b[^,]*/gi, '')
    .replace(/\s+(?:Bi-Turbo|CVT|AT|MT|4x2|4x4|Diesel|Commuter|Deluxe)\b.*/gi, '')
    .trim();
}

export function getCleanCategoryLabel(catName, vName, seats) {
  let cat = String(catName || '').trim();
  const name = String(vName || '').toLowerCase();
  if (name.includes('raptor') || name.includes('pickup') || name.includes('ranger')) {
    cat = 'Pickup';
  } else if (/motor/i.test(cat) || name.includes('adv') || name.includes('click') || name.includes('nmax')) {
    cat = 'Motorcycle';
  } else if (/sedan/i.test(cat) || name.includes('vios') || name.includes('mirage') || name.includes('wigo')) {
    cat = 'Sedan';
  } else if (/suv/i.test(cat) || name.includes('fortuner') || name.includes('montero')) {
    cat = 'SUV';
  } else if (/mpv/i.test(cat) || /cross/i.test(cat) || name.includes('innova') || name.includes('xpander')) {
    cat = 'MPV';
  } else if (/van/i.test(cat) || name.includes('hiace') || name.includes('urvan')) {
    cat = 'Van';
  }
  return `${cat}, ${seats} seats`;
}

export function vehicleCardHTML(v) {
  const exactImg = getExactVehicleImage(v);
  const rate = getVehicleDailyRate(v);
  const catName = getVehicleCategoryName(v);
  const isAvailable = (v.status || 'available').toLowerCase() === 'available';
  const seats = v.seats || (catName.toLowerCase().includes('motor') ? 2 : (catName.toLowerCase().includes('van') ? 14 : (catName.toLowerCase().includes('mpv') || catName.toLowerCase().includes('suv') ? 7 : 5)));
  const cleanName = getCleanVehicleName(v.name);
  const cleanMeta = getCleanCategoryLabel(catName, v.name, seats);
  const cleanRate = Math.round(Number(rate || 0)).toLocaleString('en-US');

  return `
    <div class="renter-vehicle-card vehicle-card" data-id="${v.id}" style="background:#ffffff;border:1px solid #E2DCF0;border-radius:14px;padding:16px;display:flex;flex-direction:column;box-shadow:0 1px 3px rgba(42,35,64,0.03);cursor:pointer;transition:transform 0.15s ease, border-color 0.15s ease;box-sizing:border-box;">
      <div style="height:140px;background:#ffffff;display:flex;align-items:center;justify-content:center;padding:10px;margin-bottom:12px;">
        <img src="${exactImg}" alt="${cleanName}" style="max-width:100%;max-height:100%;object-fit:contain;" loading="lazy" />
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
        <h3 style="font-family:'Fraunces',serif;font-size:1.06rem;font-weight:600;color:#2A2340;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${v.name}">${cleanName}</h3>
        <span class="soft-pill ${isAvailable ? 'soft-pill-mint' : 'soft-pill-amber'}" style="flex-shrink:0;">
          ${isAvailable ? 'Available' : 'Few left'}
        </span>
      </div>
      <p style="font-size:0.82rem;color:#8C86A3;margin:0 0 16px 0;">${cleanMeta}</p>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;padding-top:12px;border-top:1px solid #f1f5f9;">
        <div style="display:flex;align-items:baseline;gap:4px;white-space:nowrap;flex-shrink:0;">
          <strong style="font-family:'Fraunces',serif;font-size:1.15rem;font-weight:700;color:#2A2340;letter-spacing:-0.01em;">PHP ${cleanRate}</strong>
          <span style="font-size:0.8rem;color:#8C86A3;">/ day</span>
        </div>
        <button type="button" class="card-view-btn" data-book-btn="${v.id}">View</button>
      </div>
    </div>
  `;
}
