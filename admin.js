/* ==============================================
   Clairine ARTSPACE — admin.js
   Semua fungsi dashboard admin.
   Dimuat HANYA di halaman yang butuh admin.
   Bergantung pada: app.js (sbClient, showToast,
   renderGallery, renderHeroSlider, loadWm,
   saveWm, loadProfile, saveProfileData,
   defaultWm, _cachedArtworks)
============================================== */

/* ── Auth ── */
function openAdminLogin() {
  document.getElementById('admin-login').classList.add('show');
}
function closeAdminLogin() {
  document.getElementById('admin-login').classList.remove('show');
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  const err   = document.getElementById('loginErr');

  const { error } = await sbClient.auth.signInWithPassword({ email, password: pass });

  if (error) {
    err.textContent = '❌ Email atau password salah.';
    err.classList.add('show');
    document.getElementById('loginPass').value = '';
    return;
  }

  err.classList.remove('show');
  document.getElementById('admin-login').classList.remove('show');
  document.getElementById('admin-dashboard').classList.add('show');
  document.body.style.overflow = 'hidden';
  await renderDashboard();
  await fillProfileForm();
  syncWmForm();
}

async function doLogout() {
  await sbClient.auth.signOut();
  document.getElementById('admin-dashboard').classList.remove('show');
  document.body.style.overflow = '';
  showToast('👋 Sampai jumpa!');
}

/* ── Dashboard Tab ── */
function switchDashTab(tab, btn) {
  document.querySelectorAll('.dash-section').forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.dash-tab').forEach((b) => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
}

/* ── Dashboard Overview ── */
async function renderDashboard() {
  const { data: artworks, error } = await sbClient
    .from('artworks').select('*').order('id', { ascending: false });
  if (error) { showToast('❌ Gagal load data'); return; }
  window._cachedArtworks = artworks;

  document.getElementById('dashStats').innerHTML = `
    <div class="dash-stat"><div class="dash-stat-num">${artworks.length}</div><div class="dash-stat-label">Total Karya</div></div>
    <div class="dash-stat"><div class="dash-stat-num">${artworks.filter((a) => a.publish).length}</div><div class="dash-stat-label">Dipublikasikan</div></div>
    <div class="dash-stat"><div class="dash-stat-num">${artworks.filter((a) => !a.publish).length}</div><div class="dash-stat-label">Draft</div></div>
  `;

  document.getElementById('artworkTableBody').innerHTML = artworks.map((a) => `
    <div class="atable-row">
      <div>
        <div class="atable-thumb">
          ${a.image ? `<img src="${a.image}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : '🖼️'}
        </div>
      </div>
      <div>
        <div class="atable-title">${a.title}</div>
        <div class="atable-cat">${a.media || '-'}</div>
      </div>
      <div style="font-size:0.82rem;font-weight:700;color:var(--muted)">${a.cat}</div>
      <div>
        <button class="pub-badge ${a.publish ? 'published' : 'draft'}" onclick="togglePublish(${a.id})">
          ${a.publish ? '✅ Publish' : '📝 Draft'}
        </button>
      </div>
      <div class="atable-actions">
        <button class="act-btn act-edit" onclick="editArtwork(${a.id})" title="Edit">✏️</button>
        <button class="act-btn act-del"  onclick="deleteArtwork(${a.id})" title="Hapus">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function togglePublish(id) {
  const a = (window._cachedArtworks || []).find((x) => x.id === id);
  if (!a) return;
  const { error } = await sbClient.from('artworks').update({ publish: !a.publish }).eq('id', id);
  if (error) { showToast('❌ Gagal: ' + error.message); return; }
  await renderDashboard();
  await renderGallery();
  renderHeroSlider();
  showToast(a.publish ? '📝 Dijadikan draft' : '✅ Dipublikasikan!');
}

async function deleteArtwork(id) {
  if (!confirm('Hapus karya ini? Tidak bisa dibatalkan.')) return;
  const a = (window._cachedArtworks || []).find((x) => x.id === id);
  if (a?.image) {
    const parts = a.image.split('/artworks/');
    if (parts[1]) await sbClient.storage.from('artworks').remove([parts[1]]);
  }
  const { error } = await sbClient.from('artworks').delete().eq('id', id);
  if (error) { showToast('❌ Gagal hapus: ' + error.message); return; }
  await renderDashboard();
  await renderGallery();
  renderHeroSlider();
  showToast('🗑️ Karya dihapus');
}

/* ── Upload / Edit Karya ── */
let _selectedFile = null;

function triggerFileInput() { document.getElementById('fileInput').click(); }
function dragOver(e)  { e.preventDefault(); document.getElementById('uploadZone').classList.add('drag'); }
function dragLeave()  { document.getElementById('uploadZone').classList.remove('drag'); }
function dropFile(e)  { e.preventDefault(); dragLeave(); handleFileSelect({ target: { files: e.dataTransfer.files } }); }

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  _selectedFile = file;
  document.getElementById('uploadZoneIcon').textContent = '🖼️';
  document.getElementById('uploadZoneText').textContent = '✅ ' + file.name;
  document.getElementById('uploadZoneSub').textContent  = (file.size / 1024 / 1024).toFixed(2) + ' MB — Siap diupload!';
}

async function uploadArtwork(isDraft = false) {
  const title = document.getElementById('upTitle').value.trim();
  if (!title) { showToast('⚠️ Judul wajib diisi!'); return; }

  const editId = parseInt(document.getElementById('tab-upload').dataset.editId || '0');
  let imageUrl = null;

  if (_selectedFile) {
    showToast('⏳ Mengupload gambar...');
    const ext      = _selectedFile.name.split('.').pop();
    const filename = Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
    const { error: upErr } = await sbClient.storage.from('artworks').upload(filename, _selectedFile, { cacheControl: '3600', upsert: false });
    if (upErr) { showToast('❌ Upload gambar gagal: ' + upErr.message); return; }
    const { data: urlData } = sbClient.storage.from('artworks').getPublicUrl(filename);
    imageUrl = urlData.publicUrl;
  } else if (editId) {
    const existing = (window._cachedArtworks || []).find((a) => a.id === editId);
    imageUrl = existing?.image || null;
  }

  const artwork = {
    title,
    cat:         document.getElementById('upCat').value,
    media:       document.getElementById('upMedia').value   || 'Tidak disebutkan',
    year:        parseInt(document.getElementById('upYear').value) || 2026,
    size:        document.getElementById('upSize').value    || '-',
    description: document.getElementById('upDesc').value    || 'Tidak ada deskripsi.',
    publish:     !isDraft,
    image:       imageUrl,
  };

  const { error } = editId
    ? await sbClient.from('artworks').update(artwork).eq('id', editId)
    : await sbClient.from('artworks').insert([artwork]);

  if (error) { showToast('❌ Gagal simpan: ' + error.message); return; }

  resetUploadForm();
  await renderDashboard();
  await renderGallery();
  renderHeroSlider();
  showToast(isDraft ? '📝 Disimpan sebagai draft!' : '🎉 Karya berhasil dipublikasikan!');
}

function saveAsDraft() { uploadArtwork(true); }

function editArtwork(id) {
  const a = (window._cachedArtworks || []).find((x) => x.id === id);
  if (!a) return;

  document.querySelectorAll('.dash-section').forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.dash-tab').forEach((b) => b.classList.remove('active'));
  document.getElementById('tab-upload').classList.add('active');
  document.querySelectorAll('.dash-tab')[1]?.classList.add('active');

  document.getElementById('upTitle').value = a.title;
  document.getElementById('upCat').value   = a.cat;
  document.getElementById('upMedia').value = a.media   || '';
  document.getElementById('upYear').value  = a.year    || 2026;
  document.getElementById('upSize').value  = a.size    || '';
  document.getElementById('upDesc').value  = a.description || '';
  document.getElementById('uploadZoneIcon').textContent = a.image ? '✅' : '☁️';
  document.getElementById('uploadZoneText').textContent = a.image ? 'Gambar: ' + a.title : 'Belum ada gambar';
  document.getElementById('uploadZoneSub').textContent  = 'Klik untuk ganti gambar';

  _selectedFile = null;
  document.getElementById('tab-upload').dataset.editId = id;
  showToast('✏️ Mode edit aktif');
}

function resetUploadForm() {
  ['upTitle', 'upMedia', 'upSize', 'upDesc'].forEach((id) => { document.getElementById(id).value = ''; });
  document.getElementById('upYear').value  = 2026;
  document.getElementById('upCat').value   = 'lukisan';
  document.getElementById('uploadZoneIcon').textContent = '☁️';
  document.getElementById('uploadZoneText').textContent = 'Drag & drop gambar di sini, atau klik untuk pilih file';
  document.getElementById('uploadZoneSub').textContent  = 'Mendukung JPG, PNG, WEBP · Maks. 10MB';
  document.getElementById('fileInput').value = '';
  _selectedFile = null;
  delete document.getElementById('tab-upload').dataset.editId;
}

/* ── Watermark ── */
function updateWmPreview() {
  const wm  = loadWm();
  const text    = document.getElementById('wmText')?.value    ?? wm.text;
  const pos     = document.getElementById('wmPos')?.value     ?? wm.pos;
  const opacity = document.getElementById('wmOpacity')?.value ?? wm.opacity;
  const size    = document.getElementById('wmSize')?.value    ?? wm.size;
  const color   = document.getElementById('wmColor')?.value   ?? wm.color;

  const el = document.getElementById('wmPreviewText');
  if (!el) return;
  el.textContent        = text;
  el.style.fontSize     = size + 'px';
  el.style.color        = color;
  el.style.opacity      = (opacity / 100).toFixed(2);
  el.style.position     = 'absolute';

  if (pos === 'center') {
    Object.assign(el.style, { top:'50%', left:'50%', bottom:'auto', right:'auto', transform:'translate(-50%,-50%)' });
  } else if (pos === 'bottom-right') {
    Object.assign(el.style, { top:'auto', left:'auto', bottom:'12px', right:'12px', transform:'none' });
  } else {
    Object.assign(el.style, { top:'50%', left:'50%', bottom:'auto', right:'auto', transform:'translate(-50%,-50%) rotate(-30deg)' });
  }
}

function syncWmForm() {
  const wm = loadWm();
  document.getElementById('wmText').value    = wm.text;
  document.getElementById('wmPos').value     = wm.pos;
  document.getElementById('wmOpacity').value = wm.opacity;
  document.getElementById('wmSize').value    = wm.size;
  document.getElementById('wmColor').value   = wm.color;
  document.getElementById('wmOpacityVal').textContent = wm.opacity + '%';
  document.getElementById('wmSizeVal').textContent    = wm.size + 'px';
  updateWmPreview();
}

function saveWatermark() {
  const wm = {
    text:    document.getElementById('wmText').value,
    pos:     document.getElementById('wmPos').value,
    opacity: parseInt(document.getElementById('wmOpacity').value),
    size:    parseInt(document.getElementById('wmSize').value),
    color:   document.getElementById('wmColor').value,
  };
  saveWm(wm);
  renderGallery();
  showToast('💧 Setting watermark disimpan!');
}
function applyWmToAll() { saveWatermark(); showToast('🔄 Watermark diterapkan ke semua karya!'); }

/* ── Profil ── */
async function fillProfileForm() {
  const p = await loadProfile();
  document.getElementById('profName').value    = p.name;
  document.getElementById('profTagline').value = p.tagline;
  document.getElementById('profEmail').value   = p.email;
  document.getElementById('profLoc').value     = p.loc;
  document.getElementById('profIG').value      = p.ig  || '';
  document.getElementById('profTT').value      = p.tt  || '';
  document.getElementById('profBio').value     = p.bio;
}

async function saveProfile() {
  const p = {
    name:    document.getElementById('profName').value,
    tagline: document.getElementById('profTagline').value,
    email:   document.getElementById('profEmail').value,
    loc:     document.getElementById('profLoc').value,
    ig:      document.getElementById('profIG').value,
    tt:      document.getElementById('profTT').value,
    bio:     document.getElementById('profBio').value,
  };

  try {
    await saveProfileData(p);
  } catch (e) {
    showToast('❌ Gagal simpan profil: ' + e.message);
    return;
  }

  const bio   = document.getElementById('aboutBio');
  const cMail = document.getElementById('contactEmail');
  const cLoc  = document.getElementById('contactLoc');
  if (bio)   bio.textContent   = p.bio;
  if (cMail) cMail.textContent = p.email;
  if (cLoc)  cLoc.textContent  = p.loc;
  showToast('✅ Profil berhasil disimpan!');
}
