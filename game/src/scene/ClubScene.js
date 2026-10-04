// The main game scene. Its methods are split across the files in this
// folder by topic and mixed in below, so each file stays small.
import Phaser from 'phaser';
import { PATRON_META, PATRON_SHEETS, SPRITE_URLS } from '../assets.js';
import { PROP_TYPES } from '../catalog.js';
import { BASE_GRID_SIZE, FACINGS, PASSIVE_FAN_SHARE, FLOOR_TICK_MS, STARTING_CASH, WAGE_INTERVAL_MS, ZOOM_DEFAULT } from '../config.js';
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
import { MoodMixin } from './mood.js';
import { WallpaperMixin } from './wallpaper.js';
import { SeatingMixin } from './seating.js';
import { LightingMixin } from './lighting.js';
import { BoostMixin } from './boost.js';
import { FloorPaintMixin } from './floorPaint.js';
import { StreetMixin } from './street.js';
import { NightsMixin } from './nights.js';
import { PartiesMixin } from './parties.js';
import { GuestsMixin } from './guests.js';
import { SongsMixin } from './songs.js';
import { VipsMixin } from './vips.js';
import { InventoryMixin } from './inventory.js';
import { Music } from '../music.js';
import { applyMixins } from './applyMixins.js';

export class ClubScene extends Phaser.Scene {
  constructor() {
    super('club');
    this.cash = STARTING_CASH;
    this.fans = 0;
    this.selectedProp = null; // nothing in hand until you pick something in the shop
    this.currentFacing = 0; // facing used for the NEXT rotatable prop placed
    this.wallpaper = {}; // wall section -> wallpaper type (see wallpaper.js)
    this.floorPaint = {}; // "gx,gy" -> regular floor type (see floorPaint.js)
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

    for (const def of Object.values(PROP_TYPES)) {
      const sets = [def.sprites, ...Object.values(def.layerSprites || {})].filter(Boolean);
      for (const set of sets) {
        for (const facing of FACINGS) {
          const key = set[facing];
          if (SPRITE_URLS[key]) this.load.image(key, SPRITE_URLS[key]);
        }
      }
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
    this.registerFloorPaintTextures();
    this.createFloorPaintLayer(); // regular floors, over the bare floor
    this.registerLightTexture();
    this.createLightingLayers(); // dimming and glows, between the floor and the walls
    this.world.add(this.wallLayer);
    this.world.add(this.propLayer);
    this.createStreetLayers(); // the street outside, in front of the room
    this.world.add(this.streetLayer);
    this.world.add(this.patronLayer);
    this.registerFloorTextures();
    this.registerWallTextures();
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
    if (this.freshClub) this.placeStarterLayout();
    this.ensureClubBooth(); // every club has its DJ booth, with the DJ playing

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
      this.isDragging = false;
      // Holding a regular floor: the left button paints (drag to paint a
      // stroke) instead of moving the view.
      const holding = PROP_TYPES[this.selectedProp];
      if (holding && holding.paintStyle && p.event.button === 0) {
        this.paintingFloor = true;
        dragStart = null;
        if (this.hoverTile) this.paintFloor(this.hoverTile.gx, this.hoverTile.gy);
        return;
      }
      dragStart = { x: p.x, y: p.y, wx: this.world.x, wy: this.world.y };
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
      if (this.paintingFloor && this.hoverTile) this.paintFloor(this.hoverTile.gx, this.hoverTile.gy);
    });

    this.input.on('pointerup', (p) => {
      if (this.paintingFloor) {
        this.paintingFloor = false;
        this.saveGame();
        return;
      }
      const wasDragging = this.isDragging;
      dragStart = null;
      this.isDragging = false;
      if (wasDragging) return;
      const holding = PROP_TYPES[this.selectedProp];
      if (holding && holding.wallStyle) {
        if (p.event.button === 0 && this.hoverWall) this.paintWall(this.hoverWall);
        return;
      }
      // The Edit tab's tools act on whatever was clicked.
      if (p.event.button === 0 && this.dockTab === 'edit' && !this.selectedProp && this.hoverTile
        && this.editClick(this.hoverTile.gx, this.hoverTile.gy)) return;
      // With something in hand, a click always places it (never opens a
      // card for someone standing there).
      if (p.event.button === 0 && !this.selectedProp && this.clickPerson(p)) return; // a guest's or bartender's card
      if (!this.hoverTile) return;
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
    // A second Esc (with nothing held) puts the shop away.
    this.input.keyboard.on('keydown-ESC', () => { if (this.selectedProp) this.deselectProp(); });

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
    this.luxuryText = document.getElementById('luxuryVal');
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
        Music.applyLevels();
        this.updateMuteButton();
      });
    }
    this.setupBoost();
    this.setupParties();
    this.setupGuests();
    this.setupSongs();
    this.setupVips();
    this.setupLevelUp();
    this.setupNights(this.savedNight);
    this.setupRestart();

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
        if (!this.clubOpen()) return;
        const rate = this.totalFanRate() * PASSIVE_FAN_SHARE;
        if (rate > 0) {
          this.fans += rate;
          this.updateUI();
        }
      },
    });

    // Patron animations: one per character, per clip, per facing, named
    // patron_<i>_<clip>_<front|back> (see patronAnimKey()).
    if (this.hasCharacterSprites()) {
      const rates = PATRON_META.fps;
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
    this.startStreet();
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

    // Animated dance floors.
    this.time.addEvent({ delay: FLOOR_TICK_MS, loop: true, callback: () => this.animateFloors() });

    // Staff wages.
    this.time.addEvent({ delay: WAGE_INTERVAL_MS, loop: true, callback: () => this.payWages() });
  }
}

applyMixins(ClubScene, [
  InventoryMixin,
  WorldMixin,
  PlacementMixin,
  PropVisualsMixin,
  ShopMixin,
  EconomyMixin,
  SaveMixin,
  PatronsMixin,
  HudMixin,
  StaffMixin,
  MoodMixin,
  WallpaperMixin,
  SeatingMixin,
  LightingMixin,
  BoostMixin,
  FloorPaintMixin,
  StreetMixin,
  NightsMixin,
  PartiesMixin,
  GuestsMixin,
  SongsMixin,
  VipsMixin,
]);
