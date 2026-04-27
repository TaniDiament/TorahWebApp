package com.torahweb.search

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * Bridge to the Rust Tantivy reader (see ../../../../../../tantivy-bridge).
 *
 * The native library `libtorah_search.so` ships in jniLibs/<abi>/ and is
 * built by `tantivy-bridge/build-android.sh`. This module is registered in
 * MainApplication via [TorahSearchPackage].
 */
@ReactModule(name = TorahSearchModule.NAME)
class TorahSearchModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = NAME

    @ReactMethod
    fun open(path: String, promise: Promise) {
        try {
            if (nativeOpen(path)) {
                promise.resolve(true)
            } else {
                promise.reject("E_OPEN", "Tantivy index could not be opened at $path")
            }
        } catch (t: Throwable) {
            promise.reject("E_OPEN", t)
        }
    }

    @ReactMethod
    fun query(query: String, limit: Int, promise: Promise) {
        try {
            promise.resolve(nativeQuery(query, limit))
        } catch (t: Throwable) {
            promise.reject("E_QUERY", t)
        }
    }

    @ReactMethod
    fun close(promise: Promise) {
        try {
            nativeClose()
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject("E_CLOSE", t)
        }
    }

    private external fun nativeOpen(path: String): Boolean
    private external fun nativeQuery(query: String, limit: Int): String
    private external fun nativeClose()

    companion object {
        const val NAME = "TorahSearch"

        init {
            System.loadLibrary("torah_search")
        }
    }
}
