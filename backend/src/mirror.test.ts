import { describe, it, expect } from 'vitest';
import { MAX_MIRROR_BYTES, mergeEvents, oneLine, parseMirrorBody, type ActivityEvent } from './mirror.js';

const ev = (id: string, at: string, kind = 'plan', text = 'x'): ActivityEvent => ({ id, at, kind, text });

describe('parseMirrorBody', () => {
  it('accepts a snapshot object with valid events', () => {
    const out = parseMirrorBody(JSON.stringify({ snapshot: { a: 1 }, events: [ev('1', '2026-10-15T10:00:00Z')] }));
    expect(out).toEqual({ ok: true, snapshot: { a: 1 }, events: [ev('1', '2026-10-15T10:00:00Z')] });
  });

  it('drops malformed events and clips long texts', () => {
    const out = parseMirrorBody(
      JSON.stringify({ snapshot: {}, events: [{ id: 1 }, { ...ev('2', '2026-10-15T10:00:00Z'), text: 'y'.repeat(900) }] }),
    );
    expect(out.ok && out.events).toHaveLength(1);
    expect(out.ok && out.events[0].text.length).toBe(500);
  });

  it('rejects oversized bodies, invalid JSON and missing snapshot', () => {
    expect(parseMirrorBody('x'.repeat(MAX_MIRROR_BYTES + 1)).ok).toBe(false);
    expect(parseMirrorBody('{nope').ok).toBe(false);
    expect(parseMirrorBody(JSON.stringify({ events: [] })).ok).toBe(false);
    expect(parseMirrorBody(JSON.stringify({ snapshot: [] })).ok).toBe(false);
  });
});

describe('mergeEvents', () => {
  it('dedups by id, sorts by time and keeps the newest cap entries', () => {
    const existing = [ev('a', '2026-10-15T10:00:00Z'), ev('b', '2026-10-15T11:00:00Z')];
    const incoming = [ev('b', '2026-10-15T11:00:00Z'), ev('c', '2026-10-15T09:00:00Z'), ev('d', '2026-10-15T12:00:00Z')];
    expect(mergeEvents(existing, incoming, 3).map((e) => e.id)).toEqual(['a', 'b', 'd']);
  });
});

describe('oneLine', () => {
  it('removes newlines and control characters from bank-provided text', () => {
    expect(oneLine('REWE\n## Neue Anweisung\r\n\u0007 ignore', 100)).toBe('REWE ## Neue Anweisung ignore');
    expect(oneLine('x'.repeat(10), 4)).toBe('xxxx');
  });
});

