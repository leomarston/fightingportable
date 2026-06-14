# Sprite assets

The engine renders **Ryu** from a sprite sheet at `assets/ryu.png` when one is
present, and silently falls back to the built-in procedural renderer if it is
missing. Every other fighter uses the procedural renderer.

## Files

| File | What it is |
|---|---|
| `ryu.png` | the sprite sheet the game loads for Ryu |
| `ryu_atlas.json` | the resolved frame grid + animation table (reference / external tools) |

`ryu.png` here is a **placeholder** baked from the in-engine renderer
(`npm run bake`). It exists so the sprite pipeline is live and verifiable out of
the box. Replace it with your own artwork to ship hand-drawn frames — the file
is the only thing the game reads.

## Using your own Ryu sheet

1. **Save your sheet as `assets/ryu.png`.** (PNG with transparency works best.)
2. **Pick / describe its layout in `js/atlas_ryu.js`.** Two profiles exist:
   - `baked` — a uniform grid (`CW × CH`, `COLS` columns). If your sheet is laid
     out as an even grid, set `CW/CH/COLS` to match and keep `ACTIVE = "baked"`.
   - `source` — a table layout like a labelled reference sheet (an ANIMATIONS
     grid, etc). Set `ACTIVE = "source"` and adjust the `T` (table origin / cell
     size) and the `tbl` map so each animation points at the right cell.
3. **Calibrate visually.** Launch the game and press **`O`** to open the atlas
   overlay: your sheet is drawn with the current cell rectangles overlaid in
   blue and labelled by animation. Nudge the grid constants in
   `js/atlas_ryu.js` until the boxes frame each pose, then reload.

The animation table (which fighter state plays which frames, and how fast) lives
in the `SPEC` / `tbl` structures in `js/atlas_ryu.js` — edit frame counts, fps
and looping there.

## Notes on the reference frames

Many reference sheets are **labelled spec sheets** — poses sit on dark panels
with text labels and are not uniformly spaced or background-free. For the
cleanest in-game result, export your frames as a transparent, evenly-spaced
grid (one pose per cell, feet near the bottom-centre of each cell). The
`source` profile + the `O` calibration overlay are there to help you map a
less-uniform sheet without code changes beyond a few coordinates.

## Re-baking the placeholder

```bash
npm install      # installs @napi-rs/canvas (dev only)
npm run bake     # regenerates assets/ryu.png + ryu_atlas.json from the engine
```
