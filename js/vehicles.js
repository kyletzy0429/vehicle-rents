import { supabase } from './config.js';
import { state, getVehicleOverrides, saveVehicleOverride } from './state.js';
import { $, $$, fmtMoney, maskPlate, toast, emptyState } from './utils.js';
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

function formatHeroDate(iso) {
  if (!iso) return 'mm/dd/yyyy';
  try {
    const d = new Date(iso + 'T00:00:00');
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${dayNames[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
  } catch (e) {
    return iso;
  }
}

let heroCalYear = new Date().getFullYear();
let heroCalMonth = new Date().getMonth();

export function renderBrowse(view) {
  const cats = ['all', ...state.categories.map(c => c.name)];
  const todayStr = new Date().toISOString().slice(0, 10);
  const availableCount = state.vehicles.filter(v => v.status === 'available').length;

  const filtered = state.vehicles.filter(v => {
    const vCat = getVehicleCategoryName(v);
    const matchesCat = browseFilter === 'all' ||
      vCat.toLowerCase() === browseFilter.toLowerCase() ||
      (v.categories?.name && v.categories.name.toLowerCase() === browseFilter.toLowerCase());
    const matchesSearch = v.name.toLowerCase().includes(browseSearch.toLowerCase());
    const matchesStatus = browseStatusFilter === 'all' || v.status === browseStatusFilter;
    return matchesCat && matchesSearch && matchesStatus;
  });

  view.innerHTML = `
    <div class="view">
      <!-- Reference Hero & Availability Search Section -->
      <div class="hero-availability-container">
        <div class="hero-tag">KEY 02 — AVAILABILITY</div>
        <h1 class="hero-title">Search available vehicles</h1>
        <p class="hero-subtitle">Choose your dates to see what's open, then view deals and book on the spot.</p>

        <div class="hero-filter-card" style="position:relative;" id="heroFilterCard">
          <div class="hero-filter-field hero-date-box" id="heroPickupBox" title="Click to choose Pick-up Date">
            <label>Pick-up</label>
            <div class="hero-date-val-wrap">
              <i class="fa-regular fa-calendar-days hero-cal-icon"></i>
              <span class="hero-date-text" id="heroPickupDisplay">${browseStartDate ? formatHeroDate(browseStartDate) : 'mm/dd/yyyy'}</span>
              <span class="hero-time-badge">Noon</span>
            </div>
          </div>

          <div class="hero-filter-divider"></div>

          <div class="hero-filter-field hero-date-box" id="heroDropoffBox" title="Click to choose Drop-out Date">
            <label>Drop-out</label>
            <div class="hero-date-val-wrap">
              <i class="fa-regular fa-calendar-days hero-cal-icon"></i>
              <span class="hero-date-text" id="heroDropoffDisplay">${browseEndDate ? formatHeroDate(browseEndDate) : 'mm/dd/yyyy'}</span>
              <span class="hero-time-badge">Noon</span>
            </div>
          </div>

          <div class="hero-filter-divider"></div>

          <div class="hero-filter-field">
            <label for="heroCategorySelect">Vehicle type</label>
            <select id="heroCategorySelect">
              <option value="all" ${browseFilter === 'all' ? 'selected' : ''}>Any type</option>
              ${state.categories.map(c => `<option value="${c.name}" ${browseFilter.toLowerCase() === c.name.toLowerCase() ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>

          <button type="button" class="btn hero-search-btn" id="heroSearchBtn">
            Search
          </button>

          <!-- Floating Dual-Month Calendar Popover (Booking.com / Hertz style) -->
          <div class="hero-date-popover" id="heroCalendarPopover" style="display:none;"></div>
        </div>
      </div>


      <!-- Quick category filter pills -->
      <div class="pill-row" id="catPills" style="margin-bottom:24px;">
        <div class="pill ${browseFilter === 'all' ? 'active' : ''}" data-cat="all">All Vehicles (${state.vehicles.length})</div>
        ${state.categories.map(c => `<div class="pill ${browseFilter.toLowerCase() === c.name.toLowerCase() ? 'active' : ''}" data-cat="${c.name}">${c.name}</div>`).join('')}
      </div>

      <!-- Vehicle Cards Grid -->
      <div class="grid grid-vehicles" id="vehicleGrid">
        ${filtered.length ? filtered.map(vehicleCardHTML).join('') : emptyState('', 'No vehicles match your search or filter criteria.')}
      </div>
    </div>
  `;

  // Calendar popover logic
  const pBox = $('#heroPickupBox');
  const dBox = $('#heroDropoffBox');
  const popover = $('#heroCalendarPopover');
  const sCat = $('#heroCategorySelect');
  const sBtn = $('#heroSearchBtn');

  function renderHeroCalendar() {
    if (!popover) return;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const tierLow = 1422;
    const tierMid = 1743;
    const tierHigh = 2149;

    function getHeroPriceTier(dateIso) {
      const d = new Date(dateIso + 'T00:00:00').getDay();
      if (d === 0 || d === 6) return { tier: 'high', price: tierHigh };
      if (d === 5) return { tier: 'mid', price: tierMid };
      return { tier: 'low', price: tierLow };
    }

    function buildHeroMonthHTML(year, month) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay();

      let daysHTML = '';
      for (let i = 0; i < firstDay; i++) {
        daysHTML += `<div class="cal-day cal-day-empty"></div>`;
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const mStr = String(month + 1).padStart(2, '0');
        const dStr = String(d).padStart(2, '0');
        const dateIso = `${year}-${mStr}-${dStr}`;

        const isPast = dateIso < todayStr;
        const isStart = browseStartDate === dateIso;
        const isEnd = browseEndDate === dateIso;
        const isInRange = browseStartDate && browseEndDate && dateIso > browseStartDate && dateIso < browseEndDate;
        const { tier } = getHeroPriceTier(dateIso);

        if (isPast) {
          daysHTML += `<div class="cal-day cal-day-past" data-date="${dateIso}">${d}</div>`;
        } else {
          let dayClass = `cal-day-price cal-day-price-${tier}`;
          let tileStyle = '';
          if (isStart || isEnd) {
            dayClass += ' cal-day-selected';
            if (isStart && isEnd) dayClass += ' cal-day-single';
            else if (isStart) dayClass += ' cal-day-start';
            else if (isEnd) dayClass += ' cal-day-end';
            tileStyle = 'background-color:#1e293b !important; color:#ffffff !important; font-weight:800;';
          } else if (isInRange) {
            dayClass += ' cal-day-in-range';
            tileStyle = 'background-color:#273549 !important; color:#ffffff !important; border-radius:0 !important;';
          } else if (tier === 'low') {
            tileStyle = 'background-color:#71deb5 !important; color:#0f172a !important; font-weight:700;';
          } else if (tier === 'mid') {
            tileStyle = 'background-color:#fbc072 !important; color:#0f172a !important; font-weight:700;';
          } else if (tier === 'high') {
            tileStyle = 'background-color:#fda4af !important; color:#0f172a !important; font-weight:700;';
          }

          daysHTML += `
            <div class="cal-day ${dayClass}" style="${tileStyle}" data-date="${dateIso}" data-tier="${tier}" title="${monthNames[month]} ${d}, ${year}">
              ${d}
            </div>
          `;
        }
      }

      return `
        <div class="cal-dual-panel">
          <div class="cal-weekdays">
            <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
          </div>
          <div class="cal-days-grid">${daysHTML}</div>
        </div>
      `;
    }

    const leftYear = heroCalYear;
    const leftMonth = heroCalMonth;
    let rightMonth = heroCalMonth + 1;
    let rightYear = heroCalYear;
    if (rightMonth > 11) { rightMonth = 0; rightYear++; }

    const now = new Date();
    const isPrevDisabled = (leftYear < now.getFullYear()) || (leftYear === now.getFullYear() && leftMonth <= now.getMonth());

    popover.innerHTML = `
      <div class="cal-dual-header">
        <button type="button" class="cal-nav-btn" id="heroPrevMonth" ${isPrevDisabled ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div class="cal-panel-title cal-panel-title-left">${monthNames[leftMonth]} ${leftYear}</div>
        <div class="cal-panel-title cal-panel-title-right">${monthNames[rightMonth]} ${rightYear}</div>
        <button type="button" class="cal-nav-btn" id="heroNextMonth">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
      <div class="cal-dual-months">
        ${buildHeroMonthHTML(leftYear, leftMonth)}
        ${buildHeroMonthHTML(rightYear, rightMonth)}
      </div>
      <div class="cal-price-legend">
        <div class="cal-price-legend-item">
          <span class="cal-legend-pill cal-pill-low">₱${tierLow.toLocaleString()}+</span>
        </div>
        <div class="cal-price-legend-item">
          <span class="cal-legend-pill cal-pill-mid">₱${tierMid.toLocaleString()}+</span>
        </div>
        <div class="cal-price-legend-item">
          <span class="cal-legend-pill cal-pill-high">₱${tierHigh.toLocaleString()}+</span>
        </div>
        <span class="cal-legend-note">Based on average prices of all cars.</span>
      </div>
    `;

    $('#heroPrevMonth')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isPrevDisabled) return;
      heroCalMonth--;
      if (heroCalMonth < 0) { heroCalMonth = 11; heroCalYear--; }
      renderHeroCalendar();
    });

    $('#heroNextMonth')?.addEventListener('click', (e) => {
      e.stopPropagation();
      heroCalMonth++;
      if (heroCalMonth > 11) { heroCalMonth = 0; heroCalYear++; }
      renderHeroCalendar();
    });

    const dayCells = popover.querySelectorAll('.cal-day-price');
    dayCells.forEach(cell => {
      cell.addEventListener('mouseenter', () => {
        if (browseStartDate && !browseEndDate) {
          const hovered = cell.dataset.date;
          if (hovered > browseStartDate) {
            dayCells.forEach(c => {
              const d = c.dataset.date;
              if (d > browseStartDate && d <= hovered) {
                c.classList.add('cal-day-hover-in-range');
                c.style.backgroundColor = '#273549';
                c.style.color = '#ffffff';
                c.style.borderRadius = '0';
              } else if (d > browseStartDate) {
                c.classList.remove('cal-day-hover-in-range');
                const t = c.dataset.tier;
                if (t === 'low') { c.style.backgroundColor = '#71deb5'; c.style.color = '#0f172a'; }
                else if (t === 'mid') { c.style.backgroundColor = '#fbc072'; c.style.color = '#0f172a'; }
                else if (t === 'high') { c.style.backgroundColor = '#fda4af'; c.style.color = '#0f172a'; }
                c.style.borderRadius = '8px';
              }
            });
          }
        }
      });

      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        const clicked = cell.dataset.date;
        if (!browseStartDate || (browseStartDate && browseEndDate)) {
          browseStartDate = clicked;
          browseEndDate = '';
          const pEl = $('#heroPickupDisplay');
          if (pEl) pEl.textContent = formatHeroDate(browseStartDate);
          const dEl = $('#heroDropoffDisplay');
          if (dEl) dEl.textContent = 'mm/dd/yyyy';
          renderHeroCalendar();
        } else if (clicked > browseStartDate) {
          browseEndDate = clicked;
          popover.style.display = 'none';
          pBox?.classList.remove('active');
          dBox?.classList.remove('active');
          renderBrowse(view);
          toast(`Dates selected: ${formatHeroDate(browseStartDate)} to ${formatHeroDate(browseEndDate)}`, 'success');
        } else {
          browseStartDate = clicked;
          browseEndDate = '';
          const pEl = $('#heroPickupDisplay');
          if (pEl) pEl.textContent = formatHeroDate(browseStartDate);
          renderHeroCalendar();
        }
      });
    });

    popover.addEventListener('mouseleave', () => {
      dayCells.forEach(c => {
        const d = c.dataset.date;
        if (d !== browseStartDate && d !== browseEndDate && !(browseStartDate && browseEndDate && d > browseStartDate && d < browseEndDate)) {
          c.classList.remove('cal-day-hover-in-range');
          const t = c.dataset.tier;
          if (t === 'low') { c.style.backgroundColor = '#71deb5'; c.style.color = '#0f172a'; }
          else if (t === 'mid') { c.style.backgroundColor = '#fbc072'; c.style.color = '#0f172a'; }
          else if (t === 'high') { c.style.backgroundColor = '#fda4af'; c.style.color = '#0f172a'; }
          c.style.borderRadius = '8px';
        }
      });
    });
  }

  function openHeroCalendar(activeBox) {
    if (!popover) return;
    renderHeroCalendar();
    popover.style.display = 'block';
    if (activeBox === 'pickup') {
      pBox?.classList.add('active');
      dBox?.classList.remove('active');
    } else {
      dBox?.classList.add('active');
      pBox?.classList.remove('active');
    }
  }

  pBox?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popover && popover.style.display === 'block' && pBox.classList.contains('active')) {
      popover.style.display = 'none';
      pBox.classList.remove('active');
    } else {
      openHeroCalendar('pickup');
    }
  });

  dBox?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popover && popover.style.display === 'block' && dBox.classList.contains('active')) {
      popover.style.display = 'none';
      dBox.classList.remove('active');
    } else {
      openHeroCalendar('dropoff');
    }
  });

  document.addEventListener('click', (e) => {
    if (popover && popover.style.display === 'block') {
      if (!popover.contains(e.target) && !pBox?.contains(e.target) && !dBox?.contains(e.target)) {
        popover.style.display = 'none';
        pBox?.classList.remove('active');
        dBox?.classList.remove('active');
      }
    }
  });

  if (sCat) {
    sCat.addEventListener('change', () => {
      browseFilter = sCat.value;
    });
  }

  if (sBtn) {
    sBtn.addEventListener('click', () => {
      browseFilter = sCat ? sCat.value : 'all';
      if (browseStartDate && browseEndDate && browseEndDate < browseStartDate) {
        toast('Drop-out date must be on or after Pick-up date.', 'error');
        return;
      }
      renderBrowse(view);
    });
  }

  $$('#catPills .pill').forEach(p => p.addEventListener('click', () => {
    browseFilter = p.dataset.cat;
    if (sCat) sCat.value = browseFilter;
    renderBrowse(view);
  }));

  $$('#vehicleGrid .vehicle-card').forEach(card => card.addEventListener('click', () => {
    openVehicleDetail(Number(card.dataset.id), browseStartDate, browseEndDate);
  }));

  $$('#vehicleGrid .vehicle-book-pill-btn').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openVehicleDetail(Number(btn.dataset.bookBtn), browseStartDate, browseEndDate);
  }));

  $$('#vehicleGrid .vehicle-fav-btn').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(Number(btn.dataset.favid));
  }));


}

export function vehicleCardHTML(v) {
  const exactImg = getExactVehicleImage(v);
  const fuelType = v.fuel_type ?? 'Gasoline';
  const hasAC = v.has_ac !== undefined ? v.has_ac : true;
  const rate = getVehicleDailyRate(v);
  const catName = getVehicleCategoryName(v);
  const favs = getFavorites();
  const isFav = favs.includes(v.id);
  const isAvailable = v.status === 'available';
  const seats = v.seats || (catName.toLowerCase().includes('motor') ? 2 : (catName.toLowerCase().includes('van') ? 14 : (catName.toLowerCase().includes('mpv') || catName.toLowerCase().includes('suv') ? 7 : 5)));
  const trans = v.transmission || 'Automatic';

  let cleanDesc = (v.description || '')
    .replace(/FOX Racing shocks,?\s*/gi, '')
    .replace(/\b\d+-Seater\s+(Pickup Truck|SUV|Sedan|MPV|Subcompact Sedan|Modern Crossover MPV|Economy Sedan|Hatchback|Full-size Passenger Van)\.?\s*/gi, '')
    .trim();
  if (!cleanDesc) {
    cleanDesc = `${trans} · ${fuelType} · Well-maintained and fully insured.`;
  }

  return `
    <div class="glass vehicle-card" data-id="${v.id}">
      <div class="vehicle-card-image-wrap">
        <span class="vehicle-stage-badge">${catName}</span>
        <img class="vehicle-card-img" id="cardImg-${v.id}" src="${exactImg}" alt="${v.name}" onerror="this.src='${exactImg}'" loading="lazy" />
        <button type="button" class="vehicle-fav-btn ${isFav ? 'active' : ''}" data-favid="${v.id}" title="${isFav ? 'Remove from Favorites' : 'Save to Favorites'}">
          <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
        </button>
      </div>
      <div class="vehicle-card-content">
        <h3 class="vehicle-card-name">${v.name}</h3>
        
        <div class="vehicle-specs-row">
          <span class="v-spec-pill">${seats} Seats</span>
          <span class="v-spec-pill">${trans}</span>
          <span class="v-spec-pill">${fuelType}</span>
          <span class="v-spec-pill">${hasAC ? 'Aircon' : 'Non-AC'}</span>
        </div>

        <p class="vehicle-card-desc">
          ${cleanDesc}
        </p>

        <div class="vehicle-card-price-row">
          <div class="vehicle-card-price">
            ${fmtMoney(rate)} <span class="price-unit">/ day</span>
          </div>
          <span class="badge ${isAvailable ? 'badge-available' : 'badge-rented'}">
            <span class="status-dot"></span>
            ${isAvailable ? 'Available' : 'Booked'}
          </span>
        </div>
        <button type="button" class="btn btn-primary vehicle-book-pill-btn" data-book-btn="${v.id}">
          <span>View Deal</span>
        </button>
      </div>
    </div>
  `;
}
