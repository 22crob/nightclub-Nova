# Club Nova roadmap

The visual and gameplay reference for everything is **Nightclub City** (2010): its chibi characters, UI layout, room style and props. We build our own original art and UI in that style. We don't copy its actual images, logo or name.

## 1. Room and surroundings: done
- 12x12 starting room, expansions to 14/16/18/20
- Thick light-grey walls with pale top caps, a front door on the right wall
- Raised floor slab with dark front edges, tiled sidewalk outside
- Proportions matched to the reference: a patron is about 1.46 tile widths tall, walls about 1.3x a patron, bar counter at waist height

## 2. Interface reskin: done
- Top-left portrait with level star and a long XP bar; cash with a money icon top-centre; glossy blue buttons top-right
- Bottom toolbar of large icon buttons: Shop, Decorate (paint bucket), Staff, Friends
- Glossy, rounded, bright UI chrome like the reference

## 3. Chibi characters (Blender): done
- Big-head chibi patrons: several body types, many outfits, hairstyles and skin tones
- Walk, dance and idle animations, facing front and back (mirrored for the other two diagonals)

## 4. Props (Blender, one script each via art/blender/iso_rig.py)
- DJ booth line-up: done. Five tiers, same 2x1 size and gameplay: Wood (Lv1), Pro (Lv2), Club (Lv3), Neon (Lv5), Ice (Lv7). Booths only; speakers will be a separate decoration.
- Dance floor line-up: done. Nine designs drawn in code (src/floors.js), same gameplay, simple to fancy through level 10: Plain, Checker (Lv1), Wood (Lv2), Glow (Lv3, first animated), Light-Up (Lv4), Neon Rings (Lv5), Color Wave (Lv6) and Rainbow Flow (Lv8) that flow across the whole floor, and Step Floor (Lv10) that lights up under dancers. Animated floors move only while a DJ plays.
- Bar line-up: done. Five tiers, same 1x3 size and gameplay, rising detail: Starter (Lv1), Wood (Lv2), Pub (Lv3, the original), Neon (Lv5), Ice (Lv7). Rendered in two layers so bartenders stand between back bar and counter.
- Decorations: done. Sixteen Blender models (build_decor.py), simple to fancy through level 9: Beer Crates, Potted Fern, Wood Speaker, Disco Ball (Lv1), Velvet Rope, Palm Tree (Lv2), Lava Lamp, Speaker Tower (Lv3), Neon Sign, Glow Tube (Lv4), Pool Table (Lv5, 2 tiles), Spotlight, Aquarium (Lv6), Neon Speaker (Lv7), Gold Trophy (Lv8), Lucky Cat (Lv9).
- Characters were shrunk to about 1.5x a bar counter's height, as in Nightclub City.
- Seating: done. Wood Stool, Fabric Couch (Lv1), Candle Table (Lv2), Chrome Bar Stool, Leather Couch (Lv3), Red Velvet Booth (Lv4), Black Leather Booth (Lv6), Gold VIP Booth (Lv8). Patrons walk over and sit, which cheers them up. They don't have a sitting pose yet: the seat hides their legs. Add a real sit pose when the characters are redone.
- All prop art has drawn outlines, like Nightclub City.
- Mood lighting: done. The floor and walls are gently dimmed (src/scene/lighting.js). Coloured glows under lights (PROP_LIGHTS in catalog.js) are built but switched off (MOOD_LIGHTING.glows), because the owner found them too strong in spots.
- Later: moving spotlights as a decoration you buy, lights pulsing to the beat. (Done: the night street outside with a line at the door, `src/scene/street.js`.)
- Wallpaper: done. Eleven designs drawn in code (src/walls.js), painted one wall section at a time ($10-$120 each), simple to fancy through level 10: Paint, Brick (Lv1), Stripes, Wood Panel (Lv2), Retro Dots (Lv3), Velvet (Lv4), Neon Strip (Lv5, first animated), Equalizer (Lv6), Mirror Tiles (Lv7), Neon Chevron (Lv9), LED Wall (Lv10). Animated walls move only while a DJ plays.
- Later: more variety, e.g. colour versions of each floor and wallpaper, and more wall types

## 5. Gameplay
- Staff and drink sales: done. Hire a bartender per bar and a DJ per booth (Staff tab); wages every 30s, and staff quit if unpaid. Thirsty patrons walk to staffed bars and buy drinks (the main income); the dance floor and DJ booth only earn fans, and patrons only dance, while a DJ plays. Patrons route around furniture.
- Patron needs and mood: done. Thirst and fun drive mood; mood scales tips (0.5x-1.5x), decides fans on leaving (+3 / +1 / 0, or -2 for storming out early), and the average (Vibe, shown in the HUD) speeds up or slows new arrivals. Passive fans from props were cut to a quarter so happy patrons matter.
- Permanent DJ: done. Every club opens with a free Wood Booth and a DJ who never stops playing (no hiring or wages). The other booths are upgrades that swap it in place; it can be turned but not sold.
- Drop the Bass: done. A free 90-second boost with a 5-minute cooldown: tips twice as often and twice as big, thirst twice as fast, most patrons dance, and the music's bass turned way up. The club has a built-in beat (src/music.js, Web Audio, no files).
- Patron behaviour pass: done. Bar customers queue in a straight line out from the counter and step up as each is served; wanderers keep off the lines; stuck patrons walk around or squeeze past others; dancers stay 12-22s; visits are 45-65s; thirst and boredom were rebalanced so patrons rarely storm out (checked with a 3-minute simulated club).
- Regular floors: done. Eight floors (Concrete, Stone Tiles, Wood Planks, Red Carpet, Purple Carpet, Marble, Black Gloss, Gold Marble) painted tile by tile under the furniture, click or drag. Dance floors have their own tab, and patrons only dance on those.
- Finer grid: done. Tiles are 48 px instead of 64 (the room is 16x16 instead of 12x12 in the same space), so furniture covers more, smaller tiles like Nightclub City's. Bars are single 1x3 pieces (back bar, aisle, counter) that fit their tiles exactly and line up into one long bar along a wall. All furniture was re-rendered at the new scale. Saves moved to a new key, so clubs started fresh.
- HUD restyle: done. Dark glass, chrome rims and neon edges, like Nightclub City's interface.
- Shop strip: done. The shop is a dark strip along the bottom like Nightclub City's: category buttons on the left, a scrolling row of items with prices, a name bubble on hover, and an OK button. It stays open while you build.
- Done: image files shrunk to 256-colour palettes (`art/compress_sprites.py`); the game is about 4 MB of the play link's 16 MB
- Club nights: done. Each night runs 9 PM to 3 AM in 4 real minutes (clock under the cash). Last call stops new guests; at closing everyone heads home, the music and wages stop and the lights come up, and a summary card shows guests, drinks, tips, wages, profit and fans, with a 1-5 star rating from the night's average vibe (bonus fans for stars). "Open the doors" starts the next night; the night number and best profit are saved.
- Next: Throw a Party events
- Then: a bouncer at the door
