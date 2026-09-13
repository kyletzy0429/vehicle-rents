import { supabase } from './config.js';
import { state } from './state.js';
import { $, $$, fmtMoney, maskPlate, toast, emptyState } from './utils.js';
import { openVehicleDetail } from './booking.js';

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

export function renderBrowse(view) {
  const cats = ['all', ...state.categories.map(c => c.name)];
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
      <div class="section-head">
        <div>
          <h2>Available Vehicles</h2>
          <p>Find the perfect vehicle for your trip, check dates, and request a booking online.</p>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="badge badge-available" style="padding:6px 14px;font-size:0.82rem;box-shadow:0 2px 8px rgba(5,150,105,0.15);">
            <i class="fa-solid fa-circle-check" style="color:#059669;"></i> ${availableCount} Ready &amp; Available
          </span>
        </div>
      </div>
      <div class="search-bar">
        <div style="position:relative;flex:1;">
          <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8;"></i>
          <input type="text" id="vSearch" style="padding-left:40px;" placeholder="Search by model, brand, or features…" value="${browseSearch}" />
        </div>
      </div>
      <div class="pill-row" style="margin-bottom:8px;">
        <div class="pill ${browseStatusFilter === 'all' ? 'active' : ''}" data-status="all">All Vehicles</div>
        <div class="pill ${browseStatusFilter === 'available' ? 'active' : ''}" data-status="available" style="${browseStatusFilter === 'available' ? 'background:#059669;color:#fff;font-weight:700;' : 'border-color:#a7f3d0;color:#047857;background:#ecfdf5;font-weight:600;'}">
          <i class="fa-solid fa-circle-check"></i> Available Only (${availableCount})
        </div>
      </div>
      <div class="pill-row" id="catPills">
        ${cats.map(c => `<div class="pill ${browseFilter === c ? 'active' : ''}" data-cat="${c}">${c === 'all' ? 'All Categories' : c}</div>`).join('')}
      </div>
      <div class="grid grid-vehicles" id="vehicleGrid">
        ${filtered.length ? filtered.map(vehicleCardHTML).join('') : emptyState('fa-solid fa-car', 'No vehicles match your search or filter.')}
      </div>
    </div>
  `;

  $('#vSearch').addEventListener('input', (e) => { browseSearch = e.target.value; renderBrowse(view); });
  $$('[data-status]').forEach(p => p.addEventListener('click', () => { browseStatusFilter = p.dataset.status; renderBrowse(view); }));
  $$('#catPills .pill').forEach(p => p.addEventListener('click', () => { browseFilter = p.dataset.cat; renderBrowse(view); }));
  $$('#vehicleGrid .vehicle-card').forEach(card => card.addEventListener('click', () => openVehicleDetail(Number(card.dataset.id))));
  $$('#vehicleGrid .fav-heart-btn').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(Number(btn.dataset.favid));
  }));
  $$('#vehicleGrid .card-angle-btn').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const cardId = btn.dataset.cardid;
    const angle = btn.dataset.angle;
    const imgEl = document.getElementById(`cardImg-${cardId}`);
    if (imgEl) {
      imgEl.className = `vehicle-img ${angle === 'side' ? 'side-view' : (angle === 'rear' ? 'rear-view' : '')}`;
    }
    const parent = btn.closest('.card-angle-dots');
    if (parent) {
      parent.querySelectorAll('.card-angle-btn').forEach(b => {
        b.style.color = '#64748b';
        b.style.fontWeight = '600';
      });
      btn.style.color = '#2563eb';
      btn.style.fontWeight = '700';
    }
  }));
}

export function vehicleCardHTML(v) {
  const exactImg = getExactVehicleImage(v);
  const fuelType = v.fuel_type ?? 'Gasoline';
  const hasAC = v.has_ac !== undefined ? v.has_ac : true;
  const rate = getVehicleDailyRate(v);
  const catName = getVehicleCategoryName(v);
  const isMotorcycle = catName === 'Motorcycles' || (v.name || '').toLowerCase().includes('motor') || (v.name || '').toLowerCase().includes('click') || (v.name || '').toLowerCase().includes('nmax') || (v.name || '').toLowerCase().includes('adv');

  const favs = getFavorites();
  const isFav = favs.includes(v.id);

  const isAvailable = v.status === 'available';
  const isRented = v.status === 'rented';
  const isMaintenance = v.status === 'maintenance';

  let statusClass = 'badge-available';
  let badgeContent = '';
  if (isAvailable) {
    statusClass = 'badge-available';
    badgeContent = `<i class="fa-solid fa-circle-check" style="color:#059669;"></i> Available`;
  } else if (isRented) {
    statusClass = 'badge-rented';
    badgeContent = `<i class="fa-solid fa-clock" style="color:#dc2626;"></i> Rented`;
  } else if (isMaintenance) {
    statusClass = 'badge-maintenance';
    badgeContent = `<i class="fa-solid fa-wrench" style="color:#ca8a04;"></i> Maintenance ${v.maintenance_days ? `(${v.maintenance_days}d)` : ''}`;
  } else {
    statusClass = `badge-${v.status}`;
    badgeContent = `<i class="fa-solid fa-car-side"></i> ${v.status}`;
  }

  return `
    <div class="glass vehicle-card" data-id="${v.id}">
      <div class="vehicle-img-wrapper">
        <img class="vehicle-img" id="cardImg-${v.id}" src="${exactImg}" alt="${v.name}" onerror="this.src='${exactImg}'" loading="lazy" />
        <div class="fav-heart-btn ${isFav ? 'active' : ''}" data-favid="${v.id}" title="${isFav ? 'Remove from Favorites' : 'Save to Favorites'}">
          <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart" style="color:${isFav ? '#e11d48' : '#64748b'};font-size:0.95rem;"></i>
        </div>
        <div class="vehicle-badge-pos">
          <span class="badge ${statusClass}">${badgeContent}</span>
        </div>
        <div class="card-angle-dots">
          <button type="button" class="card-angle-btn active" data-cardid="${v.id}" data-angle="front" title="Front View" style="border:none;background:none;cursor:pointer;padding:0 3px;font-size:0.68rem;font-weight:700;color:#2563eb;">Front</button>
          <span style="color:#cbd5e1;font-size:0.65rem;">·</span>
          <button type="button" class="card-angle-btn" data-cardid="${v.id}" data-angle="side" title="Side View" style="border:none;background:none;cursor:pointer;padding:0 3px;font-size:0.68rem;font-weight:600;color:#64748b;">Side</button>
          <span style="color:#cbd5e1;font-size:0.65rem;">·</span>
          <button type="button" class="card-angle-btn" data-cardid="${v.id}" data-angle="rear" title="Rear Perspective" style="border:none;background:none;cursor:pointer;padding:0 3px;font-size:0.68rem;font-weight:600;color:#64748b;">Rear</button>
        </div>
      </div>
      <div class="vehicle-body">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span class="vehicle-cat-tag"><i class="fa-solid fa-layer-group"></i> ${catName}</span>
          <span style="font-size:0.75rem;color:#64748b;font-weight:600;"><i class="fa-solid fa-id-card"></i> ${maskPlate(v.plate_number)}</span>
        </div>
        <div class="vehicle-name">${v.name}</div>
        <div class="vehicle-meta">
          <span><i class="fa-solid fa-users" style="color:#2563eb;"></i> ${isMotorcycle ? '2 Seats' : (v.seats ?? '5 Seats')}</span>
          <span><i class="fa-solid fa-gear" style="color:#2563eb;"></i> ${v.transmission ?? 'Automatic'}</span>
          <span><i class="fa-solid fa-gas-pump" style="color:#2563eb;"></i> ${fuelType}</span>
          <span><i class="fa-solid fa-${isMotorcycle ? 'helmet-safety' : (hasAC ? 'snowflake' : 'fan')}" style="color:${isMotorcycle ? '#059669' : '#2563eb'};"></i> ${isMotorcycle ? 'Helmet' : (hasAC ? 'AC' : 'Non-AC')}</span>
        </div>
        <div class="vehicle-foot">
          <div class="rate">${fmtMoney(rate)} <span>/ day</span></div>
          <button class="btn btn-sm ${isAvailable ? 'btn-primary' : 'btn-ghost'}">
            ${isAvailable ? '<i class="fa-solid fa-calendar-plus"></i> Rent Now' : '<i class="fa-solid fa-eye"></i> Details'}
          </button>
        </div>
      </div>
    </div>
  `;
}
