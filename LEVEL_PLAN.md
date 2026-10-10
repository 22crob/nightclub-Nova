# Club Nova: level plan (agreed by the owner; applied to the game in October 2026)

**The idea:** start plain, earn the cool stuff. Each level gives a small mix of unlocks from different categories (usually two items) instead of something from every category. Simple looks come first; animations, themes and showpieces come later, so there's always an upgrade to plan and save for. There's no level cap: items run out to level 61 (the owner's rule: no cap, a new thing every level or so).

**The October 2026 review.** The owner went through every item on a review page and cut 33 that didn't fit a nightclub vibe ("design off this vibe"): the Starter, Brewery, Retro Diner, Garden, Surf Shack, Tiki and Candy bars; the Crate and Theatre DJ booths; sixteen booths and sofas (Beer Hall Bench, Cruiser Car Seat, Art Deco Sofa, Tiki Hut, Bathtub Sofa, Kiss Sofa, Fire Pit Sectional, Peacock Love Seat, Glow Lounge, Garden Gazebo, Igloo, Donut Lounge, Birdcage, Giant Clam, Cloud Nine Bed, Disco Stage); the Theatre Red wallpaper; and the Beer Crates, Oak Barrel, Palm Tree, Street Lamp, Gargoyle, Cat Statue and Rock Star Statue. They're in `REMOVED_ITEMS` (catalog.js): a save that has one, placed, stored or on a wall, gets its full price back. New clubs start with a Wood Bar instead of the Starter Bar. Bring any new item to the owner first, and design it to the nightclub vibe.

**The ladder.** The 127 kept items were laid out by the owner's approved plan: level 1 is the starter set, then about two items a level from different categories, each category climbing from plain to fancy, out to the Arch Aquarium alone at 61. Celebrities, drinks, parties and extra staff stay where they were (1-40).

**Levelling** was sped up at the owner's request ("don't make the jump so big, we don't want them to get bored or feel stuck"): `LEVEL_FANS` is 200 + 180 x (L-1) + 6 x (L-1)^2 XP per level (was 200 + 220k + 30k^2). By the balance sim: level 10 in about 1h40, 20 in about 5 hours, 30 in about 10, 40 in about 19, 61 in about 47. Saves keep their XP, so players move up a few levels on load.

**Your current club keeps everything it has.** Things already placed or in storage stay yours, even if they now unlock later.

**Nightclub batch (October 2026):** after the review I made new bars and booths in the club style the owner kept. The bars went in between the kept ones (Chrome 10, Velvet 18, Ultraviolet 26, Pink Neon 35, Champagne 44).

## Level by level

| Level | Unlocks |
|---|---|
| 1 | Bar: Wood Bar; DJ booth: Wood Booth; Floor: Concrete; Dance floor: Basic Floor; Seat/booth: Wood Stool; Seat/booth: Standing Table; Decoration: Potted Fern; Wallpaper: Paint; Drink: Beer; Party: House Party |
| 2 | Decoration: Wood Speaker; Wallpaper: Old Brick |
| 3 | DJ booth: Pro Booth; Dance floor: Plain Floor; Drink: Cocktail |
| 4 | Seat/booth: Fabric Couch; Decoration: Velvet Rope |
| 5 | Floor: Plain Tile; Decoration: Disco Ball; Party: Hip Hop Night; Bartender: +1 |
| 6 | Bar: Pub Bar; Wallpaper: Cinder Block; Drink: Shots |
| 7 | DJ booth: Brick Booth; Decoration: Lava Lamp |
| 8 | Dance floor: Checker Floor; Decoration: Speaker Tower; Celebrity: Rico Diamond; Bouncer: +1 |
| 9 | Seat/booth: Candle Table; Wallpaper: Brick |
| 10 | Bar: Chrome Bar; DJ booth: Club Booth; Decoration: Globe Lamp; Drink: Mojito; Bartender: +1 |
| 11 | Floor: Stone Tiles; Decoration: Neon Sign |
| 12 | Dance floor: Soft Glow; Wallpaper: Stripes; Party: Neon Night |
| 13 | Seat/booth: Chrome Bar Stool; Decoration: Crystal Column; Celebrity: Max Volt |
| 14 | Bar: Speakeasy Bar; Decoration: Glow Tube |
| 15 | DJ booth: Neon Booth; Wallpaper: Subway Tile |
| 16 | Dance floor: Wood Floor; Decoration: Glow Plinth; Drink: Martini; Bartender: +1 |
| 17 | Decoration: Pool Table; Wallpaper: Wood Panel |
| 18 | Bar: Velvet Bar; Floor: Wood Planks; Seat/booth: Chesterfield; Celebrity: DJ Kai Blaze; Bouncer: +1 |
| 19 | DJ booth: Truss Booth; Decoration: Pink Globe Lamp |
| 20 | Decoration: Speaker Stack; Wallpaper: Wood Planks; Party: VIP Gala |
| 21 | Dance floor: Blue Pulse; Decoration: Spotlight |
| 22 | Bar: Neon Bar; Seat/booth: Leather Couch |
| 23 | Decoration: Pink Crystal Column; Wallpaper: Retro Dots; Bartender: +1 |
| 24 | DJ booth: LED Screen Booth; Decoration: Glass Screen; Celebrity: Leo Lux; Drink: Champagne |
| 25 | Floor: Red Carpet; Dance floor: Pink Pulse |
| 26 | Bar: Ultraviolet Bar; Decoration: Aquarium; Wallpaper: Velvet; Party: Glow Party |
| 27 | DJ booth: Ice Booth; Seat/booth: Red Velvet Booth |
| 28 | Decoration: Purple Liquid Tank; Wallpaper: Neon Strip |
| 29 | Dance floor: Two-Tone Blink; Decoration: Neon Speaker |
| 30 | Bar: Ice Bar; Decoration: Purple Speaker Stack; Celebrity: Tony Fame; Bartender: +1; Bouncer: +1 |
| 31 | DJ booth: Art Deco Booth; Floor: Purple Carpet |
| 32 | Seat/booth: Wood Lounge; Wallpaper: Speaker Wall |
| 33 | Dance floor: Glow Floor; Decoration: Retro Robot; Party: Masquerade Ball |
| 34 | Decoration: Gold Trophy; Wallpaper: Equalizer; Drink: Nova Neon |
| 35 | Bar: Pink Neon Bar; DJ booth: Holo Booth; Decoration: Glass Waterfall |
| 36 | Seat/booth: Black Leather Booth; Decoration: Blue Liquid Tank |
| 37 | Dance floor: Light-Up Floor; Wallpaper: Black Arches; Celebrity: Jett Starr |
| 38 | Floor: Marble; Decoration: Lucky Cat |
| 39 | DJ booth: Steel Rack Booth; Decoration: Pagoda Statue; Party: Neon Rave |
| 40 | Bar: Disco Bar; Wallpaper: Mirror Tiles |
| 41 | Seat/booth: Tulip Lounge; Decoration: Bottle Cabinet |
| 42 | Dance floor: Neon Rings; Decoration: Truss Spotlights |
| 43 | DJ booth: Glow Panel Booth; Wallpaper: Bottle Shelf |
| 44 | Bar: Champagne Bar; Floor: Black Gloss; Decoration: Glass Divider |
| 45 | Seat/booth: LED Cube Bench; Decoration: Bubble Column |
| 46 | Dance floor: Color Wave; Wallpaper: Neon Chevron |
| 47 | DJ booth: Faceted Booth; Decoration: Ribbon Sculpture |
| 48 | Bar: Marble Lounge Bar; Wallpaper: Purple Glow |
| 49 | Seat/booth: Gold VIP Booth; Decoration: Tube Aquarium |
| 50 | Dance floor: Rainbow Flow; Decoration: Pop Star Statue |
| 51 | DJ booth: Curve Booth; Floor: Gold Marble |
| 52 | Decoration: Glow Cubes; Wallpaper: LED Wall |
| 53 | Decoration: Cabinet Aquarium; Wallpaper: Ice Panels |
| 54 | Seat/booth: Galaxy Egg Pods; Decoration: Rapper Statue |
| 55 | DJ booth: Capsule Booth; Dance floor: Step Floor |
| 56 | Bar: Cyber Bar; Decoration: Hex Aquarium |
| 57 | Decoration: Long Aquarium; Wallpaper: LED Lights |
| 58 | Floor: Starry Glass; Seat/booth: Gem Lounge |
| 59 | Dance floor: Galaxy Swirl; Decoration: Jellyfish Tank |
| 60 | DJ booth: Glass Booth; Wallpaper: Holo Wall |
| 61 | Decoration: Arch Aquarium |

**Walls (expansion limits)** grow to 26 tiles by level 40 (`EXPANSION.limits` in catalog.js). Bigger clubs already built keep their size.
