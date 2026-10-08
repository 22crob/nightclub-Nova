// ClubScene methods: noticing a newer version of the game. A Home Screen
// copy on a phone stays open in the background for days and has no reload
// button, so the game checks the site's small version.json (written by the
// build, see vite.config.js) every few minutes and whenever it comes back on
// screen; when the build there differs from this one, a button pops up
// (#updateButton) that saves the club and reloads. Opened from disk
// (file://) there's nothing to check.
// Mixed into ClubScene (see ClubScene.js); `this` is the scene.
/* global __BUILD_ID__ */
import { SFX } from '../sfx.js';

const CHECK_EVERY_MS = 5 * 60 * 1000;

// version.json sits next to the page (the /test/ copy's is one folder up).
function versionUrl() {
  const here = new URL('.', location.href);
  return new URL(/\/test\/$/.test(here.pathname) ? '../version.json' : 'version.json', here);
}

export class AppUpdateMixin {
  setupAppUpdate() {
    this.buildId = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : '';
    document.getElementById('updateButton')?.addEventListener('click', () => { SFX.unlock(); this.applyUpdate(); });
    if (location.protocol === 'file:' || !this.buildId) return;
    setInterval(() => this.checkForUpdate(), CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.checkForUpdate(); });
    setTimeout(() => this.checkForUpdate(), 20000);
  }

  // True (and the button shows) if the site has a different build.
  async checkForUpdate() {
    if (location.protocol === 'file:') return false;
    try {
      const res = await fetch(`${versionUrl()}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return false;
      const { build } = await res.json();
      const newer = !!build && build !== this.buildId;
      document.getElementById('updateButton')?.classList.toggle('open', newer);
      return newer;
    } catch {
      return false; // offline: try again later
    }
  }

  applyUpdate() {
    this.saveGame();
    const url = new URL(location.href);
    url.searchParams.set('v', Date.now().toString(36)); // past any cached copy of the page
    location.replace(url.href);
  }
}
