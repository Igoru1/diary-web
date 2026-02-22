/* ============================================================
   STORAGE.JS — persistencia con Firebase Firestore
   Cada libro tiene un ID único en la URL (?id=xxxx)
   Si no hay ID, se genera uno nuevo y se redirige.

   IMPORTANTE: se usan objetos anidados reales en lugar de
   notación de punto ("texts.id") para que Firestore guarde
   correctamente dentro de los campos texts, images, etc.
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDG_e2GvjbuF7LljjWE9ShIVeQTcI2NX0s",
  authDomain:        "milovsito.firebaseapp.com",
  projectId:         "milovsito",
  storageBucket:     "milovsito.firebasestorage.app",
  messagingSenderId: "856277891358",
  appId:             "1:856277891358:web:d3e2b5834685f3e5f2710f"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

/* ── ID del libro desde la URL ── */

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export function getBookId() {
  const params = new URLSearchParams(window.location.search);
  let id = params.get('id');
  if (!id) {
    id = generateId();
    window.location.replace(`${window.location.pathname}?id=${id}`);
  }
  return id;
}

const BOOK_ID = getBookId();

function bookRef() {
  return doc(db, 'libros', BOOK_ID);
}

/* ── Estado por defecto ── */

function defaultState() {
  return {
    currentSpread:  0,
    mobilePageSide: 'left',
    texts:          {},
    images:         {},
    zones:          {},
    editables:      {},
    dynamicSpreads: []
  };
}

/* ── Leer estado completo ──
   Normaliza el documento por si hay claves con punto
   de versiones anteriores (migración automática).
*/
export async function getState() {
  try {
    const snap = await getDoc(bookRef());
    if (!snap.exists()) return defaultState();

    const raw  = snap.data();
    const base = defaultState();

    // Copiar campos simples
    if (raw.currentSpread  !== undefined) base.currentSpread  = raw.currentSpread;
    if (raw.mobilePageSide !== undefined) base.mobilePageSide = raw.mobilePageSide;
    if (raw.dynamicSpreads !== undefined) base.dynamicSpreads = raw.dynamicSpreads;

    // Copiar objetos anidados correctos si existen
    if (raw.texts     && typeof raw.texts     === 'object') base.texts     = raw.texts;
    if (raw.images    && typeof raw.images    === 'object') base.images    = raw.images;
    if (raw.zones     && typeof raw.zones     === 'object') base.zones     = raw.zones;
    if (raw.editables && typeof raw.editables === 'object') base.editables = raw.editables;

    // Migrar claves con punto de versiones anteriores
    // ej: "texts.page-1a" → base.texts["page-1a"]
    Object.entries(raw).forEach(([key, val]) => {
      if (key.startsWith('texts.'))     base.texts[key.slice(6)]     = val;
      if (key.startsWith('images.'))    base.images[key.slice(7)]    = val;
      if (key.startsWith('editables.')) base.editables[key.slice(10)] = val;
      if (key.startsWith('zones.')) {
        // "zones.img-1a.hidden" → base.zones["img-1a"] = { hidden: val }
        const parts = key.slice(6).split('.');
        const zId   = parts[0];
        const field = parts[1];
        if (zId && field) {
          if (!base.zones[zId]) base.zones[zId] = {};
          base.zones[zId][field] = val;
        }
      }
    });

    return base;

  } catch (e) {
    console.error('Error leyendo Firestore:', e);
    return defaultState();
  }
}

/* ── Guardar — siempre objetos anidados reales ── */

async function patch(data) {
  try {
    await setDoc(bookRef(), data, { merge: true });
  } catch (e) {
    console.warn('Error guardando en Firestore:', e);
  }
}

export function saveCurrentSpread(index) {
  patch({ currentSpread: index });
}

export function saveMobilePageSide(side) {
  patch({ mobilePageSide: side });
}

/* Guarda el texto dentro del objeto texts anidado */
export function saveText(id, value) {
  patch({ texts: { [id]: value } });
}

/* Guarda la imagen dentro del objeto images anidado */
export function saveImage(id, src) {
  patch({ images: { [id]: src } });
}

/* Guarda el estado de la zona dentro del objeto zones anidado */
export function saveZone(zoneId, data) {
  const zoneUpdate = {};
  if (data.hidden   !== undefined) zoneUpdate.hidden   = data.hidden;
  if (data.position !== undefined) zoneUpdate.position = data.position;
  patch({ zones: { [zoneId]: zoneUpdate } });
}

export function saveDynamicSpreads(list) {
  patch({ dynamicSpreads: list });
}

/* Guarda el editable dentro del objeto editables anidado */
export function saveEditable(id, value) {
  patch({ editables: { [id]: value } });
}

/* ── Escuchar cambios en tiempo real ── */

export function subscribeToChanges(callback) {
  return onSnapshot(bookRef(), snap => {
    if (snap.exists()) {
      // Pasar por el mismo normalizador para que el callback reciba
      // siempre la misma estructura limpia
      getState().then(callback);
    }
  });
}

/* ── Link para compartir ── */

export function getShareUrl() {
  return `${window.location.origin}${window.location.pathname}?id=${BOOK_ID}`;
}