/**
 * Client-side search over a Lucene-produced pre-computed inverted index.
 *
 * At build time, the Python scripts invoke an Apache Lucene Java CLI that
 * tokenizes every search entry with Lucene's EnglishAnalyzer (lower-case,
 * stop-word removal, Porter stemming) and scores each document per term
 * using BM25. The result is a JSON file mapping stemmed terms to ranked
 * posting lists:
 *
 * ```json
 * {
 *   "version": 1,
 *   "analyzer": "EnglishAnalyzer",
 *   "docCount": 5000,
 *   "terms": {
 *     "lesson": [{ "id": "rsch-20260418-01", "s": 8.42 }, …],
 *     …
 *   }
 * }
 * ```
 *
 * At query time the app applies the same stemming to the query terms,
 * looks up each stem in the map, intersects the posting lists (AND
 * semantics), sums the scores, and returns ranked results.
 */

// ---------------------------------------------------------------------------
// Porter stemmer — minimal English stemmer matching Lucene's default.
// Adapted from the classic public-domain JavaScript implementation by
// Tartarus / Martin Porter.
// ---------------------------------------------------------------------------

/* eslint-disable no-param-reassign */
const step2list: Record<string, string> = {
  ational: 'ate', tional: 'tion', enci: 'ence', anci: 'ance',
  izer: 'ize', bli: 'ble', alli: 'al', entli: 'ent', eli: 'e',
  ousli: 'ous', ization: 'ize', ation: 'ate', ator: 'ate',
  alism: 'al', iveness: 'ive', fulness: 'ful', ousness: 'ous',
  aliti: 'al', iviti: 'ive', biliti: 'ble', logi: 'log',
};
const step3list: Record<string, string> = {
  icate: 'ic', ative: '', alize: 'al', iciti: 'ic',
  ical: 'ic', ful: '', ness: '',
};
const c = '[^aeiou]';
const v = '[aeiouy]';
const C = c + '[^aeiouy]*';
const V = v + '[aeiou]*';
const mgr0 = new RegExp(`^(${C})?${V}${C}`);
const meq1 = new RegExp(`^(${C})?${V}${C}(${V})?$`);
const mgr1 = new RegExp(`^(${C})?${V}${C}${V}${C}`);
const s_v = new RegExp(`^(${C})?${v}`);

function porterStem(w: string): string {
  if (w.length < 3) return w;

  let stem: string;
  let suffix: string;
  let re: RegExp;
  let re2: RegExp;
  let re3: RegExp;
  let re4: RegExp;

  const firstch = w.charAt(0);
  if (firstch === 'y') w = firstch.toUpperCase() + w.substring(1);

  // Step 1a
  re = /^(.+?)(ss|i)es$/;
  re2 = /^(.+?)([^s])s$/;
  if (re.test(w)) w = w.replace(re, '$1$2');
  else if (re2.test(w)) w = w.replace(re2, '$1$2');

  // Step 1b
  re = /^(.+?)eed$/;
  re2 = /^(.+?)(ed|ing)$/;
  if (re.test(w)) {
    const fp = re.exec(w)!;
    if (mgr0.test(fp[1])) w = w.slice(0, -1);
  } else if (re2.test(w)) {
    const fp = re2.exec(w)!;
    stem = fp[1];
    if (s_v.test(stem)) {
      w = stem;
      re2 = /(at|bl|iz)$/;
      re3 = /([^aeiouylsz])\1$/;
      re4 = new RegExp(`^${C}${v}[^aeiouwxy]$`);
      if (re2.test(w)) w += 'e';
      else if (re3.test(w)) w = w.slice(0, -1);
      else if (re4.test(w)) w += 'e';
    }
  }

  // Step 1c
  re = /^(.+?)y$/;
  if (re.test(w)) {
    const fp = re.exec(w)!;
    stem = fp[1];
    if (s_v.test(stem)) w = stem + 'i';
  }

  // Step 2
  re = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/;
  if (re.test(w)) {
    const fp = re.exec(w)!;
    stem = fp[1];
    suffix = fp[2];
    if (mgr0.test(stem)) w = stem + step2list[suffix];
  }

  // Step 3
  re = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/;
  if (re.test(w)) {
    const fp = re.exec(w)!;
    stem = fp[1];
    suffix = fp[2];
    if (mgr0.test(stem)) w = stem + step3list[suffix];
  }

  // Step 4
  re = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/;
  re2 = /^(.+?)(s|t)(ion)$/;
  if (re.test(w)) {
    const fp = re.exec(w)!;
    stem = fp[1];
    if (mgr1.test(stem)) w = stem;
  } else if (re2.test(w)) {
    const fp = re2.exec(w)!;
    stem = fp[1] + fp[2];
    if (mgr1.test(stem)) w = stem;
  }

  // Step 5
  re = /^(.+?)e$/;
  if (re.test(w)) {
    const fp = re.exec(w)!;
    stem = fp[1];
    re2 = new RegExp(`^${C}${v}[^aeiouwxy]$`);
    if (mgr1.test(stem) || (meq1.test(stem) && !re2.test(stem))) w = stem;
  }
  re = /ll$/;
  if (re.test(w) && mgr1.test(w)) w = w.slice(0, -1);

  if (firstch === 'y') w = w.charAt(0).toLowerCase() + w.substring(1);
  return w;
}
/* eslint-enable no-param-reassign */

// ---------------------------------------------------------------------------
// LuceneSearchIndex
// ---------------------------------------------------------------------------

interface PostingEntry {
  id: string;
  /** BM25 score computed at build time. */
  s: number;
}

export interface LuceneIndexData {
  version: number;
  analyzer: string;
  docCount: number;
  terms: Record<string, PostingEntry[]>;
}

export interface SearchResult {
  id: string;
  score: number;
}

/**
 * English stop words matching Lucene's EnglishAnalyzer default stop set.
 * Query terms that appear in this set are dropped before lookup.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if',
  'in', 'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or', 'such',
  'that', 'the', 'their', 'then', 'there', 'these', 'they', 'this',
  'to', 'was', 'will', 'with',
]);

export class LuceneSearchIndex {
  private terms: Map<string, PostingEntry[]>;
  readonly docCount: number;

  private constructor(data: LuceneIndexData) {
    this.docCount = data.docCount;
    this.terms = new Map();
    for (const [term, postings] of Object.entries(data.terms)) {
      this.terms.set(term, postings);
    }
  }

  /** Load a Lucene index from its JSON representation. */
  static load(json: LuceneIndexData): LuceneSearchIndex {
    return new LuceneSearchIndex(json);
  }

  /**
   * Tokenize a query string the same way Lucene's EnglishAnalyzer does:
   * lowercase → split on non-alphanumeric → drop stop words → Porter stem.
   */
  static tokenize(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0 && !STOP_WORDS.has(t))
      .map(porterStem);
  }

  /**
   * Search the index. Returns document IDs ranked by total BM25 score.
   *
   * Semantics: AND across all query terms — a document must appear in
   * every term's posting list to be included. Scores are summed across
   * matching terms.
   */
  search(query: string): SearchResult[] {
    const stems = LuceneSearchIndex.tokenize(query);
    if (stems.length === 0) return [];

    // Gather posting lists for each stem
    const postingLists: PostingEntry[][] = [];
    for (const stem of stems) {
      const list = this.terms.get(stem);
      if (!list || list.length === 0) return []; // AND: missing term → no results
      postingLists.push(list);
    }

    if (postingLists.length === 1) {
      // Single-term fast path
      return postingLists[0].map((p) => ({ id: p.id, score: p.s }));
    }

    // Multi-term: intersect and sum scores
    // Start with the shortest posting list for efficiency
    postingLists.sort((a, b) => a.length - b.length);

    // Build a score map from the first (shortest) list
    const scores = new Map<string, number>();
    for (const p of postingLists[0]) {
      scores.set(p.id, p.s);
    }

    // Intersect with remaining lists
    for (let i = 1; i < postingLists.length; i++) {
      const listIds = new Set(postingLists[i].map((p) => p.id));
      const listScores = new Map(postingLists[i].map((p) => [p.id, p.s]));

      for (const id of scores.keys()) {
        if (!listIds.has(id)) {
          scores.delete(id);
        } else {
          scores.set(id, scores.get(id)! + listScores.get(id)!);
        }
      }
    }

    // Sort by score descending
    const results: SearchResult[] = [];
    for (const [id, score] of scores) {
      results.push({ id, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results;
  }
}
