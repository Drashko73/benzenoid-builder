import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_SHARE_HASH_LENGTH, hexFlake } from '../src/core';
import { useBuilder } from '../src/ui/state/useBuilder';

describe('useBuilder URL sync', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('writes a compact hash for a dense flake', () => {
    const { result } = renderHook(() => useBuilder());
    act(() => result.current.dispatch({ type: 'set', cells: hexFlake(20) })); // 1261 rings
    expect(result.current.shareable).toBe(true);
    expect(window.location.hash.length).toBeLessThan(600);
    expect(result.current.cells).toHaveLength(1261);
  });

  it('leaves the URL clean and marks the state unshareable when the hash would be too long', () => {
    // Sparse, far from the origin: ~7 characters per ring defeats the range encoding.
    const sparse = [] as [number, number][];
    for (let r = 0; r < 30; r++) for (let q = 0; q < 50; q++) sparse.push([10000 + 2 * q, r]);
    const { result } = renderHook(() => useBuilder());
    act(() => result.current.dispatch({ type: 'set', cells: sparse }));
    expect(result.current.shareHashLength).toBeGreaterThan(MAX_SHARE_HASH_LENGTH);
    expect(result.current.shareable).toBe(false);
    expect(window.location.hash).toBe('');
    // Shrinking the selection makes it shareable again.
    act(() => result.current.dispatch({ type: 'set', cells: hexFlake(1) }));
    expect(result.current.shareable).toBe(true);
    expect(window.location.hash).toBe('#c=-1:0..1;0:-1..1;1:-1..0');
  });
});
