/* ============================================================
   STORAGE.JS — persistencia con Firebase Firestore
   Cada libro tiene un ID único en la URL (?id=xxxx)
   Si no hay ID, se genera uno nuevo y se redirige.
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
  return Math.random().toString(36).slice(2, 9); // ej: "xk92m4a"
}

export function getBookId() {
  const params = new URLSearchParams(window.location.search);
  let id = params.get('id');
  if (!id) {
    id = generateId();
    // Redirigir a la misma página con el ID en la URL
    window.location.replace(`${window.location.pathname}?id=${id}`);
  }
  return id;
}

const BOOK_ID = getBookId();

/* Referencia al documento del libro en Firestore */
function bookRef() {
  return doc(db, 'libros', BOOK_ID);
}

/* ── Leer estado completo ── */

export async function getState() {
  try {
    const snap = await getDoc(bookRef());
    if (snap.exists()) return snap.data();
    return defaultState();
  } catch (e) {
    console.warn('Error leyendo Firestore:', e);
    return defaultState();
  }
}

function defaultState() {
  return {
    currentSpread:   0,
    mobilePageSide:  'left',
    texts:           {},
    images:          {},
    zones:           {},
    dynamicSpreads:  []
  };
}

/* ── Guardar campo individual ── */

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

export function saveText(id, value) {
  patch({ [`texts.${id}`]: value });
}

export function saveImage(id, src) {
  patch({ [`images.${id}`]: src });
}

export function saveZone(zoneId, data) {
  const updates = {};
  if (data.hidden   !== undefined) updates[`zones.${zoneId}.hidden`]   = data.hidden;
  if (data.position !== undefined) updates[`zones.${zoneId}.position`] = data.position;
  patch(updates);
}

export function saveDynamicSpreads(list) {
  patch({ dynamicSpreads: list });
}

/* ── Escuchar cambios en tiempo real ── */

/*
 * Llama a callback(newState) cada vez que otro usuario
 * guarda algo en el mismo libro.
 * Devuelve la función unsubscribe para detener la escucha.
 */
export function subscribeToChanges(callback) {
  return onSnapshot(bookRef(), snap => {
    if (snap.exists()) callback(snap.data());
  });
}

/* ── Link para compartir ── */

export function getShareUrl() {
  return `${window.location.origin}${window.location.pathname}?id=${BOOK_ID}`;
}
export function saveEditable(id, value) {
  patch({ [`editables.${id}`]: value });
}