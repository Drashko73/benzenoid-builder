import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/ui/App';

function svg(): SVGSVGElement {
  return document.querySelector('svg.honeycomb') as SVGSVGElement;
}

/** In jsdom the SVG has no size, so every pointer position maps to cell (0, 0). */
function clickOrigin() {
  fireEvent.pointerDown(svg(), { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerUp(svg(), { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
}

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });
  afterEach(cleanup);

  it('starts empty and explains what to do', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Benzenoid Builder' })).toBeInTheDocument();
    expect(screen.getByText('No rings selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download \.xyz/i })).toBeDisabled();
  });

  it('adds benzene when a cell is clicked and exposes the .xyz text', () => {
    render(<App />);
    clickOrigin();
    expect(screen.getByTitle('C6H6')).toHaveTextContent('C₆H₆');
    const pre = screen.getByLabelText('.xyz preview');
    expect(pre.textContent!.startsWith('    12\n  \n     6')).toBe(true);
    expect(screen.getByRole('button', { name: /download \.xyz/i })).toBeEnabled();
    expect(window.location.hash).toBe('#c=0:0');
  });

  it('toggles the cell off again and supports undo', () => {
    render(<App />);
    clickOrigin();
    clickOrigin();
    expect(screen.getByText('No rings selected')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Undo (Ctrl+Z)'));
    expect(screen.getByTitle('C6H6')).toBeInTheDocument();
  });

  it('loads a preset', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Named molecule'), { target: { value: 'coronene' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Load' })[0]);
    expect(screen.getByTitle('C24H12')).toBeInTheDocument();
    expect(screen.getByText(/single connected benzenoid/i)).toBeInTheDocument();
  });

  it('restores a molecule from the URL hash', () => {
    window.history.replaceState(null, '', '/#c=0,0;1,0&o=none&n=naph');
    render(<App />);
    expect(screen.getByTitle('C10H8')).toBeInTheDocument();
    expect(screen.getByLabelText('File name')).toHaveValue('naph');
    expect(screen.getByLabelText('as drawn')).toBeChecked();
  });

  it('reports an enclosed ring and fixes it on request', () => {
    window.history.replaceState(null, '', '/#c=1,0;0,1;-1,1;-1,0;0,-1;1,-1');
    render(<App />);
    expect(screen.getByText('1 enclosed ring not selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fill enclosed rings' }));
    expect(screen.getByTitle('C24H12')).toBeInTheDocument();
  });
});
