// The main game scene. Its methods are split across the files in this
// folder by topic and mixed in below, so each file stays small.
import Phaser from 'phaser';
import { BAR_SPRITES, DJ_BOOTH_SPRITES, PATRON_META, PATRON_SHEETS } from '../assets.js';
import { PROP_TYPES } from '../catalog.js';
import { BASE_GRID_SIZE, FACINGS, STARTING_CASH, WAGE_INTERVAL_MS, ZOOM_DEFAULT } from '../config.js';
import { SFX } from '../sfx.js';
import { WorldMixin } from './world.js';
import { PlacementMixin } from './placement.js';
import { PropVisualsMixin } from './propVisuals.js';
import { ShopMixin } from './shop.js';
import { EconomyMixin } from './economy.js';
import { SaveMixin } from './save.js';
import { PatronsMixin } from './patrons.js';
import { HudMixin } from './hud.js';
import { StaffMixin } from './staff.js';
import { applyMixins } from './applyMixins.js';

export class ClubScene extends Phaser.Scene {
  constructor() {
    super('club');
    this.cash = STARTING_CASH;
    this.fans = 0;
    this.selectedProp = 'bar';
    this.currentFacing = 0; // facing used for the NEXT rotatable prop placed
    this.placed = {}; // "gx,gy" -> { type, facing, gameObject, label }
    // The club's current floor size — grows via expandClub()/GRID_EXPANSIONS
    // and is saved/restored like any other piece of club state. Set for
    // real (possibly from a save) in create(), before the tile grid below
    // is built.
    this.gridSize = BASE_GRID_SIZE;
    this.hoverTile = null; // { gx, gy } currently under the mouse, or null
    this.ghost = null; // preview sprite shown while hovering an empty tile with a rotatable prop selected
    this.highlightedTiles = []; // tile polygons currently tinted as "this is what will be placed on"
    this.hoveredPropLabel = null; // the one placed-prop name label currently shown, if any — see updateHoveredPropLabel()
    this.patrons = []; // active visitor NPCs — see patrons.js and the patron constants in config.js
  }

  preload() {
    // Sprite URLs come from assets.js. If any image fails to load, its
    // texture simply won't exist: hasAnySprite()/hasCharacterSprites() then
    // fall back to the placeholder box / primitive patron token.
    this.load.on('loaderror', (file) => console.error('[Club Nova] failed to load sprite:', file.key));

    for (const facing of FACINGS) {
      this.load.image(PROP_TYPES.dj.sprites[facing], DJ_BOOTH_SPRITES[facing]);
      this.load.image(PROP_TYPES.bar.sprites[facing], BAR_SPRITES[facing]);
    }

    // Chibi patrons: one spritesheet per character.
    PATRON_SHEETS.forEach((url, i) => {
      this.load.spritesheet(`patron_${i}`, url, {
        frameWidth: PATRON_META.frameWidth,
        frameHeight: PATRON_META.frameHeight,
      });
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0612');

    // World container we can drag around and zoom. centerView() below
    // positions it once the grid size is known.
    this.world = this.add.container(0, 0).setScale(ZOOM_DEFAULT);

    this.tileLayer = this.add.container(0, 0);
    this.wallLayer = this.add.container(0, 0);
    this.propLayer = this.add.container(0, 0);
    this.patronLayer = this.add.container(0, 0);
    this.ghostLayer = this.add.container(0, 0);
    this.world.add(this.tileLayer);
    this.world.add(this.wallLayer);
    this.world.add(this.propLayer);
    this.world.add(this.patronLayer);
    this.world.add(this.ghostLayer);

    // If there's a save with an already-expanded club, size the grid to
    // match it up front — otherwise the floor would always start at
    // BASE_GRID_SIZE and only reach its real size after loadGame() (further
    // down) re-runs the expansion, which would work but momentarily builds
    // (and throws away) a smaller grid than the save actually has.
    this.gridSize = this.peekSavedGridSize() || BASE_GRID_SIZE;

    this.tiles = {};
    this.buildTiles(this.gridSize);
    this.buildWalls(this.gridSize);
    this.centerView();

    // Restore a previous save, if there is one — must happen after the
    // tile grid and layers above exist (restoreProp draws into propLayer)
    // but before updateUI() below so the very first render already shows
    // the restored cash/fans instead of flashing the fresh-game defaults.
    this.loadGame();

    // Baseline for level-up detection (see updateUI()) — set from whatever
    // level the restored save (or a fresh level-1 game) actually starts
    // at, so loading a save already at level 3 doesn't fire three
    // "level up!" celebrations on the very first frame.
    this.currentLevel = this.levelInfo().level;

    // Hover/placement is driven entirely off the raw mouse position, not
    // per-tile hit zones. Every frame we convert the pointer's screen
    // position straight into a grid cell with screenToGrid(), and that
    // SAME number is used for the hover highlight, the ghost preview, and
    // the tile that actually gets placed on click. Previously, hover used
    // one code path (per-tile polygon hit-tests) and click used another
    // (the gx/gy baked into that tile's own listener closure) — those two
    // paths could disagree right at a tile boundary, which is what made
    // the booth appear to place on "the tile next to" the one you were
    // hovering. With one shared calculation, that can't happen anymore.
    this.isDragging = false;
    let dragStart = null;

    this.input.on('pointerdown', (p) => {
      SFX.unlock(); // first real user gesture — safe/cheap to call every time
      dragStart = { x: p.x, y: p.y, wx: this.world.x, wy: this.world.y };
      this.isDragging = false;
    });

    this.input.on('pointermove', (p) => {
      if (dragStart) {
        const dx = p.x - dragStart.x;
        const dy = p.y - dragStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) {
          this.isDragging = true;
          this.world.x = dragStart.wx + dx;
          this.world.y = dragStart.wy + dy;
        }
      }
      this.updateHoverFromPointer(p);
    });

    this.input.on('pointerup', (p) => {
      const wasDragging = this.isDragging;
      dragStart = null;
      this.isDragging = false;
      if (wasDragging || !this.hoverTile) return;
      if (p.event.button === 0) {
        this.placeProp(this.hoverTile.gx, this.hoverTile.gy);
      } else if (p.event.button === 2) {
        this.sellProp(this.hoverTile.gx, this.hoverTile.gy);
      }
    });

    // R: rotate. If hovering a placed rotatable prop, rotate that prop.
    // Otherwise, rotate the "pending" facing used for the next placement.
    this.input.keyboard.on('keydown-R', () => this.handleRotateKey());

    // ESC: quick way to stop holding whatever's selected, same as
    // re-clicking it in the shop.
    this.input.keyboard.on('keydown-ESC', () => this.deselectProp());

    // Zoom: mouse wheel zooms toward the cursor, +/- keys and the on-screen
    // buttons zoom around the screen centre.
    this.input.on('wheel', (pointer, objects, dx, dy) => {
      this.zoomTo(this.world.scaleX * (dy > 0 ? 0.9 : 1 / 0.9), pointer.x, pointer.y);
      this.updateHoverFromPointer(pointer);
    });
    this.input.keyboard.on('keydown-PLUS', () => this.zoomTo(this.world.scaleX / 0.85));
    this.input.keyboard.on('keydown-MINUS', () => this.zoomTo(this.world.scaleX * 0.85));
    const zoomIn = document.getElementById('zoomIn');
    const zoomOut = document.getElementById('zoomOut');
    if (zoomIn) zoomIn.addEventListener('click', () => this.zoomTo(this.world.scaleX / 0.85));
    if (zoomOut) zoomOut.addEventListener('click', () => this.zoomTo(this.world.scaleX * 0.85));

    this.cashText = document.getElementById('cashVal');
    this.fansText = document.getElementById('fansVal');
    this.levelText = document.getElementById('levelVal');
    this.xpBarFill = document.getElementById('xpBarFill');
    this.xpText = document.getElementById('xpText');
    this.placedText = document.getElementById('placedVal');
    this.buildShop();
    this.updateUI();

    // Mute toggle — a device preference (SFX.muted), not club state, so it
    // lives outside the save file and just needs its icon synced on load.
    this.muteButton = document.getElementById('muteButton');
    if (this.muteButton) {
      this.updateMuteButton();
      this.muteButton.addEventListener('click', () => {
        SFX.unlock();
        SFX.setMuted(!SFX.muted);
        this.updateMuteButton();
      });
    }

    // Outline layer for the "which tiles will this actually occupy" marker
    // — always drawn on top of props/ghost so a tall sprite's artwork can
    // never visually hide which floor tiles are claimed.
    this.footprintOutline = this.add.graphics().setDepth(9999);
    this.world.add(this.footprintOutline);

    // Passive fan growth from placed dance tiles / DJ booth
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        const rate = this.totalFanRate();
        if (rate > 0) {
          this.fans += rate;
          this.updateUI();
        }
      },
    });

    // Patron animations: one per character, per clip, per facing, named
    // patron_<i>_<clip>_<front|back> (see patronAnimKey()).
    if (this.hasCharacterSprites()) {
      const rates = { idle: 4, walk: 11, dance: 10 };
      PATRON_SHEETS.forEach((_, i) => {
        for (const [row, start] of Object.entries(PATRON_META.rows)) {
          const clip = row.split('_')[0];
          const first = start * PATRON_META.columns;
          this.anims.create({
            key: `patron_${i}_${row}`,
            frames: this.anims.generateFrameNumbers(`patron_${i}`, { start: first, end: first + PATRON_META.frames[clip] - 1 }),
            frameRate: rates[clip],
            repeat: -1,
          });
        }
      });
    }

    // Patron spawn loop — attempts a new arrival at a randomized interval
    // (self-rescheduling rather than a fixed-period timer, so spawns don't
    // land in an obvious metronomic rhythm).
    this.scheduleNextPatronSpawn();

    // Patron behavior tick — movement, tipping, and departure are all
    // driven off wall-clock timestamps checked here for every patron at
    // once, rather than one Phaser timer per patron.
    this.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => this.tickPatrons(),
    });

    // Cash/fans drift upward continuously from patron tips, not just on
    // discrete actions like placing a prop, so on top of the save-on-action
    // calls elsewhere (placeProp, rotatePlacedProp) an autosave timer keeps
    // that drift from being lost. Also save on tab close as a last resort.
    this.time.addEvent({
      delay: 6000,
      loop: true,
      callback: () => this.saveGame(),
    });
    window.addEventListener('beforeunload', () => this.saveGame());

    // Staff wages.
    this.time.addEvent({ delay: WAGE_INTERVAL_MS, loop: true, callback: () => this.payWages() });
  }
}

applyMixins(ClubScene, [
  WorldMixin,
  PlacementMixin,
  PropVisualsMixin,
  ShopMixin,
  EconomyMixin,
  SaveMixin,
  PatronsMixin,
  HudMixin,
  StaffMixin,
]);
