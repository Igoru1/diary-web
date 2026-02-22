/* ============================================================
   BOOK.JS — estado del libro, navegación, spreads dinámicos
   ============================================================ */

import { saveCurrentSpread, saveMobilePageSide, saveDynamicSpreads } from './storage.js';

/* ── Estado global ── */
export const state = {
  current:        0,       // índice del spread activo
  mobilePageSide: 'left',  // 'left' | 'right' — página visible en móvil
  isMobile:       false,
};

/* Lista viva de spreads (se actualiza al agregar/eliminar) */
export function getSpreads() {
  return Array.from(document.querySelectorAll('.spread'));
}

export function getTotalSpreads() {
  return getSpreads().length;
}

/* ── Detección de móvil ── */
export function checkMobile() {
  state.isMobile = window.matchMedia('(max-width: 600px)').matches;
}


/* ── Numeración automática de páginas ── */
export function renumberPages() {
  let num = 1;
  getSpreads().forEach(spread => {
    const chapter = spread.dataset.chapter;
    if (chapter === 'cover' || chapter === 'end') return;

    spread.querySelectorAll('.page').forEach(page => {
      let el = page.querySelector('.page-num');
      if (!el) {
        el = document.createElement('span');
        el.className = 'page-num';
        page.appendChild(el);
      }
      el.textContent = num++;
    });
  });
}


/* ── Indicador de navegación ── */
export function getLabel(spread) {
  return spread.dataset.label || '';
}

export function updateNav() {
  const spreads = getSpreads();
  const total   = spreads.length;
  const current = spreads[state.current];

  document.getElementById('btn-prev').disabled = state.current === 0;
  document.getElementById('btn-next').disabled = state.current === total - 1;

  let label = getLabel(current);

  // En móvil mostrar también qué página del spread vemos
  if (state.isMobile && current.dataset.chapter !== 'cover' && current.dataset.chapter !== 'end') {
    const side = state.mobilePageSide === 'left' ? '· pág A' : '· pág B';
    label += ' ' + side;
  }

  document.getElementById('page-indicator').textContent = label;
}


/* ── Lomo: visible solo en portada y contraportada ── */
function updateSpine() {
  const spreads = getSpreads();
  const chapter = spreads[state.current]?.dataset.chapter;
  const isInterior = chapter !== 'cover' && chapter !== 'end';
  document.getElementById('book').classList.toggle('interior', isInterior);
}


/* ── Móvil: puntos indicadores y página activa ── */
function updateMobilePage(spread) {
  if (!state.isMobile) return;
  const chapter = spread.dataset.chapter;

  // Portada y contraportada no tienen división
  if (chapter === 'cover' || chapter === 'end') return;

  const pages = spread.querySelectorAll('.page');

  pages.forEach(p => p.classList.remove('mobile-active'));

  const target = spread.querySelector(
    state.mobilePageSide === 'left'
      ? '[data-page-side="left"]'
      : '[data-page-side="right"]'
  );
  if (target) target.classList.add('mobile-active');

  // Puntos
  let dotContainer = spread.querySelector('.mobile-page-dot');
  if (!dotContainer && pages.length > 1) {
    dotContainer = document.createElement('div');
    dotContainer.className = 'mobile-page-dot';
    for (let i = 0; i < pages.length; i++) {
      const dot = document.createElement('span');
      dotContainer.appendChild(dot);
    }
    spread.appendChild(dotContainer);
  }

  if (dotContainer) {
    dotContainer.querySelectorAll('span').forEach((dot, i) => {
      dot.classList.toggle('active', i === (state.mobilePageSide === 'left' ? 0 : 1));
    });
  }
}

/* En móvil, navegar entre las dos páginas del spread actual antes de cambiar spread */
export function mobileNextPage() {
  const spreads = getSpreads();
  const current = spreads[state.current];
  const chapter = current.dataset.chapter;
  const pages   = current.querySelectorAll('.page');

  if (chapter === 'cover' || chapter === 'end' || pages.length < 2) return false;

  if (state.mobilePageSide === 'left') {
    state.mobilePageSide = 'right';
    saveMobilePageSide('right');
    updateMobilePage(current);
    updateNav();
    return true; // consumido — no cambiar spread
  }
  return false; // no había más páginas — cambiar spread
}

export function mobilePrevPage() {
  const spreads = getSpreads();
  const current = spreads[state.current];
  const chapter = current.dataset.chapter;
  const pages   = current.querySelectorAll('.page');

  if (chapter === 'cover' || chapter === 'end' || pages.length < 2) return false;

  if (state.mobilePageSide === 'right') {
    state.mobilePageSide = 'left';
    saveMobilePageSide('left');
    updateMobilePage(current);
    updateNav();
    return true;
  }
  return false;
}


/* ── Cambio de spread ── */
function activateSpread(index, dir) {
  const spreads = getSpreads();
  const prev    = spreads[state.current];
  const next    = spreads[index];

  // Al entrar a un nuevo spread en móvil, mostrar la página correcta según dirección
  state.mobilePageSide = dir > 0 ? 'left' : 'right';
  saveMobilePageSide(state.mobilePageSide);

  if (dir > 0) {
    prev.classList.add('exiting-left');
    setTimeout(() => {
      prev.classList.remove('active', 'exiting-left');
      next.classList.add('active', 'entering-right');
      setTimeout(() => next.classList.remove('entering-right'), 420);
    }, 360);
  } else {
    prev.classList.remove('active');
    next.classList.add('active', 'entering-right');
    setTimeout(() => next.classList.remove('entering-right'), 420);
  }

  state.current = index;
  updateMobilePage(next);
  updateSpine();
  updateNav();
  saveCurrentSpread(index);
}

export function turnPage(dir) {
  const total = getTotalSpreads();

  // En móvil intentar primero navegar entre páginas del spread
  if (state.isMobile) {
    if (dir > 0 && mobileNextPage()) return;
    if (dir < 0 && mobilePrevPage()) return;
  }

  const next = state.current + dir;
  if (next < 0 || next >= total) return;
  activateSpread(next, dir);
}

export function jumpToSpread(index) {
  const spreads = getSpreads();
  if (index < 0 || index >= spreads.length) return;

  spreads[state.current].classList.remove('active');
  state.current = index;
  spreads[state.current].classList.add('active');

  updateMobilePage(spreads[state.current]);
  updateSpine();
  updateNav();
}


/* ── Spreads dinámicos ── */

let dynamicList = []; // espejo en memoria de lo guardado

export function getDynamicList() { return dynamicList; }

function uid() {
  return 'dyn-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
}

/*
 * Inserta un nuevo spread dinámico justo después del spread actual.
 * Devuelve el elemento creado.
 */
export function addDynamicSpread() {
  const spreads = getSpreads();
  const currentSpread = spreads[state.current];

  const chapter = currentSpread.dataset.chapter;
  const label   = (currentSpread.dataset.label || '') + ' cont.';
  const id      = uid();

  // Clonar template
  const tpl   = document.getElementById('tpl-extra-spread');
  const clone = tpl.content.cloneNode(true);
  const section = clone.querySelector('section');

  // Asignar IDs únicos a textareas e imágenes
  const textL  = id + '-tl';
  const textR  = id + '-tr';
  const imgL   = id + '-il';
  const imgR   = id + '-ir';

  section.dataset.chapter = chapter;
  section.dataset.label   = label;
  section.dataset.dynamicId = id;

  // Página izquierda
  const pageL = section.querySelector('[data-page-side="left"]');
  pageL.querySelector('textarea').dataset.id = textL;
  const boxL = pageL.querySelector('.drawing-box');
  boxL.dataset.id = imgL;
  const zoneImgL = pageL.querySelector('.zone-image');
  if (zoneImgL) zoneImgL.dataset.zoneId = imgL;
  const btnAddL = pageL.querySelector('.btn-add-image');
  if (btnAddL) btnAddL.dataset.zone = imgL;

  // Página derecha
  const pageR = section.querySelector('[data-page-side="right"]');
  pageR.querySelector('textarea').dataset.id = textR;
  const boxR = pageR.querySelector('.drawing-box');
  boxR.dataset.id = imgR;
  const zoneImgR = pageR.querySelector('.zone-image');
  if (zoneImgR) zoneImgR.dataset.zoneId = imgR;
  const btnAddR = pageR.querySelector('.btn-add-image');
  if (btnAddR) btnAddR.dataset.zone = imgR;

  // Etiqueta de capítulo
  const chapLabel = section.querySelector('.dynamic-chapter-label');
  if (chapLabel) chapLabel.textContent = label;

  // Insertar en el DOM después del spread actual
  currentSpread.after(section);

  // Actualizar índices data-spread de todos los spreads
  reindexSpreads();
  renumberPages();

  // Registrar en lista dinámica
  dynamicList.push({
    id,
    chapter,
    label,
    afterDynamicId: currentSpread.dataset.dynamicId || null,
    afterStaticSpread: currentSpread.dataset.spread || null,
    pages: {
      left:  { textId: textL, imgId: imgL, imgPosition: 'top',    imgHidden: false },
      right: { textId: textR, imgId: imgR, imgPosition: 'bottom',  imgHidden: false },
    }
  });
  saveDynamicSpreads(dynamicList);

  // Navegar al spread nuevo
  const newIndex = state.current + 1;
  activateSpread(newIndex, 1);

  return section;
}

export function removeDynamicSpread(section) {
  const id = section.dataset.dynamicId;
  section.remove();
  dynamicList = dynamicList.filter(d => d.id !== id);
  saveDynamicSpreads(dynamicList);

  reindexSpreads();
  renumberPages();

  // Volver al spread anterior si el eliminado era el activo
  const total = getTotalSpreads();
  if (state.current >= total) {
    state.current = total - 1;
  }
  jumpToSpread(state.current);
  updateNav();
}

/* Reasigna data-spread a todos los spreads según su orden actual en el DOM */
function reindexSpreads() {
  getSpreads().forEach((s, i) => { s.dataset.spread = i; });
}

export function setDynamicList(list) {
  dynamicList = list;
}