/**
 * Client-side search over a Lucene-produced inverted index (schema v2).
 *
 * The build-time Java tool emits a JSON file that contains every raw BM25
 * input — per-(term, field) postings as `[id, tf]` pairs, per-doc field
 * lengths, per-field collection averages, and the BM25 hyperparameters —
 * but **does not** pre-compute scores. The schema:
 *
 * ```json
 * {
 *   "schemaVersion": 2,
 *   "analyzer": "EnglishAnalyzer",
 *   "scoring": { "scorer": "BM25", "k1": 1.2, "b": 0.75 },
 *   "docCount": 5000,
 *   "fields": [
 *     { "name": "meta", "boost": 5.0, "avgLen": 48.7 },
 *     { "name": "body", "boost": 1.0, "avgLen": 412.3 }
 *   ],
 *   "docLens": { "rsch-20260418-01": [52, 410], … },
 *   "terms": {
 *     "lesson": {
 *       "df": [312, 894],
 *       "postings": [ [["rsch-…", 2], …], [["rsch-…", 5], …] ]
 *     }
 *   }
 * }
 * ```
 *
 * At query time we tokenize the query the same way Lucene did at index
 * time (lowercase → strip possessive 's → split → stop-word filter →
 * Porter stem), look up each stem, and compute BM25 per (term, field, doc)
 * with the published hyperparameters. Scores across fields are summed
 * with the field's boost; scores across query terms are AND-intersected
 * and summed. This keeps every contribution to a hit's total score
 * within the same similarity context.
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

/** A single posting: tuple of [entryId, termFrequency]. */
type Posting = [string, number];

interface FieldStats {
  name: string;
  boost: number;
  avgLen: number;
}

interface TermData {
  /** Document frequency per field, indexed by field position. */
  df: number[];
  /** Postings per field, indexed by field position. */
  postings: Posting[][];
}

export interface LuceneIndexData {
  schemaVersion: number;
  analyzer: string;
  scoring: { scorer: 'BM25'; k1: number; b: number };
  docCount: number;
  fields: FieldStats[];
  docLens: Record<string, number[]>;
  terms: Record<string, TermData>;
}

export interface SearchResult {
  id: string;
  score: number;
}

/**
 * English stop words matching Lucene's EnglishAnalyzer default stop set
 * (`EnglishAnalyzer.ENGLISH_STOP_WORDS_SET`). Query terms in this set are
 * dropped before stemming and lookup.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if',
  'in', 'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or', 'such',
  'that', 'the', 'their', 'then', 'there', 'these', 'they', 'this',
  'to', 'was', 'will', 'with',
]);

// ---------------------------------------------------------------------------
// Transliteration synonyms + gated fuzzy fallback
// ---------------------------------------------------------------------------

/**
 * Hebrew/Aramaic words have no single English spelling, so the same concept
 * shows up under several transliterations across the corpus ("Shabbos" vs
 * "Shabbat", "teshuva" vs "teshuvah"). Each row groups spellings of one word.
 * At load time every spelling is run through the same Porter stemmer the query
 * pipeline uses and cross-linked, so a search for one spelling also matches
 * documents indexed under another. Extend freely — a row only contributes if
 * it stems to 2+ distinct stems (otherwise the exact lookup already covers it).
 */
const SYNONYM_CLUSTERS: string[][] = [
  ['shabbos', 'shabbas', 'shabbes', 'shabbat', 'shabos'],
  ['teshuva', 'teshuvah', 'tshuva', 'tshuvah'],
  ['sukkos', 'sukkot', 'sukkoth', 'succos', 'succot'],
  ['sukkah', 'sukka', 'succah', 'succa'],
  ['chanukah', 'chanuka', 'chanukkah', 'hanukkah', 'hanukah'],
  ['shavuos', 'shavuot', 'shavuoth'],
  ['pesach', 'pesah', 'passover'],
  ['kippur', 'kipur'],
  ['mitzvah', 'mitzva', 'mitzvos', 'mitzvot', 'mitzvoth'],
  ['bracha', 'brocho', 'beracha', 'berachah', 'brachos', 'berachos', 'berachot'],
  ['halacha', 'halachah', 'halakha', 'halocho'],
  ['gemara', 'gemora', 'gmara'],
  ['tefilla', 'tefillah', 'tefila', 'tefillos', 'tefilos', 'tefilot'],
  ['emuna', 'emunah'],
  ['parsha', 'parshah', 'parasha', 'parshas'],
  ['neshama', 'neshamah', 'neshomo'],
  ['tzedaka', 'tzedakah', 'tzdaka'],
  ['simcha', 'simchah', 'simcho'],
  ['avoda', 'avodah'],
  ['hashana', 'hashanah', 'hashono'],
];

/**
 * stem → the other same-meaning stems in its cluster (not itself), so callers
 * expand a query stem to `[stem, ...SYNONYM_STEMS.get(stem)]`. Built once.
 */
const SYNONYM_STEMS: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const cluster of SYNONYM_CLUSTERS) {
    const stems = Array.from(new Set(cluster.map((w) => porterStem(w))));
    if (stems.length < 2) continue;
    for (const s of stems) {
      let bucket = map.get(s);
      if (!bucket) {
        bucket = [];
        map.set(s, bucket);
      }
      for (const other of stems) {
        if (other !== s && !bucket.includes(other)) bucket.push(other);
      }
    }
  }
  return map;
})();

/** Below this length a term is too short to fuzz without nonsense matches. */
const FUZZY_MIN_LEN = 4;
/** Lucene-style length-scaled edit budget. */
const maxEditsFor = (len: number): number => (len <= 3 ? 0 : len <= 5 ? 1 : 2);
/** Fuzzy hits are spelling guesses — keep them ranked below exact/synonym hits. */
const FUZZY_SCORE_PENALTY = 0.5;
/** Cap how many equally-close fuzzy candidates we score, to bound cost. */
const FUZZY_MAX_CANDIDATES = 8;

/**
 * Levenshtein edit distance with an early-exit ceiling: returns the distance
 * when it's ≤ max, or -1 as soon as it's provably greater. Two-row DP with a
 * per-row minimum check so a hopeless comparison bails before finishing.
 */
function boundedLevenshtein(a: string, b: string, max: number): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return -1;
  if (la === 0) return lb <= max ? lb : -1;
  if (lb === 0) return la <= max ? la : -1;

  let prev = new Array<number>(lb + 1);
  let curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      const cell = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      curr[j] = cell;
      if (cell < rowMin) rowMin = cell;
    }
    if (rowMin > max) return -1;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  const d = prev[lb];
  return d <= max ? d : -1;
}

export class LuceneSearchIndex {
  readonly docCount: number;
  private readonly k1: number;
  private readonly b: number;
  private readonly fields: FieldStats[];
  private readonly docLens: Record<string, number[]>;
  private readonly terms: Map<string, TermData>;

  private constructor(data: LuceneIndexData) {
    this.docCount = data.docCount;
    this.k1 = data.scoring?.k1 ?? 1.2;
    this.b = data.scoring?.b ?? 0.75;
    this.fields = data.fields ?? [];
    this.docLens = data.docLens ?? {};
    this.terms = new Map();
    for (const [term, td] of Object.entries(data.terms ?? {})) {
      this.terms.set(term, td);
    }
  }

  /** Load a Lucene index from its JSON representation. */
  static load(json: LuceneIndexData): LuceneSearchIndex {
    return new LuceneSearchIndex(json);
  }

  /**
   * Tokenize a query string the same way Lucene's EnglishAnalyzer does:
   * lowercase → strip English possessive 's → split on non-alphanumeric →
   * drop stop words / single-char residue → Porter stem.
   *
   * The possessive strip mirrors Lucene's EnglishPossessiveFilter. Without
   * it "Schachter's lecture" would tokenize to ["schachter", "s", "lectur"]
   * and the AND-search would exclude any doc whose haystack happens not to
   * contain the noise token "s".
   */
  static tokenize(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/(\w)['’]s\b/g, '$1')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
      .map(porterStem);
  }

  /**
   * Score one query term across every field it appears in and accumulate
   * per-doc totals. BM25 with the published `k1`/`b` and per-field boost.
   *
   * Formula (Lucene-style):
   *   idf = ln(1 + (N - df + 0.5) / (df + 0.5))
   *   tfNorm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * |d_f| / avgLen_f))
   *   score(t, f, d) = boost_f * idf * tfNorm
   */
  private scoreTerm(term: string): Map<string, number> {
    const data = this.terms.get(term);
    const out = new Map<string, number>();
    if (!data) return out;

    for (let f = 0; f < this.fields.length; f++) {
      const postings = data.postings[f];
      if (!postings || postings.length === 0) continue;
      const df = data.df[f];
      if (df <= 0) continue;

      const idf = Math.log(1 + (this.docCount - df + 0.5) / (df + 0.5));
      const { avgLen, boost } = this.fields[f];
      // BM25 with avgLen = 0 is degenerate; treat as length-normalization-off.
      const denom1 = avgLen > 0 ? 1 - this.b : 1;
      const bOverAvg = avgLen > 0 ? this.b / avgLen : 0;

      for (let i = 0; i < postings.length; i++) {
        const [id, tf] = postings[i];
        const lens = this.docLens[id];
        if (!lens) continue;
        const len = lens[f] ?? 0;
        const tfNorm =
          (tf * (this.k1 + 1)) /
          (tf + this.k1 * (denom1 + bOverAvg * len));
        const contribution = boost * idf * tfNorm;
        const prev = out.get(id);
        out.set(id, prev === undefined ? contribution : prev + contribution);
      }
    }
    return out;
  }

  /**
   * Score one query position: its exact stem plus any transliteration
   * synonyms, merged by best (max) per-doc score since the variants denote the
   * same concept. Only when nothing matched exactly does it fall back to a
   * gated edit-distance search — so correctly-spelled, in-vocabulary terms
   * never pay the fuzzy cost nor pull in noisy near-spellings.
   */
  private scoreQueryTerm(stem: string): Map<string, number> {
    const variants = [stem, ...(SYNONYM_STEMS.get(stem) ?? [])];
    const exact = this.scoreVariants(variants);
    if (exact.size > 0) return exact;

    if (stem.length < FUZZY_MIN_LEN) return exact;
    const maxEdits = maxEditsFor(stem.length);
    if (maxEdits === 0) return exact;
    const candidates = this.fuzzyTerms(stem, maxEdits);
    if (candidates.length === 0) return new Map();
    const fuzzy = this.scoreVariants(candidates);
    for (const [id, s] of fuzzy) fuzzy.set(id, s * FUZZY_SCORE_PENALTY);
    return fuzzy;
  }

  /** Score several index terms and merge by best (max) per-doc score. */
  private scoreVariants(stems: string[]): Map<string, number> {
    const seen = new Set<string>();
    const out = new Map<string, number>();
    for (const stem of stems) {
      if (seen.has(stem)) continue;
      seen.add(stem);
      const scores = this.scoreTerm(stem);
      for (const [id, score] of scores) {
        const prev = out.get(id);
        if (prev === undefined || score > prev) out.set(id, score);
      }
    }
    return out;
  }

  /**
   * Vocabulary terms within `maxEdits` of `stem`, returning only those at the
   * smallest distance found (closest spelling wins) and capped for cost. The
   * length pre-filter skips the bulk of the vocabulary before the DP runs.
   */
  private fuzzyTerms(stem: string, maxEdits: number): string[] {
    let best = maxEdits + 1;
    let out: string[] = [];
    for (const term of this.terms.keys()) {
      if (Math.abs(term.length - stem.length) > maxEdits) continue;
      const d = boundedLevenshtein(stem, term, maxEdits);
      if (d < 0) continue;
      if (d < best) {
        best = d;
        out = [term];
      } else if (d === best && out.length < FUZZY_MAX_CANDIDATES) {
        out.push(term);
      }
    }
    return best <= maxEdits ? out : [];
  }

  /**
   * Search the index. Returns document IDs ranked by total BM25 score.
   *
   * Semantics: AND across all query terms — a document must appear in
   * every term's union of field postings to be included. Scores are
   * summed across matching terms.
   */
  search(query: string): SearchResult[] {
    const stems = LuceneSearchIndex.tokenize(query);
    if (stems.length === 0) return [];

    let acc: Map<string, number> | null = null;
    for (const stem of stems) {
      const termScores = this.scoreQueryTerm(stem);
      if (termScores.size === 0) return []; // AND: missing term → no results
      if (acc === null) {
        acc = termScores;
        continue;
      }
      // Intersect: keep only docs present in both, summing scores.
      const next = new Map<string, number>();
      for (const [id, prev] of acc) {
        const add = termScores.get(id);
        if (add !== undefined) next.set(id, prev + add);
      }
      if (next.size === 0) return [];
      acc = next;
    }

    const results: SearchResult[] = new Array(acc!.size);
    let i = 0;
    for (const [id, score] of acc!) results[i++] = { id, score };
    results.sort((a, b) => b.score - a.score);
    return results;
  }
}
