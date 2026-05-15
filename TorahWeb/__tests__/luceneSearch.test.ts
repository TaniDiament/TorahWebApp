/**
 * Unit tests for the client-side Lucene BM25 search (schema v2).
 *
 * These tests hand-craft minimal v2 indexes in memory so the math is
 * checkable without spinning up the Java tool. The goal is to catch
 * scoring regressions (issue #6) and tokenizer regressions (issue #2,
 * #8) in the same suite.
 */
import { LuceneSearchIndex, LuceneIndexData } from '../src/services/luceneSearch';

/** Build a small v2 index for a single field "body" with no boost. */
function singleFieldIndex(opts: {
  docCount: number;
  avgLen: number;
  docLens: Record<string, number>;
  terms: Record<string, { df: number; postings: [string, number][] }>;
}): LuceneIndexData {
  const docLens: Record<string, number[]> = {};
  for (const [id, len] of Object.entries(opts.docLens)) docLens[id] = [len];
  const terms: LuceneIndexData['terms'] = {};
  for (const [t, td] of Object.entries(opts.terms)) {
    terms[t] = { df: [td.df], postings: [td.postings] };
  }
  return {
    schemaVersion: 2,
    analyzer: 'EnglishAnalyzer',
    scoring: { scorer: 'BM25', k1: 1.2, b: 0.75 },
    docCount: opts.docCount,
    fields: [{ name: 'body', boost: 1.0, avgLen: opts.avgLen }],
    docLens,
    terms,
  };
}

/** Build a small v2 index for two fields "meta" (boost 5) + "body" (boost 1). */
function twoFieldIndex(opts: {
  docCount: number;
  avgLenMeta: number;
  avgLenBody: number;
  docLens: Record<string, [number, number]>;
  terms: Record<string, {
    df: [number, number];
    metaPostings: [string, number][];
    bodyPostings: [string, number][];
  }>;
}): LuceneIndexData {
  const terms: LuceneIndexData['terms'] = {};
  for (const [t, td] of Object.entries(opts.terms)) {
    terms[t] = { df: td.df, postings: [td.metaPostings, td.bodyPostings] };
  }
  return {
    schemaVersion: 2,
    analyzer: 'EnglishAnalyzer',
    scoring: { scorer: 'BM25', k1: 1.2, b: 0.75 },
    docCount: opts.docCount,
    fields: [
      { name: 'meta', boost: 5.0, avgLen: opts.avgLenMeta },
      { name: 'body', boost: 1.0, avgLen: opts.avgLenBody },
    ],
    docLens: opts.docLens,
    terms,
  };
}

describe('LuceneSearchIndex.tokenize', () => {
  test("strips English possessive 's and drops single-char residue", () => {
    expect(LuceneSearchIndex.tokenize("Schachter's lecture")).toEqual([
      'schachter',
      'lectur',
    ]);
  });

  test('removes stop words', () => {
    expect(LuceneSearchIndex.tokenize('the lessons of the seder')).toEqual([
      'lesson',
      'seder',
    ]);
  });

  test('Porter-stems endings', () => {
    expect(LuceneSearchIndex.tokenize('lessons running')).toEqual([
      'lesson',
      'run',
    ]);
  });

  test('handles curly apostrophes as well as straight', () => {
    expect(LuceneSearchIndex.tokenize('Schachter’s lecture')).toEqual([
      'schachter',
      'lectur',
    ]);
  });

  test('empty/punct-only queries → no tokens', () => {
    expect(LuceneSearchIndex.tokenize('')).toEqual([]);
    expect(LuceneSearchIndex.tokenize('!!! ???')).toEqual([]);
  });
});

describe('LuceneSearchIndex.search — basic semantics', () => {
  test('empty query → empty results', () => {
    const idx = LuceneSearchIndex.load(
      singleFieldIndex({
        docCount: 1,
        avgLen: 5,
        docLens: { a: 5 },
        terms: { lesson: { df: 1, postings: [['a', 1]] } },
      }),
    );
    expect(idx.search('')).toEqual([]);
    expect(idx.search('the of')).toEqual([]);
  });

  test('single-term query returns matching docs with positive scores', () => {
    const idx = LuceneSearchIndex.load(
      singleFieldIndex({
        docCount: 3,
        avgLen: 5,
        docLens: { a: 5, b: 5, c: 5 },
        terms: {
          lesson: {
            df: 2,
            postings: [
              ['a', 1],
              ['b', 1],
            ],
          },
        },
      }),
    );
    const out = idx.search('lesson');
    expect(out.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(out.every((r) => r.score > 0)).toBe(true);
  });

  test('missing term in multi-term query → empty (AND semantics)', () => {
    const idx = LuceneSearchIndex.load(
      singleFieldIndex({
        docCount: 2,
        avgLen: 5,
        docLens: { a: 5, b: 5 },
        terms: {
          lesson: { df: 2, postings: [['a', 1], ['b', 1]] },
          // "seder" not in index
        },
      }),
    );
    expect(idx.search('lesson seder')).toEqual([]);
  });

  test('multi-term AND: only docs in every posting list survive, scores sum', () => {
    const idx = LuceneSearchIndex.load(
      singleFieldIndex({
        docCount: 3,
        avgLen: 5,
        docLens: { a: 5, b: 5, c: 5 },
        terms: {
          lesson: {
            df: 2,
            postings: [
              ['a', 1],
              ['b', 1],
            ],
          },
          seder: {
            df: 2,
            postings: [
              ['a', 1],
              ['c', 1],
            ],
          },
        },
      }),
    );
    const out = idx.search('lesson seder');
    expect(out.map((r) => r.id)).toEqual(['a']);
    expect(out[0].score).toBeGreaterThan(0);
  });
});

describe('LuceneSearchIndex.search — BM25 properties', () => {
  test('shorter doc with same tf scores higher than longer doc (length norm)', () => {
    const idx = LuceneSearchIndex.load(
      singleFieldIndex({
        docCount: 2,
        avgLen: 10,
        docLens: { short: 2, long: 20 },
        terms: {
          torah: { df: 2, postings: [['short', 1], ['long', 1]] },
        },
      }),
    );
    const out = idx.search('torah');
    expect(out[0].id).toBe('short');
    expect(out[0].score).toBeGreaterThan(out[1].score);
  });

  test('higher tf scores higher (saturating)', () => {
    const idx = LuceneSearchIndex.load(
      singleFieldIndex({
        docCount: 2,
        avgLen: 10,
        docLens: { a: 10, b: 10 },
        terms: {
          torah: { df: 2, postings: [['a', 1], ['b', 5]] },
        },
      }),
    );
    const out = idx.search('torah');
    expect(out[0].id).toBe('b');
    expect(out[0].score).toBeGreaterThan(out[1].score);
    // Saturation: tf=5 should NOT be 5× tf=1.
    expect(out[0].score).toBeLessThan(out[1].score * 5);
  });

  test('rarer term contributes more than common term (IDF)', () => {
    // Both docs match both terms with tf=1 and equal length; differ only in df.
    const idx = LuceneSearchIndex.load(
      singleFieldIndex({
        docCount: 100,
        avgLen: 10,
        docLens: { a: 10, b: 10 },
        terms: {
          rare: { df: 1, postings: [['a', 1]] },
          common: { df: 90, postings: [['b', 1]] },
        },
      }),
    );
    const rareScore = idx.search('rare')[0].score;
    const commonScore = idx.search('common')[0].score;
    expect(rareScore).toBeGreaterThan(commonScore);
  });

  test('field boost: term in meta-only outranks term in body-only with equal stats', () => {
    const idx = LuceneSearchIndex.load(
      twoFieldIndex({
        docCount: 2,
        avgLenMeta: 5,
        avgLenBody: 5,
        docLens: { metaHit: [5, 5], bodyHit: [5, 5] },
        terms: {
          torah: {
            df: [1, 1],
            metaPostings: [['metaHit', 1]],
            bodyPostings: [['bodyHit', 1]],
          },
        },
      }),
    );
    const out = idx.search('torah');
    expect(out[0].id).toBe('metaHit');
    // With boost 5 vs 1 and otherwise identical stats, the ratio is 5×.
    expect(out[0].score / out[1].score).toBeCloseTo(5, 5);
  });

  test('cross-field score is the sum of per-field contributions', () => {
    // Doc that has the term in both fields beats either-only doc.
    const idx = LuceneSearchIndex.load(
      twoFieldIndex({
        docCount: 3,
        avgLenMeta: 5,
        avgLenBody: 5,
        docLens: { both: [5, 5], metaOnly: [5, 5], bodyOnly: [5, 5] },
        terms: {
          torah: {
            df: [2, 2],
            metaPostings: [['both', 1], ['metaOnly', 1]],
            bodyPostings: [['both', 1], ['bodyOnly', 1]],
          },
        },
      }),
    );
    const out = idx.search('torah');
    expect(out[0].id).toBe('both');
    // both = metaOnly + bodyOnly contribution (df is same → idf identical).
    const both = out.find((r) => r.id === 'both')!.score;
    const metaOnly = out.find((r) => r.id === 'metaOnly')!.score;
    const bodyOnly = out.find((r) => r.id === 'bodyOnly')!.score;
    expect(both).toBeCloseTo(metaOnly + bodyOnly, 5);
  });

  test('exact BM25 numeric check on a hand-computable fixture', () => {
    // Single field, single doc, single term. We can compute by hand:
    //   N=10, df=1, avgLen=4, len=4, tf=1, k1=1.2, b=0.75, boost=1
    //   idf = ln(1 + (10 - 1 + 0.5)/(1 + 0.5)) = ln(1 + 9.5/1.5) = ln(7.333…)
    //   X = 1 - 0.75 + 0.75 * 4/4 = 1
    //   tfNorm = 1 * 2.2 / (1 + 1.2 * 1) = 2.2 / 2.2 = 1
    //   score = 1 * idf * 1 = ln(7.333…) ≈ 1.99243
    const idx = LuceneSearchIndex.load(
      singleFieldIndex({
        docCount: 10,
        avgLen: 4,
        docLens: { a: 4 },
        terms: { torah: { df: 1, postings: [['a', 1]] } },
      }),
    );
    const out = idx.search('torah');
    expect(out).toHaveLength(1);
    expect(out[0].score).toBeCloseTo(Math.log(1 + 9.5 / 1.5), 5);
  });
});
