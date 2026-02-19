/* ============================================
   TOYO — script.js
   Team Créa · Partage de fichiers
   ============================================ */

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

// Clic sur "parcourir"
browseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

// Sélection via input natif
fileInput.addEventListener('change', (e) => {
  addFiles([...e.target.files]);
  // Reset input pour permettre de re-sélectionner le même fichier
  fileInput.value = '';
});

// Drag over
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

// Drag leave
dropZone.addEventListener('dragleave', (e) => {
  // Éviter le flicker sur les éléments enfants
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove('drag-over');
  }
});

// Drop
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const droppedFiles = [...e.dataTransfer.files];
  addFiles(droppedFiles);
});

/* ══════════════════════════════════════════
   FILE MANAGEMENT
══════════════════════════════════════════ */

/**
 * Ajoute des fichiers à la liste
 * @param {File[]} newFiles
 */
function addFiles(newFiles) {
  selectedFiles.push(...newFiles);
  renderFiles();
}

/**
 * Supprime un fichier de la liste par son index
 * @param {number} idx
 */
function removeFile(idx) {
  selectedFiles.splice(idx, 1);
  renderFiles();
}

/**
 * Affiche la liste des fichiers sélectionnés
 */
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

    // Bouton supprimer
    item.querySelector('.file-remove').addEventListener('click', () => removeFile(i));

    filesList.appendChild(item);
  });
}

/* ══════════════════════════════════════════
   SEND / UPLOAD
══════════════════════════════════════════ */

sendBtn.addEventListener('click', sendFiles);

/**
 * Lance le processus d'envoi
 */
function sendFiles() {
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

  // Simuler la progression
  simulateProgress(() => finishTransfer(sender, email, msg));
}

/**
 * Simule une barre de progression réaliste
 * @param {Function} onComplete - Callback à la fin
 */
function simulateProgress(onComplete) {
  const steps = [
    'Lecture des fichiers...',
    'Compression...',
    'Upload...',
    'Génération du lien...',
    'Finalisation...'
  ];

  let progress = 0;
  let stepIdx  = 0;

  const interval = setInterval(() => {
    // Incrément aléatoire pour un effet naturel
    progress += Math.random() * 18 + 4;
    if (progress > 100) progress = 100;

    progressFill.style.width = progress + '%';
    progressPct.textContent  = Math.round(progress) + '%';

    // Changer l'étape texte
    const newStep = Math.floor(progress / 25);
    if (newStep !== stepIdx && newStep < steps.length) {
      stepIdx = newStep;
      progressText.textContent = steps[stepIdx];
    }

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(onComplete, 200);
    }
  }, 120);
}

/**
 * Finalise le transfert et affiche le modal succès
 * @param {string} sender
 * @param {string} email
 * @param {string} msg
 */
function finishTransfer(sender, email, msg) {
  // Générer un code unique
  const code      = generateCode();
  const link      = `toyo-transfer.link/${code}`;
  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
  const fileNames = selectedFiles.map(f => f.name);

  // Créer l'objet transfert
  const transfer = {
    id      : code,
    link,
    sender,
    email,
    message : msg,
    files   : fileNames,
    size    : formatSize(totalSize),
    count   : selectedFiles.length,
    date    : new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    time    : new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  };

  // Sauvegarder dans l'historique (max 6)
  transfers.unshift(transfer);
  if (transfers.length > 6) transfers = transfers.slice(0, 6);
  localStorage.setItem('toyo_transfers', JSON.stringify(transfers));

  // Mettre à jour le modal
  linkUrl.textContent = link;
  linkBox.dataset.link = link;

  if (email) {
    successSub.innerHTML = `Lien envoyé à <strong>${escapeHtml(email)}</strong> et disponible ci-dessous.`;
  } else {
    successSub.textContent = 'Partage ce lien pour permettre le téléchargement.';
  }

  // Ouvrir le modal
  openSuccess();

  // Mettre à jour l'historique
  renderTransfers();

  // Réinitialiser le formulaire
  resetForm();
}

/* ══════════════════════════════════════════
   SUCCESS MODAL
══════════════════════════════════════════ */

/**
 * Ouvre le modal succès
 */
function openSuccess() {
  successOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/**
 * Ferme le modal succès
 */
function closeSuccess() {
  successOverlay.classList.remove('open');
  document.body.style.overflow = '';
  copySuccessEl.classList.remove('show');
}

/**
 * Copie le lien dans le presse-papiers
 */
function copyLink() {
  const url = linkUrl.textContent;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(showCopySuccess)
      .catch(fallbackCopy);
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
  try {
    document.execCommand('copy');
    showCopySuccess();
  } catch (e) {
    showToast('Impossible de copier le lien');
  }
  document.body.removeChild(ta);
}

function showCopySuccess() {
  copySuccessEl.classList.add('show');
  setTimeout(() => copySuccessEl.classList.remove('show'), 2500);
}

/**
 * Simule un téléchargement (front-end only)
 */
function downloadAll() {
  showToast('Intègre un backend pour activer le téléchargement réel');
  closeSuccess();
}

// Boutons du modal
document.getElementById('closeSuccessBtn').addEventListener('click', closeSuccess);
document.getElementById('newTransferBtn').addEventListener('click', closeSuccess);
document.getElementById('downloadAllBtn').addEventListener('click', downloadAll);
linkBox.addEventListener('click', copyLink);

// Fermer sur clic en dehors
successOverlay.addEventListener('click', (e) => {
  if (e.target === successOverlay) closeSuccess();
});

// Fermer avec Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSuccess();
});

/* ══════════════════════════════════════════
   RESET FORM
══════════════════════════════════════════ */

/**
 * Réinitialise le formulaire après envoi
 */
function resetForm() {
  selectedFiles = [];
  renderFiles();

  document.getElementById('senderName').value    = '';
  document.getElementById('recipientEmail').value = '';
  document.getElementById('message').value        = '';
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

/**
 * Affiche l'historique des transferts
 */
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
    const card   = document.createElement('div');
    card.className = 'transfer-card';
    const fillW  = Math.floor(Math.random() * 40 + 60);
    const label  = t.count > 1
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

    // Clic sur une card → rouvrir le modal avec le lien
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

/**
 * Affiche une notification toast
 * @param {string} msg
 */
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ══════════════════════════════════════════
   UTILS
══════════════════════════════════════════ */

/**
 * Formate une taille en octets en string lisible
 * @param {number} bytes
 * @returns {string}
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k     = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Génère un code de transfert aléatoire
 * @returns {string}
 */
function generateCode() {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

/**
 * Échappe les caractères HTML pour éviter les injections
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
renderTransfers();
