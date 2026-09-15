"""
Regenerate tests/fixtures from the Python generator of the current-density project.

    MOLGEN_SRC=/path/to/current-density/src python scripts/gen-fixtures.py

For every molecule in SPECS this writes <name>.principal.xyz and <name>.none.xyz
(the two orientation modes) and records the cells in manifest.json. The
TypeScript core must reproduce these files; see tests/fixtures.test.ts.

These are ideal-lattice geometries produced by molgen, not DFT data.
"""
import json
import os
import sys

MOLGEN_SRC = os.environ.get("MOLGEN_SRC", os.path.join("..", "..", "current-density", "src"))
sys.path.insert(0, os.path.abspath(MOLGEN_SRC))

from molgen import generate  # noqa: E402
from molgen import xyz  # noqa: E402

SPECS = {
    "benzene": {"preset": "benzene"},
    "naphthalene": {"preset": "naphthalene"},
    "anthracene": {"preset": "anthracene"},
    "tetracene": {"preset": "tetracene"},
    "phenanthrene": {"preset": "phenanthrene"},
    "chrysene": {"preset": "train_7"},
    "tetraphene": {"preset": "train_8"},
    "pyrene": {"preset": "pyrene"},
    "triphenylene": {"preset": "triphenylene"},
    "perylene": {"preset": "perylene"},
    "coronene": {"preset": "coronene"},
    "hbc": {"preset": "hbc"},
    "dataset-10": {"preset": "train_10"},
    "dataset-12": {"preset": "train_12"},
    "hex_flake_2": {"family": "hex_flake", "radius": 2},
    "rect_flake_3x4": {"family": "rect_flake", "rows": 3, "cols": 4},
    "zigzag_5": {"family": "zigzag", "n": 5},
    "custom_L": {"cells": [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]},
}

out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tests", "fixtures")
os.makedirs(out_dir, exist_ok=True)
manifest = {}
for name, spec in SPECS.items():
    entry = {}
    for orient in ("principal", "none"):
        molecule, warnings = generate(spec, orient=orient)
        path = os.path.join(out_dir, f"{name}.{orient}.xyz")
        with open(path, "w", newline="\n") as f:
            f.write(xyz.to_string(molecule))
        entry["cells"] = [list(c) for c in molecule.cells]
        entry["formula"] = molecule.formula
    manifest[name] = entry
    print(f"{name:16s} {entry['formula']:10s} {len(entry['cells'])} rings")

with open(os.path.join(out_dir, "manifest.json"), "w", newline="\n") as f:
    json.dump(manifest, f, indent=2)
    f.write("\n")
