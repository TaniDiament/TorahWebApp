package org.torahweb.indexer;

import com.google.gson.*;
import com.google.gson.stream.JsonReader;
import org.apache.lucene.analysis.Analyzer;
import org.apache.lucene.analysis.en.EnglishAnalyzer;
import org.apache.lucene.document.*;
import org.apache.lucene.index.*;
import org.apache.lucene.search.*;
import org.apache.lucene.store.ByteBuffersDirectory;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * CLI tool: reads a JSON array of search entries from stdin, builds an
 * Apache Lucene in-memory index, extracts per-term posting lists with
 * BM25 scores, and writes the result as JSON to stdout.
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
 * <h3>Output format (stdout)</h3>
 * <pre>
 * {
 *   "version": 1,
 *   "analyzer": "EnglishAnalyzer",
 *   "docCount": 5000,
 *   "terms": {
 *     "lesson": [
 *       { "id": "rsch-20260418-01", "score": 8.42 },
 *       ...
 *     ],
 *     ...
 *   }
 * }
 * </pre>
 *
 * The app loads this JSON into a {@code Map<String, {id, score}[]>} and
 * performs fast look-ups at query time, applying the same analyzer
 * (English stemmer) to the query to match stem forms.
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

    public static void main(String[] args) throws Exception {
        // 1. Parse input entries from stdin
        List<Entry> entries = readEntries(System.in);
        if (entries.isEmpty()) {
            System.out.println("{\"version\":1,\"analyzer\":\"EnglishAnalyzer\",\"docCount\":0,\"terms\":{}}");
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
        }

        // 3. Score every document for every unique term using BM25
        DirectoryReader reader = DirectoryReader.open(directory);
        IndexSearcher searcher = new IndexSearcher(reader);
        // BM25Similarity is the default, but be explicit
        searcher.setSimilarity(new org.apache.lucene.search.similarities.BM25Similarity());

        int docCount = reader.numDocs();

        // Collect all unique terms across meta + body fields
        Set<String> allTerms = new TreeSet<>();
        for (LeafReaderContext ctx : reader.leaves()) {
            LeafReader leaf = ctx.reader();
            for (String field : List.of(F_META, F_BODY)) {
                Terms terms = leaf.terms(field);
                if (terms == null) continue;
                TermsEnum te = terms.iterator();
                while (te.next() != null) {
                    allTerms.add(te.term().utf8ToString());
                }
            }
        }

        // For each term, run a BooleanQuery (meta boosted + body) and
        // collect all matching docs with their scores.
        Map<String, List<ScoredDoc>> invertedIndex = new TreeMap<>();

        for (String term : allTerms) {
            BooleanQuery.Builder bqb = new BooleanQuery.Builder();
            BoostQuery metaQ = new BoostQuery(
                    new TermQuery(new Term(F_META, term)), META_BOOST);
            TermQuery bodyQ = new TermQuery(new Term(F_BODY, term));

            bqb.add(metaQ, BooleanClause.Occur.SHOULD);
            bqb.add(bodyQ, BooleanClause.Occur.SHOULD);

            TopDocs topDocs = searcher.search(bqb.build(), docCount);
            if (topDocs.scoreDocs.length == 0) continue;

            List<ScoredDoc> posting = new ArrayList<>(topDocs.scoreDocs.length);
            for (ScoreDoc sd : topDocs.scoreDocs) {
                posting.add(new ScoredDoc(docIdToEntryId.get(sd.doc),
                        Math.round(sd.score * 100.0f) / 100.0f));
            }
            // Sort by score descending
            posting.sort((a, b) -> Float.compare(b.score, a.score));
            invertedIndex.put(term, posting);
        }

        reader.close();
        directory.close();

        // 4. Write output JSON to stdout
        JsonObject output = new JsonObject();
        output.addProperty("version", 1);
        output.addProperty("analyzer", "EnglishAnalyzer");
        output.addProperty("docCount", docCount);

        JsonObject termsObj = new JsonObject();
        for (Map.Entry<String, List<ScoredDoc>> e : invertedIndex.entrySet()) {
            JsonArray arr = new JsonArray();
            for (ScoredDoc sd : e.getValue()) {
                JsonObject item = new JsonObject();
                item.addProperty("id", sd.id);
                item.addProperty("s", sd.score);
                arr.add(item);
            }
            termsObj.add(e.getKey(), arr);
        }
        output.add("terms", termsObj);

        Gson gson = new GsonBuilder().disableHtmlEscaping().create();
        System.out.println(gson.toJson(output));
    }

    // --- data classes ---

    private static class Entry {
        String id;
        String type;
        String date;
        String haystack;
    }

    private static class ScoredDoc {
        final String id;
        final float score;

        ScoredDoc(String id, float score) {
            this.id = id;
            this.score = score;
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
