/* ==============================================
   RANA ARTSPACE — app.js
   Hanya berisi fungsi PUBLIK (galeri, modal,
   contact, toast, mobile menu, hero slider).
   Supabase client dibuat di sini dan diekspos
   ke window agar admin.js bisa pakai juga.
============================================== */

/* ── Supabase Client ── */
const sbClient = window.supabase.createClient(
  'https://lssnarvapedecidtsyzk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxzc25hcnZhcGVkZWNpZHRzeXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDgzNTksImV4cCI6MjA5ODEyNDM1OX0.mAavWCQ0FglRFnQrxhSBSQtMEbwIlgdq4XGwvY_k1BY',
);
window.sbClient = sbClient; // agar admin.js bisa akses

/* ── Local Storage helpers (watermark saja) ── */
const KEYS = { watermark: 'Clairine-art' };

const defaultWm = { text: '© Clarine ARTSPACE', pos: 'center', opacity: 40, size: 18, color: '#ffffff' };
const defaultProfile = {
  name: 'clairine maharayya',
  tagline: 'Pelukis Independen · Batu Malang',
  email: 'clairine.art.id@gmail.com',
  loc: 'Batu Malang, Indonesia',
  ig: '',
  tt: '',
  bio: 'Halo! Saya calirine, pelukis berbasis di Batu Malang dengan pengalaman lebih dari 5 tahun.',
};

function loadWm() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.watermark)) || defaultWm;
  } catch {
    return defaultWm;
  }
}
function saveWm(w) {
  localStorage.setItem(KEYS.watermark, JSON.stringify(w));
}

/* ── Profile (Supabase) ── */
// Tabel `profiles` di Supabase, satu baris dengan id = 1
// Buat tabel dengan SQL:
//   create table profiles (
//     id int primary key default 1,
//     name text, tagline text, email text,
//     loc text, ig text, tt text, bio text
//   );
//   insert into profiles (id) values (1);

async function loadProfile() {
  try {
    const { data, error } = await sbClient.from('profiles').select('*').eq('id', 1).single();

    if (error || !data) {
      console.warn('loadProfile: pakai default', error?.message);
      return defaultProfile;
    }
    // Gabungkan dengan default supaya field baru tidak undefined
    return { ...defaultProfile, ...data };
  } catch (e) {
    console.error('loadProfile exception:', e);
    return defaultProfile;
  }
}

async function saveProfileData(p) {
  const { error } = await sbClient.from('profiles').upsert({ id: 1, ...p }, { onConflict: 'id' });

  if (error) {
    console.error('saveProfileData:', error.message);
    throw error; // biar admin.js bisa catch & tampil toast error
  }
}

/* ── Gallery ── */
let currentFilter = 'semua';
let _cachedArtworks = [];

const catGrads = {
  lukisan: 'linear-gradient(135deg,#FF8C42,#FF6B9D)',
  sketsa: 'linear-gradient(135deg,#4CC9F0,#06D6A0)',
  digital: 'linear-gradient(135deg,#4CC9F0,#7B2FFF)',
  'cat air': 'linear-gradient(135deg,#FFD166,#FF8C42)',
};
function gradForCat(cat) {
  return catGrads[cat] || 'linear-gradient(135deg,#FF8C42,#FFB085)';
}

async function loadArtworks() {
  const { data, error } = await sbClient.from('artworks').select('*').order('id', { ascending: false });
  if (error) {
    console.error('loadArtworks:', error);
    return [];
  }
  _cachedArtworks = data;
  return data;
}

async function renderGallery() {
  const artworks = await loadArtworks();
  const wm = loadWm();
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  const published = artworks.filter((a) => a.publish);
  const filtered = currentFilter === 'semua' ? published : published.filter((a) => a.cat === currentFilter);

  if (!filtered.length) {
    grid.innerHTML = '<p style="color:var(--muted);font-weight:700;grid-column:1/-1;text-align:center;padding:48px">Belum ada karya di kategori ini.</p>';
    const stat = document.getElementById('heroStatArtworks');
    if (stat) stat.textContent = 0;
    return;
  }

  grid.innerHTML = filtered
    .map(
      (a) => `
    <div class="artwork-card" onclick="openModal(${a.id})">
      <div class="artwork-img" style="background:${gradForCat(a.cat)}">
        ${a.image ? `<img src="${a.image}" alt="${a.title}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">` : `<span style="font-size:4rem">🖼️</span>`}
        <div class="artwork-wm"><span>${wm.text}</span></div>
        ${(a.likes || 0) > 0 ? `<div class="artwork-likes-badge">❤️ ${a.likes}</div>` : ''}
      </div>
      <div class="artwork-info">
        <div class="artwork-cat">${a.cat.toUpperCase()}</div>
        <div class="artwork-title">${a.title}</div>
        <div class="artwork-meta">${a.media} · ${a.year}</div>
        </span>
      </div>
    </div>
  `,
    )
    .join('');

  const stat = document.getElementById('heroStatArtworks');
  if (stat) stat.textContent = published.length;
}

function filterGallery(btn) {
  document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.cat;
  renderGallery();
}

/* ── Modal ── */
async function openModal(id) {
  _currentModalId = id;
  let a = _cachedArtworks.find((x) => x.id === id);
  if (!a) {
    const { data } = await sbClient.from('artworks').select('*').eq('id', id).single();
    a = data;
  }
  if (!a) return;

  const wm = loadWm();
  document.getElementById('modalHeader').style.background = gradForCat(a.cat);

  const modalImg = document.getElementById('modalEmoji');
  if (a.image) {
    modalImg.innerHTML = `
<img src="${a.image}"
style="
width:100%;
height:100%;
object-fit:contain;
object-position:center;
display:block;
background:#000;
">
`;
  } else {
    modalImg.innerHTML = '';
    modalImg.textContent = '🖼️';
  }

  document.getElementById('modalCat').textContent = a.cat.toUpperCase();
  document.getElementById('modalTitle').textContent = a.title;
  document.getElementById('modalDesc').textContent = a.description;
  document.getElementById('modalYear').textContent = a.year;
  document.getElementById('modalMedia').textContent = a.media;
  document.getElementById('modalSize').textContent = a.size;

  const wmEl = document.getElementById('modalWmText');
  wmEl.textContent = wm.text;
  wmEl.style.fontSize = wm.size + 'px';
  wmEl.style.color = wm.color;
  wmEl.style.opacity = wm.opacity / 100;
  wmEl.style.zIndex = '10';
  if (wm.pos === 'bottom-right') {
    Object.assign(wmEl.style, { position: 'absolute', bottom: '12px', right: '12px', top: 'auto', left: 'auto', transform: 'none' });
  } else if (wm.pos === 'diagonal') {
    Object.assign(wmEl.style, { position: '', bottom: '', right: '', top: '', left: '', transform: 'rotate(-30deg)' });
  } else {
    Object.assign(wmEl.style, { position: '', bottom: '', right: '', top: '', left: '', transform: 'none' });
  }

  document.getElementById('artworkModal').classList.add('open');
  document.body.style.overflow = 'hidden';

  const likeCount = a.likes || 0;
  document.getElementById('modalLikeCount').textContent = likeCount;
  const likeBtn = document.getElementById('modalLikeBtn');
  const alreadyLiked = sessionStorage.getItem('liked_' + id);
  likeBtn.classList.toggle('liked', !!alreadyLiked);
}

function closeModal() {
  document.getElementById('artworkModal').classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Like ── */
let _currentModalId = null;

async function likeArtwork() {
  if (!_currentModalId) return;

  const likedKey = 'liked_' + _currentModalId;
  if (sessionStorage.getItem(likedKey)) {
    showToast('❤️ Kamu sudah menyukai karya ini!');
    return;
  }

  const a = _cachedArtworks.find((x) => x.id === _currentModalId);
  if (!a) return;
  const newLikes = (a.likes || 0) + 1;

  const { error } = await sbClient.from('artworks').update({ likes: newLikes }).eq('id', _currentModalId);
  if (error) {
    showToast('❌ Gagal: ' + error.message);
    return;
  }

  sessionStorage.setItem(likedKey, '1');
  a.likes = newLikes;

  document.getElementById('modalLikeCount').textContent = newLikes;
  const btn = document.getElementById('modalLikeBtn');
  btn.classList.add('liked');
  showToast('❤️ Terima kasih sudah menyukai karya ini!');

  await renderGallery();
  renderHeroSlider();
}

function closeModalOnBg(e) {
  if (e.target === document.getElementById('artworkModal')) closeModal();
}
function shareArtwork() {
  if (navigator.share) {
    navigator.share({ title: 'Karya Clairine Artspace', url: location.href });
  } else {
    navigator.clipboard.writeText(location.href);
    showToast('🔗 Link disalin!');
  }
}

/* ── Hero Slider ── */
async function renderHeroSlider() {
  const wrapper = document.getElementById('heroSliderWrapper');
  if (!wrapper) return;
  const artworks = await loadArtworks();
  const published = artworks.filter((a) => a.publish);

  const sorted = [...published].sort((a, b) => (b.likes || 0) - (a.likes || 0));
  const topArtworks = sorted.length > 0 ? sorted.slice(0, Math.min(5, sorted.length)) : published;
  const hasLikes = topArtworks.some((a) => (a.likes || 0) > 0);

  const slides = topArtworks
    .map(
      (a, i) => `
    <div class="slide-item" onclick="openModal(${a.id})" style="cursor:pointer">
      ${a.image ? `<img src="${a.image}" class="slide-img" alt="${a.title}">` : `<div class="slide-art-preview">🖼️</div>`}
      <div class="slide-title">
        ${hasLikes && i === 0 ? '🏆 ' : ''}${a.title}
        ${(a.likes || 0) > 0 ? `<span class="slide-likes">❤️ ${a.likes}</span>` : ''}
      </div>
    </div>
  `,
    )
    .join('');

  if (topArtworks.length === 1) {
    wrapper.innerHTML = slides;
    wrapper.style.animation = 'none';
    wrapper.style.width = '100%';
  } else {
    wrapper.innerHTML = slides + slides;
    wrapper.style.animation = '';
    wrapper.style.width = '';
  }
}

/* ── Contact ── */
emailjs.init({ publicKey: 'sGiQOylvhUEEoSG7s' });

function showPixelPopup() {
  document.getElementById('pixelPopup').classList.add('show');
}
function closePixelPopup() {
  document.getElementById('pixelPopup').classList.remove('show');
}

function sendContact() {
  const nama = document.getElementById('nama').value.trim();
  const email = document.getElementById('email').value.trim();
  const pesan = document.getElementById('pesan').value.trim();
  const btn = document.getElementById('sendBtn');
  if (!nama || !email || !pesan) {
    alert('❌ Semua kolom wajib diisi.');
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '⏳ Mengirim...';
  emailjs
    .send('service_mwajv4p', 'template_w2oiqxa', { from_name: nama, from_email: email, message: pesan })
    .then(() => {
      document.getElementById('nama').value = '';
      document.getElementById('email').value = '';
      document.getElementById('pesan').value = '';
      showPixelPopup();
    })
    .catch((err) => {
      console.error(err);
      alert('❌ Gagal mengirim pesan.');
    })
    .finally(() => {
      btn.disabled = false;
      btn.innerHTML = '✉️ Kirim Pesan';
    });
}

/* ── Toast ── */
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ── Mobile Menu ── */
function toggleMobileMenu() {
  const links = document.querySelector('.nav-links');
  const isOpen = links.style.display === 'flex';
  if (isOpen) {
    links.removeAttribute('style');
  } else {
    Object.assign(links.style, {
      display: 'flex',
      flexDirection: 'column',
      position: 'absolute',
      top: '68px',
      left: '0',
      right: '0',
      background: 'rgba(255,248,242,0.98)',
      padding: '16px 5% 24px',
      borderBottom: '2px solid var(--border)',
      gap: '16px',
      zIndex: '99',
    });
  }
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  const p = await loadProfile();
  const bio = document.getElementById('aboutBio');
  const cMail = document.getElementById('contactEmail');
  const cLoc = document.getElementById('contactLoc');
  if (bio) bio.textContent = p.bio;
  if (cMail) cMail.textContent = p.email;
  if (cLoc) cLoc.textContent = p.loc;

  await renderGallery();
  await renderHeroSlider();
});

document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => {
  if (e.target.tagName === 'IMG') e.preventDefault();
});


// Smooth Scroll Navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();

    const target = document.querySelector(this.getAttribute("href"));

    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    // Tutup menu mobile setelah klik
    if (window.innerWidth <= 768) {
      document.querySelector(".nav-links")?.classList.remove("active");
      document.getElementById("hamburgerBtn")?.classList.remove("active");
    }
  });
});
