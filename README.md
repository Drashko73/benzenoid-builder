# Benzenoid Builder

An interactive honeycomb editor for designing **benzenoid molecules** — fused hexagonal
rings of carbon with hydrogens on the perimeter (benzene, naphthalene, pyrene, coronene,
graphene flakes, …) — and exporting them as standard **`.xyz`** files with ideal
lattice geometry.

Click hexagons on a honeycomb grid; the carbon skeleton and the hydrogens appear as you
go, the formula and validation update live, and the exported file is ready for
ParaView, Avogadro, VMD, or a quantum-chemistry / machine-learning pipeline.

![The editor with perylene selected](docs/screenshots/editor-light.png)

It is aimed at anyone who needs polycyclic aromatic hydrocarbon geometries quickly —
for a calculation, a figure, a teaching example, or as input to a machine-learning
pipeline — without hand-editing coordinates.

## Features

- **Draw on a honeycomb.** Click to add or remove a ring, drag to paint, scroll to zoom,
  right-drag to pan. Every hexagon corner is a carbon; perimeter carbons get a hydrogen
  automatically.
- **Live structure.** Ball-and-stick overlay on the grid, formula (C₂₄H₁₂), ring / atom
  counts, dimensions in Å, and a preview of the molecule exactly as it will be written.
- **Chemistry-aware validation** with one-click fixes:
  - the rings must form one edge-connected molecule (corner contact is not a bond);
  - an empty hexagon whose six corners are already carbons is a ring whether you
    selected it or not (six rings around a hole are coronene) — _Fill_ adds it;
  - overlapping hydrogens in fjord regions ([4]helicene and the like), where a planar
    model is physically wrong;
  - a sanity cap of 1 000 atoms (the largest benzenoid ever synthesised has 264).
- **Presets and families.** Sixteen named molecules from benzene to hexabenzocoronene
  and 43-ring graphene flakes; parametric acenes, zigzag chains, hexagonal and rectangular
  flakes.
- **Export.** `.xyz` download or copy, ring coordinates as JSON, SVG / PNG image of the
  structure, and a share link that reproduces the whole state (rings are stored as row
  ranges, so even a 5 000-ring flake fits in ~1 500 characters; a selection that would
  need more than 8 000 characters is kept out of the URL and shared as cells JSON instead).
- **Parameters.** C–C and C–H bond lengths, orientation convention, file name, comment
  line, atomic numbers or element symbols.
- Undo / redo, keyboard shortcuts, light and dark themes. No server, no account: it is a
  static page.

![Validation: an enclosed ring is flagged with a Fill button](docs/screenshots/validation.png)

## Running it

The app is a static site. To run it locally:

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run build` writes a deployable copy to `dist/`. The repository ships a GitHub
Actions workflow that publishes `dist/` to GitHub Pages on every push to `main`
(enable _Settings → Pages → Source: GitHub Actions_ once).

## How the geometry is built

Benzenoids are [polyhexes](<https://en.wikipedia.org/wiki/Polyhex_(mathematics)>): sets of
hexagons on a triangular lattice. The builder works in **integer lattice coordinates**
and converts to Ångström once at the end, so there are no floating-point tolerances
and no geometry optimisation.

A ring is an axial cell `(q, r)` with centre `(√3·d·(q + r/2), 1.5·d·r)` and pointy-top
orientation. Its six carbons sit on integer honeycomb sites

```
X = 2q + r + a_k,   Y = 3r + b_k,   (a_k, b_k) = (0,2) (−1,1) (−1,−1) (0,−2) (1,−1) (1,1)
```

at Cartesian position `(√3·d·X/2, d·Y/2)`. A carbon with only two carbon neighbours
carries one hydrogen along its third, missing, lattice direction — the exterior angle
bisector, without any trigonometry.

| Convention  | Value                                                                                                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| d(C–C)      | **1.42 Å** (adjustable) — fitted to DFT-optimised geometries of 18 benzenoids from benzene to C114H30; every atom lands within 0.17 Å of the ideal lattice (RMSD ≤ 0.075 Å per molecule), so no geometry optimisation is needed |
| d(C–H)      | **1.09 Å** (adjustable)                                                                                                                                                                                                    |
| Frame       | all-atom centroid at the origin, molecule in the **z = 0** plane                                                                                                                                                           |
| Orientation | _long axis along x_ (default): principal axes of the carbon skeleton, heavier end (third moment) towards +x; round molecules (benzene, coronene, triphenylene, HBC) keep the lattice orientation. _As drawn_: only centred |
| Atom order  | carbons first, sorted by lattice site (X, then Y); then hydrogens in the order of their parent carbons                                                                                                                     |

### The `.xyz` file

```
    12

     6             -1.229756    0.710000    0.000000
     6             -1.229756   -0.710000    0.000000
     ...
     1             -2.173735    1.255000    0.000000
```

Line 1 is the atom count, line 2 the comment (blank by default), then one atom per line
as **atomic number** and x, y, z in Å in fixed-width columns (`%6d%22.6f%12.6f%12.6f`).
Readers split on whitespace, so the widths are cosmetic. Atomic numbers are the default
because many computational pipelines expect them; viewers that only accept element
symbols (`C`, `H`) are served by the _Write element symbols_ switch under Parameters.

### Ring coordinates

Internally a molecule is just a list of rings in axial coordinates. _Copy cells JSON_
gives you that list,

```json
{"cells": [[0,0],[1,0],[1,1]]}
```

which is handy for scripts and for describing a molecule in a few bytes; _Import cells_
accepts the same text (or a bare `[[q,r],…]` list, or `q,r q,r …`). Share links use the
same coordinates in a compact row-range form.

## Keyboard shortcuts

| Keys                                            | Action                                             |
| ----------------------------------------------- | -------------------------------------------------- |
| `Ctrl`+`Z` / `Ctrl`+`Shift`+`Z` (or `Ctrl`+`Y`) | undo / redo                                        |
| `Ctrl`+`S`                                      | download the `.xyz` file                           |
| `F` / `0`                                       | fit the view to the molecule / reset the view      |
| `G` `H` `L` `R`                                 | toggle grid, hydrogens, atom numbers, ring numbers |
| `Space` + drag                                  | pan                                                |
| Touch                                           | tap = add/remove, drag = move, pinch = zoom; the on-canvas **Paint** switch makes drags paint rings instead |
| `Shift` + drag                                  | erase rings                                        |
| `?`                                             | help                                               |

## Project layout

```
src/core/     chemistry engine, no DOM: lattice geometry, orientation, validation,
              presets and families, .xyz writer, share-link codec
src/ui/       React application: honeycomb canvas, sidebar panels, export preview
tests/        Vitest suites; tests/fixtures/*.xyz are reference files the core must reproduce
scripts/      gen-fixtures.py (regenerate fixtures), screenshots.mjs (README images), favicon.mjs
```

`src/core` is usable outside the app:

```ts
import { buildMolecule, hexFlake, toXyz, validateCells } from './src/core';

const cells = hexFlake(1); // coronene
console.log(validateCells(cells).ok); // true
console.log(toXyz(buildMolecule(cells))); // the .xyz text
```

## Development

```bash
npm run dev          # Vite dev server with hot reload
npm test             # Vitest (core + UI smoke tests)
npm run typecheck    # tsc
npm run lint         # ESLint
npm run format       # Prettier
npm run build        # production build in dist/
```

The `.xyz` files in `tests/fixtures/` were produced by an independent Python
implementation of the same lattice construction; the TypeScript core must reproduce
them byte for byte, which pins the geometry and the file format. `scripts/gen-fixtures.py`
regenerates them given that implementation (`MOLGEN_SRC=/path/to/its/src`).

## Extending to other atoms

The core already carries an element registry (`src/core/elements.ts`: H, C, N, O, F, S,
Cl, B with atomic numbers, colours and typical bond lengths to carbon) and a per-site
terminal-atom map in `BuildParams.terminal`, so a perimeter hydrogen can be replaced by
another single atom without touching the writer or the renderer. The UI does not expose
this yet; wiring a picker to `terminal` is the intended path.

## Roadmap

- `.xyz` import with ring detection (recognise the hexagons in an existing file)
- substituent picker for perimeter sites (see above)
- multi-atom substituents (OH, CH₃) with their own geometry
- non-planar structures (helicenes) are out of scope by design

## Citing

If this tool is useful in your work, please cite it — see [`CITATION.cff`](CITATION.cff).

## License

[MIT](LICENSE).
