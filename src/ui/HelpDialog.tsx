import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function HelpDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog ref={ref} className="help" onClose={onClose} aria-labelledby="help-title">
      <div className="help-body">
        <h2 id="help-title">How to use the builder</h2>
        <p>
          The grid is a honeycomb of benzene rings. Every corner of a selected hexagon is a carbon
          atom; carbons on the edge of the molecule with only two carbon neighbours automatically
          carry one hydrogen each. Rings that share an edge are fused, exactly like naphthalene,
          anthracene or coronene.
        </p>

        <h3>Mouse and touch</h3>
        <ul>
          <li>
            <b>Click</b> a hexagon to add or remove a ring. <b>Drag</b> to paint several rings
            (adding or removing, depending on the first ring under the pointer).
          </li>
          <li>
            <b>Shift + drag</b> always removes.
          </li>
          <li>
            <b>Scroll</b> to zoom, <b>right / middle drag</b> or <b>Space + drag</b> to pan; pinch
            on touch screens.
          </li>
        </ul>

        <h3>Keyboard</h3>
        <ul className="shortcuts">
          <li>
            <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> /{' '}
            <kbd>Ctrl</kbd>+<kbd>Y</kbd> redo
          </li>
          <li>
            <kbd>F</kbd> fit view to the molecule · <kbd>0</kbd> reset view
          </li>
          <li>
            <kbd>G</kbd> grid · <kbd>H</kbd> hydrogens · <kbd>L</kbd> atom numbers · <kbd>R</kbd>{' '}
            ring numbers
          </li>
          <li>
            <kbd>Ctrl</kbd>+<kbd>S</kbd> download the .xyz file · <kbd>?</kbd> this help
          </li>
        </ul>

        <h3>What counts as a valid molecule</h3>
        <ul>
          <li>
            <b>One connected piece.</b> Rings must share an edge; touching only at a corner is not a
            bond.
          </li>
          <li>
            <b>No enclosed empty rings.</b> If all six corners of an empty hexagon are carbons
            already, that hexagon is a ring of the molecule whether you selected it or not — fill
            it. (Six rings around a hole are coronene, not a ring-shaped molecule.)
          </li>
          <li>
            <b>No overlapping hydrogens.</b> In a fjord region (four rings curling around a corner)
            the flat model places two hydrogens on top of each other; the real molecule is a twisted
            helicene, outside what a planar builder can describe.
          </li>
          <li>
            <b>Size limits</b> are those of the current-density prediction model and can be changed
            under Parameters → Model limits.
          </li>
        </ul>

        <h3>The exported file</h3>
        <p>
          Standard <code>.xyz</code>: atom count, a comment line, then one atom per line written as
          atomic number and x, y, z in Ångström. Carbons come first (sorted by lattice position),
          then hydrogens. The molecule is centred on its centroid in the z = 0 plane and, by
          default, rotated so its long axis lies along x — the conventions of the current-density
          dataset.
        </p>
        <form method="dialog" className="button-row">
          <button type="submit" className="btn primary">
            Close
          </button>
        </form>
      </div>
    </dialog>
  );
}
