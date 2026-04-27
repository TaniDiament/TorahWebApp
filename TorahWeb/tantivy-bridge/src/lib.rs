//! Tantivy bridge for the TorahWeb React Native app.
//!
//! Two FFI surfaces wrap the same internal `Engine`:
//!
//! * `extern "C"` (`torah_search_*`) — used by iOS via a Swift module.
//! * `extern "system"` JNI exports (`Java_com_torahweb_search_*`) — used by
//!   Android directly from the Kotlin native module, no JNI shim needed.
//!
//! The engine itself just opens a Tantivy index by path, runs a multi-field
//! BM25 query with per-field boosts (mirroring how the index was built in
//! `Jsongenerators/_common.py`), and returns a JSON array of `{id, score}`
//! hits. Filtering by author/topic/type stays in JS — same separation as the
//! existing search code.

use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::path::Path;

use once_cell::sync::Lazy;
use parking_lot::RwLock;
use serde::Serialize;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::{Field, Value};
use tantivy::{Index, IndexReader, ReloadPolicy, TantivyDocument};

mod errors {
    pub const OK: i32 = 0;
    pub const ERR_NOT_OPEN: i32 = -1;
    pub const ERR_BAD_PATH: i32 = -2;
    pub const ERR_OPEN_FAILED: i32 = -3;
    pub const ERR_BAD_QUERY: i32 = -4;
    pub const ERR_INTERNAL: i32 = -5;
}

/// Field-boost table. Mirrors the rationale from the schema doc: title and
/// metadata fields outweigh body matches.
const FIELD_BOOSTS: &[(&str, f32)] = &[
    ("title", 5.0),
    ("author_name", 3.0),
    ("topic_names", 3.0),
    ("parsha", 3.0),
    ("excerpt", 2.0),
    ("body", 1.0),
    ("description", 1.0),
];

/// Fields the user-typed query is parsed against. Order doesn't affect
/// scoring (boosts handle that) but determines the QueryParser default
/// fields.
const QUERY_FIELDS: &[&str] = &[
    "title",
    "author_name",
    "topic_names",
    "parsha",
    "excerpt",
    "body",
    "description",
];

struct Engine {
    reader: IndexReader,
    id_field: Field,
    parser: QueryParser,
}

impl Engine {
    fn open(path: &Path) -> Result<Self, String> {
        let index = Index::open_in_dir(path).map_err(|e| format!("open: {e}"))?;
        let schema = index.schema();

        let mut by_name: HashMap<&str, Field> = HashMap::new();
        for name in QUERY_FIELDS.iter().chain(std::iter::once(&"id")) {
            let field = schema
                .get_field(name)
                .map_err(|_| format!("field `{name}` missing from index schema"))?;
            by_name.insert(name, field);
        }
        let id_field = *by_name.get("id").unwrap();
        let query_fields: Vec<Field> =
            QUERY_FIELDS.iter().map(|n| *by_name.get(n).unwrap()).collect();

        let mut parser = QueryParser::for_index(&index, query_fields);
        // AND semantics by default — matches the user expectation that "X Y"
        // narrows results, not broadens them. Tantivy's QueryParser default
        // is OR, which surprises users.
        parser.set_conjunction_by_default();
        for (name, boost) in FIELD_BOOSTS {
            if let Some(field) = by_name.get(*name) {
                parser.set_field_boost(*field, *boost);
            }
        }

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::Manual)
            .try_into()
            .map_err(|e| format!("reader: {e}"))?;

        Ok(Engine { reader, id_field, parser })
    }

    fn search(&self, query: &str, limit: usize) -> Result<Vec<Hit>, String> {
        let q = match self.parser.parse_query(query) {
            Ok(q) => q,
            Err(_) => return Ok(Vec::new()),
        };
        let searcher = self.reader.searcher();
        let top = searcher
            .search(&q, &TopDocs::with_limit(limit))
            .map_err(|e| format!("search: {e}"))?;
        let mut hits = Vec::with_capacity(top.len());
        for (score, addr) in top {
            let doc: TantivyDocument = searcher
                .doc(addr)
                .map_err(|e| format!("doc fetch: {e}"))?;
            let id = doc
                .get_first(self.id_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if !id.is_empty() {
                hits.push(Hit { id, score });
            }
        }
        Ok(hits)
    }
}

#[derive(Serialize)]
struct Hit {
    id: String,
    score: f32,
}

static ENGINE: Lazy<RwLock<Option<Engine>>> = Lazy::new(|| RwLock::new(None));

fn open_path(path: &str) -> i32 {
    let p = Path::new(path);
    if !p.is_dir() {
        return errors::ERR_BAD_PATH;
    }
    match Engine::open(p) {
        Ok(engine) => {
            *ENGINE.write() = Some(engine);
            errors::OK
        }
        Err(msg) => {
            log::warn!("torah_search: open failed: {msg}");
            errors::ERR_OPEN_FAILED
        }
    }
}

fn run_query(query: &str, limit: u32) -> Result<String, i32> {
    let guard = ENGINE.read();
    let engine = guard.as_ref().ok_or(errors::ERR_NOT_OPEN)?;
    let hits = engine
        .search(query, limit.max(1) as usize)
        .map_err(|msg| {
            log::warn!("torah_search: query failed: {msg}");
            errors::ERR_BAD_QUERY
        })?;
    serde_json::to_string(&hits).map_err(|_| errors::ERR_INTERNAL)
}

fn close_engine() {
    *ENGINE.write() = None;
}

// ---------- C ABI (iOS) -----------------------------------------------

/// Open a Tantivy index at `path`. Returns 0 on success, negative on error.
/// # Safety
/// `path` must be a valid NUL-terminated UTF-8 string.
#[no_mangle]
pub unsafe extern "C" fn torah_search_open(path: *const c_char) -> i32 {
    if path.is_null() {
        return errors::ERR_BAD_PATH;
    }
    let path_str = match CStr::from_ptr(path).to_str() {
        Ok(s) => s,
        Err(_) => return errors::ERR_BAD_PATH,
    };
    open_path(path_str)
}

/// Run a query, returning a malloc'd JSON string of `[{"id","score"},...]`.
/// Caller MUST free the returned pointer with `torah_search_free`. Returns
/// NULL on error.
/// # Safety
/// `query` must be a valid NUL-terminated UTF-8 string.
#[no_mangle]
pub unsafe extern "C" fn torah_search_query(
    query: *const c_char,
    limit: u32,
) -> *mut c_char {
    if query.is_null() {
        return std::ptr::null_mut();
    }
    let query_str = match CStr::from_ptr(query).to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };
    match run_query(query_str, limit) {
        Ok(json) => match CString::new(json) {
            Ok(c) => c.into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}

/// Free a string previously returned by `torah_search_query`.
/// # Safety
/// `ptr` must come from `torah_search_query` and not have been freed yet.
#[no_mangle]
pub unsafe extern "C" fn torah_search_free(ptr: *mut c_char) {
    if !ptr.is_null() {
        let _ = CString::from_raw(ptr);
    }
}

/// Close the active index, releasing memory. Idempotent.
#[no_mangle]
pub extern "C" fn torah_search_close() {
    close_engine();
}

// ---------- JNI ABI (Android) -----------------------------------------

#[cfg(target_os = "android")]
mod android {
    use super::*;
    use jni::objects::{JClass, JString};
    use jni::sys::{jboolean, jint, jstring, JNI_FALSE, JNI_TRUE};
    use jni::JNIEnv;

    fn jni_init_logging() {
        use std::sync::Once;
        static ONCE: Once = Once::new();
        ONCE.call_once(|| {
            android_logger::init_once(
                android_logger::Config::default()
                    .with_max_level(log::LevelFilter::Info)
                    .with_tag("TorahSearch"),
            );
        });
    }

    #[no_mangle]
    pub extern "system" fn Java_com_torahweb_search_TorahSearchModule_nativeOpen(
        mut env: JNIEnv,
        _class: JClass,
        path: JString,
    ) -> jboolean {
        jni_init_logging();
        let path_str: String = match env.get_string(&path) {
            Ok(s) => s.into(),
            Err(_) => return JNI_FALSE,
        };
        if open_path(&path_str) == errors::OK {
            JNI_TRUE
        } else {
            JNI_FALSE
        }
    }

    #[no_mangle]
    pub extern "system" fn Java_com_torahweb_search_TorahSearchModule_nativeQuery<'local>(
        mut env: JNIEnv<'local>,
        _class: JClass<'local>,
        query: JString<'local>,
        limit: jint,
    ) -> jstring {
        let query_str: String = match env.get_string(&query) {
            Ok(s) => s.into(),
            Err(_) => return std::ptr::null_mut(),
        };
        let json = match run_query(&query_str, limit.max(1) as u32) {
            Ok(j) => j,
            Err(_) => "[]".to_string(),
        };
        match env.new_string(json) {
            Ok(s) => s.into_raw(),
            Err(_) => std::ptr::null_mut(),
        }
    }

    #[no_mangle]
    pub extern "system" fn Java_com_torahweb_search_TorahSearchModule_nativeClose(
        _env: JNIEnv,
        _class: JClass,
    ) {
        close_engine();
    }
}
