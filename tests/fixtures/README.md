# Fixtures

Every `<name>.<orient>.xyz` file here was written by the Python generator of the
[current-density](https://github.com/imilos/current-density) project (`src/molgen`)
with its default bond lengths, for the cells listed in `manifest.json`. They are
ideal-lattice geometries, not DFT data.

`tests/fixtures.test.ts` requires the TypeScript core to reproduce them: byte for byte
for `orient = none`, and up to a 180° rotation for `orient = principal` (numpy's `eigh`
does not fix the eigenvector sign for molecules with zero skew).

Regenerate with:

```bash
MOLGEN_SRC=/path/to/current-density/src python scripts/gen-fixtures.py
```
