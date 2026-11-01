// Saving to the browser's local storage.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function writeSave(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
