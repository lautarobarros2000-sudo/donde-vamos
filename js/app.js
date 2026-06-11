const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── STATE ──
let categories    = [];
let allPlaceCats  = [];   // { place_id, category_id }
let allPlaces     = [];
let placeCounts   = {};   // categoryId → count
let currentCategoryId = null;
let currentPlaces = [];
let statusFilter  = 'todos';
let editMode      = false;
let reviewRating  = 0;
let chosenColor   = '#8B2230';

const PALETTE = [
  '#7A1E2E','#8B2230','#C41230','#6A1020',
  '#2D6A4F','#1A4A35','#3A8A60','#256A48',
  '#9B5E1A','#7A3A00','#C47C0A','#8A5010',
  '#1A3A8A','#0E2A6A','#2A5AB5','#1A4898',
  '#5E3A8A','#3A1A6A','#8A5AB5','#4A2878',
  '#0E3E52','#0A2A3A','#1A6A8A','#124A60',
  '#3A3A3A','#1A1A1A','#5A5A5A','#2A2A2A',
  '#7A5A0A','#5A3A00','#A08020','#6A4A08',
];

// ── INIT ──
async function init() {
  await Promise.all([loadCategories(), loadAllPlaceCats(), loadAllPlaces()]);
  showHome();
}

async function loadCategories() {
  const { data } = await db.from('categories').select('*').order('sort_order');
  categories = data || [];
}

async function loadAllPlaceCats() {
  const { data } = await db.from('place_categories').select('place_id,category_id');
  allPlaceCats = data || [];
  placeCounts = {};
  allPlaceCats.forEach(pc => {
    placeCounts[pc.category_id] = (placeCounts[pc.category_id] || 0) + 1;
  });
}

async function loadAllPlaces() {
  const { data } = await db.from('places').select('*').order('name');
  allPlaces = data || [];
}

// ── NAVIGATION ──
function showHome() {
  currentCategoryId = null;
  document.getElementById('view-home').classList.remove('hidden');
  document.getElementById('view-category').classList.add('hidden');
  renderCatGrid();
}

function goHome() { showHome(); }

async function openCategory(catId) {
  currentCategoryId = catId;
  statusFilter = 'todos';

  document.getElementById('view-home').classList.add('hidden');
  document.getElementById('view-category').classList.remove('hidden');

  // Reset tab
  document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === 0));

  const cat = categories.find(c => c.id === catId);
  document.getElementById('cat-header-info').innerHTML = cat
    ? `<span class="cat-header-emoji">${cat.emoji}</span>
       <span class="cat-header-name" style="color:${cat.color}">${esc(cat.name)}</span>`
    : '';

  document.getElementById('cat-places-list').innerHTML =
    '<div class="loading-state"><div class="empty-text">Cargando...</div></div>';

  await loadPlacesForCat(catId);
  renderCatPlaces();
}

async function loadPlacesForCat(catId) {
  const ids = allPlaceCats.filter(pc => pc.category_id === catId).map(pc => pc.place_id);
  if (!ids.length) { currentPlaces = []; return; }
  const { data } = await db.from('places').select('*').in('id', ids).order('name');
  currentPlaces = data || [];
}

// ── RENDER HOME ──
function renderCatGrid() {
  const grid = document.getElementById('cat-grid');
  if (!categories.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🍽️</div><div class="empty-text">Creá tu primera categoría abajo</div></div>';
    return;
  }
  grid.innerHTML = categories.map(cat => {
    const n = placeCounts[cat.id] || 0;
    return `
    <div class="cat-tile" style="background:${cat.color}" onclick="openCategory('${cat.id}')">
      <div class="cat-tile-emoji">${cat.emoji}</div>
      <div class="cat-tile-name">${esc(cat.name)}</div>
      <div class="cat-tile-count">${n} lugar${n !== 1 ? 'es' : ''}</div>
      <button class="cat-edit-btn" onclick="event.stopPropagation();openCategoryModal('${cat.id}')">✎</button>
    </div>`;
  }).join('');
}

// ── RENDER CATEGORY VIEW ──
function renderCatPlaces() {
  const filtered = currentPlaces.filter(p =>
    statusFilter === 'todos' || p.status === statusFilter
  );
  const el = document.getElementById('cat-places-list');
  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🍽️</div><div class="empty-text">Sin lugares aquí aún</div></div>';
    return;
  }
  el.innerHTML = filtered.map(p => placeCard(p)).join('');
}

function setFilter(f, el) {
  statusFilter = f;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderCatPlaces();
}

// ── PLACE CARD ──
function placeCard(p) {
  const cats = categories.filter(c =>
    allPlaceCats.some(pc => pc.place_id === p.id && pc.category_id === c.id)
  );
  const been = p.status === 'ya fui';
  return `
  <div class="place-card" onclick="openPlaceDetail('${p.id}')">
    <div class="card-left">
      <div class="card-name">${esc(p.name)}</div>
      ${p.neighborhood ? `<div class="card-hood">${esc(p.neighborhood)}</div>` : ''}
      <div class="card-cats">
        ${cats.map(c => `<span class="cat-pill" style="background:${c.color}">${c.emoji} ${esc(c.name)}</span>`).join('')}
      </div>
      ${p.notes ? `<div class="card-notes">${esc(p.notes)}</div>` : ''}
    </div>
    <div class="card-right">
      <span class="status-badge ${been ? 'badge-been' : 'badge-want'}">${been ? '✓ Ya fui' : '♡'}</span>
    </div>
  </div>`;
}

// ── SEARCH ──
function onSearch(q) {
  const term = q.trim().toLowerCase();
  const results = document.getElementById('search-results');
  const catSection = document.getElementById('cat-section');

  if (!term) {
    results.classList.add('hidden');
    catSection.classList.remove('hidden');
    return;
  }

  catSection.classList.add('hidden');
  results.classList.remove('hidden');

  const matches = allPlaces.filter(p =>
    p.name.toLowerCase().includes(term) ||
    (p.neighborhood || '').toLowerCase().includes(term) ||
    (p.notes || '').toLowerCase().includes(term)
  );

  const grid = document.getElementById('search-grid');
  if (!matches.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-text">Sin resultados</div></div>';
    return;
  }
  grid.innerHTML = matches.map(p => placeCard(p)).join('');
}

// ── PLACE DETAIL ──
async function openPlaceDetail(placeId) {
  const p = allPlaces.find(x => x.id === placeId);
  if (!p) return;

  const [{ data: reviews }] = await Promise.all([
    db.from('reviews').select('*').eq('place_id', placeId),
  ]);

  const cats = categories.filter(c =>
    allPlaceCats.some(pc => pc.place_id === placeId && pc.category_id === c.id)
  );

  const been = p.status === 'ya fui';
  const lautiR = (reviews || []).find(r => r.user_name === 'Lauti');
  const pipuR  = (reviews || []).find(r => r.user_name === 'Pipu');

  const ttQuery = encodeURIComponent(p.name);
  const ttAppUrl = `snssdk1233://search?keyword=${ttQuery}`;
  const ttWebUrl = `https://www.tiktok.com/search?q=${ttQuery}`;

  let igHtml;
  if (p.instagram_handle) {
    const igAppUrl = `instagram://user?username=${encodeURIComponent(p.instagram_handle)}`;
    const igWebUrl = `https://www.instagram.com/${p.instagram_handle}/`;
    igHtml = `<a href="${igAppUrl}" class="social-btn" onclick="appFallback(${JSON.stringify(igWebUrl)})">&#128247; @${esc(p.instagram_handle)}</a>`;
  } else {
    const igGoogleUrl = `https://www.google.com/search?q=${encodeURIComponent(p.name + ' instagram')}`;
    igHtml = `<a href="${igGoogleUrl}" target="_blank" rel="noopener" class="social-btn">&#128269; Buscar Instagram</a>`;
  }

  document.getElementById('modal-place-body').innerHTML = `
    <div class="detail-name">${esc(p.name)}</div>
    ${p.neighborhood ? `<div class="detail-hood">${esc(p.neighborhood)}</div>` : ''}
    <div class="detail-cats">
      ${cats.map(c => `<span class="detail-cat-pill" style="background:${c.color}">${c.emoji} ${esc(c.name)}</span>`).join('')}
    </div>

    <div class="social-btns">
      ${igHtml}
      <a href="${ttAppUrl}" class="social-btn" onclick="appFallback(${JSON.stringify(ttWebUrl)})">&#127925; TikTok</a>
    </div>

    ${p.notes ? `
    <div class="detail-section">
      <div class="detail-label">Notas</div>
      <div class="detail-notes-text">${esc(p.notes)}</div>
    </div>` : ''}

    <button class="btn-visit ${been ? 'btn-undo' : 'btn-go'}" onclick="toggleVisit('${p.id}')">
      ${been ? '↩ Marcar como pendiente' : '✓ ¡Ya fui!'}
    </button>

    <div class="detail-section">
      <div class="detail-label">Reviews</div>
      <div class="reviews-grid">
        ${reviewCard('Lauti', lautiR)}
        ${reviewCard('Pipu', pipuR)}
      </div>
      <button class="btn-review" onclick="openReviewModal('${p.id}')">+ Escribir mi review</button>
    </div>

    <div class="detail-footer">
      <span>Por ${esc(p.added_by || '—')}</span>
      <button class="btn-edit-place" onclick="openPlaceModal('${p.id}', null)">✎ Editar lugar</button>
    </div>
  `;

  document.getElementById('modal-place').classList.remove('hidden');
}

function reviewCard(userName, r) {
  if (!r) {
    return `<div class="review-card">
      <div class="review-top">
        <span class="reviewer-name">${userName}</span>
        <span class="no-review">Sin review aún</span>
      </div>
    </div>`;
  }
  const stars = r.rating
    ? '★'.repeat(r.rating) + '<span style="opacity:.25">' + '★'.repeat(5 - r.rating) + '</span>'
    : '';
  return `<div class="review-card">
    <div class="review-top">
      <span class="reviewer-name">${userName}</span>
      ${stars ? `<span class="review-stars">${stars}</span>` : ''}
    </div>
    ${r.dishes ? `<div class="review-dishes-label">Platos</div><div class="review-text">${esc(r.dishes)}</div>` : ''}
    ${r.notes  ? `<div class="review-text" style="margin-top:${r.dishes ? '8px' : '0'}">${esc(r.notes)}</div>` : ''}
  </div>`;
}

// ── VISIT TOGGLE ──
async function toggleVisit(placeId) {
  const p = allPlaces.find(x => x.id === placeId);
  if (!p) return;
  const newStatus = p.status === 'ya fui' ? 'quiero ir' : 'ya fui';
  const { error } = await db.from('places').update({
    status: newStatus,
    visited_at: newStatus === 'ya fui' ? new Date().toISOString() : null,
  }).eq('id', placeId);
  if (error) return;
  p.status = newStatus;
  const inCurrent = currentPlaces.find(x => x.id === placeId);
  if (inCurrent) inCurrent.status = newStatus;
  await openPlaceDetail(placeId);
  if (currentCategoryId) renderCatPlaces();
}

// ── REVIEW MODAL ──
function openReviewModal(placeId) {
  reviewRating = 0;
  document.getElementById('fr-place-id').value = placeId;
  document.getElementById('fr-dishes').value = '';
  document.getElementById('fr-notes').value = '';
  document.querySelectorAll('#review-form .user-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  updateStars(0);
  document.getElementById('modal-review').classList.remove('hidden');
}

function setReviewRating(n) {
  reviewRating = n;
  updateStars(n);
}

function updateStars(n) {
  document.querySelectorAll('#review-stars .star').forEach((s, i) => s.classList.toggle('lit', i < n));
}

async function saveReview(e) {
  e.preventDefault();
  const btn = e.submitter;
  btn.disabled = true;
  const placeId  = document.getElementById('fr-place-id').value;
  const userName = document.querySelector('#review-form .user-btn.active')?.dataset.user;
  const dishes   = document.getElementById('fr-dishes').value.trim() || null;
  const notes    = document.getElementById('fr-notes').value.trim() || null;

  const { error } = await db.from('reviews').upsert(
    { place_id: placeId, user_name: userName, rating: reviewRating || null, dishes, notes },
    { onConflict: 'place_id,user_name' }
  );
  btn.disabled = false;
  if (error) { alert('Error al guardar. Intentá de nuevo.'); return; }
  closeModal('modal-review');
  await openPlaceDetail(placeId);
}

// ── ADD / EDIT PLACE ──
function openPlaceModal(placeId, defaultCatId) {
  const form = document.getElementById('add-place-form');
  form.reset();
  document.getElementById('fp-id').value = '';
  document.getElementById('fp-precat').value = defaultCatId || '';
  document.getElementById('add-place-title').textContent = 'Agregar lugar';

  document.querySelectorAll('#add-place-form .user-btn').forEach((b, i) => b.classList.toggle('active', i === 0));

  if (placeId) {
    const p = allPlaces.find(x => x.id === placeId);
    if (p) {
      document.getElementById('add-place-title').textContent = 'Editar lugar';
      document.getElementById('fp-id').value = p.id;
      document.getElementById('fp-name').value = p.name || '';
      document.getElementById('fp-neighborhood').value = p.neighborhood || '';
      document.getElementById('fp-instagram').value = p.instagram_handle || '';
      document.getElementById('fp-notes').value = p.notes || '';
      const addedBtn = document.querySelector(`#add-place-form .user-btn[data-user="${p.added_by}"]`);
      if (addedBtn) {
        document.querySelectorAll('#add-place-form .user-btn').forEach(b => b.classList.remove('active'));
        addedBtn.classList.add('active');
      }
      const selCats = allPlaceCats.filter(pc => pc.place_id === p.id).map(pc => pc.category_id);
      renderCatChecks(selCats);
      closeModal('modal-place');
      document.getElementById('modal-add-place').classList.remove('hidden');
      return;
    }
  }

  const presel = defaultCatId ? [defaultCatId] : [];
  renderCatChecks(presel);
  closeModal('modal-place');
  document.getElementById('modal-add-place').classList.remove('hidden');
}

function renderCatChecks(selectedIds) {
  document.getElementById('fp-categories').innerHTML = categories.map(cat => {
    const on = selectedIds.includes(cat.id);
    return `<label class="cat-check${on ? ' on' : ''}" onclick="toggleCheck(this)">
      <input type="checkbox" value="${cat.id}"${on ? ' checked' : ''}>
      ${cat.emoji} ${esc(cat.name)}
    </label>`;
  }).join('');
}

function toggleCheck(label) {
  const cb = label.querySelector('input');
  cb.checked = !cb.checked;
  label.classList.toggle('on', cb.checked);
}

function pickUser(el, formId) {
  document.querySelectorAll(`#${formId} .user-btn`).forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

async function savePlace(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-save-place');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const id           = document.getElementById('fp-id').value;
  const name         = document.getElementById('fp-name').value.trim();
  const neighborhood = document.getElementById('fp-neighborhood').value.trim() || null;
  const instagram_handle = document.getElementById('fp-instagram').value.trim().replace(/^@/, '') || null;
  const notes        = document.getElementById('fp-notes').value.trim() || null;
  const added_by     = document.querySelector('#add-place-form .user-btn.active')?.dataset.user;
  const selCatIds    = [...document.querySelectorAll('#fp-categories input:checked')].map(cb => cb.value);

  let placeId = id;

  if (id) {
    const { error } = await db.from('places').update({ name, neighborhood, instagram_handle, notes }).eq('id', id);
    if (error) { alert('Error al guardar.'); btn.disabled = false; btn.textContent = 'Guardar'; return; }
    const local = allPlaces.find(p => p.id === id);
    if (local) Object.assign(local, { name, neighborhood, instagram_handle, notes });
    const inCurrent = currentPlaces.find(p => p.id === id);
    if (inCurrent) Object.assign(inCurrent, { name, neighborhood, instagram_handle, notes });
  } else {
    const { data, error } = await db.from('places')
      .insert([{ name, neighborhood, instagram_handle, notes, added_by, status: 'quiero ir' }])
      .select();
    if (error) { alert('Error al guardar.'); btn.disabled = false; btn.textContent = 'Guardar'; return; }
    placeId = data[0].id;
    allPlaces.push(data[0]);
    allPlaces.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  // Sync place_categories
  await db.from('place_categories').delete().eq('place_id', placeId);
  if (selCatIds.length) {
    await db.from('place_categories').insert(selCatIds.map(cid => ({ place_id: placeId, category_id: cid })));
  }

  // Update local allPlaceCats + placeCounts
  allPlaceCats = allPlaceCats.filter(pc => pc.place_id !== placeId);
  selCatIds.forEach(cid => allPlaceCats.push({ place_id: placeId, category_id: cid }));
  placeCounts = {};
  allPlaceCats.forEach(pc => { placeCounts[pc.category_id] = (placeCounts[pc.category_id] || 0) + 1; });

  closeModal('modal-add-place');
  btn.disabled = false;
  btn.textContent = 'Guardar';

  renderCatGrid();
  if (currentCategoryId) {
    await loadPlacesForCat(currentCategoryId);
    renderCatPlaces();
  }
}

// ── CATEGORY MODAL ──
function openCategoryModal(catId) {
  const cat = catId ? categories.find(c => c.id === catId) : null;
  document.getElementById('cat-modal-title').textContent = cat ? 'Editar categoría' : 'Nueva categoría';
  document.getElementById('fc-id').value    = catId || '';
  document.getElementById('fc-name').value  = cat?.name  || '';
  document.getElementById('fc-emoji').value = cat?.emoji || '';
  chosenColor = cat?.color || '#8B2230';
  renderColorGrid();
  document.getElementById('modal-category').classList.remove('hidden');
}

function renderColorGrid() {
  document.getElementById('color-grid').innerHTML = PALETTE.map(color => `
    <div class="color-swatch${color === chosenColor ? ' selected' : ''}"
         style="background:${color}"
         onclick="pickColor('${color}',this)">
    </div>`).join('');
}

function pickColor(color, el) {
  chosenColor = color;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
}

async function saveCategory(e) {
  e.preventDefault();
  const btn = e.submitter;
  btn.disabled = true;
  const id    = document.getElementById('fc-id').value;
  const name  = document.getElementById('fc-name').value.trim();
  const emoji = document.getElementById('fc-emoji').value.trim() || '🍽️';
  const color = chosenColor;

  if (id) {
    const { error } = await db.from('categories').update({ name, emoji, color }).eq('id', id);
    btn.disabled = false;
    if (error) { alert('Error.'); return; }
    const cat = categories.find(c => c.id === id);
    if (cat) Object.assign(cat, { name, emoji, color });
  } else {
    const sort_order = categories.length + 1;
    const { data, error } = await db.from('categories')
      .insert([{ name, emoji, color, sort_order }]).select();
    btn.disabled = false;
    if (error) { alert('Error.'); return; }
    categories.push(data[0]);
  }

  closeModal('modal-category');
  renderCatGrid();
}

// ── EDIT MODE ──
function toggleEditMode() {
  editMode = !editMode;
  document.getElementById('app').classList.toggle('edit-mode', editMode);
  document.getElementById('btn-edit-mode').classList.toggle('active', editMode);
}

// ── APP DEEP LINK FALLBACK ──
// Fires alongside a custom-scheme href (snssdk1233://, instagram://).
// If the app opens, window loses focus and we cancel the web fallback.
// If the app is not installed, after 1.5s we open the web URL.
function appFallback(webUrl) {
  const t = setTimeout(() => window.open(webUrl, '_blank', 'noopener'), 1500);
  const cancel = () => clearTimeout(t);
  window.addEventListener('blur', cancel, { once: true });
  document.addEventListener('visibilitychange', cancel, { once: true });
}

// ── MODAL HELPERS ──
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function backdropClose(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}

// ── UTILS ──
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init();
