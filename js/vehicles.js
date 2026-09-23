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
    description: '7-Seater Premium Diesel SUV. High ground clearance, leather seats, dual aircon. Ideal for family trips across the Philippines.'
  },
  {
    name: 'Toyota Vios 1.5 G CVT',
    plate_number: 'NCO-2914',
    status: 'available',
    image_url: 'images/vios.webp',
    description: '5-Seater Subcompact Sedan. Excellent fuel efficiency, automatic transmission. Best choice for city driving and errands.'
  },
  {
    name: 'Toyota Innova 2.8 E Diesel AT',
    plate_number: 'DAR-4921',
    status: 'available',
    image_url: 'images/innova.webp',
    description: '8-Seater MPV. Powerful 2.8L Diesel engine with dual AC. Spacious and reliable family vehicle.'
  },
  {
    name: 'Mitsubishi Montero Sport GT 4x2',
    plate_number: 'NGF-7102',
    status: 'available',
    image_url: 'images/montero.webp',
    description: '7-Seater SUV. 2.4L MIVEC Turbo Diesel engine, smooth 8-speed automatic, sunroof.'
  },
  {
    name: 'Ford Ranger Raptor 2.0L Bi-Turbo',
    plate_number: 'CBL-9481',
    status: 'available',
    image_url: 'images/raptor.webp',
    description: '5-Seater Pickup Truck. FOX Racing shocks, 4x4 Off-road mode. Great for heavy loads and provincial roads.'
  },
  {
    name: 'Mitsubishi Xpander GLS 1.5 AT',
    plate_number: 'NBF-3910',
    status: 'available',
    image_url: 'images/xpander.webp',
    description: '7-Seater Modern Crossover MPV. Spacious 3-row seating, flexible cargo space, high ground clearance.'
  },
  {
    name: 'Mitsubishi Mirage G4 GLX AT',
    plate_number: 'NDB-5012',
    status: 'available',
    image_url: 'images/mirage.webp',
    description: '5-Seater Economy Sedan. Highly fuel-efficient 1.2L engine. Compact and easy to drive in city traffic.'
  },
  {
    name: 'Toyota Wigo 1.0 G CVT',
    plate_number: 'NCL-1049',
    status: 'available',
    image_url: 'images/wigo.webp',
    description: '5-Seater Hatchback. Compact city hatchback with agile handling and low gas consumption.'
  },
  {
    name: 'Toyota HiAce Commuter Deluxe 2.8',
    plate_number: 'VAA-8012',
    status: 'available',
    image_url: 'images/hiace.webp',
    description: '14-Seater Full-size Passenger Van. Front engine layout, strong rear AC. Ideal for group tours and outings.'
  },
  {
    name: 'Yamaha NMAX 155 ABS (Motorcycle)',
    plate_number: '128-NMX',
    status: 'available',
    image_url: 'images/nmax.webp',
    description: '155cc Automatic Maxi Scooter. Variable Valve Actuation (VVA), ABS front/rear, digital panel. Premium scooter.'
  },
  {
    name: 'Honda Click 125i (Motorcycle)',
    plate_number: '904-CLK',
    status: 'available',
    image_url: 'images/click.webp',
    description: '125cc Automatic Scooter. Sporty design, combi-brake system, spacious under-seat storage box.'
  },
  {
    name: 'Honda ADV 160 (Motorcycle)',
    plate_number: '481-ADV',
    status: 'available',
    image_url: 'images/adv.webp',
    description: '160cc Adventure Scooter. Long-travel suspension, HSTC torque control, adjustable windshield.'
  }
];

export const PH_CATEGORIES = [
  { name: 'Motorcycles', daily_rate: 500, description: 'Automatic scooters & motorbikes (Honda Click 125i @ ₱400, Yamaha NMAX 155 @ ₱500, Honda ADV 160 @ ₱600)' },
  { name: 'Economy & Hatchbacks', daily_rate: 2200, description: 'Compact fuel-efficient hatchbacks & sedans (Toyota Wigo, Mitsubishi Mirage G4)' },
  { name: 'Sedans', daily_rate: 2500, description: '5-Seater comfortable subcompact sedans (Toyota Vios 1.5 G)' },
  { name: 'MPVs & Crossovers', daily_rate: 3000, description: '7 to 8-Seater family MPVs (Toyota Innova, Mitsubishi Xpander)' },
  { name: 'SUVs & Pickups', daily_rate: 4200, description: 'Midsize 7-Seater SUVs & Pickup Trucks (Toyota Fortuner, Montero Sport, Ford Ranger Raptor)' },
  { name: 'Passenger Vans', daily_rate: 5000, description: '14-Seater full-size passenger vans for tours and group trips (Toyota HiAce Commuter Deluxe)' }
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
      supabase.from('categories').update({ daily_rate: 500, description: 'Automatic scooters & motorbikes (Honda Click 125i @ ₱400, Yamaha NMAX 155 @ ₱500, Honda ADV 160 @ ₱600)' }).eq('id', motorCat.id).then(() => { }).catch(() => { });
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
        <p class="hero-subtitle">Choose your dates to see what's open, then reserve on the spot.</p>

        <div class="hero-filter-card">
          <div class="hero-filter-field">
            <label for="heroStartDate">Pick-up</label>
            <input type="date" id="heroStartDate" value="${browseStartDate}" min="${todayStr}" />
          </div>
          <div class="hero-filter-divider"></div>
          <div class="hero-filter-field">
            <label for="heroEndDate">Drop-out</label>
            <input type="date" id="heroEndDate" value="${browseEndDate}" min="${browseStartDate || todayStr}" />
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
        </div>
      </div>

      <!-- Quick category filter pills -->
      <div class="pill-row" id="catPills" style="margin-bottom:24px;">
        <div class="pill ${browseFilter === 'all' ? 'active' : ''}" data-cat="all">All Fleet (${state.vehicles.length})</div>
        ${state.categories.map(c => `<div class="pill ${browseFilter.toLowerCase() === c.name.toLowerCase() ? 'active' : ''}" data-cat="${c.name}">${c.name}</div>`).join('')}
      </div>

      <!-- Vehicle Cards Grid -->
      <div class="grid grid-vehicles" id="vehicleGrid">
        ${filtered.length ? filtered.map(vehicleCardHTML).join('') : emptyState('', 'No vehicles match your search or filter criteria.')}
      </div>
    </div>
  `;

  const sStart = $('#heroStartDate');
  const sEnd = $('#heroEndDate');
  const sCat = $('#heroCategorySelect');
  const sBtn = $('#heroSearchBtn');

  if (sStart) {
    sStart.addEventListener('change', () => {
      browseStartDate = sStart.value;
      if (sEnd && sStart.value) sEnd.min = sStart.value;
    });
  }
  if (sEnd) {
    sEnd.addEventListener('change', () => {
      browseEndDate = sEnd.value;
    });
  }
  if (sCat) {
    sCat.addEventListener('change', () => {
      browseFilter = sCat.value;
    });
  }
  if (sBtn) {
    sBtn.addEventListener('click', () => {
      browseStartDate = sStart ? sStart.value : '';
      browseEndDate = sEnd ? sEnd.value : '';
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

  return `
    <div class="glass vehicle-card" data-id="${v.id}">
      <div class="vehicle-card-image-wrap">
        <img class="vehicle-card-img" id="cardImg-${v.id}" src="${exactImg}" alt="${v.name}" onerror="this.src='${exactImg}'" loading="lazy" />
        <button type="button" class="vehicle-fav-btn ${isFav ? 'active' : ''}" data-favid="${v.id}" title="${isFav ? 'Remove from Favorites' : 'Save to Favorites'}">
          <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
        </button>
      </div>
      <div class="vehicle-card-content">
        <div class="vehicle-card-category">${catName.toUpperCase()}</div>
        <h3 class="vehicle-card-name">${v.name}</h3>
        <div class="vehicle-card-rating">
          <span class="stars">★★★★★</span>
          <span class="rating-count">(5.0)</span>
        </div>
        <p class="vehicle-card-desc">
          ${v.description || `${v.seats || 5}-Seater · ${v.transmission || 'Automatic'} · ${fuelType} · ${hasAC ? 'Air Conditioned' : 'Comfortable'}`}
        </p>
        <div class="vehicle-card-price-row">
          <div class="vehicle-card-price">
            ${fmtMoney(rate)} <span class="price-unit">/ day</span>
          </div>
          <span class="badge ${isAvailable ? 'badge-available' : 'badge-rented'}">
            ${isAvailable ? 'Available' : 'Booked'}
          </span>
        </div>
        <button type="button" class="btn btn-primary vehicle-book-pill-btn" data-book-btn="${v.id}">
          Book Now
        </button>
      </div>
    </div>
  `;
}
