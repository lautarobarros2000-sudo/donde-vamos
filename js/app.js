const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const CATEGORIES = ['Resto','Chill','Pastas','Clásicos ⭐️','Platitos','Vinilos','Bares','Rooftop','Casual','Asiático'];
const CAT_KEY = { 'Resto':'Resto','Chill':'Chill','Pastas':'Pastas','Clásicos ⭐️':'Clasicos','Platitos':'Platitos','Vinilos':'Vinilos','Bares':'Bares','Rooftop':'Rooftop','Casual':'Casual','Asiático':'Asiatico' };

let allPlaces = [];
let filter = { status: 'todos', category: 'Todos', search: '' };
let currentId = null;

async function init() {
  renderCategoryPills();
  await loadPlaces();
}

async function loadPlaces() {
  const { data, error } = await db.from('places').select('*').order('name');
  if (error) {
    document.getElementById('places-grid').innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div>Error al cargar. Revisá la conexión.</div>';
    return;
  }
  allPlaces = data || [];
  render();
}

function render() {
  renderGrid();
  renderStats();
}

function renderCategoryPills() {
  const el = document.getElementById('categories');
  el.innerHTML = ['Todos', ...CATEGORIES].map(c =>
    `<button class="cat${c === 'Todos' ? ' active' : ''}" onclick="setCat('${c}', this)">${c}</button>`
  ).join('');
}

function renderGrid() {
  const places = filtered();
  const grid = document.getElementById('places-grid');
  if (!places.length) {
    grid.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div>Ningún lugar coincide.</div>';
    return;
  }
  grid.innerHTML = places.map(p => {
    const catKey = CAT_KEY[p.category] || 'Casual';
    const stars = p.our_rating ? '★'.repeat(p.our_rating) : '';
    const visited = p.status === 'ya fui';
    return `
    <div class="place-card${visited ? ' visited' : ' cl-' + catKey}" onclick="openDetail('${p.id}')">
      <div class="card-top">
        <span class="card-name">${esc(p.name)}</span>
        ${visited ? `<span class="badge badge-been">✓ Ya fui</span>` : ''}
      </div>
      <div class="card-meta">
        ${p.neighborhood ? `<span class="card-neighborhood">${esc(p.neighborhood)}</span>` : ''}
        ${p.neighborhood && p.category ? `<span class="sep">·</span>` : ''}
        ${p.category ? `<span class="card-cat cat-${catKey}">${esc(p.category)}</span>` : ''}
      </div>
      ${p.notes ? `<p class="card-notes">${esc(p.notes)}</p>` : ''}
      ${stars ? `<div class="card-stars">${stars}</div>` : ''}
    </div>`;
  }).join('');
}

function renderStats() {
  const total = allPlaces.length;
  const been = allPlaces.filter(p => p.status === 'ya fui').length;
  document.getElementById('stats').textContent = `${been} visitados · ${total - been} pendientes`;
}

function filtered() {
  const s = filter.search.toLowerCase();
  return allPlaces.filter(p => {
    if (filter.status !== 'todos' && p.status !== filter.status) return false;
    if (filter.category !== 'Todos' && p.category !== filter.category) return false;
    if (s && !p.name.toLowerCase().includes(s) && !(p.neighborhood||'').toLowerCase().includes(s) && !(p.notes||'').toLowerCase().includes(s)) return false;
    return true;
  });
}

function setStatusFilter(status, el) {
  filter.status = status;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderGrid();
}

function setCat(cat, el) {
  filter.category = cat;
  document.querySelectorAll('.cat').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderGrid();
}

function filterPlaces() {
  filter.search = document.getElementById('search-input').value;
  renderGrid();
}

function randomPlace() {
  const pending = filtered().filter(p => p.status === 'quiero ir');
  if (!pending.length) { alert('No hay lugares pendientes con el filtro actual.'); return; }
  openDetail(pending[Math.floor(Math.random() * pending.length)].id);
}

function openDetail(id) {
  const p = allPlaces.find(x => x.id === id);
  if (!p) return;
  currentId = id;
  const catKey = CAT_KEY[p.category] || 'Casual';
  const been = p.status === 'ya fui';

  document.getElementById('modal-detail-content').innerHTML = `
    <div class="detail-name">${esc(p.name)}</div>
    <div class="detail-meta">
      ${p.neighborhood ? `<span class="card-neighborhood">${esc(p.neighborhood)}</span>` : ''}
      ${p.category ? `<span class="card-cat cat-${catKey}">${esc(p.category)}</span>` : ''}
      ${p.price_level ? `<span class="card-neighborhood">${'$'.repeat(p.price_level)}</span>` : ''}
      ${p.google_rating ? `<span class="card-neighborhood">⭐ ${p.google_rating}</span>` : ''}
    </div>

    ${p.address ? `<div class="detail-section"><p class="detail-label">Dirección</p><p>${esc(p.address)}</p></div>` : ''}
    ${p.hours ? `<div class="detail-section"><p class="detail-label">Horarios</p><p>${formatHours(p.hours)}</p></div>` : ''}
    ${p.website ? `<div class="detail-section"><a href="${p.website}" target="_blank" style="color:var(--accent);font-size:14px;">🔗 Ver sitio web</a></div>` : ''}

    <button class="btn-toggle ${been ? 'btn-undo' : 'btn-go'}" onclick="toggleVisit()">
      ${been ? '↩ Marcar como pendiente' : '✓ ¡Ya fui!'}
    </button>

    ${been ? `
    <div class="detail-section">
      <p class="detail-label">Rating</p>
      <div class="star-row">
        ${[1,2,3,4,5].map(n => `<span class="star${(p.our_rating||0) >= n ? ' lit' : ''}" onclick="setRating(${n})">★</span>`).join('')}
      </div>
    </div>
    <div class="detail-section">
      <p class="detail-label">Review</p>
      <textarea class="detail-notes-input" id="detail-text" placeholder="Cómo estuvo..." onblur="saveText('review')">${esc(p.review||'')}</textarea>
    </div>` : `
    <div class="detail-section">
      <p class="detail-label">Notas</p>
      <textarea class="detail-notes-input" id="detail-text" placeholder="Por qué querés ir, qué te dijeron..." onblur="saveText('notes')">${esc(p.notes||'')}</textarea>
    </div>`}

    <p class="added-by">Agregado por ${esc(p.added_by || '—')}</p>
  `;

  document.getElementById('modal-detail').classList.remove('hidden');
}

async function toggleVisit() {
  const p = allPlaces.find(x => x.id === currentId);
  const newStatus = p.status === 'ya fui' ? 'quiero ir' : 'ya fui';
  const { error } = await db.from('places').update({ status: newStatus, visited_at: newStatus === 'ya fui' ? new Date().toISOString() : null }).eq('id', currentId);
  if (error) return;
  p.status = newStatus;
  p.visited_at = newStatus === 'ya fui' ? new Date().toISOString() : null;
  openDetail(currentId);
  render();
}

async function setRating(n) {
  const { error } = await db.from('places').update({ our_rating: n }).eq('id', currentId);
  if (error) return;
  allPlaces.find(x => x.id === currentId).our_rating = n;
  openDetail(currentId);
  render();
}

async function saveText(field) {
  const val = document.getElementById('detail-text')?.value;
  if (val === undefined) return;
  await db.from('places').update({ [field]: val }).eq('id', currentId);
  allPlaces.find(x => x.id === currentId)[field] = val;
  renderGrid();
}

function openAddModal() {
  document.getElementById('add-form').reset();
  document.getElementById('btn-save').disabled = false;
  document.getElementById('btn-save').textContent = 'Guardar lugar';
  document.getElementById('modal-add').classList.remove('hidden');
}

async function addPlace(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const place = {
    name: document.getElementById('new-name').value.trim(),
    neighborhood: document.getElementById('new-neighborhood').value.trim() || null,
    category: document.getElementById('new-category').value,
    notes: document.getElementById('new-notes').value.trim() || null,
    added_by: document.getElementById('new-added-by').value,
    status: 'quiero ir',
  };

  const { data, error } = await db.from('places').insert([place]).select();
  if (error) {
    alert('Error al guardar. Intentá de nuevo.');
    btn.disabled = false;
    btn.textContent = 'Guardar lugar';
    return;
  }
  allPlaces.push(data[0]);
  allPlaces.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  closeModal('modal-add');
  render();
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  if (id === 'modal-detail') currentId = null;
}

function handleModalBackdrop(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}

function formatHours(hours) {
  if (typeof hours === 'string') return hours;
  if (Array.isArray(hours)) return hours.join('<br>');
  return JSON.stringify(hours);
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
