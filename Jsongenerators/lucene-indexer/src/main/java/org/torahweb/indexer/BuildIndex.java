package org.torahweb.indexer;

import com.google.gson.*;
import com.google.gson.stream.JsonReader;
import org.apache.lucene.analysis.Analyzer;
import org.apache.lucene.analysis.en.EnglishAnalyzer;
import org.apache.lucene.document.*;
import org.apache.lucene.index.*;
import org.apache.lucene.search.*;
import org.apache.lucene.store.ByteBuffersDirectory;
import org.apache.lucene.util.BytesRef;
import org.apache.lucene.util.SmallFloat;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * CLI tool: reads a JSON array of search entries from stdin, builds an
 * Apache Lucene in-memory index, and emits a JSON file containing raw
 * BM25 inputs (per-field posting lists, per-doc field lengths, per-field
 * collection stats). The client computes BM25 scores at query time using
 * the hyperparameters embedded in the output.
 *
 * <h3>Input format (stdin)</h3>
 * <pre>
 * [
 *   { "id": "rsch-20260418-01", "type": "article", "date": "2026-04-18",
 *     "haystack": "lessons from the seder rabbi hershel schachter ..." },
 *   ...
 * ]
 * </pre>
 *
 * <h3>Output format (stdout) — schema v2</h3>
 * <pre>
 * {
 *   "schemaVersion": 2,
 *   "analyzer": "EnglishAnalyzer",
 *   "scoring": { "scorer": "BM25", "k1": 1.2, "b": 0.75 },
 *   "docCount": 5000,
 *   "fields": [
 *     { "name": "meta", "boost": 5.0, "avgLen": 48.7 },
 *     { "name": "body", "boost": 1.0, "avgLen": 412.3 }
 *   ],
 *   "docLens": {
 *     "rsch-20260418-01": [52, 410],
 *     ...
 *   },
 *   "terms": {
 *     "lesson": {
 *       "df": [312, 894],
 *       "postings": [
 *         [["rsch-20260418-01", 2], ...],   meta postings (may be empty)
 *         [["rsch-20260418-01", 5], ...]    body postings
 *       ]
 *     },
 *     ...
 *   }
 * }
 * </pre>
 *
 * Doc lengths use Lucene's {@code SmallFloat.byte4ToInt} decoded form —
 * the same quantized length BM25Similarity uses internally — so client-
 * side scores match what Lucene would compute.
 */
public class BuildIndex {

    /** Field name for the metadata-heavy leading slice (boosted). */
    private static final String F_META = "meta";
    /** Field name for the full haystack body. */
    private static final String F_BODY = "body";
    /** How many leading characters of the haystack count as "meta". */
    private static final int META_SLICE = 512;
    /** Boost applied to the meta field relative to body. */
    private static final float META_BOOST = 5.0f;
    /** BM25 saturation parameter. Lucene default. */
    private static final float BM25_K1 = 1.2f;
    /** BM25 length-normalization parameter. Lucene default. */
    private static final float BM25_B = 0.75f;

    public static void main(String[] args) throws Exception {
        // Force stdout to UTF-8 — on Windows the JVM otherwise inherits the
        // platform code page (cp1252) and mangles non-ASCII characters in
        // the JSON we emit. The Python wrapper reads us back as UTF-8.
        PrintStream stdout = new PrintStream(System.out, false, StandardCharsets.UTF_8);

        // 1. Parse input entries from stdin
        List<Entry> entries = readEntries(System.in);
        if (entries.isEmpty()) {
            stdout.println(emptyOutput());
            stdout.flush();
            return;
        }

        // 2. Build an in-memory Lucene index
        ByteBuffersDirectory directory = new ByteBuffersDirectory();
        Analyzer analyzer = new EnglishAnalyzer();

        IndexWriterConfig config = new IndexWriterConfig(analyzer);
        config.setOpenMode(IndexWriterConfig.OpenMode.CREATE);

        // Map Lucene internal doc IDs → our entry IDs
        List<String> docIdToEntryId = new ArrayList<>();

        try (IndexWriter writer = new IndexWriter(directory, config)) {
            for (Entry entry : entries) {
                Document doc = new Document();
                doc.add(new StringField("id", entry.id, Field.Store.YES));

                String metaSlice = entry.haystack.substring(
                        0, Math.min(META_SLICE, entry.haystack.length()));
                doc.add(new TextField(F_META, metaSlice, Field.Store.NO));
                doc.add(new TextField(F_BODY, entry.haystack, Field.Store.NO));

                writer.addDocument(doc);
                docIdToEntryId.add(entry.id);
            }
            // Merge to a single segment so we can walk postings against one
            // LeafReader below without per-leaf score aggregation.
            writer.forceMerge(1);
        }

        // 3. Walk postings and gather raw BM25 inputs (no scoring here).
        //
        // For each (term, field) we emit [docId, tf] pairs. We also collect
        // each doc's per-field length (decoded from Lucene's norm byte via
        // SmallFloat.byte4ToInt, the same quantized form BM25Similarity
        // consumes internally — so client-side scores match Lucene's).
        //
        // CollectionStatistics gives us sumTotalTermFreq and docCount per
        // field; we publish avgLen = sumTotalTermFreq / docCount so the
        // client doesn't have to derive it from docLens.
        DirectoryReader reader = DirectoryReader.open(directory);
        IndexSearcher searcher = new IndexSearcher(reader);

        int docCount = reader.numDocs();
        LeafReader leaf = reader.leaves().get(0).reader();

        String[] fieldNames = { F_META, F_BODY };
        float[] fieldBoosts = { META_BOOST, 1.0f };

        // Per-field collection stats and norm readers.
        CollectionStatistics[] fieldStats = new CollectionStatistics[fieldNames.length];
        NumericDocValues[] fieldNorms = new NumericDocValues[fieldNames.length];
        float[] avgLens = new float[fieldNames.length];
        for (int f = 0; f < fieldNames.length; f++) {
            fieldStats[f] = searcher.collectionStatistics(fieldNames[f]);
            fieldNorms[f] = leaf.getNormValues(fieldNames[f]);
            avgLens[f] = fieldStats[f] == null
                    ? 0f
                    : (float) fieldStats[f].sumTotalTermFreq() / Math.max(1L, fieldStats[f].docCount());
        }

        // Per-doc field lengths, keyed by entry id.
        // docLens[entryId] = [metaLen, bodyLen] (decoded from norm byte).
        Map<String, int[]> docLens = new LinkedHashMap<>();
        for (int doc = 0; doc < docCount; doc++) {
            String entryId = docIdToEntryId.get(doc);
            int[] lens = new int[fieldNames.length];
            for (int f = 0; f < fieldNames.length; f++) {
                NumericDocValues norms = fieldNorms[f];
                if (norms != null && norms.advanceExact(doc)) {
                    lens[f] = SmallFloat.byte4ToInt((byte) norms.longValue());
                }
            }
            docLens.put(entryId, lens);
            // norms is iterator-style; need fresh readers per pass.
        }
        // Refresh norm iterators for the per-term loop below (they advance).
        for (int f = 0; f < fieldNames.length; f++) {
            fieldNorms[f] = leaf.getNormValues(fieldNames[f]);
        }

        // Collect union of terms across fields.
        Set<String> allTerms = new TreeSet<>();
        for (String field : fieldNames) {
            Terms terms = leaf.terms(field);
            if (terms == null) continue;
            TermsEnum te = terms.iterator();
            BytesRef br;
            while ((br = te.next()) != null) {
                allTerms.add(br.utf8ToString());
            }
        }

        // Per-term postings split by field.
        Map<String, TermPostings> termPostings = new TreeMap<>();
        for (String term : allTerms) {
            BytesRef termBr = new BytesRef(term);
            int[] dfs = new int[fieldNames.length];
            @SuppressWarnings("unchecked")
            List<int[]>[] postingsByField = new List[fieldNames.length];
            for (int f = 0; f < fieldNames.length; f++) {
                postingsByField[f] = collectPostings(leaf, fieldNames[f], termBr, dfs, f);
            }
            termPostings.put(term, new TermPostings(dfs, postingsByField));
        }

        reader.close();
        directory.close();

        // 4. Write output JSON to stdout (schema v2).
        JsonObject output = new JsonObject();
        output.addProperty("schemaVersion", 2);
        output.addProperty("analyzer", "EnglishAnalyzer");

        JsonObject scoring = new JsonObject();
        scoring.addProperty("scorer", "BM25");
        scoring.addProperty("k1", BM25_K1);
        scoring.addProperty("b", BM25_B);
        output.add("scoring", scoring);

        output.addProperty("docCount", docCount);

        JsonArray fieldsArr = new JsonArray();
        for (int f = 0; f < fieldNames.length; f++) {
            JsonObject fobj = new JsonObject();
            fobj.addProperty("name", fieldNames[f]);
            fobj.addProperty("boost", fieldBoosts[f]);
            fobj.addProperty("avgLen", round2(avgLens[f]));
            fieldsArr.add(fobj);
        }
        output.add("fields", fieldsArr);

        JsonObject docLensObj = new JsonObject();
        for (Map.Entry<String, int[]> e : docLens.entrySet()) {
            JsonArray lenArr = new JsonArray();
            for (int len : e.getValue()) lenArr.add(len);
            docLensObj.add(e.getKey(), lenArr);
        }
        output.add("docLens", docLensObj);

        JsonObject termsObj = new JsonObject();
        for (Map.Entry<String, TermPostings> e : termPostings.entrySet()) {
            JsonObject termObj = new JsonObject();
            JsonArray dfArr = new JsonArray();
            for (int df : e.getValue().df) dfArr.add(df);
            termObj.add("df", dfArr);

            JsonArray postingsArr = new JsonArray();
            for (List<int[]> fieldPostings : e.getValue().postings) {
                JsonArray fieldArr = new JsonArray();
                for (int[] p : fieldPostings) {
                    JsonArray pair = new JsonArray();
                    pair.add(docIdToEntryId.get(p[0]));
                    pair.add(p[1]);
                    fieldArr.add(pair);
                }
                postingsArr.add(fieldArr);
            }
            termObj.add("postings", postingsArr);
            termsObj.add(e.getKey(), termObj);
        }
        output.add("terms", termsObj);

        Gson gson = new GsonBuilder().disableHtmlEscaping().create();
        stdout.println(gson.toJson(output));
        stdout.flush();
    }

    /** Empty-corpus output. Kept consistent with the populated schema. */
    private static String emptyOutput() {
        return "{\"schemaVersion\":2,\"analyzer\":\"EnglishAnalyzer\","
                + "\"scoring\":{\"scorer\":\"BM25\",\"k1\":" + BM25_K1 + ",\"b\":" + BM25_B + "},"
                + "\"docCount\":0,"
                + "\"fields\":[{\"name\":\"" + F_META + "\",\"boost\":" + META_BOOST + ",\"avgLen\":0.0},"
                + "{\"name\":\"" + F_BODY + "\",\"boost\":1.0,\"avgLen\":0.0}],"
                + "\"docLens\":{},\"terms\":{}}";
    }

    /**
     * Collect [docId, tf] pairs for a single term in a single field.
     * Sets {@code dfs[fieldIndex]} to the document frequency. Returns an
     * empty list (and leaves df = 0) if the term is absent from the field.
     */
    private static List<int[]> collectPostings(LeafReader leaf, String field, BytesRef term,
                                               int[] dfs, int fieldIndex) throws IOException {
        Terms terms = leaf.terms(field);
        if (terms == null) return List.of();
        TermsEnum te = terms.iterator();
        if (!te.seekExact(term)) return List.of();

        dfs[fieldIndex] = te.docFreq();
        PostingsEnum pe = te.postings(null, PostingsEnum.FREQS);
        List<int[]> out = new ArrayList<>(te.docFreq());
        int doc;
        while ((doc = pe.nextDoc()) != PostingsEnum.NO_MORE_DOCS) {
            out.add(new int[] { doc, pe.freq() });
        }
        return out;
    }

    private static double round2(float f) {
        return Math.round(f * 100.0) / 100.0;
    }

    // --- data classes ---

    private static class Entry {
        String id;
        String type;
        String date;
        String haystack;
    }

    /** Per-term posting data: df per field and postings[fieldIndex] = [docId, tf] pairs. */
    private static class TermPostings {
        final int[] df;
        final List<int[]>[] postings;

        TermPostings(int[] df, List<int[]>[] postings) {
            this.df = df;
            this.postings = postings;
        }
    }

    // --- input parsing ---

    private static List<Entry> readEntries(InputStream in) throws IOException {
        List<Entry> entries = new ArrayList<>();
        try (JsonReader jr = new JsonReader(
                new InputStreamReader(in, StandardCharsets.UTF_8))) {
            jr.beginArray();
            Gson gson = new Gson();
            while (jr.hasNext()) {
                Entry e = gson.fromJson(jr, Entry.class);
                if (e != null && e.id != null && e.haystack != null) {
                    entries.add(e);
                }
            }
            jr.endArray();
        }
        return entries;
    }
}
