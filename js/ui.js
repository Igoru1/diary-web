/* ============================================================
   UI.JS — eventos de interfaz: zonas, imágenes, swipe, textarea
   ============================================================ */

import { saveText, saveImage, saveZone } from './storage.js';
import { turnPage, addDynamicSpread, removeDynamicSpread, state } from './book.js';


/* ── Textarea auto-resize ── */

export function autoResize(el) {
  const id = el.dataset.id;
  if (id) saveText(id, el.value);
}

export function initTextareas(root = document) {
  root.querySelectorAll('textarea.auto-resize').forEach(el => {
    el.addEventListener('input', () => autoResize(el));
  });
}


/* ── Imágenes ── */

export function loadImageIntoBox(box, src) {
  const img = box.querySelector('img');
  img.src = src;
  box.classList.add('has-image');
}

export function initImageInputs(root = document) {
  root.querySelectorAll('.drawing-box input[type="file"]').forEach(input => {
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const box = input.closest('.drawing-box');
      const reader = new FileReader();
      reader.onload = e => {
        loadImageIntoBox(box, e.target.result);
        const id = box.dataset.id;
        if (id) saveImage(id, e.target.result);
      };
      reader.readAsDataURL(file);
    });
  });
}


/* ── Zonas: quitar imagen / añadir imagen / mover posición ── */

/*
 * Ocultar zona imagen → mostrar btn-add-image
 * El textarea vecino toma el espacio gracias al CSS (zone-image.hidden + zone-text → flex:1)
 */
function hideImageZone(zone) {
  zone.classList.add('hidden');
  const zoneId = zone.dataset.zoneId;

  // Mostrar botón añadir
  const page = zone.closest('.page-inner');
  const btn = page.querySelector(`.btn-add-image[data-zone="${zoneId}"]`);
  if (btn) btn.classList.add('visible');

  // Ocultar controles de posición
  const controls = page.querySelector('.zone-controls');
  if (controls) controls.style.display = 'none';

  if (zoneId) saveZone(zoneId, { hidden: true });
}

function showImageZone(zone) {
  zone.classList.remove('hidden');
  const zoneId = zone.dataset.zoneId;

  // Ocultar botón añadir
  const page = zone.closest('.page-inner');
  const btn = page.querySelector(`.btn-add-image[data-zone="${zoneId}"]`);
  if (btn) btn.classList.remove('visible');

  // Mostrar controles de posición
  const controls = page.querySelector('.zone-controls');
  if (controls) controls.style.display = '';

  if (zoneId) saveZone(zoneId, { hidden: false });
}

/*
 * Mover zona imagen arriba o abajo.
 * Intercambia las clases zone-top / zone-bottom entre la zona imagen y la zona texto.
 */
function moveImageZone(zone, pos) {
  const pageInner = zone.closest('.page-inner');
  const zoneText  = pageInner.querySelector('.zone-text');
  if (!zoneText) return;

  if (pos === 'top') {
    zone.classList.add('zone-top');
    zone.classList.remove('zone-bottom');
    zoneText.classList.add('zone-bottom');
    zoneText.classList.remove('zone-top');
    // Mover al DOM: imagen primero
    pageInner.insertBefore(zone, zoneText);
  } else {
    zone.classList.add('zone-bottom');
    zone.classList.remove('zone-top');
    zoneText.classList.add('zone-top');
    zoneText.classList.remove('zone-bottom');
    // Mover al DOM: texto primero
    pageInner.insertBefore(zoneText, zone);
  }

  const zoneId = zone.dataset.zoneId;
  if (zoneId) saveZone(zoneId, { position: pos });
}

export function initZoneControls(root = document) {

  // Botón ✕ quitar imagen
  root.querySelectorAll('.zone-remove-img').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const zone = btn.closest('.zone-image');
      if (zone) hideImageZone(zone);
    });
  });

  // Botón añadir imagen
  root.querySelectorAll('.btn-add-image').forEach(btn => {
    btn.addEventListener('click', () => {
      const zoneId = btn.dataset.zone;
      const zone = root.querySelector(`.zone-image[data-zone-id="${zoneId}"]`)
                || btn.closest('.page-inner')?.querySelector('.zone-image');
      if (zone) showImageZone(zone);
    });
  });

  // Botones de posición ▲ ▼
  root.querySelectorAll('.btn-zone-pos').forEach(btn => {
    btn.addEventListener('click', () => {
      const pos     = btn.dataset.pos;
      const zoneId  = btn.dataset.zone || btn.closest('.zone-controls')
                        ?.previousElementSibling?.dataset.zoneId;
      const page    = btn.closest('.page-inner');
      const zone    = page?.querySelector('.zone-image');
      if (!zone) return;

      moveImageZone(zone, pos);

      // Actualizar estado activo del botón
      btn.closest('.zone-controls')
         ?.querySelectorAll('.btn-zone-pos')
         .forEach(b => b.classList.toggle('active', b === btn));
    });
  });
}


/* ── Spreads dinámicos: eliminar ── */

export function initDeleteButtons(root = document) {
  root.querySelectorAll('.btn-delete-spread').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.spread-dynamic');
      if (!section) return;
      if (confirm('¿Eliminar esta página? Se perderá su contenido.')) {
        removeDynamicSpread(section);
      }
    });
  });
}


/* ── Navegación con botones ── */

export function initNavigation() {
  document.querySelectorAll('[data-dir]').forEach(btn => {
    btn.addEventListener('click', () => {
      turnPage(Number(btn.dataset.dir));
    });
  });
}


/* ── Swipe táctil ── */

export function initSwipe() {
  const area = document.getElementById('pages-area');
  let startX = 0;
  let startY = 0;

  area.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  area.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    // Solo swipe horizontal y si supera umbral
    if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;

    if (dx < 0) turnPage(1);   // swipe izquierda → siguiente
    else        turnPage(-1);  // swipe derecha  → anterior
  }, { passive: true });
}


/* ── Teclado ── */

export function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'TEXTAREA') return; // no interferir al escribir
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown')  turnPage(1);
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')    turnPage(-1);
  });
}


/* ── Botón "añadir página" al final de cada spread interior ── */

/*
 * Añade un pequeño botón al pie de la página derecha de cada spread interior.
 * Al pulsarlo inserta un spread dinámico justo después.
 */
export function initAddPageButtons() {
  document.querySelectorAll('.spread:not(.cover-spread):not(.back-spread)').forEach(spread => {
    const rightPage = spread.querySelector('[data-page-side="right"] .page-inner');
    if (!rightPage) return;
    if (rightPage.querySelector('.btn-add-spread')) return; // ya existe

    const btn = document.createElement('button');
    btn.className = 'btn-add-spread';
    btn.textContent = '+ añadir página';
    btn.title = 'Agregar una página extra a este capítulo';
    btn.addEventListener('click', () => {
      const spreads = Array.from(document.querySelectorAll('.spread'));
      const idx = spreads.indexOf(spread);
      if (state.current !== idx) jumpToSpread(idx);
      const newSection = addDynamicSpread();
      initTextareas(newSection);
      initImageInputs(newSection);
      initZoneControls(newSection);
      initDeleteButtons(newSection);
    });
    rightPage.appendChild(btn);
  });
}