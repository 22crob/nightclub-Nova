# Club Nova: level plan (agreed by the owner; applied to the game in October 2026)

**The idea:** start plain, earn the cool stuff. Each level gives a small mix of unlocks from different categories (usually two items) instead of something from every category. Simple looks come first; animations, themes and showpieces come later, so there's always an upgrade to plan and save for. There's no level cap: items run out to level 61 (the owner's rule: no cap, a new thing every level or so).

**The October 2026 review.** The owner went through every item on a review page and cut 33 that didn't fit a nightclub vibe ("design off this vibe"): the Starter, Brewery, Retro Diner, Garden, Surf Shack, Tiki and Candy bars; the Crate and Theatre DJ booths; sixteen booths and sofas (Beer Hall Bench, Cruiser Car Seat, Art Deco Sofa, Tiki Hut, Bathtub Sofa, Kiss Sofa, Fire Pit Sectional, Peacock Love Seat, Glow Lounge, Garden Gazebo, Igloo, Donut Lounge, Birdcage, Giant Clam, Cloud Nine Bed, Disco Stage); the Theatre Red wallpaper; and the Beer Crates, Oak Barrel, Palm Tree, Street Lamp, Gargoyle, Cat Statue and Rock Star Statue. They're in `REMOVED_ITEMS` (catalog.js): a save that has one, placed, stored or on a wall, gets its full price back. New clubs start with a Wood Bar instead of the Starter Bar. Bring any new item to the owner first, and design it to the nightclub vibe.

**The ladder.** The 127 kept items were laid out by the owner's approved plan: level 1 is the starter set, then about two items a level from different categories, each category climbing from plain to fancy, out to the Arch Aquarium alone at 61. Celebrities, drinks, parties and extra staff stay where they were (1-40).

**Levelling** was sped up at the owner's request ("don't make the jump so big, we don't want them to get bored or feel stuck"): `LEVEL_FANS` is 200 + 180 x (L-1) + 6 x (L-1)^2 XP per level (was 200 + 220k + 30k^2). By the balance sim: level 10 in about 1h40, 20 in about 5 hours, 30 in about 10, 40 in about 19, 61 in about 47. Saves keep their XP, so players move up a few levels on load.

**Your current club keeps everything it has.** Things already placed or in storage stay yours, even if they now unlock later.

**Nightclub batch (October 2026):** after the review I made new bars and booths in the club style the owner kept. The bars went in between the kept ones (Chrome 10, Velvet 18, Ultraviolet 26, Pink Neon 35, Champagne 44), and the booths too (Bean Bags 7, Stripe Booth 16, Bottle Service 30, Onyx Horseshoe 39, Neon Ring Booth 47, Crystal VIP Booth 52).

**October 2026 feedback, round 3:** the Stripe Booth Corner (16, with the Stripe Booth) makes an L of two straight sections; a Black Lux Bottle Shelf for the wall at 50; wall decorations hang low, middle or high, and are drawn bigger.

**October 2026 feedback, round 2:** wall decorations became 3D and moved to Decorations (plus Vine Wall 22 and the Floating Bottle Shelf 41, which replaced the Bottle Cabinet); new Black Stool 2, Black Table 3, Snake Plant 6, Glow High-Top 7, Club Chair 9, Monstera 11, Glass Table 15, Black Bamboo 17, Velvet Tub Chair 20, Black Pool Table 30; Red Gloss moved to 14, Red Pulse to 13; Leopard Print became Cheetah Print (41).

**October 2026 feedback:** wall decorations (Hanging Fern 4, Pendant Lights 8, Cyan LED Pole 13, Neon Heart 19, Pink LED Pole 24, Wall Speaker 28, Fairy Lights 33), Red Pulse dance floor 23, Red Gloss floor 34, Leopard Print floor 41. Walls grow to 20 tiles at most (by level 40).

**The unlock review (October 2026):** the owner moved 65 things on the Unlock Ladder page (every item with its picture and price): lots of seats, aquariums and lit dance floors come earlier, and parties start later (House Party 5, Hip Hop Night 10, Neon Night 17, VIP Gala 23, Foam Party 27), so a new club's guide just mentions parties for later. Prices follow the new levels by themselves (`itemPrice()`). Moved: Aquarium 26→25, Arch Aquarium 61→56, Black Leather Booth 36→27, Black Table 3→6, Blue Pulse 21→12, Bottle Service 30→18, Floating Bottle Shelf 41→32, Brick Booth 7→6, Bubble Column 45→38, Cabinet Aquarium 53→27, Club Chair 9→8, Checker Floor 8→5, Art Deco Booth 31→28, Fairy Lights 33→25, Marble 38→37, Purple Carpet 31→29, Starry Glass 58→57, Stone Tiles 11→10, Galaxy Swirl 59→58, Galaxy Egg Pods 54→53, Gem Lounge 58→57, Glass Booth 60→58, Glass Divider 44→41, Hex Aquarium 56→45, Glow High-Top 7→4, Ice Booth 27→26, Jellyfish Tank 59→54, Pink LED Pole 24→23, Purple LED Pole 30→29, Long Aquarium 57→49, Light-Up Floor 37→32, Neon Speaker 29→27, Onyx Horseshoe 39→37, Black Pool Table 30→26, Pool Table 17→12, Red Pulse 13→8, Neon Ring Booth 47→42, Retro Robot 33→31, Soft Glow 12→9, Speaker Stack 20→19, Stripe Booth 16→15, Stripe Booth Corner 16→15, Candle Table 9→3, Truss Spotlights 42→30, Tube Aquarium 49→33, Tulip Lounge 41→9, Two-Tone Blink 29→21, Red Velvet Booth 27→24, Wall Speaker 28→21, Glass Waterfall 35→32, Color Wave 46→34, Wood Lounge 32→20, Black Arches 37→36, Cinder Block 6→2, Equalizer 34→29, Holo Wall 60→58, LED Lights 57→51, Old Brick 2→4, Wood Planks 20→18, Speaker Wall 32→31.

**The future batch (October 2026):** holograms and future pieces the owner asked for: Plasma Orb 20, Holo Logo 23, Holo Globe 27, Cyber Pillar 30, Holo Screen 34 (wall), Gyro Rings 38, Hologram Dancer 45, Laser Gate 50.

**New floors from the reference clubs (October 2026, the owner's ask):** Pin Dot 7, Swirl dance floor 11, Diamond Plate 12, Purple Haze 19, Blue Slate 22, Deco Rings 23, Theatre Glow 27, Deco Fans 31, Bubble Lights 38, Ice Star 46, Silver Stars 47.

**The second future batch (October 2026):** Hover Sofa 33, Circuit Board floor 36, Hex Grid dance floor 40, Data Stream wallpaper 44, Cyber Booth 46, Hover Deck DJ booth 49, Orbit Bar 52.

## Level by level

| Level | Unlocks |
|---|---|
| 1 | Bar: Wood Bar; DJ booth: Wood Booth; Seat/booth: Wood Stool; Seat/booth: Standing Table; Floor: Concrete; Dance floor: Basic Floor; Decoration: Potted Fern; Wallpaper: Paint; Drink: Beer |
| 2 | Seat/booth: Black Stool; Decoration: Wood Speaker; Wallpaper: Cinder Block |
| 3 | DJ booth: Pro Booth; Seat/booth: Candle Table; Dance floor: Plain Floor; Drink: Cocktail |
| 4 | Seat/booth: Fabric Couch; Seat/booth: Glow High-Top; Decoration: Velvet Rope; Wall decor: Hanging Fern; Wallpaper: Old Brick |
| 5 | Floor: Plain Tile; Dance floor: Checker Floor; Decoration: Disco Ball; Party: House Party; Bartender: +1 |
| 6 | Bar: Pub Bar; DJ booth: Brick Booth; Seat/booth: Black Table; Decoration: Snake Plant; Drink: Shots |
| 7 | Seat/booth: Bean Bags; Decoration: Lava Lamp; Floor: Pin Dot |
| 8 | Seat/booth: Club Chair; Dance floor: Red Pulse; Decoration: Speaker Tower; Wall decor: Pendant Lights; Bouncer: +1; Celebrity: Rico Diamond |
| 9 | Seat/booth: Tulip Lounge; Dance floor: Soft Glow; Wallpaper: Brick |
| 10 | Bar: Chrome Bar; DJ booth: Club Booth; Floor: Stone Tiles; Decoration: Globe Lamp; Drink: Mojito; Party: Hip Hop Night; Bartender: +1 |
| 11 | Decoration: Neon Sign; Decoration: Monstera; Dance floor: Swirl |
| 12 | Dance floor: Blue Pulse; Decoration: Pool Table; Wallpaper: Stripes; Floor: Diamond Plate |
| 13 | Seat/booth: Chrome Bar Stool; Decoration: Crystal Column; Wall decor: Blue LED Pole; Celebrity: Max Volt |
| 14 | Bar: Speakeasy Bar; Floor: Red Gloss; Decoration: Glow Tube |
| 15 | DJ booth: Neon Booth; Seat/booth: Glass Table; Seat/booth: Stripe Booth; Wallpaper: Subway Tile |
| 16 | Dance floor: Wood Floor; Decoration: Glow Plinth; Drink: Martini; Bartender: +1 |
| 17 | Decoration: Black Bamboo; Wall decor: Red LED Pole; Wallpaper: Wood Panel; Party: Neon Night |
| 18 | Bar: Velvet Bar; Seat/booth: Chesterfield; Seat/booth: Bottle Service; Floor: Wood Planks; Wallpaper: Wood Planks; Bouncer: +1; Celebrity: DJ Kai Blaze |
| 19 | Decoration: Pink Globe Lamp; Wall decor: Neon Heart; Decoration: Speaker Stack; Dance floor: Purple Haze |
| 20 | Seat/booth: Velvet Tub Chair; Seat/booth: Wood Lounge |
| 21 | Dance floor: Two-Tone Blink; Decoration: Spotlight; Wall decor: Wall Speaker |
| 22 | Bar: Neon Bar; Seat/booth: Leather Couch; Wall decor: Vine Wall; Floor: Blue Slate |
| 23 | Decoration: Pink Crystal Column; Wall decor: Pink LED Pole; Wallpaper: Retro Dots; Party: VIP Gala; Bartender: +1; Dance floor: Deco Rings |
| 24 | DJ booth: LED Screen Booth; Seat/booth: Red Velvet Booth; Decoration: Glass Screen; Drink: Champagne; Celebrity: Leo Lux |
| 25 | Floor: Red Carpet; Dance floor: Pink Pulse; Decoration: Aquarium; Wall decor: Fairy Lights |
| 26 | Bar: Ultraviolet Bar; DJ booth: Ice Booth; Decoration: Black Pool Table; Wallpaper: Velvet |
| 27 | Seat/booth: Black Leather Booth; Decoration: Neon Speaker; Decoration: Cabinet Aquarium; Party: Foam Party; Dance floor: Theatre Glow |
| 28 | DJ booth: Art Deco Booth; Decoration: Purple Liquid Tank; Wallpaper: Neon Strip |
| 29 | Floor: Purple Carpet; Wall decor: Purple LED Pole; Wallpaper: Equalizer |
| 30 | Bar: Ice Bar; Decoration: Purple Speaker Stack; Decoration: Truss Spotlights; Bartender: +1; Bouncer: +1; Celebrity: Tony Fame |
| 31 | Decoration: Retro Robot; Wallpaper: Speaker Wall; Floor: Deco Fans |
| 32 | Dance floor: Light-Up Floor; Decoration: Glass Waterfall; Wall decor: Floating Bottle Shelf |
| 33 | Dance floor: Glow Floor; Decoration: Tube Aquarium; Party: Masquerade Ball |
| 34 | Dance floor: Color Wave; Decoration: Gold Trophy; Drink: Nova Neon |
| 35 | Bar: Pink Neon Bar; DJ booth: Holo Booth |
| 36 | Decoration: Blue Liquid Tank; Wallpaper: Black Arches |
| 37 | Seat/booth: Onyx Horseshoe; Floor: Marble; Celebrity: Jett Starr |
| 38 | Decoration: Lucky Cat; Decoration: Bubble Column; Dance floor: Bubble Lights |
| 39 | DJ booth: Steel Rack Booth; Decoration: Pagoda Statue; Party: Neon Rave |
| 40 | Bar: Disco Bar; Wallpaper: Mirror Tiles |
| 41 | Floor: Cheetah Print; Decoration: Glass Divider |
| 42 | Seat/booth: Neon Ring Booth; Dance floor: Neon Rings |
| 43 | DJ booth: Glow Panel Booth; Wallpaper: Bottle Shelf |
| 44 | Bar: Champagne Bar; Floor: Black Gloss |
| 45 | Seat/booth: LED Cube Bench; Decoration: Hex Aquarium |
| 46 | Wallpaper: Neon Chevron; Dance floor: Ice Star |
| 47 | DJ booth: Faceted Booth; Decoration: Ribbon Sculpture; Floor: Silver Stars |
| 48 | Bar: Marble Lounge Bar; Wallpaper: Purple Glow |
| 49 | Seat/booth: Gold VIP Booth; Decoration: Long Aquarium |
| 50 | Dance floor: Rainbow Flow; Decoration: Pop Star Statue; Wall decor: Black Lux Bottle Shelf |
| 51 | DJ booth: Curve Booth; Floor: Gold Marble; Wallpaper: LED Lights |
| 52 | Seat/booth: Crystal VIP Booth; Decoration: Glow Cubes; Wallpaper: LED Wall |
| 53 | Seat/booth: Galaxy Egg Pods; Wallpaper: Ice Panels |
| 54 | Decoration: Rapper Statue; Decoration: Jellyfish Tank |
| 55 | DJ booth: Capsule Booth; Dance floor: Step Floor |
| 56 | Bar: Cyber Bar; Decoration: Arch Aquarium |
| 57 | Seat/booth: Gem Lounge; Floor: Starry Glass |
| 58 | DJ booth: Glass Booth; Dance floor: Galaxy Swirl; Wallpaper: Holo Wall |

**Walls (expansion limits)** grow to 20 tiles by level 40, then a row every three levels to 26 at 58 (`EXPANSION.limits` in catalog.js). Bigger clubs already built keep their size.
