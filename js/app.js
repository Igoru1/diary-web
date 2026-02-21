/* ============================================================
   APP.JS — punto de entrada
   - Firebase como storage
   - Modo lectura (default) / modo edición
   - Sincronización en tiempo real entre usuarios
   - Botón compartir link
   ============================================================ */

import {
  state,
  checkMobile,
  jumpToSpread,
  updateNav,
  renumberPages,
  setDynamicList,
  getSpreads,
} from './book.js';

import {
  getState,
  saveCurrentSpread,
  saveZone,
  subscribeToChanges,
  getShareUrl,
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
    btn.textContent = active ? '👁 modo lectura' : '✏️ editar';
    btn.title       = active ? 'Cambiar a modo lectura' : 'Cambiar a modo edición';
  }

  // Habilitar o deshabilitar textareas
  document.querySelectorAll('textarea').forEach(ta => {
    ta.readOnly = !active;
  });

  // Habilitar o deshabilitar inputs de archivo
  document.querySelectorAll('.drawing-box input[type="file"]').forEach(inp => {
    inp.disabled = !active;
  });

  // Content Editable
  document.querySelectorAll('[contenteditable]').forEach(el => {
  el.contentEditable = active ? 'true' : 'false';
  });
}

function initEditModeButton() {
  const btn = document.createElement('button');
  btn.id        = 'btn-edit-mode';
  btn.className = 'btn-edit-mode';
  btn.textContent = '✏️ editar';
  btn.title     = 'Cambiar a modo edición';
  btn.addEventListener('click', () => setEditMode(!editMode));
  document.getElementById('book-container').appendChild(btn);
}


/* ═══════════════════════════════════════════
   BOTÓN COMPARTIR
═══════════════════════════════════════════ */

function initShareButton() {
  const btn = document.createElement('button');
  btn.id        = 'btn-share';
  btn.className = 'btn-share';
  btn.textContent = '🔗 compartir';
  btn.title     = 'Copiar link para compartir';

  btn.addEventListener('click', async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = '✓ link copiado';
      setTimeout(() => { btn.textContent = '🔗 compartir'; }, 2200);
    } catch {
      prompt('Copia este link:', url);
    }
  });

  document.getElementById('book-container').appendChild(btn);
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
  // Textos
  document.querySelectorAll('textarea[data-id]').forEach(el => {
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
}


/* ═══════════════════════════════════════════
   SYNC EN TIEMPO REAL
   Cuando otro usuario guarda algo, actualiza
   solo los campos que cambiaron en el DOM.
═══════════════════════════════════════════ */

let lastSavedState = {};

function applyRemoteChanges(newState) {
  // Textos
  const texts = newState.texts || {};
  Object.entries(texts).forEach(([id, val]) => {
    if (lastSavedState.texts?.[id] === val) return; // sin cambio
    const el = document.querySelector(`textarea[data-id="${id}"]`);
    if (el && document.activeElement !== el) {
      el.value = val;
    }
  });

  // Imágenes
  const images = newState.images || {};
  Object.entries(images).forEach(([id, src]) => {
    if (lastSavedState.images?.[id] === src) return;
    const box = document.querySelector(`.drawing-box[data-id="${id}"]`);
    if (box && !box.classList.contains('has-image')) {
      loadImageIntoBox(box, src);
      box.closest('.zone-image')?.classList.add('has-image');
    }
  });

  lastSavedState = newState;
}


/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */

async function init() {
  checkMobile();

  // Mostrar loading mientras carga Firebase
  document.body.classList.add('loading');

  const saved = await getState();
  lastSavedState = saved;

  document.body.classList.remove('loading');

  // Reconstruir spreads dinámicos
  rebuildDynamicSpreads(saved);
  renumberPages();

  // Restaurar contenido
  restoreContent(saved);

  // Inicializar eventos
  initTextareas();
  initImageInputs();
  initZoneControls();
  initDeleteButtons();
  initNavigation();
  initSwipe();
  initKeyboard();
  initAddPageButtons();

  // Iniciar en modo lectura por defecto
  setEditMode(false);

  // Botones flotantes
  initEditModeButton();
  initShareButton();

  // Navegar a la página guardada
  state.mobilePageSide = saved.mobilePageSide || 'left';
  jumpToSpread(saved.currentSpread || 0);
  updateNav();

  // Escuchar cambios en tiempo real de otros usuarios
  subscribeToChanges(newState => {
    applyRemoteChanges(newState);
  });

  // Resize
  window.addEventListener('resize', () => {
    const wasMobile = state.isMobile;
    checkMobile();
    if (wasMobile !== state.isMobile) {
      jumpToSpread(state.current);
      updateNav();
    }
  });
}
function initEditables() {
  document.querySelectorAll('[data-editable]').forEach(el => {
    el.addEventListener('blur', () => {
      const val = el.innerHTML.trim();
      
  // Guardar siempre, incluso vacío
  saveEditable(el.dataset.editable, val);
  // Si quedó vacío, no hacer nada más — el CSS :empty muestra el placeholder
});
    // Enter no crea <div> extra, solo <br>
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

init();