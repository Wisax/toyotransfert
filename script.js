/* ============================================
   TOYO — script.js
   Team Créa · Partage de fichiers
   ============================================ */

/* ══════════════════════════════════════════
   SUPABASE CONFIG
══════════════════════════════════════════ */
const SUPABASE_URL    = 'https://cmaidtfztwhmlkcshhpu.supabase.co';
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtYWlkdGZ6dHdobWxrY3NoaHB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTA4NjMsImV4cCI6MjA4NzA4Njg2M30.tnGa1pLIfkvxrApi2nOgKdBCAryqDSigKVTbMp2O1Jw';
const BUCKET          = 'TOYOTRANSFERT';

/* ══════════════════════════════════════════
   EMAILJS CONFIG
══════════════════════════════════════════ */
const EMAILJS_SERVICE  = 'service_l18cbua';
const EMAILJS_TEMPLATE = 'template_5gemqfk';
const EMAILJS_KEY      = 'WU9tc-nJfRiqigcPN';

/**
 * Upload un fichier dans Supabase Storage
 * @param {string} folder  - code unique du transfert
 * @param {File}   file
 * @returns {Promise<string>} URL publique du fichier
 */
async function uploadToSupabase(folder, file) {
  const path = `${folder}/${file.name}`;
  const res  = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method  : 'POST',
    headers : {
      'Authorization' : `Bearer ${SUPABASE_ANON}`,
      'Content-Type'  : file.type || 'application/octet-stream',
      'x-upsert'      : 'true'
    },
    body: file
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Upload échoué (${res.status})`);
  }

  // URL publique
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
let selectedFiles = [];
let transfers = JSON.parse(localStorage.getItem('toyo_transfers') || '[]');

/* ══════════════════════════════════════════
   DOM REFS
══════════════════════════════════════════ */
const fileInput       = document.getElementById('fileInput');
const dropZone        = document.getElementById('dropZone');
const filesList       = document.getElementById('filesList');
const sendBtn         = document.getElementById('sendBtn');
const progressWrap    = document.getElementById('progressWrap');
const progressFill    = document.getElementById('progressFill');
const progressPct     = document.getElementById('progressPct');
const progressText    = document.getElementById('progressText');
const successOverlay  = document.getElementById('successOverlay');
const linkUrl         = document.getElementById('linkUrl');
const linkBox         = document.getElementById('linkBox');
const successSub      = document.getElementById('successSub');
const copySuccessEl   = document.getElementById('copySuccess');
const toast           = document.getElementById('toast');
const transfersGrid   = document.getElementById('transfersGrid');
const browseBtn       = document.getElementById('browseBtn');

/* ══════════════════════════════════════════
   FILE INPUT EVENTS
══════════════════════════════════════════ */

browseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  addFiles([...e.target.files]);
  fileInput.value = '';
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove('drag-over');
  }
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  addFiles([...e.dataTransfer.files]);
});

/* ══════════════════════════════════════════
   FILE MANAGEMENT
══════════════════════════════════════════ */

function addFiles(newFiles) {
  selectedFiles.push(...newFiles);
  renderFiles();
}

function removeFile(idx) {
  selectedFiles.splice(idx, 1);
  renderFiles();
}

function renderFiles() {
  filesList.innerHTML = '';

  if (selectedFiles.length === 0) {
    filesList.classList.remove('has-files');
    return;
  }

  filesList.classList.add('has-files');

  selectedFiles.forEach((file, i) => {
    const ext  = file.name.split('.').pop().toUpperCase().slice(0, 4) || 'FILE';
    const size = formatSize(file.size);

    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <div class="file-icon">${ext}</div>
      <div class="file-info">
        <div class="file-name">${escapeHtml(file.name)}</div>
        <div class="file-size">${size}</div>
      </div>
      <button class="file-remove" aria-label="Supprimer ${escapeHtml(file.name)}">✕</button>
    `;

    item.querySelector('.file-remove').addEventListener('click', () => removeFile(i));
    filesList.appendChild(item);
  });
}

/* ══════════════════════════════════════════
   SEND / UPLOAD RÉEL
══════════════════════════════════════════ */

sendBtn.addEventListener('click', sendFiles);

async function sendFiles() {
  if (selectedFiles.length === 0) {
    showToast('Ajoute au moins un fichier avant d\'envoyer');
    return;
  }

  const sender = document.getElementById('senderName').value.trim() || 'Team Créa';
  const email  = document.getElementById('recipientEmail').value.trim();
  const msg    = document.getElementById('message').value.trim();

  // Désactiver le bouton
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span>Envoi en cours...</span>';

  // Afficher la progress bar
  progressWrap.classList.add('active');
  progressFill.style.width = '0%';
  progressPct.textContent = '0%';
  progressText.textContent = 'Préparation...';

  const code      = generateCode();
  const fileUrls  = [];
  const total     = selectedFiles.length;

  try {
    for (let i = 0; i < total; i++) {
      const file = selectedFiles[i];
      progressText.textContent = `Upload de ${file.name}...`;

      const url = await uploadToSupabase(code, file);
      fileUrls.push({ name: file.name, url });

      const pct = Math.round(((i + 1) / total) * 100);
      progressFill.style.width = pct + '%';
      progressPct.textContent  = pct + '%';
    }

    progressText.textContent = 'Génération du lien...';
    await finishTransfer(code, sender, email, msg, fileUrls);

  } catch (err) {
    console.error(err);
    showToast('Erreur upload : ' + err.message);
    resetForm();
  }
}

/* ══════════════════════════════════════════
   FINISH TRANSFER
══════════════════════════════════════════ */

async function finishTransfer(code, sender, email, msg, fileUrls) {
  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
  const fileNames = selectedFiles.map(f => f.name);

  // Générer le lien vers la page de téléchargement sur Vercel
  const params = new URLSearchParams({ code, sender });
  if (msg) params.set('msg', msg);
  const link = `https://toyotransfertrue.vercel.app/download.html?${params.toString()}`;

  // Sauvegarder dans l'historique
  const transfer = {
    id      : code,
    link,
    sender,
    email,
    message : msg,
    files   : fileNames,
    fileUrls,
    size    : formatSize(totalSize),
    count   : selectedFiles.length,
    date    : new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    time    : new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  };

  transfers.unshift(transfer);
  if (transfers.length > 6) transfers = transfers.slice(0, 6);
  localStorage.setItem('toyo_transfers', JSON.stringify(transfers));

  // Mettre à jour le modal
  linkUrl.textContent  = link;
  linkBox.dataset.link = link;

  if (email) {
    successSub.innerHTML = `Lien envoyé à <strong>${escapeHtml(email)}</strong> et disponible ci-dessous.`;
  } else {
    successSub.textContent = 'Partage ce lien pour permettre le téléchargement.';
  }

  // Envoyer l'email si destinataire renseigné
  if (email) {
    try {
      await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
        to_email : email,
        sender   : sender,
        message  : msg || 'Aucun message',
        link     : link,
        files    : fileNames.join(', ')
      }, EMAILJS_KEY);
    } catch (e) {
      console.error('EmailJS error:', e);
      showToast('Email non envoyé, mais le lien est prêt');
    }
  }

  openSuccess();
  renderTransfers();
  resetForm();
}

/* ══════════════════════════════════════════
   PAGE DE TÉLÉCHARGEMENT GÉNÉRÉE
══════════════════════════════════════════ */

/**
 * Génère une page HTML autonome avec les liens de téléchargement
 */
function buildDownloadPage(code, sender, msg, fileUrls) {
  const filesHtml = fileUrls.map(f => `
    <a class="file-row" href="${f.url}" download="${escapeHtml(f.name)}">
      <span class="fname">${escapeHtml(f.name)}</span>
      <span class="dl">Télécharger ↓</span>
    </a>`).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TOYO · Transfert ${code}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0a0a0a;color:#f0ede8;font-family:'DM Sans',system-ui,sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem}
  .card{background:#111;border:1px solid #1e1e1e;border-radius:16px;padding:2.5rem;max-width:520px;width:100%}
  .logo{font-size:1.1rem;letter-spacing:.2em;color:#888;margin-bottom:2rem}
  .logo span{color:#c8b8a2}
  h1{font-size:1.6rem;margin-bottom:.4rem}
  .from{color:#888;font-size:.9rem;margin-bottom:.3rem}
  .msg{background:#1a1a1a;border-radius:8px;padding:1rem;margin:1rem 0;font-size:.9rem;color:#c8b8a2;font-style:italic}
  .files{display:flex;flex-direction:column;gap:.6rem;margin-top:1.5rem}
  .file-row{display:flex;justify-content:space-between;align-items:center;background:#1a1a1a;border:1px solid #222;border-radius:10px;padding:.9rem 1.2rem;text-decoration:none;color:#f0ede8;transition:border-color .2s}
  .file-row:hover{border-color:#c8b8a2}
  .fname{font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%}
  .dl{font-size:.8rem;color:#c8b8a2;white-space:nowrap}
  .footer{margin-top:2rem;font-size:.75rem;color:#444;text-align:center}
</style>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
</head>
<body>
<div class="card">
  <div class="logo">TOY<span>O</span> · Transfer</div>
  <h1>Tes fichiers sont prêts</h1>
  <div class="from">Envoyé par <strong>${escapeHtml(sender)}</strong></div>
  ${msg ? `<div class="msg">"${escapeHtml(msg)}"</div>` : ''}
  <div class="files">${filesHtml}</div>
</div>
<div class="footer">TOYO Transfer · Team Créa · ${code}</div>
</body>
</html>`;
}

/* ══════════════════════════════════════════
   SUCCESS MODAL
══════════════════════════════════════════ */

function openSuccess() {
  successOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSuccess() {
  successOverlay.classList.remove('open');
  document.body.style.overflow = '';
  copySuccessEl.classList.remove('show');
}

function copyLink() {
  const url = linkUrl.textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(showCopySuccess).catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
}

function fallbackCopy() {
  const ta = document.createElement('textarea');
  ta.value = linkUrl.textContent;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); showCopySuccess(); }
  catch (e) { showToast('Impossible de copier le lien'); }
  document.body.removeChild(ta);
}

function showCopySuccess() {
  copySuccessEl.classList.add('show');
  setTimeout(() => copySuccessEl.classList.remove('show'), 2500);
}

function downloadAll() {
  const url = linkUrl.textContent;
  window.open(url, '_blank');
}

document.getElementById('closeSuccessBtn').addEventListener('click', closeSuccess);
document.getElementById('newTransferBtn').addEventListener('click', closeSuccess);
document.getElementById('downloadAllBtn').addEventListener('click', downloadAll);
linkBox.addEventListener('click', copyLink);

successOverlay.addEventListener('click', (e) => {
  if (e.target === successOverlay) closeSuccess();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSuccess();
});

/* ══════════════════════════════════════════
   RESET FORM
══════════════════════════════════════════ */

function resetForm() {
  selectedFiles = [];
  renderFiles();

  document.getElementById('senderName').value     = '';
  document.getElementById('recipientEmail').value  = '';
  document.getElementById('message').value         = '';
  fileInput.value = '';

  progressWrap.classList.remove('active');
  progressFill.style.width = '0%';
  progressPct.textContent  = '0%';
  progressText.textContent = 'Préparation...';

  sendBtn.disabled  = false;
  sendBtn.innerHTML = '<span>Générer le lien de transfert</span><span>→</span>';
}

/* ══════════════════════════════════════════
   TRANSFERS HISTORY
══════════════════════════════════════════ */

function renderTransfers() {
  transfersGrid.innerHTML = '';

  if (transfers.length === 0) {
    transfersGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-kanji">空</div>
        <div class="empty-text">Aucun transfert pour le moment</div>
      </div>`;
    return;
  }

  transfers.forEach((t) => {
    const card  = document.createElement('div');
    card.className = 'transfer-card';
    const fillW = Math.floor(Math.random() * 40 + 60);
    const label = t.count > 1
      ? `${escapeHtml(t.files[0])} +${t.count - 1}`
      : escapeHtml(t.files[0]);

    card.innerHTML = `
      <div class="transfer-top">
        <span class="transfer-type">${t.count} fichier${t.count > 1 ? 's' : ''}</span>
        <span class="transfer-size">${t.size}</span>
      </div>
      <div class="transfer-name">${label}</div>
      <div class="transfer-meta">
        <span>De ${escapeHtml(t.sender)}</span>
        <span>${t.date} · ${t.time}</span>
      </div>
      <div class="transfer-bar">
        <div class="transfer-bar-fill" style="width:${fillW}%"></div>
      </div>
    `;

    card.addEventListener('click', () => {
      linkUrl.textContent = t.link;
      successSub.textContent = `Transfert du ${t.date} à ${t.time} · De ${t.sender}`;
      openSuccess();
    });

    transfersGrid.appendChild(card);
  });
}

/* ══════════════════════════════════════════
   TOAST
══════════════════════════════════════════ */

let toastTimer = null;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ══════════════════════════════════════════
   UTILS
══════════════════════════════════════════ */

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k     = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function generateCode() {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
renderTransfers();
