// ============================================================
// DATE HELPERS (everything derives from TRIP.startDate)
// ============================================================
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function tripDate(offset) {
  const d = new Date(TRIP.startDate + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return d;
}
function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dayLabel(offset) {
  const d = tripDate(offset);
  return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`;
}
function dayCount() { return ITIN.length; }
function todayInfo() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = tripDate(0);
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const diff = Math.round((today - s) / 86400000);
  if (diff < 0)             return { state:'before', daysUntil:-diff, dayN:null };
  if (diff < dayCount())    return { state:'during', dayN:diff+1 };
  return { state:'after', dayN:null };
}
function htmlEscape(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function attrEscape(s) { return htmlEscape(s); }
function directionsUrl(s) { return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`; }

// ---- Geocoding / place search ----
// Primary: Photon (komoot) — free, no key, good at fuzzy text & POIs/business
// names. Biased toward Malta. Falls back to Nominatim if Photon returns nothing.
const MALTA_BIAS = { lat: 35.92, lon: 14.42 };

async function photonSuggest(query, limit = 6) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}&lang=en&lat=${MALTA_BIAS.lat}&lon=${MALTA_BIAS.lon}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const d = await r.json();
  if (!d || !Array.isArray(d.features)) return [];
  return d.features.map(f => {
    const p = f.properties || {};
    const c = (f.geometry && f.geometry.coordinates) || [];
    const lng = c[0], lat = c[1];
    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    const primary = p.name || street || p.city || p.country || 'Unknown place';
    const place = p.city || p.town || p.village || p.district || p.locality || p.county;
    const ctx = [...new Set([
      street && street !== primary ? street : null,
      place && place !== primary ? place : null,
      p.state && p.state !== place ? p.state : null,
      p.country
    ].filter(Boolean))].join(', ');
    return { lat, lng, primary, context: ctx, label: ctx ? `${primary}, ${ctx}` : primary };
  }).filter(x => isFinite(x.lat) && isFinite(x.lng));
}

async function nominatimSuggest(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=mt&addressdetails=1&q=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!r.ok) return [];
  const d = await r.json();
  return (d || []).map(x => {
    const parts = (x.display_name || '').split(',').map(s => s.trim());
    return { lat: parseFloat(x.lat), lng: parseFloat(x.lon), primary: parts[0] || x.display_name,
             context: parts.slice(1, 3).join(', '), label: x.display_name };
  });
}

// list of candidate places for the autocomplete dropdown
async function geocodeSuggest(query) {
  try { const r = await photonSuggest(query); if (r.length) return r; } catch (e) {}
  try { return await nominatimSuggest(query); } catch (e) { return []; }
}

// single best match (used by "Find on map" and auto-pin on save)
async function geocode(query) {
  const list = await geocodeSuggest(query);
  return list.length ? { lat: list[0].lat, lng: list[0].lng, label: list[0].label } : null;
}
function genId(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 9); }
function legacyKey(dayN, name) { return `d${dayN}_${name.replace(/[^a-z0-9]/gi,'_')}`; }

// ============================================================
// STATE
// ============================================================
let state = {
  checked: JSON.parse(localStorage.getItem('malta_checked') || '{}'),
  notes: JSON.parse(localStorage.getItem('malta_notes') || '{}'),
  budget: parseFloat(localStorage.getItem('malta_budget') || '0'),
  expenses: JSON.parse(localStorage.getItem('malta_expenses') || '[]'),
  packing: JSON.parse(localStorage.getItem('malta_packing') || '{}'),
  packingCustom: JSON.parse(localStorage.getItem('malta_packing_custom') || '{}'),
  budgetMode: localStorage.getItem('malta_budget_mode') || '',   // '' = auto · 'even' · 'smart'
};
function save(key, val) {
  localStorage.setItem('malta_' + key, typeof val === 'object' ? JSON.stringify(val) : val);
  scheduleFileSave();
}

// ---- Itinerary: a mutable, persisted working copy seeded from DAYS ----
// Estimated per-stop costs from the seed data, keyed by stop id. Lets the
// Smart budget calculator work even for itineraries saved before costs existed.
const SEED_COST = (() => {
  const m = {};
  DAYS.forEach(day => day.stops.forEach(s => {
    if (!s.ph && s.name && typeof s.cost === 'number') m[legacyKey(day.n, s.name)] = s.cost;
  }));
  return m;
})();
function backfillCosts(itin) {
  let changed = false;
  itin.forEach(day => (day.items || []).forEach(it => {
    if (!it.ph && it.cost == null && SEED_COST[it.id] != null) { it.cost = SEED_COST[it.id]; changed = true; }
  }));
  return changed;
}
let ITIN = loadItinerary();
function seedItinerary() {
  return DAYS.map(day => ({
    id: 'day_' + day.n,
    title: day.title,
    zone: day.zone || '',
    color: day.color || '#2176c7',
    items: day.stops.map(s => s.ph
      ? { id: genId('p'), ph: s.ph }
      // keep the original stable key so existing checks/notes carry over
      : { id: legacyKey(day.n, s.name), t: s.t || 'a', name: s.name, time: s.time || '',
          addr: s.addr || '', lat: s.lat, lng: s.lng, note: s.note || '',
          cost: (typeof s.cost === 'number' ? s.cost : undefined) })
  }));
}
function loadItinerary() {
  const raw = localStorage.getItem('malta_itinerary');
  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p) && p.length) {
        if (backfillCosts(p)) localStorage.setItem('malta_itinerary', JSON.stringify(p));
        return p;
      }
    } catch(e){}
  }
  const seeded = seedItinerary();
  localStorage.setItem('malta_itinerary', JSON.stringify(seeded));
  return seeded;
}
function saveItinerary() { localStorage.setItem('malta_itinerary', JSON.stringify(ITIN)); scheduleFileSave(); }

// ============================================================
// THEME
// ============================================================
function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('malta_theme', next);
  updateThemeBtn();
}
function updateThemeBtn() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const b = document.getElementById('themeToggle');
  if (b) { b.textContent = dark ? '☀️' : '🌙'; b.title = dark ? 'Switch to light mode' : 'Switch to dark mode'; }
}

// ============================================================
// COUNTDOWN
// ============================================================
function cdUnit(n, l) { return `<div class="cd-unit"><div class="cd-num">${n}</div><div class="cd-u-l">${l}</div></div>`; }
function updateCountdown() {
  const el = document.getElementById('countdown');
  if (!el) return;
  const info = todayInfo();
  if (info.state === 'before') {
    let ms = tripDate(0) - new Date();
    const dys = Math.floor(ms / 86400000); ms -= dys * 86400000;
    const hrs = Math.floor(ms / 3600000);  ms -= hrs * 3600000;
    const min = Math.floor(ms / 60000);    ms -= min * 60000;
    const sec = Math.floor(ms / 1000);
    el.innerHTML = `<div class="cd-label">✈️ Countdown to Malta</div>
      <div class="cd-units">${cdUnit(dys,'Days')}${cdUnit(hrs,'Hrs')}${cdUnit(min,'Min')}${cdUnit(sec,'Sec')}</div>`;
  } else if (info.state === 'during') {
    el.innerHTML = `<div class="cd-live">🌊 Day ${info.dayN} of ${dayCount()} — you're in Malta!</div>`;
  } else {
    el.innerHTML = `<div class="cd-live">🎉 Trip complete — hope it was amazing!</div>`;
  }
}

// ============================================================
// ITINERARY (render + edit + drag)
// ============================================================
const ICONS = { a:'📍', f:'🍽️', n:'🌙', m:'⭐' };
// Day header photos (bundled, offline). Keyed by the seeded day id.
const DAY_PHOTOS = {
  day_1:'images/day1.jpg',  day_2:'images/day2.jpg',  day_3:'images/day3.jpg',
  day_4:'images/day4.jpg',  day_5:'images/day5.jpg',  day_6:'images/day6.jpg',
  day_7:'images/day7.jpg',  day_8:'images/day8.jpg',  day_9:'images/day9.jpg',
  day_10:'images/day10.jpg'
};
function dayPhoto(day) { return DAY_PHOTOS[day.id] || ''; }
const TYPE_LABEL = { a:'Attraction', f:'Food', n:'Evening', m:'Must-see ★' };
let openDays = new Set();        // (legacy) dayIds expanded
let selectedDay = 0;             // index of the day shown in the carousel detail
let editId = null;               // item being edited
let addDayId = null;             // day showing the "new stop" form

function buildItinerary() {
  // default open state: today's day if mid-trip
  const info = todayInfo();
  if (info.state === 'during') openDays.add('day_' + info.dayN); // best effort for seed ids
  renderItinerary();
}

function renderItinerary() {
  const container = document.getElementById('dayCards');
  const info = todayInfo();

  // header stats
  let totalStops = 0, mustCount = 0;
  ITIN.forEach(day => day.items.forEach(it => { if (!it.ph) { totalStops++; if (it.t === 'm') mustCount++; } }));
  document.getElementById('totalStops').textContent = totalStops;
  document.getElementById('mustCount').textContent = mustCount;

  const jumpWrap = document.getElementById('jumpToday');
  if (info.state === 'during') jumpWrap.innerHTML = `<button class="jump-today-btn" onclick="scrollToToday()">Today · Day ${info.dayN}</button>`;
  else if (info.state === 'before') jumpWrap.innerHTML = `<span class="days-to-go">${info.daysUntil} day${info.daysUntil===1?'':'s'} to go</span>`;
  else jumpWrap.innerHTML = '';

  if (selectedDay >= ITIN.length) selectedDay = Math.max(0, ITIN.length - 1);
  container.innerHTML = '';

  // ---- swipeable carousel of days ----
  const carousel = document.createElement('div');
  carousel.className = 'day-carousel';
  ITIN.forEach((day, di) => {
    const dayN = di + 1;
    const isToday = info.state === 'during' && info.dayN === dayN;
    const stops = day.items.filter(it => !it.ph);
    const checked = stops.filter(it => state.checked[it.id]).length;
    const photo = dayPhoto(day);
    const card = document.createElement('button');
    card.className = 'dc-card' + (di === selectedDay ? ' active' : '') + (isToday ? ' today' : '');
    card.dataset.dayIdx = di;
    if (photo) card.style.backgroundImage = `url('${photo}')`;
    else if (day.color) card.style.backgroundColor = day.color;
    card.innerHTML = `
      <div class="dc-scrim"></div>
      <div class="dc-top"><span class="dc-num">Day ${dayN}</span>${isToday ? '<span class="today-badge">● Today</span>' : ''}</div>
      <div class="dc-bot">
        <div class="dc-title">${htmlEscape(day.title)}</div>
        <div class="dc-meta">${dayLabel(di)} · <span id="dayCount_${day.id}">${checked}/${stops.length}</span></div>
      </div>`;
    card.addEventListener('click', () => { selectedDay = di; renderItinerary(); });
    carousel.appendChild(card);
  });
  container.appendChild(carousel);

  // ---- selected day detail (timeline) ----
  const day = ITIN[selectedDay];
  if (day) {
    const di = selectedDay;
    const stops = day.items.filter(it => !it.ph);
    const checked = stops.filter(it => state.checked[it.id]).length;
    const plan = estForDay(di);
    const hasCoords = day.items.some(it => !it.ph && it.lat != null);
    const detail = document.createElement('div');
    detail.className = 'day-detail card';
    detail.innerHTML = `
      <div class="dd-head">
        <div>
          <div class="dd-title">${htmlEscape(day.title)}</div>
          <div class="dd-sub">${dayLabel(di)}${day.zone ? ` · ${htmlEscape(day.zone)}` : ''} · ${checked}/${stops.length} done${plan > 0 ? ` · plan €${plan}` : ''}</div>
        </div>
        <button class="icon-btn del" title="Delete day" data-del-day="${day.id}">🗑️</button>
      </div>
      ${hasCoords ? `<button class="tbtn dd-route" onclick="showDayOnMap(${di + 1})">🗺️ Show route on map</button>` : ''}`;
    const itemsWrap = document.createElement('div');
    itemsWrap.className = 'day-items';
    itemsWrap.dataset.dayId = day.id;
    day.items.forEach(it => {
      itemsWrap.appendChild(it.id === editId ? renderStopForm(day.id, it) : renderItemRow(day.id, it));
    });
    detail.appendChild(itemsWrap);
    if (addDayId === day.id) {
      detail.appendChild(renderStopForm(day.id, null));
    } else {
      const addRow = document.createElement('div');
      addRow.className = 'add-row';
      addRow.innerHTML = `
        <button class="tbtn" data-add-stop="${day.id}">➕ Add stop</button>
        <button class="tbtn" data-add-phase="${day.id}">＃ Add section</button>`;
      detail.appendChild(addRow);
    }
    container.appendChild(detail);

    detail.querySelector('[data-del-day]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${day.title}" and all its stops?`)) return;
      ITIN.splice(di, 1);
      if (selectedDay >= ITIN.length) selectedDay = Math.max(0, ITIN.length - 1);
      commitItinerary();
    });
  }

  // "add day" button
  const addDayBtn = document.createElement('button');
  addDayBtn.className = 'tbtn primary add-day-btn';
  addDayBtn.textContent = '➕ Add a day';
  addDayBtn.onclick = addDay;
  container.appendChild(addDayBtn);

  wireItemButtons(container);
  updateProgress();
}

function renderItemRow(dayId, it) {
  const row = document.createElement('div');
  if (it.ph) {
    row.className = 'item-row phase-row';
    row.dataset.itemId = it.id;
    row.innerHTML = `
      <div class="phase-label">${htmlEscape(it.ph)}</div>
      <div class="row-actions">
        <span class="row-link" data-edit-phase="${dayId}|${it.id}">✏️ Rename</span>
        <span class="row-link del" data-del-item="${dayId}|${it.id}">✕ Remove</span>
      </div>`;
    return row;
  }
  const iconClass = it.t === 'm' ? 'must' : it.t === 'f' ? 'food' : it.t === 'n' ? 'night' : 'attraction';
  const noteVal = state.notes[it.id] || '';
  row.className = 'item-row stop-row';
  row.dataset.itemId = it.id;
  row.innerHTML = `
    <div class="stop-check"><input type="checkbox" data-key="${it.id}" ${state.checked[it.id] ? 'checked' : ''} /></div>
    <div class="stop-icon ${iconClass}">${ICONS[it.t]||'📍'}</div>
    <div class="stop-content">
      <div class="stop-name-row">
        <span class="stop-name${state.checked[it.id]?' done':''}" id="sn_${it.id}">${htmlEscape(it.name)}</span>
        ${it.time ? `<span class="stop-time">${htmlEscape(it.time)}</span>` : ''}
        ${it.cost != null ? `<span class="stop-cost${it.cost > 0 ? '' : ' free'}">${it.cost > 0 ? '~€' + it.cost : 'free'}</span>` : ''}
        ${it.t==='m' ? '<span class="stop-must">★ your spot</span>' : ''}
      </div>
      ${it.addr ? `<div class="stop-addr">📍 ${htmlEscape(it.addr)}</div>` : ''}
      ${it.note ? `<div class="stop-note">${htmlEscape(it.note)}</div>` : ''}
      <div class="stop-actions">
        ${it.lat ? `<a class="stop-link" href="${directionsUrl(it)}" target="_blank" rel="noopener">🧭 Directions</a>` : ''}
        <span class="note-toggle" data-note-toggle="${it.id}">✏️ ${noteVal ? 'Edit note' : 'Add note'}</span>
        <span class="row-link" data-edit-item="${dayId}|${it.id}">✎ Edit</span>
        <span class="row-link del" data-del-item="${dayId}|${it.id}">✕ Remove</span>
      </div>
      <div class="note-area${noteVal ? ' open' : ''}" id="na_${it.id}">
        <textarea class="stop-note-input" placeholder="Your memory or note about this place..." data-note-key="${it.id}" rows="2">${htmlEscape(noteVal)}</textarea>
      </div>
    </div>`;
  return row;
}

function renderStopForm(dayId, it) {
  const wrap = document.createElement('div');
  wrap.className = 'stop-form';
  const v = it || { t:'a', name:'', time:'', addr:'', note:'', lat:'', lng:'', cost:'' };
  wrap.innerHTML = `
    <div class="full"><label>Name *</label><input id="f_name" value="${attrEscape(v.name)}" placeholder="e.g. Blue Grotto boat trip" /></div>
    <div><label>Type</label>
      <select id="f_type">
        <option value="a"${v.t==='a'?' selected':''}>📍 Attraction</option>
        <option value="f"${v.t==='f'?' selected':''}>🍽️ Food</option>
        <option value="n"${v.t==='n'?' selected':''}>🌙 Evening</option>
        <option value="m"${v.t==='m'?' selected':''}>⭐ Must-see</option>
      </select>
    </div>
    <div><label>Time</label><input id="f_time" value="${attrEscape(v.time)}" placeholder="e.g. 09:00–11:00" /></div>
    <div><label>Est. cost €</label><input id="f_cost" type="number" min="0" step="1" value="${v.cost ?? ''}" placeholder="for both of you" /></div>
    <div class="full addr-field"><label>Address</label><input id="f_addr" autocomplete="off" value="${attrEscape(v.addr)}" placeholder="Start typing a place… e.g. Blue Grotto" />
      <div class="ac-list" id="addrAC"></div>
    </div>
    <div class="full geo-row">
      <button class="tbtn" data-geocode="1">🔎 Find on map from address</button>
      <span class="geo-status" id="f_geostatus">Leave coordinates blank — they fill in automatically from the address when you save.</span>
    </div>
    <div class="full"><label>Note</label><textarea id="f_note" placeholder="Tips, prices, booking...">${htmlEscape(v.note)}</textarea></div>
    <div><label>Latitude <span class="muted">(auto)</span></label><input id="f_lat" value="${v.lat ?? ''}" placeholder="auto from address" /></div>
    <div><label>Longitude <span class="muted">(auto)</span></label><input id="f_lng" value="${v.lng ?? ''}" placeholder="auto from address" /></div>
    <div class="stop-form-actions">
      <button class="tbtn" data-form-cancel="1">Cancel</button>
      <button class="tbtn primary" data-form-save="${dayId}|${it ? it.id : ''}">${it ? 'Save changes' : 'Add stop'}</button>
    </div>`;
  return wrap;
}

function wireItemButtons(container) {
  // checkboxes
  container.querySelectorAll('input[type=checkbox][data-key]').forEach(cb => {
    cb.addEventListener('change', function() {
      state.checked[this.dataset.key] = this.checked;
      save('checked', state.checked);
      const sn = document.getElementById('sn_' + this.dataset.key);
      if (sn) sn.className = 'stop-name' + (this.checked ? ' done' : '');
      updateProgress(); updateAllDayCounts(); updateMapMarkers(); refreshLocReadout();
    });
  });
  // note textareas
  container.querySelectorAll('textarea[data-note-key]').forEach(ta => {
    ta.addEventListener('input', function() {
      state.notes[this.dataset.noteKey] = this.value;
      save('notes', state.notes);
    });
  });
  container.querySelectorAll('[data-note-toggle]').forEach(el => {
    el.addEventListener('click', () => document.getElementById('na_' + el.dataset.noteToggle).classList.toggle('open'));
  });
  // edit / delete / forms
  container.querySelectorAll('[data-edit-item]').forEach(el => el.addEventListener('click', () => {
    const [, itemId] = el.dataset.editItem.split('|'); editId = itemId; addDayId = null; renderItinerary();
  }));
  container.querySelectorAll('[data-del-item]').forEach(el => el.addEventListener('click', () => {
    const [dayId, itemId] = el.dataset.delItem.split('|');
    const day = ITIN.find(d => d.id === dayId); if (!day) return;
    if (!confirm('Remove this item?')) return;
    day.items = day.items.filter(i => i.id !== itemId);
    commitItinerary();
  }));
  container.querySelectorAll('[data-edit-phase]').forEach(el => el.addEventListener('click', () => {
    const [dayId, itemId] = el.dataset.editPhase.split('|');
    const day = ITIN.find(d => d.id === dayId); const it = day && day.items.find(i => i.id === itemId);
    if (!it) return;
    const v = prompt('Section label:', it.ph); if (v === null) return;
    it.ph = v.trim() || it.ph; commitItinerary();
  }));
  container.querySelectorAll('[data-add-stop]').forEach(el => el.addEventListener('click', () => {
    addDayId = el.dataset.addStop; editId = null; openDays.add(addDayId); renderItinerary();
  }));
  container.querySelectorAll('[data-add-phase]').forEach(el => el.addEventListener('click', () => {
    const dayId = el.dataset.addPhase; const day = ITIN.find(d => d.id === dayId); if (!day) return;
    const v = prompt('New section label (e.g. Morning, Evening):'); if (!v) return;
    day.items.push({ id: genId('p'), ph: v.trim() }); commitItinerary();
  }));
  container.querySelectorAll('[data-geocode]').forEach(el => el.addEventListener('click', doGeocodeForm));
  const addrInput = container.querySelector('#f_addr');
  if (addrInput) wireAddressAutocomplete(addrInput, container.querySelector('#addrAC'));
  container.querySelectorAll('[data-form-cancel]').forEach(el => el.addEventListener('click', () => {
    editId = null; addDayId = null; renderItinerary();
  }));
  container.querySelectorAll('[data-form-save]').forEach(el => el.addEventListener('click', async () => {
    const [dayId, itemId] = el.dataset.formSave.split('|');
    const original = el.textContent;
    el.disabled = true; el.textContent = 'Saving…';
    const ok = await saveStopForm(dayId, itemId || null);
    if (!ok) { el.disabled = false; el.textContent = original; }
  }));
}

// look up the address typed in the form and fill in the coordinates
async function doGeocodeForm() {
  const status = document.getElementById('f_geostatus');
  const addr = document.getElementById('f_addr').value.trim();
  const name = document.getElementById('f_name').value.trim();
  const q = addr || name;
  if (!q) { if (status) status.textContent = 'Type an address or name first.'; return; }
  if (status) status.textContent = '🔎 Searching Malta…';
  const res = await geocode(q);
  if (res) {
    document.getElementById('f_lat').value = res.lat.toFixed(5);
    document.getElementById('f_lng').value = res.lng.toFixed(5);
    if (status) status.innerHTML = '✓ Found: ' + htmlEscape(res.label.split(',').slice(0, 3).join(', '));
  } else if (status) {
    status.textContent = '⚠️ Couldn\'t find that — try adding the town (e.g. "…, Sliema").';
  }
}

// live tap-to-pick suggestions under the address field
function wireAddressAutocomplete(input, list) {
  if (!input || !list) return;
  let timer = null, items = [], active = -1, lastQ = '';
  const status = () => document.getElementById('f_geostatus');
  function close() { list.classList.remove('open'); list.innerHTML = ''; active = -1; }
  function render() {
    list.innerHTML = items.map((it, i) =>
      `<div class="ac-item${i === active ? ' active' : ''}" data-i="${i}">
        <div class="ac-name">${htmlEscape(it.primary)}</div>
        ${it.context ? `<div class="ac-ctx">${htmlEscape(it.context)}</div>` : ''}
      </div>`).join('');
    list.classList.toggle('open', items.length > 0);
    list.querySelectorAll('.ac-item').forEach(el =>
      el.addEventListener('mousedown', (e) => { e.preventDefault(); choose(+el.dataset.i); }));
  }
  function choose(i) {
    const it = items[i]; if (!it) return;
    input.value = it.label;
    const latI = document.getElementById('f_lat'), lngI = document.getElementById('f_lng');
    if (latI) latI.value = it.lat.toFixed(5);
    if (lngI) lngI.value = it.lng.toFixed(5);
    const st = status(); if (st) st.innerHTML = '✓ Pinned: ' + htmlEscape(it.primary);
    close();
  }
  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(timer);
    if (q.length < 3) { close(); return; }
    timer = setTimeout(async () => {
      if (q === lastQ) return; lastQ = q;
      const st = status(); if (st) st.textContent = '🔎 Searching…';
      items = await geocodeSuggest(q);
      active = -1; render();
      const s2 = status();
      if (s2) s2.textContent = items.length ? 'Pick a match below, or keep typing.' : 'No matches yet — try adding the town.';
    }, 280);
  });
  input.addEventListener('keydown', (e) => {
    if (!list.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { close(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
}

async function saveStopForm(dayId, itemId) {
  const name = document.getElementById('f_name').value.trim();
  if (!name) { alert('Please give the stop a name.'); return false; }
  let lat = parseFloat(document.getElementById('f_lat').value);
  let lng = parseFloat(document.getElementById('f_lng').value);
  const addr = document.getElementById('f_addr').value.trim();
  // no coordinates entered? auto-detect them from the address (or name)
  if ((isNaN(lat) || isNaN(lng)) && (addr || name)) {
    const status = document.getElementById('f_geostatus');
    if (status) status.textContent = '🔎 Finding location from address…';
    const res = await geocode(addr || name);
    if (res) { lat = res.lat; lng = res.lng; }
  }
  const costRaw = parseFloat(document.getElementById('f_cost').value);
  const data = {
    t: document.getElementById('f_type').value,
    name,
    time: document.getElementById('f_time').value.trim(),
    addr,
    note: document.getElementById('f_note').value.trim(),
    lat: isNaN(lat) ? undefined : lat,
    lng: isNaN(lng) ? undefined : lng,
    cost: isNaN(costRaw) ? undefined : costRaw,
  };
  const day = ITIN.find(d => d.id === dayId); if (!day) return false;
  if (itemId) {
    const it = day.items.find(i => i.id === itemId);
    if (it) Object.assign(it, data);
  } else {
    day.items.push(Object.assign({ id: genId('s') }, data));
  }
  editId = null; addDayId = null;
  commitItinerary();
  if (data.lat == null) {
    setTimeout(() => alert(`Saved "${name}", but I couldn't pin "${addr || name}" on the map. Edit it and use 🔎 Find on map, or add the town to the address.`), 60);
  }
  return true;
}

function addDay() {
  const n = ITIN.length + 1;
  ITIN.push({ id: genId('day'), title: 'Day ' + n, zone: '', color: '#245F73', items: [] });
  selectedDay = ITIN.length - 1;
  saveItinerary();
  renderItinerary();
  populateExpenseDays(); rebuildMap(); updateBudgetUI(); buildWeather();
}

// persist + re-render everything affected by an itinerary change
function commitItinerary() {
  saveItinerary();
  renderItinerary();
  populateExpenseDays();
  rebuildMap();
  updateBudgetUI();
  buildWeather();
}

function scrollToToday() {
  const info = todayInfo();
  if (info.state !== 'during') return;
  selectedDay = info.dayN - 1;
  renderItinerary();
  const card = document.querySelectorAll('#dayCards .dc-card')[selectedDay];
  if (card) card.scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' });
}
// jump to a day's route on the Map tab
function showDayOnMap(dayN) {
  showPage('map');
  setTimeout(() => {
    const btn = document.querySelectorAll('.map-filter-btn')[dayN]; // 0 = All, then Day 1..
    if (btn) filterMap(dayN, btn);
  }, 280);
}
function updateAllDayCounts() {
  ITIN.forEach(day => {
    const stops = day.items.filter(it => !it.ph);
    const checked = stops.filter(it => state.checked[it.id]).length;
    const el = document.getElementById('dayCount_' + day.id);
    if (el) el.textContent = `${checked}/${stops.length}`;
  });
}
function updateProgress() {
  let total = 0, done = 0;
  ITIN.forEach(d => d.items.forEach(it => { if (!it.ph) { total++; if (state.checked[it.id]) done++; } }));
  const pct = total ? Math.round(done/total*100) : 0;
  document.getElementById('visitedCount').textContent = done;
  document.getElementById('heroProgress').style.width = pct + '%';
  document.getElementById('globalProgress').style.width = pct + '%';
  const labels = ["let's go!", 'Getting started! 🚀', 'Halfway there! 🌊', 'Almost done! 🏖️', 'Trip complete! 🎉'];
  const li = pct === 100 ? 4 : pct >= 75 ? 3 : pct >= 50 ? 2 : pct >= 25 ? 1 : 0;
  document.getElementById('progressLabel').textContent = `${pct}% complete — ${labels[li]}`;
}

// ---- drag (SortableJS) ----
let containerSortable = null, daySortables = [], dragScheduled = false;
function initSortables() {
  if (typeof Sortable === 'undefined') return;
  if (containerSortable) { containerSortable.destroy(); containerSortable = null; }
  daySortables.forEach(s => s.destroy()); daySortables = [];
  containerSortable = new Sortable(document.getElementById('dayCards'), {
    animation: 150, handle: '.day-drag', draggable: '.day-card', ghostClass: 'sortable-ghost',
    onEnd: scheduleDragCommit
  });
  document.querySelectorAll('.day-items').forEach(el => {
    daySortables.push(new Sortable(el, {
      group: 'itin', animation: 150, handle: '.item-drag', draggable: '.item-row',
      ghostClass: 'sortable-ghost', onEnd: scheduleDragCommit, onAdd: scheduleDragCommit
    }));
  });
}
function scheduleDragCommit() {
  if (dragScheduled) return;
  dragScheduled = true;
  setTimeout(() => { dragScheduled = false; commitDrag(); }, 0);
}
function commitDrag() {
  const idToItem = {}; ITIN.forEach(d => d.items.forEach(it => idToItem[it.id] = it));
  const byId = {}; ITIN.forEach(d => byId[d.id] = d);
  const newOrder = [...document.querySelectorAll('#dayCards .day-card')].map(card => {
    const day = byId[card.dataset.dayId];
    const items = [...card.querySelectorAll('.item-row')].map(r => idToItem[r.dataset.itemId]).filter(Boolean);
    return Object.assign({}, day, { items });
  });
  ITIN = newOrder;
  commitItinerary();
}

// ============================================================
// MAP
// ============================================================
let map, allMarkers = [];
let routeLayer = null, nextLine = null, routeSeq = 0;
const DAY_COLORS = ['#2176c7','#0e6b9e','#1a6b8a','#2d6b4a','#6b4a2d','#6b2d6b','#0e6b6b','#6b4a0e','#6b2d2d','#4a4a6b'];
const TYPE_COLORS = { a:'#2176c7', f:'#16a34a', n:'#7c3aed', m:'#d97706' };

function initMap() {
  if (map) return;
  map = L.map('map').setView([35.92, 14.38], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:'© OpenStreetMap contributors', maxZoom:18
  }).addTo(map);
  rebuildMapFilters();
  buildMapMarkers();
  if (autoTrackEnabled()) startTracking();
  else updateTrackBtn();
}
function rebuildMap() {
  if (!map) return;
  allMarkers.forEach(m => map.removeLayer(m.marker));
  allMarkers = [];
  clearRoute();
  rebuildMapFilters();
  buildMapMarkers();
}
function rebuildMapFilters() {
  const f = document.getElementById('mapFilters');
  f.innerHTML = '<button class="map-filter-btn active" onclick="filterMap(\'all\',this)">All days</button>';
  ITIN.forEach((d, di) => {
    const btn = document.createElement('button');
    btn.className = 'map-filter-btn';
    btn.textContent = `Day ${di + 1}`;
    btn.onclick = function() { filterMap(di + 1, this); };
    f.appendChild(btn);
  });
}
function makeIcon(color, visited, num) {
  const c = visited ? '#64748b' : color;
  const label = (num != null) ? String(num) : '';
  const fs = label.length > 1 ? 11 : 13;
  const inner = label
    ? `<text x="14" y="14" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="-apple-system,Segoe UI,sans-serif" font-size="${fs}" font-weight="700">${label}</text>`
    : `<circle cx="14" cy="14" r="5" fill="white"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="${c}" stroke="white" stroke-width="2"/>${inner}</svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [28,36], iconAnchor: [14,36], popupAnchor: [0,-36] });
}
function buildMapMarkers() {
  ITIN.forEach((day, di) => {
    let stopIdx = 0;                              // running order within the day
    day.items.forEach(it => {
      if (it.ph) return;
      stopIdx++;
      if (it.lat == null || isNaN(it.lat)) return;
      const visited = !!state.checked[it.id];
      const color = it.t === 'm' ? '#d97706' : TYPE_COLORS[it.t] || DAY_COLORS[di % DAY_COLORS.length];
      const marker = L.marker([it.lat, it.lng], { icon: makeIcon(color, visited, stopIdx) });
      const mustTag = it.t === 'm' ? ' <span style="background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:4px;font-size:11px">★ your spot</span>' : '';
      marker.bindPopup(`
        <div style="font-family:-apple-system,sans-serif;min-width:200px">
          <div style="font-weight:600;font-size:14px;margin-bottom:4px">${htmlEscape(it.name)}${mustTag}</div>
          <div style="font-size:12px;color:#64748b;margin-bottom:4px">📅 Day ${di+1} · ${dayLabel(di)} · Stop ${stopIdx}</div>
          ${it.time ? `<div style="font-size:11px;background:#f1f5f9;color:#334155;display:inline-block;padding:1px 6px;border-radius:6px;margin-bottom:4px">${htmlEscape(it.time)}</div>` : ''}
          ${it.addr ? `<div style="font-size:12px;color:#64748b;margin-bottom:4px">📍 ${htmlEscape(it.addr)}</div>` : ''}
          ${it.note ? `<div style="font-size:12px;color:#475569;font-style:italic;margin-bottom:6px">${htmlEscape(it.note)}</div>` : ''}
          <a href="${directionsUrl(it)}" target="_blank" rel="noopener" style="font-size:12px;color:#2176c7;font-weight:600;text-decoration:none">🧭 Get directions</a>
        </div>`);
      marker.addTo(map);
      allMarkers.push({ marker, dayN: di+1, type: it.t, key: it.id, lat: it.lat, lng: it.lng, name: it.name, num: stopIdx });
    });
  });
}
function updateMapMarkers() {
  allMarkers.forEach(m => {
    const visited = !!state.checked[m.key];
    const di = m.dayN - 1;
    const color = m.type === 'm' ? '#d97706' : TYPE_COLORS[m.type] || DAY_COLORS[di % DAY_COLORS.length];
    m.marker.setIcon(makeIcon(color, visited, m.num));
  });
}
function filterMap(dayN, btn) {
  document.querySelectorAll('.map-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  allMarkers.forEach(m => {
    if (dayN === 'all' || m.dayN === dayN) { if (!map.hasLayer(m.marker)) m.marker.addTo(map); }
    else { if (map.hasLayer(m.marker)) map.removeLayer(m.marker); }
  });
  if (dayN !== 'all') {
    const dayMarkers = allMarkers.filter(m => m.dayN === dayN);
    if (dayMarkers.length) map.fitBounds(L.featureGroup(dayMarkers.map(m => m.marker)).getBounds().pad(0.3));
    drawDayRoute(dayN);
  } else {
    map.setView([35.92, 14.38], 10);
    clearRoute();
  }
}

// ---- Day route: real road route (OSRM) with straight-line fallback ----
function clearRoute() {
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  const ri = document.getElementById('routeInfo');
  if (ri) { ri.innerHTML = ''; ri.classList.remove('show'); }
}
function dayLatLngs(dayN) {
  return allMarkers.filter(m => m.dayN === dayN).sort((a, b) => a.num - b.num).map(m => [m.lat, m.lng]);
}
function straightKm(pts) {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += distKm(pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1]);
  return t;
}
async function drawDayRoute(dayN) {
  if (!map) return;
  clearRoute();
  const pts = dayLatLngs(dayN);
  if (pts.length < 2) return;
  const color = DAY_COLORS[(dayN - 1) % DAY_COLORS.length];
  const ri = document.getElementById('routeInfo');
  // instant straight-line path (also the offline fallback)
  routeLayer = L.polyline(pts, { color, weight: 4, opacity: 0.5, dashArray: '6,8' }).addTo(map);
  if (ri) { ri.classList.add('show'); ri.innerHTML = `<span class="ri-dot" style="background:${color}"></span>Day ${dayN} · finding the road route…`; }
  const seq = ++routeSeq;
  const coords = pts.map(p => `${p[1]},${p[0]}`).join(';');
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('bad response');
    const d = await r.json();
    if (seq !== routeSeq) return;                       // a different day was picked meanwhile
    const route = d && d.routes && d.routes[0];
    if (!route || !route.geometry) throw new Error('no route');
    const line = route.geometry.coordinates.map(c => [c[1], c[0]]);
    if (routeLayer) map.removeLayer(routeLayer);
    routeLayer = L.polyline(line, { color, weight: 5, opacity: 0.85 }).addTo(map);
    const km = route.distance / 1000, min = Math.round(route.duration / 60);
    if (ri) ri.innerHTML = `<span class="ri-dot" style="background:${color}"></span>Day ${dayN} · ${km.toFixed(1)} km · ${min} min by car`;
  } catch (e) {
    if (seq !== routeSeq) return;
    const km = straightKm(pts);
    if (ri) ri.innerHTML = `<span class="ri-dot" style="background:${color}"></span>Day ${dayN} · ~${km.toFixed(1)} km (straight line — road route unavailable)`;
  }
}

// ---- Live location tracking (auto-on) ----
let userMarker = null, accCircle = null, watchId = null, firstFix = true, lastPos = null;
function autoTrackEnabled() { return localStorage.getItem('malta_autotrack') !== '0'; }
function updateTrackBtn() {
  const btn = document.getElementById('locateBtn');
  if (!btn) return;
  if (watchId !== null) { btn.classList.add('active'); btn.textContent = '📍 Live tracking ON — tap to stop'; }
  else { btn.classList.remove('active'); btn.textContent = '📍 Track my location'; }
}
function toggleTracking() {
  if (watchId !== null) {
    localStorage.setItem('malta_autotrack', '0');
    stopTracking();
  } else {
    localStorage.setItem('malta_autotrack', '1');
    startTracking();
  }
}
function startTracking() {
  if (!('geolocation' in navigator)) { setLocReadout('⚠️ Geolocation not supported by this browser.'); return; }
  if (watchId !== null) return;
  firstFix = true;
  updateTrackBtn();
  setLocReadout('📡 Getting your location…');
  watchId = navigator.geolocation.watchPosition(onPos, onPosErr, { enableHighAccuracy:true, maximumAge:5000, timeout:20000 });
  updateTrackBtn();
}
function stopTracking() {
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
  if (accCircle)  { map.removeLayer(accCircle);  accCircle = null; }
  if (nextLine)   { map.removeLayer(nextLine);   nextLine = null; }
  lastPos = null;
  setLocReadout('');
  updateTrackBtn();
}
function onPos(pos) {
  const { latitude:la, longitude:ln, accuracy:ac } = pos.coords;
  lastPos = { la, ln };
  if (!userMarker) {
    userMarker = L.marker([la, ln], {
      icon: L.divIcon({ className:'', html:'<div class="user-pulse"></div>', iconSize:[16,16], iconAnchor:[8,8] }),
      zIndexOffset: 1000
    }).addTo(map).bindPopup('You are here');
    accCircle = L.circle([la, ln], { radius: ac, color:'#2176c7', fillColor:'#2176c7', fillOpacity:0.08, weight:1 }).addTo(map);
  } else {
    userMarker.setLatLng([la, ln]);
    accCircle.setLatLng([la, ln]).setRadius(ac);
  }
  if (firstFix) { map.setView([la, ln], 14); firstFix = false; }
  updateTrackBtn();
  refreshLocReadout();
}
function onPosErr(err) {
  stopTracking();
  localStorage.setItem('malta_autotrack', '0');
  const msg = err.code === 1
    ? '⚠️ Location blocked. On a file:// page Chrome disables GPS — open via the local server (http://localhost) or use Safari.'
    : '⚠️ Could not get your location: ' + err.message;
  setLocReadout(msg);
}
function setLocReadout(html) { const el = document.getElementById('locReadout'); if (el) el.innerHTML = html; }
function distKm(la1, ln1, la2, ln2) {
  const R = 6371, toR = x => x * Math.PI / 180;
  const dLa = toR(la2-la1), dLo = toR(ln2-ln1);
  const s = Math.sin(dLa/2)**2 + Math.cos(toR(la1))*Math.cos(toR(la2))*Math.sin(dLo/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}
function refreshLocReadout() {
  if (!lastPos) return;
  let nearest = null, best = Infinity;
  allMarkers.forEach(m => {
    if (state.checked[m.key]) return;            // only stops you haven't done
    const d = distKm(lastPos.la, lastPos.ln, m.lat, m.lng);
    if (d < best) { best = d; nearest = m; }
  });
  if (nextLine) { map.removeLayer(nextLine); nextLine = null; }
  if (!nearest) { setLocReadout('🎉 You\'ve visited every remaining stop on the map!'); return; }
  // live line from where you are now to your next stop
  nextLine = L.polyline([[lastPos.la, lastPos.ln], [nearest.lat, nearest.lng]],
    { color: '#2176c7', weight: 3, opacity: 0.85, dashArray: '2,8' }).addTo(map);
  const dist = best < 1 ? `${Math.round(best*1000)} m` : `${best.toFixed(1)} km`;
  setLocReadout(`📍 Tracking live · nearest next stop: <strong>${htmlEscape(nearest.name)}</strong> — ${dist} (Day ${nearest.dayN})`);
}

// ============================================================
// BUDGET
// ============================================================
function populateExpenseDays() {
  const sel = document.getElementById('expDay');
  const prev = sel.value;
  sel.innerHTML = ITIN.map((d, di) => `<option value="Day ${di+1}">Day ${di+1} – ${dayLabel(di)}</option>`).join('');
  if (prev) sel.value = prev;
}
function setBudget() {
  const v = parseFloat(document.getElementById('budgetInput').value);
  if (!v || v <= 0) return;
  state.budget = v; save('budget', v); updateBudgetUI();
}
function clearBudget() {
  if (!confirm('Reset budget and all logged expenses?')) return;
  state.budget = 0; state.expenses = [];
  save('budget', 0); save('expenses', []);
  document.getElementById('budgetInput').value = '';
  updateBudgetUI(); renderExpenses();
}
function addExpense() {
  const day = document.getElementById('expDay').value;
  const desc = document.getElementById('expDesc').value.trim();
  const cat = document.getElementById('expCat').value;
  const amount = parseFloat(document.getElementById('expAmount').value);
  if (!desc || !amount || amount <= 0) return;
  state.expenses.push({ id: Date.now(), day, desc, cat, amount });
  save('expenses', state.expenses);
  document.getElementById('expDesc').value = '';
  document.getElementById('expAmount').value = '';
  updateBudgetUI(); renderExpenses();
}
function deleteExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  save('expenses', state.expenses);
  updateBudgetUI(); renderExpenses();
}
function dayTotals() {
  const m = {}; ITIN.forEach((d, di) => m['Day ' + (di+1)] = 0);
  state.expenses.forEach(e => { m[e.day] = (m[e.day] || 0) + e.amount; });
  return m;
}
function catTotals() {
  const m = {}; state.expenses.forEach(e => { m[e.cat] = (m[e.cat] || 0) + e.amount; });
  return m;
}
// ---- Smart vs even daily allowance ----
function effectiveBudgetMode() {
  if (state.budgetMode === 'even' || state.budgetMode === 'smart') return state.budgetMode;
  return totalEstimate() > 0 ? 'smart' : 'even';      // auto default
}
function setBudgetMode(mode) {
  state.budgetMode = mode;
  localStorage.setItem('malta_budget_mode', mode);
  scheduleFileSave();
  updateBudgetUI();
}
function estForDay(di) {
  const day = ITIN[di];
  if (!day) return 0;
  return day.items.reduce((a, it) => a + (it.ph ? 0 : (Number(it.cost) || 0)), 0);
}
function totalEstimate() { let t = 0; ITIN.forEach((d, di) => t += estForDay(di)); return t; }
function dailyAllowances() {
  const tot = totalEstimate();
  if (effectiveBudgetMode() === 'smart' && tot > 0 && state.budget > 0)
    return ITIN.map((d, di) => state.budget * estForDay(di) / tot);
  const per = state.budget ? state.budget / dayCount() : 0;
  return ITIN.map(() => per);
}
function updateBudgetModeButtons() {
  const mode = effectiveBudgetMode();
  document.querySelectorAll('.seg-btn[data-mode]').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode));
}

function updateBudgetUI() {
  const spent = state.expenses.reduce((a,e) => a+e.amount, 0);
  const left = state.budget - spent;
  const pct = state.budget ? Math.min(spent/state.budget*100, 100) : 0;
  const dailyAvg = state.budget ? state.budget / dayCount() : 0;
  document.getElementById('budgetTotal').textContent = `€${state.budget.toFixed(0)}`;
  document.getElementById('budgetSpent').textContent = `€${spent.toFixed(2)}`;
  document.getElementById('budgetLeft').textContent = `€${left.toFixed(2)}`;
  document.getElementById('budgetLeft').className = 'budget-stat-val' + (left < 0 ? ' over' : '');
  document.getElementById('budgetDaily').textContent = `€${dailyAvg.toFixed(0)}`;
  const bar = document.getElementById('budgetBar');
  bar.style.width = pct + '%';
  bar.style.background = pct > 90 ? 'var(--red-400)' : pct > 70 ? 'var(--amber-400)' : 'var(--blue-600)';
  updateBudgetModeButtons();
  drawSpendChart();
  renderBreakdown(dailyAllowances());
}

// SVG line/area chart: cumulative planned vs actual spend across the trip
function drawSpendChart() {
  const el = document.getElementById('spendChart');
  if (!el) return;
  const n = dayCount();
  const totals = dayTotals();
  const cumPlan = [], cumAct = [];
  let p = 0, a = 0;
  for (let i = 0; i < n; i++) { p += estForDay(i); a += (totals['Day ' + (i+1)] || 0); cumPlan.push(p); cumAct.push(a); }
  const anyActual = a > 0;
  const budget = state.budget || 0;
  const maxY = Math.max(budget, p, a, 1) * 1.08;
  const W = 360, H = 150, padL = 10, padR = 10, padT = 12, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const X = i => padL + (n <= 1 ? plotW / 2 : plotW * i / (n - 1));
  const Y = v => padT + plotH - (v / maxY * plotH);
  const line = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  const area = arr => `${line(arr)} L${X(n-1).toFixed(1)} ${Y(0).toFixed(1)} L${X(0).toFixed(1)} ${Y(0).toFixed(1)} Z`;
  const budgetLine = budget > 0 ? `<line x1="${padL}" y1="${Y(budget).toFixed(1)}" x2="${W-padR}" y2="${Y(budget).toFixed(1)}" style="stroke:var(--gray-300);stroke-width:1;stroke-dasharray:3,4"/>` : '';
  let xl = '';
  for (let i = 0; i < n; i++) { if (n > 7 && i % 2 !== 0 && i !== n-1) continue; const d = tripDate(i); xl += `<text x="${X(i).toFixed(1)}" y="${H-7}" text-anchor="middle" style="font-size:10px;fill:var(--gray-400)">${d.getDate()}</text>`; }
  const info = todayInfo();
  let today = '';
  if (info.state === 'during') { const xi = X(info.dayN - 1).toFixed(1); today = `<line x1="${xi}" y1="${padT}" x2="${xi}" y2="${padT+plotH}" style="stroke:var(--blue-400);stroke-width:1;stroke-dasharray:2,3"/>`; }
  const actualLayer = anyActual ? `<path d="${line(cumAct)}" style="fill:none;stroke:var(--warm);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round"/>` : '';
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative spending across the trip">
      ${budgetLine}${today}
      <path d="${area(cumPlan)}" style="fill:var(--blue-600);opacity:.12"/>
      <path d="${line(cumPlan)}" style="fill:none;stroke:var(--blue-600);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round"/>
      ${actualLayer}${xl}
    </svg>
    <div class="sc-legend">
      <span><i style="background:var(--blue-600)"></i>Planned €${Math.round(p)}</span>
      ${anyActual ? `<span><i style="background:var(--warm)"></i>Spent €${Math.round(a)}</span>` : ''}
      ${budget > 0 ? `<span><i style="background:var(--gray-300)"></i>Budget €${Math.round(budget)}</span>` : ''}
    </div>`;
}
function spendColor(amount, allowance) {
  if (!allowance) return '#60aef0';
  const r = amount / allowance;
  return r > 1 ? '#f87171' : r > 0.8 ? '#f59e0b' : '#22c55e';
}
let openBudgetDays = new Set();
function toggleBudgetDay(dayId) {
  if (openBudgetDays.has(dayId)) openBudgetDays.delete(dayId); else openBudgetDays.add(dayId);
  updateBudgetUI();
}
function stopCostTag(it) {
  if (it.cost == null) return '<span class="bd-stop-cost none">—</span>';
  return it.cost > 0
    ? `<span class="bd-stop-cost">€${it.cost}</span>`
    : '<span class="bd-stop-cost free">free</span>';
}
function renderBreakdown(allowances) {
  const totals = dayTotals();
  const spends = ITIN.map((d, di) => totals['Day ' + (di+1)] || 0);
  const maxVal = Math.max(...allowances, ...spends, 1);
  const hasBudget = state.budget > 0;
  const mode = effectiveBudgetMode();
  const dayEl = document.getElementById('budgetByDay');
  dayEl.innerHTML = ITIN.map((d, di) => {
    const amt = spends[di];
    const allow = allowances[di] || 0;
    const plan = estForDay(di);
    const w = Math.min(amt / maxVal * 100, 100);
    const tick = hasBudget ? Math.min(allow / maxVal * 100, 100) : null;
    const over = hasBudget && amt > allow;
    const planSub = plan > 0 ? ` · plan €${plan.toFixed(0)}` : '';
    const isOpen = openBudgetDays.has(d.id);
    const detail = d.items.map(it => it.ph
      ? `<div class="bd-phase">${htmlEscape(it.ph)}</div>`
      : `<div class="bd-stop"><span class="bd-stop-icon">${ICONS[it.t]||'📍'}</span><span class="bd-stop-name">${htmlEscape(it.name)}</span>${stopCostTag(it)}</div>`
    ).join('');
    return `<div class="bd-day${isOpen ? ' open' : ''}">
      <div class="bd-row" onclick="toggleBudgetDay('${d.id}')">
        <span class="bd-chevron">▸</span>
        <div class="bd-label">Day ${di+1} <span class="bd-sub">${dayLabel(di)}${planSub}</span></div>
        <div class="bd-track">
          <div class="bd-fill" style="width:${w}%;background:${spendColor(amt, allow)}"></div>
          ${tick !== null ? `<div class="bd-tick" style="left:${tick}%"></div>` : ''}
        </div>
        <div class="bd-amt${over ? ' over' : ''}">€${amt.toFixed(0)}${hasBudget ? ` / €${allow.toFixed(0)}` : ''}</div>
      </div>
      <div class="bd-detail">
        ${detail || '<div class="bd-detail-hint">No stops on this day yet.</div>'}
        <div class="bd-detail-hint">Tip: set or change any price on the Itinerary tab (✎ Edit a stop).</div>
      </div>
    </div>`;
  }).join('');
  const tot = totalEstimate();
  document.getElementById('budgetByDayNote').innerHTML = !hasBudget
    ? `Set a total budget above to see each day's allowance.${tot > 0 ? ` Your planned stops add up to ~€${tot.toFixed(0)}.` : ''}`
    : (mode === 'smart' && tot > 0)
      ? `<strong>Smart allowance</strong> splits your €${state.budget.toFixed(0)} across the days by each day's planned cost (stops total ~€${tot.toFixed(0)}) — pricey days get more, quiet days less. Grey line = that day's allowance; bars turn <span style="color:#f87171;font-weight:600">red</span> over it.`
      : `<strong>Even split</strong>: €${state.budget.toFixed(0)} ÷ ${dayCount()} days = €${(state.budget/dayCount()).toFixed(0)}/day. Switch to <em>Smart</em> to weight days by planned cost.`;

  const cats = catTotals();
  const spentTotal = Object.values(cats).reduce((a,b)=>a+b,0);
  const catEl = document.getElementById('budgetByCat');
  const entries = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  if (!entries.length) { catEl.innerHTML = '<div class="empty-state">No expenses yet</div>'; return; }
  const maxCat = Math.max(...entries.map(e=>e[1]), 1);
  catEl.innerHTML = entries.map(([cat, amt]) => {
    const w = amt / maxCat * 100;
    const share = spentTotal ? Math.round(amt/spentTotal*100) : 0;
    return `<div class="bd-row">
      <div class="bd-label">${htmlEscape(cat)}</div>
      <div class="bd-track"><div class="bd-fill" style="width:${w}%;background:var(--blue-400)"></div></div>
      <div class="bd-amt">€${amt.toFixed(0)} · ${share}%</div>
    </div>`;
  }).join('');
}
function renderExpenses() {
  const el = document.getElementById('expenseList');
  if (!state.expenses.length) { el.innerHTML = '<div class="empty-state">No expenses logged yet</div>'; return; }
  el.innerHTML = [...state.expenses].reverse().map(e => `
    <div class="expense-item">
      <span class="expense-day-badge">${htmlEscape(e.day)}</span>
      <span class="expense-cat">${htmlEscape(e.cat)}</span>
      <span class="expense-desc">${htmlEscape(e.desc)}</span>
      <span class="expense-amount">€${e.amount.toFixed(2)}</span>
      <button class="expense-del" onclick="deleteExpense(${e.id})">✕</button>
    </div>`).join('');
}

// ============================================================
// PACKING
// ============================================================
function packItemsFor(sec) { return sec.items.concat(state.packingCustom[sec.section] || []); }
function buildPacking() {
  const container = document.getElementById('packingSections');
  container.innerHTML = '';
  PACKING.forEach(sec => {
    const items = packItemsFor(sec);
    const div = document.createElement('div');
    div.className = 'packing-section';
    const total = items.length;
    const done = items.filter(i => state.packing[packKey(sec.section, i)]).length;
    div.innerHTML = `<div class="packing-section-title">${sec.section} <span style="font-size:11px;color:var(--gray-400);font-weight:400">${done}/${total}</span></div>
      <div class="packing-grid" id="pg_${sec.section.replace(/[^a-z]/gi,'_')}"></div>
      <div class="add-item-row">
        <input type="text" placeholder="Add custom item..." id="addInput_${sec.section.replace(/[^a-z]/gi,'_')}" />
        <button onclick="addPackItem('${sec.section}')">+ Add</button>
      </div>`;
    container.appendChild(div);
    const grid = div.querySelector('.packing-grid');
    items.forEach(item => grid.appendChild(makePackItem(sec.section, item)));
  });
  updatePackingProgress();
}
function packKey(sec, item) { return `${sec}_${item}`.replace(/[^a-z0-9]/gi,'_'); }
function makePackItem(sec, item) {
  const key = packKey(sec, item);
  const checked = !!state.packing[key];
  const el = document.createElement('label');
  el.className = 'pack-item' + (checked ? ' checked' : '');
  el.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} /><span class="pack-item-label">${htmlEscape(item)}</span>`;
  el.querySelector('input').addEventListener('change', function() {
    state.packing[key] = this.checked;
    save('packing', state.packing);
    el.className = 'pack-item' + (this.checked ? ' checked' : '');
    updatePackingProgress();
  });
  return el;
}
function addPackItem(sec) {
  const id = `addInput_${sec.replace(/[^a-z]/gi,'_')}`;
  const input = document.getElementById(id);
  const val = input.value.trim();
  if (!val) return;
  if (!state.packingCustom[sec]) state.packingCustom[sec] = [];
  state.packingCustom[sec].push(val);
  save('packing_custom', state.packingCustom);
  const gridId = `pg_${sec.replace(/[^a-z]/gi,'_')}`;
  document.getElementById(gridId).appendChild(makePackItem(sec, val));
  input.value = '';
  updatePackingProgress();
}
function updatePackingProgress() {
  let total = 0, done = 0;
  PACKING.forEach(sec => packItemsFor(sec).forEach(item => { total++; if (state.packing[packKey(sec.section, item)]) done++; }));
  document.getElementById('packingProgress').textContent = `${done} of ${total} items packed — ${total ? Math.round(done/total*100) : 0}% ready`;
  PACKING.forEach(sec => {
    const items = packItemsFor(sec);
    const secDone = items.filter(i => state.packing[packKey(sec.section, i)]).length;
    const grid = document.getElementById(`pg_${sec.section.replace(/[^a-z]/gi,'_')}`);
    if (grid) {
      const title = grid.closest('.packing-section').querySelector('.packing-section-title span');
      if (title) title.textContent = `${secDone}/${items.length}`;
    }
  });
}

// ============================================================
// WEATHER (live via Open-Meteo, typical July fallback)
// ============================================================
async function buildWeather() {
  renderWeatherDays(null);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${TRIP.forecast.lat}&longitude=${TRIP.forecast.lng}`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,wind_speed_10m_max,precipitation_probability_max`
    + `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m`
    + `&timezone=Europe%2FMalta&forecast_days=16`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('bad response');
    const data = await r.json();
    renderWeatherCurrent(data.current);
    renderWeatherDays(data.daily);
  } catch (e) {
    const cur = document.getElementById('weatherCurrent');
    if (cur) cur.innerHTML = '<div class="weather-current-note">⚠️ Live weather unavailable — showing typical July averages below.</div>';
    renderWeatherDays(null);
  }
}
function renderWeatherCurrent(c) {
  const el = document.getElementById('weatherCurrent');
  if (!el || !c) return;
  const [icon, desc] = wmo(c.weather_code);
  el.innerHTML = `
    <div class="weather-current-icon">${icon}</div>
    <div>
      <div class="weather-current-temp">${Math.round(c.temperature_2m)}°C</div>
      <div class="weather-current-meta">${desc} · 💨 ${Math.round(c.wind_speed_10m)} km/h · 💧 ${c.relative_humidity_2m}%</div>
    </div>
    <div class="weather-current-live">● Live now · Valletta</div>`;
}
function renderWeatherDays(daily) {
  const grid = document.getElementById('weatherGrid');
  if (!grid) return;
  const info = todayInfo();
  let html = '';
  for (let i = 0; i < dayCount(); i++) {
    const d = tripDate(i);
    const iso = isoOf(d);
    let live = false, icon, desc, hi, lo, uv, wind, pop = null;
    if (daily && daily.time) {
      const idx = daily.time.indexOf(iso);
      if (idx >= 0) {
        live = true;
        [icon, desc] = wmo(daily.weather_code[idx]);
        hi = Math.round(daily.temperature_2m_max[idx]);
        lo = Math.round(daily.temperature_2m_min[idx]);
        uv = Math.round(daily.uv_index_max[idx]);
        wind = Math.round(daily.wind_speed_10m_max[idx]);
        pop = daily.precipitation_probability_max ? daily.precipitation_probability_max[idx] : null;
      }
    }
    if (!live) { const t = WEATHER_TYPICAL[i % WEATHER_TYPICAL.length]; icon=t.icon; desc=t.desc; hi=t.hi; lo=t.lo; uv=t.uv; wind=t.wind; }
    const isToday = info.state === 'during' && info.dayN === (i+1);
    html += `<div class="weather-card${isToday ? ' is-today' : ''}">
      <span class="weather-badge ${live ? 'live' : 'typical'}">${live ? 'Live' : 'Typical'}</span>
      <div class="weather-icon">${icon}</div>
      <div class="weather-day">${WD[d.getDay()]}</div>
      <div class="weather-date">${d.getDate()} ${MO[d.getMonth()]}</div>
      <div class="weather-temp">${hi}°<span style="font-size:13px;color:var(--gray-400)"> / ${lo}°</span></div>
      <div class="weather-desc">${desc}</div>
      <div class="weather-detail">UV ${uv} · ${wind} km/h${pop != null ? ` · 🌧️ ${pop}%` : ''}</div>
    </div>`;
  }
  grid.innerHTML = html;
}

// ============================================================
// TIPS
// ============================================================
function buildTips() {
  const grid = document.getElementById('tipsGrid');
  grid.innerHTML = '';
  TIPS.forEach(t => {
    grid.innerHTML += `<div class="tip-card">
      <div class="tip-icon">${t.icon}</div>
      <div class="tip-title">${t.title}</div>
      <div class="tip-body">${t.body}</div>
    </div>`;
  });
}

// ============================================================
// DATA: collect / apply (one place that knows the full state)
// ============================================================
function collectState() {
  return {
    app: 'malta-trip', version: 1, savedAt: new Date().toISOString(),
    itinerary: ITIN,
    checked: state.checked, notes: state.notes,
    budget: state.budget, budgetMode: state.budgetMode || '', expenses: state.expenses,
    packing: state.packing, packingCustom: state.packingCustom,
    theme: localStorage.getItem('malta_theme') || 'light',
    autotrack: localStorage.getItem('malta_autotrack') || '1',
  };
}
let applyingState = false;     // guard so loading data doesn't re-trigger a file write
function applyState(d) {
  applyingState = true;
  try {
    if (Array.isArray(d.itinerary)) { ITIN = d.itinerary; saveItinerary(); }
    if (d.checked) { state.checked = d.checked; save('checked', state.checked); }
    if (d.notes) { state.notes = d.notes; save('notes', state.notes); }
    if (typeof d.budget === 'number') { state.budget = d.budget; save('budget', d.budget); }
    if (typeof d.budgetMode === 'string') { state.budgetMode = d.budgetMode; localStorage.setItem('malta_budget_mode', d.budgetMode); }
    if (Array.isArray(d.expenses)) { state.expenses = d.expenses; save('expenses', state.expenses); }
    if (d.packing) { state.packing = d.packing; save('packing', state.packing); }
    if (d.packingCustom) { state.packingCustom = d.packingCustom; save('packing_custom', state.packingCustom); }
    if (d.theme) { localStorage.setItem('malta_theme', d.theme); document.documentElement.setAttribute('data-theme', d.theme); updateThemeBtn(); }
    if (d.autotrack) { localStorage.setItem('malta_autotrack', d.autotrack); }
  } finally { applyingState = false; }
  rerenderEverything();
}

// ---- manual backup file (download / upload) ----
function exportData() {
  const blob = new Blob([JSON.stringify(collectState(), null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `malta-trip-backup-${isoOf(new Date())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function triggerImport() { document.getElementById('importFile').click(); }
function importData(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    let d;
    try { d = JSON.parse(e.target.result); }
    catch (err) { alert('That file is not valid JSON.'); input.value = ''; return; }
    if (!confirm('Import this backup? It replaces your current itinerary, notes, checklist, budget and packing.')) { input.value=''; return; }
    applyState(d);
    alert('Backup imported ✓');
    input.value = '';
  };
  reader.readAsText(file);
}

// ============================================================
// AUTO-SAVE TO A FILE  (File System Access API, Chrome/Edge desktop)
// Pick a file once → every change silently overwrites it.
// localStorage stays as the universal fallback everywhere else.
// ============================================================
let fileHandle = null;          // FileSystemFileHandle when connected
let fileMode = 'none';          // 'unsupported' | 'none' | 'connected' | 'need-permission'
let saveState = 'idle';         // 'idle' | 'saving' | 'saved' | 'error'
let fileSaveTimer = null;

// tiny IndexedDB store to remember the file handle between sessions
function idbDB() {
  return new Promise((res, rej) => {
    const o = indexedDB.open('malta_fs', 1);
    o.onupgradeneeded = () => o.result.createObjectStore('kv');
    o.onsuccess = () => res(o.result);
    o.onerror = () => rej(o.error);
  });
}
async function idbGet(k) { const db = await idbDB(); return new Promise((res, rej) => { const r = db.transaction('kv','readonly').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbSet(k, v) { const db = await idbDB(); return new Promise((res, rej) => { const tx = db.transaction('kv','readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbDel(k) { const db = await idbDB(); return new Promise((res, rej) => { const tx = db.transaction('kv','readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }

async function verifyPermission(handle) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;   // must be from a click
  return false;
}
function setFileMode(m) { fileMode = m; renderSaveBar(); }
function setSaveState(s) { saveState = s; renderSaveBar(); }

// push every change to real-time sync too (no-op if sync isn't enabled).
// applyingState guard stops remote updates from echoing straight back.
function cloudPush() {
  if (!applyingState && window.maltaSync && window.maltaSync.push) window.maltaSync.push();
}
function scheduleFileSave() {
  cloudPush();
  if (fileMode !== 'connected' || applyingState) return;
  setSaveState('saving');
  clearTimeout(fileSaveTimer);
  fileSaveTimer = setTimeout(writeFile, 600);
}
async function writeFile() {
  if (!fileHandle) return;
  try {
    if ((await fileHandle.queryPermission({ mode:'readwrite' })) !== 'granted') { setFileMode('need-permission'); return; }
    const w = await fileHandle.createWritable();
    await w.write(new Blob([JSON.stringify(collectState(), null, 2)], { type:'application/json' }));
    await w.close();
    setSaveState('saved');
  } catch (e) { setSaveState('error'); }
}
async function loadFromFile() {
  try {
    const file = await fileHandle.getFile();
    const text = await file.text();
    if (text && text.trim()) applyState(JSON.parse(text));
    setSaveState('saved');
  } catch (e) { setSaveState('error'); }
}
async function chooseSaveFile() {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'malta-trip-save.json',
      types: [{ description: 'Malta trip save file', accept: { 'application/json': ['.json'] } }],
    });
    fileHandle = handle; await idbSet('saveFileHandle', handle);
    setFileMode('connected'); await writeFile();          // write current state straight away
  } catch (e) { if (e.name !== 'AbortError') alert('Could not set up the save file: ' + e.message); }
}
async function openSaveFile() {
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: 'Malta trip save file', accept: { 'application/json': ['.json'] } }],
    });
    if (!(await verifyPermission(handle))) return;
    fileHandle = handle; await idbSet('saveFileHandle', handle);
    setFileMode('connected'); await loadFromFile();        // the file is the source of truth
  } catch (e) { if (e.name !== 'AbortError') alert('Could not open the save file: ' + e.message); }
}
async function reconnectFile() {
  if (!fileHandle) return chooseSaveFile();
  if (await verifyPermission(fileHandle)) { setFileMode('connected'); await loadFromFile(); }
}
async function disconnectFile() {
  fileHandle = null; try { await idbDel('saveFileHandle'); } catch (e) {}
  setFileMode('none');
}
async function initFileSync() {
  if (!('showSaveFilePicker' in window)) { setFileMode('unsupported'); return; }
  let handle = null; try { handle = await idbGet('saveFileHandle'); } catch (e) {}
  if (!handle) { setFileMode('none'); return; }
  fileHandle = handle;
  try {
    if ((await handle.queryPermission({ mode:'readwrite' })) === 'granted') { setFileMode('connected'); await loadFromFile(); }
    else setFileMode('need-permission');
  } catch (e) { setFileMode('none'); }
}
function renderSaveBar() {
  const bar = document.getElementById('saveBar');
  if (!bar) return;
  bar.className = 'save-bar' + (fileMode === 'connected' ? ' ' + (saveState === 'saving' ? 'saving' : saveState === 'error' ? 'error' : 'connected') : '');
  if (fileMode === 'unsupported') {
    bar.innerHTML = `<span class="save-dot"></span><span class="save-msg">💾 Auto-save-to-file needs Chrome or Edge on desktop. Your data still auto-saves in this browser — use ⬇️ Export for a backup.</span>`;
  } else if (fileMode === 'none') {
    bar.innerHTML = `<span class="save-dot"></span><span class="save-msg">💾 Changes auto-save in this browser. Connect a save file to also auto-save to disk.</span>
      <span class="save-actions"><span class="save-link" onclick="chooseSaveFile()">Set up save file</span><span class="save-link muted" onclick="openSaveFile()">Open existing…</span></span>`;
  } else if (fileMode === 'need-permission') {
    bar.innerHTML = `<span class="save-dot"></span><span class="save-msg">💾 Save file connected${fileHandle ? ` (<span class="save-name">${htmlEscape(fileHandle.name)}</span>)` : ''} — paused for this session.</span>
      <span class="save-actions"><span class="save-link" onclick="reconnectFile()">Resume auto-save</span></span>`;
  } else {
    const msg = saveState === 'saving' ? 'Saving…' : saveState === 'error' ? '⚠️ couldn\'t write file' : 'All changes saved ✓';
    bar.innerHTML = `<span class="save-dot"></span><span class="save-msg">Auto-saving to <span class="save-name">${htmlEscape(fileHandle ? fileHandle.name : '')}</span> · ${msg}</span>
      <span class="save-actions"><span class="save-link muted" onclick="disconnectFile()">Disconnect</span></span>`;
  }
}

function resetItinerary() {
  if (!confirm('Reset the itinerary back to the original Malta plan? Your notes and checkmarks for original stops are kept, but added/edited/removed stops will be lost.')) return;
  localStorage.removeItem('malta_itinerary');
  ITIN = loadItinerary();
  rerenderEverything();
}
function rerenderEverything() {
  openDays = new Set(); editId = null; addDayId = null;
  renderItinerary();
  populateExpenseDays();
  rebuildMap();
  updateBudgetUI(); renderExpenses();
  buildPacking();
  buildWeather();
  updateCountdown();
}

// ============================================================
// NAV
// ============================================================
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab, .bn-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelectorAll(`[data-page="${id}"]`).forEach(t => t.classList.add('active'));
  window.scrollTo({ top: 0 });
  if (id === 'map') setTimeout(() => { initMap(); if (map) map.invalidateSize(); }, 50);
}

// ============================================================
// INIT
// ============================================================
updateThemeBtn();
buildItinerary();
populateExpenseDays();
buildPacking();
buildWeather();
buildTips();
updateBudgetUI();
renderExpenses();
updateCountdown();
setInterval(updateCountdown, 1000);
if (todayInfo().state === 'during') setTimeout(scrollToToday, 300);
renderSaveBar();
initFileSync();

// ============================================================
// PWA: register the service worker for offline support.
// (No-op on file:// or unsupported browsers — the app still runs.)
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker registration failed:', err));
  });
}

// Fallback so the "Share trip" button never throws if sync.js didn't load.
// sync.js overrides this with the real, trip-aware version when available.
if (!window.shareTrip) window.shareTrip = function () { alert('Live sync isn\'t set up yet.'); };
