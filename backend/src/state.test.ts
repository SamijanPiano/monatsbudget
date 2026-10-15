import { describe, it, expect } from 'vitest';
import {
  MAX_STATE_BYTES,
  decidePut,
  isPairCodeValid,
  parseStatePut,
  readStoredState,
  splitIntoChunks,
} from './state.js';

const NOW = '2026-10-15T12:00:00Z';

describe('parseStatePut', () => {
  it('accepts a valid write', () => {
    expect(parseStatePut(JSON.stringify({ baseRevision: 0, deviceId: 'handy', doc: { a: 1 } }))).toEqual({
      ok: true,
      baseRevision: 0,
      deviceId: 'handy',
      doc: { a: 1 },
    });
  });

  it('rejects broken bodies', () => {
    expect(parseStatePut('x'.repeat(MAX_STATE_BYTES + 1)).ok).toBe(false);
    expect(parseStatePut('{').ok).toBe(false);
    expect(parseStatePut(JSON.stringify({ baseRevision: -1, deviceId: 'a', doc: {} })).ok).toBe(false);
    expect(parseStatePut(JSON.stringify({ baseRevision: 1.5, deviceId: 'a', doc: {} })).ok).toBe(false);
    expect(parseStatePut(JSON.stringify({ baseRevision: 0, doc: {} })).ok).toBe(false);
    expect(parseStatePut(JSON.stringify({ baseRevision: 0, deviceId: 'a', doc: [] })).ok).toBe(false);
  });
});

describe('decidePut', () => {
  const current = { revision: 4, updatedAt: NOW, deviceId: 'handy', doc: { x: 1 } };

  it('first write creates revision 1', () => {
    const d = decidePut(null, { baseRevision: 0, deviceId: 'handy', doc: {} }, NOW);
    expect(d).toEqual({ kind: 'write', next: { revision: 1, updatedAt: NOW, deviceId: 'handy', doc: {} } });
  });

  it('writes on the current revision and counts up', () => {
    const d = decidePut(current, { baseRevision: 4, deviceId: 'mac', doc: { y: 2 } }, NOW);
    expect(d.kind === 'write' && d.next.revision).toBe(5);
  });

  it('rejects a base that is ahead of the stored state, even when nothing is stored', () => {
    expect(decidePut(current, { baseRevision: 9, deviceId: 'mac', doc: {} }, NOW).kind).toBe('conflict');
    const d = decidePut(null, { baseRevision: 3, deviceId: 'mac', doc: {} }, NOW);
    expect(d.kind === 'conflict' && d.current.revision).toBe(0);
  });

  it('rejects a stale write with the current state', () => {
    expect(decidePut(current, { baseRevision: 3, deviceId: 'mac', doc: {} }, NOW)).toEqual({
      kind: 'conflict',
      current,
    });
  });
});

describe('readStoredState', () => {
  it('treats missing or broken values as empty', () => {
    expect(readStoredState(null)).toBeNull();
    expect(readStoredState('nope')).toBeNull();
    expect(readStoredState(JSON.stringify({ revision: 'x', doc: {} }))).toBeNull();
  });
});

describe('splitIntoChunks', () => {
  it('splits and joins back losslessly', () => {
    const json = JSON.stringify({ text: 'ä'.repeat(25) });
    const parts = splitIntoChunks(json, 10);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join('')).toBe(json);
    expect(splitIntoChunks('')).toEqual(['']);
  });
});

describe('isPairCodeValid', () => {
  it('only accepts unexpired codes', () => {
    expect(isPairCodeValid({ expiresAt: 2000 }, 1000)).toBe(true);
    expect(isPairCodeValid({ expiresAt: 1000 }, 1000)).toBe(false);
    expect(isPairCodeValid(undefined, 1000)).toBe(false);
  });
});
