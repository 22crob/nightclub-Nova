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
- Sofas and booths; candle tables; pool table; speakers; plants; neon signs; disco ball
- Wallpapers and floor finishes for the Decorate tool

## 5. Gameplay
- Staff and drink sales: done. Hire a bartender per bar and a DJ per booth (Staff tab); wages every 30s, and staff quit if unpaid. Thirsty patrons walk to staffed bars and buy drinks (the main income); the dance floor and DJ booth only earn fans, and patrons only dance, while a DJ plays. Patrons route around furniture.
- Patron needs and mood: done. Thirst and fun drive mood; mood scales tips (0.5x-1.5x), decides fans on leaving (+3 / +1 / 0, or -2 for storming out early), and the average (Vibe, shown in the HUD) speeds up or slows new arrivals. Passive fans from props were cut to a quarter so happy patrons matter.
- Next: club nights on a clock, with an end-of-night summary
- Then: Throw a Party events; a bouncer at the door
