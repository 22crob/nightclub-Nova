// The main game scene. Its methods are split across the files in this
// folder by topic and mixed in below, so each file stays small.
import Phaser from 'phaser';
import { PATRON_SHEETS, SPRITE_URLS, patronMetaOf } from '../assets.js';
import { PROP_TYPES } from '../catalog.js';
import { BASE_GRID_SIZE, FACINGS, PASSIVE_FAN_SHARE, FLOOR_TICK_MS, STARTING_CASH, TOUCH, WAGE_INTERVAL_MS, ZOOM_DEFAULT } from '../config.js';
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
import { RatingMixin } from './rating.js';
import { PartiesMixin } from './parties.js';
import { GuestsMixin } from './guests.js';
import { SongsMixin } from './songs.js';
import { CelebritiesMixin } from './celebrities.js';
import { InventoryMixin } from './inventory.js';
import { ActivitiesMixin } from './activities.js';
import { SecurityMixin } from './security.js';
import { ReactionsMixin } from './reactions.js';
import { BarsMixin } from './bars.js';
import { BonusesMixin } from './bonuses.js';
import { SpeakersMixin } from './speakers.js';
import { SelectionMixin } from './selection.js';
import { GoalsMixin } from './goals.js';
import { MeterMixin } from './meter.js';
import { ClubNameMixin } from './clubName.js';
import { DailyMixin } from './daily.js';
import { DrinksMixin } from './drinks.js';
import { TestModeMixin } from './testMode.js';
import { PopularityMixin } from './popularity.js';
import { UpgradesMixin } from './upgrades.js';
import { PartyFxMixin } from './partyFx.js';
import { TutorialMixin } from './tutorial.js';
import { AchievementsMixin } from './achievements.js';
import { TouchPlaceMixin } from './touchPlace.js';
import { AppUpdateMixin } from './appUpdate.js';
import { TankFxMixin } from './tankFx.js';
import { Music } from '../music.js';
import { applyMixins } from './applyMixins.js';

export class ClubScene extends Phaser.Scene {
  constructor() {
    super('club');
    this.cash = STARTING_CASH;
    this.fans = 0;
    this.popularity = 0; // the club's reputation (popularity.js)
    this.bouncers = 1; // hired bouncers, the house one included (security.js)
    this.selectedProp = null; // nothing in hand until you pick something in the shop
    this.currentFacing = 0; // facing used for the NEXT rotatable prop placed
    this.wallpaper = {}; // wall section -> wallpaper type (see wallpaper.js)
    this.floorPaint = {}; // "gx,gy" -> regular floor type (see floorPaint.js)
    this.placed = {}; // "gx,gy" -> { type, facing, gameObject, label }
    // The club's current floor size — grows a row at a time via expandClub()
    // and is saved/restored like any other piece of club state. Set for
    // real (possibly from a save) in create(), before the tile grid below
    // is built.
    this.gridW = BASE_GRID_SIZE; // tiles along gx (the right wall)
    this.gridH = BASE_GRID_SIZE; // tiles along gy (the left wall)
    this.hoverTile = null; // { gx, gy } currently under the mouse, or null
    this.ghost = null; // preview sprite shown while hovering an empty tile with a rotatable prop selected
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
      // Seating's "in front of this seat" cut-outs (see addSeatOccluder()).
      for (const [facing, row] of Object.entries(def.occluders || {})) {
        row.forEach((off, i) => {
          const key = `${def.sprites[0].replace(/_0$/, '')}_occ${i}_${facing}`;
          if (off && SPRITE_URLS[key]) this.load.image(key, SPRITE_URLS[key]);
        });
      }
    }

    // The buildings across the street (street.js).
    for (const key of Object.keys(SPRITE_URLS)) if (key.startsWith('bldg_')) this.load.image(key, SPRITE_URLS[key]);

    // Patrons: one spritesheet per character, each with its own frame grid.
    PATRON_SHEETS.forEach((url, i) => {
      const meta = patronMetaOf(i);
      this.load.spritesheet(`patron_${i}`, url, { frameWidth: meta.frameWidth, frameHeight: meta.frameHeight });
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
    this.createStreetLayers(); // the street outside
    this.world.add(this.streetBackLayer); // walkers behind the walls
    this.world.add(this.wallLayer);
    this.world.add(this.propLayer);
    this.world.add(this.streetLayer); // walkers in front of the room
    this.world.add(this.patronLayer);
    this.registerFloorTextures();
    this.registerWallTextures();
    this.world.add(this.ghostLayer);

    // If there's a save with an already-expanded club, size the grid to
    // match it up front — otherwise the floor would always start at
    // BASE_GRID_SIZE and only reach its real size after loadGame() (further
    // down) re-runs the expansion, which would work but momentarily builds
    // (and throws away) a smaller grid than the save actually has.
    const saved = this.peekSavedGridSize();
    if (saved) [this.gridW, this.gridH] = saved;

    this.tiles = {};
    this.buildTiles();
    this.buildWalls();
    this.centerView();
    // The window changed size (the play link can open in a small panel and
    // then go full screen): fit the club to the new size.
    this.scale.on('resize', () => this.centerView());

    // Restore a previous save, if there is one — must happen after the
    // tile grid and layers above exist (restoreProp draws into propLayer)
    // but before updateUI() below so the very first render already shows
    // the restored cash/fans instead of flashing the fresh-game defaults.
    this.loadGame();
    if (this.freshClub) this.placeStarterLayout();
    this.applyTestMode(); // only on the test link (see testMode.js)
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

    // Touch: a second finger pinches to zoom (see pinchMove()); a tap may
    // wobble a little more than a mouse click before it counts as a drag.
    this.input.addPointer(1);
    this.pinch = null;
    const dragSlop = (p) => (p.wasTouch ? TOUCH.tapSlop : 6);

    this.input.on('pointerdown', (p) => {
      SFX.unlock(); // first real user gesture — safe/cheap to call every time
      this.isDragging = false;
      if (this.startPinch()) { dragStart = null; this.placeGrab = null; return; }
      // On a phone, a finger on the held item drags it (touchPlace.js).
      if (p.wasTouch && this.touchPlacing() && this.grabTouchPlace(p)) { dragStart = null; return; }
      // A finger has no hover: bring the hover state (tile, ghost, object)
      // to where it touched first.
      if (p.wasTouch) { this.updateHoverFromPointer(p); this.updateHoverObject(p); }
      // Holding a regular floor: the left button paints (drag to paint a
      // stroke) instead of moving the view.
      const holding = PROP_TYPES[this.selectedProp];
      if (holding && holding.paintStyle && p.button === 0) {
        this.paintingFloor = true;
        dragStart = null;
        if (this.hoverTile) this.paintFloor(this.hoverTile.gx, this.hoverTile.gy);
        return;
      }
      // A bonus badge under the pointer takes the click (see pointerup).
      if (this.bonusAt(p.x, p.y, p.wasTouch)) { dragStart = null; return; }
      dragStart = { x: p.x, y: p.y, wx: this.world.x, wy: this.world.y };
    });

    this.input.on('pointermove', (p) => {
      if (this.pinch) { this.pinchMove(); return; }
      if (this.placeGrab) { this.dragTouchPlace(p); return; }
      if (dragStart) {
        const dx = p.x - dragStart.x;
        const dy = p.y - dragStart.y;
        if (Math.abs(dx) + Math.abs(dy) > dragSlop(p)) {
          this.isDragging = true;
          this.world.x = dragStart.wx + dx;
          this.world.y = dragStart.wy + dy;
        }
      }
      this.updateHoverFromPointer(p);
      if (!this.isDragging) this.updateHoverObject(p); // outline glow (selection.js)
      if (this.paintingFloor && this.hoverTile) this.paintFloor(this.hoverTile.gx, this.hoverTile.gy);
    });

    this.input.on('pointerup', (p) => {
      // A pinch ends when the last finger lifts; none of its fingers click.
      if (this.pinch) {
        if (!this.input.pointer1.isDown && !this.input.pointer2.isDown) this.pinch = null;
        dragStart = null;
        this.isDragging = false;
        return;
      }
      if (this.paintingFloor) {
        this.paintingFloor = false;
        this.saveGame();
        return;
      }
      if (this.placeGrab) { this.releaseTouchPlace(p); return; }
      const wasDragging = this.isDragging;
      dragStart = null;
      this.isDragging = false;
      if (wasDragging) return;
      // A bonus badge comes first: collecting it never opens a card or
      // places, moves or sells anything underneath.
      if (p.button === 0 && this.clickBonus(p)) return;
      // On a phone, a tap with something in hand hops it there; the ✓ buys it (touchPlace.js).
      if (p.wasTouch && this.touchPlacing()) {
        const at = this.tileAtScreen(p.x, p.y);
        if (this.inGrid(at.gx, at.gy)) this.moveTouchPlace(at.gx, at.gy);
        return;
      }
      const holding = PROP_TYPES[this.selectedProp];
      if (holding && holding.wallStyle) {
        if (p.button === 0 && this.hoverWall) this.paintWall(this.hoverWall);
        return;
      }
      // With nothing in hand, a click goes to whatever is drawn under the
      // cursor: the Edit tools act on the piece clicked (anywhere on it), a
      // person opens their card, furniture is selected (selection.js).
      // With something in hand, a click always places it.
      if (p.button === 0 && !this.selectedProp && this.clickObject(p)) return;
      if (p.button === 0 && this.dockTab === 'edit' && !this.selectedProp && this.hoverTile
        && this.editClick(this.hoverTile.gx, this.hoverTile.gy)) return;
      if (p.button === 2) {
        const hit = this.objectAt(p.x, p.y);
        if (hit && hit.kind === 'prop') { this.sellProp(hit.target.anchor[0], hit.target.anchor[1]); return; }
      }
      if (!this.hoverTile) return;
      if (p.button === 0) {
        this.placeProp(this.hoverTile.gx, this.hoverTile.gy);
      } else if (p.button === 2) {
        this.sellProp(this.hoverTile.gx, this.hoverTile.gy);
      }
    });

    // R: rotate. If hovering a placed rotatable prop, rotate that prop.
    // Otherwise, rotate the "pending" facing used for the next placement.
    this.input.keyboard.on('keydown-R', () => this.handleRotateKey());

    // ESC: quick way to stop holding whatever's selected, same as
    // re-clicking it in the shop.
    // A second Esc (with nothing held) puts the shop away.
    this.input.keyboard.on('keydown-ESC', () => { if (this.selectedProp) this.deselectProp(); this.clearSelection(); });

    // Zoom: mouse wheel zooms toward the cursor, +/- keys zoom around the
    // screen centre.
    this.input.on('wheel', (pointer, objects, dx, dy) => {
      this.zoomTo(this.world.scaleX * (dy > 0 ? 0.9 : 1 / 0.9), pointer.x, pointer.y);
      this.updateHoverFromPointer(pointer);
    });
    this.input.keyboard.on('keydown-PLUS', () => this.zoomTo(this.world.scaleX / 0.85));
    this.input.keyboard.on('keydown-MINUS', () => this.zoomTo(this.world.scaleX * 0.85));

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
    this.setupLevelUp();
    this.setupClubHours();
    this.setupRestart();
    this.setupBackup(); // copy / load the club as a code (save.js)

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
      PATRON_SHEETS.forEach((_, i) => {
        const meta = patronMetaOf(i);
        for (const [row, first] of Object.entries(meta.starts)) {
          const clip = row.split('_')[0];
          this.anims.create({
            key: `patron_${i}_${row}`,
            frames: this.anims.generateFrameNumbers(`patron_${i}`, { start: first, end: first + meta.frames[clip] - 1 }),
            frameRate: meta.fps[clip],
            repeat: -1,
          });
        }
      });
    }

    // Patron spawn loop — attempts a new arrival at a randomized interval
    // (self-rescheduling rather than a fixed-period timer, so spawns don't
    // land in an obvious metronomic rhythm).
    this.startStreet();
    this.setupSecurity(); // the guard inside the door
    this.makeReactionTextures(); // happy faces etc. over guests (reactions.js)
    this.registerLightTexture();
    this.setupBonuses(); // high fives worth $88 (bonuses.js)
    this.setupSpeakers(); // speaker cones bounce to the beat (speakers.js)
    this.setupGoals(); // the goals panel (goals.js)
    this.setupClubName(); // the name and its sign outside; asks for one if there isn't (clubName.js)
    this.setupDaily(); // today's gift, once a day (daily.js)
    this.setupTutorial(); // the How to play guide (tutorial.js)
    this.setupAchievements(); // badges and the trophy wall (achievements.js)
    this.setupTouchPlace(); // drag-and-confirm placing on phones (touchPlace.js)
    this.setupAppUpdate(); // the New version button (appUpdate.js)
    this.setupDrinkMenu(); // what the bars serve (drinks.js)
    this.setupMeter(); // the drink meter on the right edge (meter.js)
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickMeter() });
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
  PopularityMixin,
  UpgradesMixin,
  PartyFxMixin,
  TutorialMixin,
  AchievementsMixin,
  TouchPlaceMixin,
  AppUpdateMixin,
  InventoryMixin,
  ActivitiesMixin,
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
  RatingMixin,
  PartiesMixin,
  GuestsMixin,
  SongsMixin,
  CelebritiesMixin,
  SecurityMixin,
  ReactionsMixin,
  BarsMixin,
  BonusesMixin,
  SpeakersMixin,
  SelectionMixin,
  GoalsMixin,
  MeterMixin,
  ClubNameMixin,
  DailyMixin,
  DrinksMixin,
  TestModeMixin,
  TankFxMixin,
]);
