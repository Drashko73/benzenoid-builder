# Fixtures

Every `<name>.<orient>.xyz` file here was written by an independent Python
implementation of the same integer-lattice construction (default bond lengths,
cells listed in `manifest.json`). They are ideal-lattice geometries, not DFT data.

`tests/fixtures.test.ts` requires the TypeScript core to reproduce them: byte for byte
for `orient = none`, and up to a 180° rotation for `orient = principal` (a symmetric
eigenvalue solver does not fix the eigenvector sign for molecules with zero skew).

Regenerate with:

```bash
MOLGEN_SRC=/path/to/reference/src python scripts/gen-fixtures.py
```
