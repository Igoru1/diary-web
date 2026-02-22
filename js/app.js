/* ============================================================
   APP.JS — punto de entrada
   - Firebase como storage
   - Modo lectura (default) / modo edición
   - Sincronización en tiempo real entre usuarios
   - Botón compartir link
   - Títulos y capítulos editables (contenteditable)
   ============================================================ */

import {
  state,
  checkMobile,
  jumpToSpread,
  updateNav,
  renumberPages,
  setDynamicList,
} from './book.js';

import {
  getState,
  subscribeToChanges,
  getShareUrl,
  saveEditable,
} from './storage.js';

import {
  initTextareas,
  initImageInputs,
  initZoneControls,
  initDeleteButtons,
  initNavigation,
  initSwipe,
  initKeyboard,
  initAddPageButtons,
  loadImageIntoBox,
  autoResize,
} from './ui.js';


/* ═══════════════════════════════════════════
   MODO LECTURA / EDICIÓN
═══════════════════════════════════════════ */

let editMode = false;

function setEditMode(active) {
  editMode = active;
  document.body.classList.toggle('edit-mode', active);

  const btn = document.getElementById('btn-edit-mode');
  if (btn) {
    btn.textContent = active ? '👁 lectura' : '✏️ editar';
    btn.title = active ? 'Cambiar a modo lectura' : 'Cambiar a modo edición';
  }

  // Textareas
  document.querySelectorAll('textarea').forEach(ta => {
    ta.readOnly = !active;
  });

  // Inputs de imagen
  document.querySelectorAll('.drawing-box input[type="file"]').forEach(inp => {
    inp.disabled = !active;
  });

  // Títulos y elementos contenteditable
  document.querySelectorAll('[data-editable]').forEach(el => {
    el.contentEditable = active ? 'true' : 'false';
  });
}


/* ═══════════════════════════════════════════
   BOTONES DE CONTROL (editar + compartir)
   — en desktop: fixed abajo a la derecha
   — en móvil: dentro del #nav
═══════════════════════════════════════════ */

function initControlButtons() {
  const btnEdit = document.createElement('button');
  btnEdit.id = 'btn-edit-mode';
  btnEdit.className = 'btn-edit-mode';
  btnEdit.textContent = '✏️ editar';
  btnEdit.addEventListener('click', () => setEditMode(!editMode));

  const btnShare = document.createElement('button');
  btnShare.id = 'btn-share';
  btnShare.className = 'btn-share';
  btnShare.textContent = '🔗';
  btnShare.addEventListener('click', async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      btnShare.textContent = '✓';
      setTimeout(() => { btnShare.textContent = '🔗'; }, 2200);
    } catch {
      prompt('Copia este link:', url);
    }
  });

  if (state.isMobile) {
    // En móvil: barra flotante propia, no toca el nav
    const bar = document.createElement('div');
    bar.id = 'action-bar';
    bar.appendChild(btnShare);
    bar.appendChild(btnEdit);
    document.body.appendChild(bar);
  } else {
    // En desktop: fixed abajo a la derecha
    document.getElementById('book-container').appendChild(btnEdit);
    document.getElementById('book-container').appendChild(btnShare);
  }
}


/* ═══════════════════════════════════════════
   EDITABLES — títulos, subtítulos, capítulos
═══════════════════════════════════════════ */

function initEditables() {
  document.querySelectorAll('[data-editable]').forEach(el => {
    // Guardar al salir del elemento
    el.addEventListener('blur', () => {
      saveEditable(el.dataset.editable, el.innerHTML.trim());
    });

    // Enter inserta <br> en lugar de crear un <div> nuevo
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.execCommand('insertLineBreak');
      }
    });
  });
}

function restoreEditables(saved) {
  const editables = saved.editables || {};
  Object.entries(editables).forEach(([id, html]) => {
    const el = document.querySelector(`[data-editable="${id}"]`);
    if (el) el.innerHTML = html;
  });
}


/* ═══════════════════════════════════════════
   RECONSTRUIR SPREADS DINÁMICOS
═══════════════════════════════════════════ */

function rebuildDynamicSpreads(saved) {
  const list = saved.dynamicSpreads || [];
  if (!list.length) return;

  const pagesArea = document.getElementById('pages-area');
  const allSpreads = () => Array.from(pagesArea.querySelectorAll('.spread'));

  list.forEach(dynData => {
    const tpl     = document.getElementById('tpl-extra-spread');
    const clone   = tpl.content.cloneNode(true);
    const section = clone.querySelector('section');

    section.dataset.chapter   = dynData.chapter;
    section.dataset.label     = dynData.label;
    section.dataset.dynamicId = dynData.id;

    const { left, right } = dynData.pages;

    const pageL = section.querySelector('[data-page-side="left"]');
    pageL.querySelector('textarea').dataset.id = left.textId;
    const boxL = pageL.querySelector('.drawing-box');
    boxL.dataset.id = left.imgId;
    const zoneImgL = pageL.querySelector('.zone-image');
    if (zoneImgL) zoneImgL.dataset.zoneId = left.imgId;
    const btnAddL = pageL.querySelector('.btn-add-image');
    if (btnAddL) btnAddL.dataset.zone = left.imgId;

    const pageR = section.querySelector('[data-page-side="right"]');
    pageR.querySelector('textarea').dataset.id = right.textId;
    const boxR = pageR.querySelector('.drawing-box');
    boxR.dataset.id = right.imgId;
    const zoneImgR = pageR.querySelector('.zone-image');
    if (zoneImgR) zoneImgR.dataset.zoneId = right.imgId;
    const btnAddR = pageR.querySelector('.btn-add-image');
    if (btnAddR) btnAddR.dataset.zone = right.imgId;

    const chapLabel = section.querySelector('.dynamic-chapter-label');
    if (chapLabel) chapLabel.textContent = dynData.label;

    let anchor = null;
    if (dynData.afterDynamicId) {
      anchor = pagesArea.querySelector(`[data-dynamic-id="${dynData.afterDynamicId}"]`);
    }
    if (!anchor && dynData.afterStaticSpread !== null) {
      anchor = allSpreads().find(s =>
        !s.dataset.dynamicId && s.dataset.spread === String(dynData.afterStaticSpread)
      );
    }

    if (anchor) anchor.after(section);
    else pagesArea.appendChild(section);
  });

  setDynamicList(list);
}


/* ═══════════════════════════════════════════
   RESTAURAR CONTENIDO
═══════════════════════════════════════════ */

function restoreContent(saved) {
  console.log('textos', saved.texts);
  console.log('imágenes', saved.images);
  console.log('zonas', saved.zones);
  console.log('texareas', document.querySelectorAll('textarea[data-id]').length);
  // Textos
  document.querySelectorAll('textarea[data-id]').forEach(el => {
    console.log('textarea', el.dataset.id, 'valor guardado:', saved.texts?.[el.dataset.id]);
    const val = saved.texts?.[el.dataset.id];
    
    if (val) {
      el.value = val;
      autoResize(el);
    }
  });

  // Imágenes
  document.querySelectorAll('.drawing-box[data-id]').forEach(box => {
    const src = saved.images?.[box.dataset.id];
    if (src) {
      loadImageIntoBox(box, src);
      box.closest('.zone-image')?.classList.add('has-image');
    }
  });

  // Estado de zonas
  document.querySelectorAll('.zone-image[data-zone-id]').forEach(zone => {
    const zoneId = zone.dataset.zoneId;
    const zData  = saved.zones?.[zoneId];
    if (!zData) return;

    if (zData.hidden) {
      zone.classList.add('hidden');
      const page = zone.closest('.page-inner');
      const btn  = page?.querySelector(`.btn-add-image[data-zone="${zoneId}"]`);
      if (btn) btn.classList.add('visible');
      const controls = page?.querySelector('.zone-controls');
      if (controls) controls.style.display = 'none';
    }

    if (zData.position) {
      const page     = zone.closest('.page-inner');
      const zoneText = page?.querySelector('.zone-text');
      if (!zoneText) return;

      if (zData.position === 'top') {
        zone.classList.add('zone-top');
        zone.classList.remove('zone-bottom');
        zoneText.classList.add('zone-bottom');
        zoneText.classList.remove('zone-top');
        page.insertBefore(zone, zoneText);
      } else {
        zone.classList.add('zone-bottom');
        zone.classList.remove('zone-top');
        zoneText.classList.add('zone-top');
        zoneText.classList.remove('zone-bottom');
        page.insertBefore(zoneText, zone);
      }

      page.querySelectorAll('.btn-zone-pos').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.pos === zData.position);
      });
    }
  });

  // Editables
  restoreEditables(saved);
}


/* ═══════════════════════════════════════════
   SYNC EN TIEMPO REAL
═══════════════════════════════════════════ */

let lastSavedState = {};

function applyRemoteChanges(newState) {
  // Textos
  Object.entries(newState.texts || {}).forEach(([id, val]) => {
    if (lastSavedState.texts?.[id] === val) return;
    const el = document.querySelector(`textarea[data-id="${id}"]`);
    if (el && document.activeElement !== el) el.value = val;
  });

  // Imágenes
  Object.entries(newState.images || {}).forEach(([id, src]) => {
    if (lastSavedState.images?.[id] === src) return;
    const box = document.querySelector(`.drawing-box[data-id="${id}"]`);
    if (box && !box.classList.contains('has-image')) {
      loadImageIntoBox(box, src);
      box.closest('.zone-image')?.classList.add('has-image');
    }
  });

  // Editables remotos
  Object.entries(newState.editables || {}).forEach(([id, html]) => {
    if (lastSavedState.editables?.[id] === html) return;
    const el = document.querySelector(`[data-editable="${id}"]`);
    if (el && document.activeElement !== el) el.innerHTML = html;
  });

  lastSavedState = newState;
}


/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */

async function init() {
  checkMobile();

  document.body.classList.add('loading');
  const saved = await getState();
  lastSavedState = saved;
  document.body.classList.remove('loading');

  // Reconstruir spreads dinámicos guardados
  rebuildDynamicSpreads(saved);
  renumberPages();

  // Restaurar contenido (textos, imágenes, zonas, editables)
  restoreContent(saved);

  // Eventos
  initTextareas();
  initImageInputs();
  initZoneControls();
  initDeleteButtons();
  initNavigation();
  initSwipe();
  initKeyboard();
  initAddPageButtons();
  initEditables();

  // Arrancar en modo lectura
  setEditMode(false);

  // Botones editar + compartir
  initControlButtons();

  // Posición guardada
  state.mobilePageSide = saved.mobilePageSide || 'left';
  jumpToSpread(saved.currentSpread || 0);
  updateNav();

  // Escuchar cambios remotos
  subscribeToChanges(newState => applyRemoteChanges(newState));

  // Resize (rotar pantalla)
  window.addEventListener('resize', () => {
    const wasMobile = state.isMobile;
    checkMobile();
    if (wasMobile !== state.isMobile) {
      jumpToSpread(state.current);
      updateNav();
    }
  });
}

init();