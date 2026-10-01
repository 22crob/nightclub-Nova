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
- DJ booth with speakers and decks; light-up dance floor tile (glowing circles)
- Premium bar; sofas and booths; candle tables; pool table; speakers; plants; neon signs; disco ball
- Wallpapers and floor finishes for the Decorate tool

## 5. Gameplay
- Staff and drink sales: done. Hire a bartender per bar and a DJ per booth (Staff tab); wages every 30s, and staff quit if unpaid. Thirsty patrons walk to staffed bars and buy drinks (the main income); the dance floor and DJ booth only earn fans, and patrons only dance, while a DJ plays. Patrons route around furniture.
- Next: patron needs and mood (happy patrons tip more and bring fans; unhappy ones leave early)
- Then: club nights on a clock, with an end-of-night summary
- Then: Throw a Party events; a bouncer at the door
