import Foundation

/// Bridge from React Native to the Rust Tantivy reader.
///
/// The static library `libtorah_search.a` is built by
/// `tantivy-bridge/build-ios.sh` and bundled into `TorahSearch.xcframework`.
/// The C symbols are declared in `tantivy_bridge.h`, included by the
/// bridging header.
@objc(TorahSearch)
final class TorahSearch: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  /// Heavy work runs off the JS thread.
  @objc var methodQueue: DispatchQueue {
    DispatchQueue(label: "com.torahweb.search", qos: .userInitiated)
  }

  @objc(open:resolver:rejecter:)
  func open(
    _ path: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let result: Int32 = path.withCString { cstr in
      torah_search_open(cstr)
    }
    if result == 0 {
      resolver(true)
    } else {
      rejecter("E_OPEN", "Tantivy index could not be opened (code \(result))", nil)
    }
  }

  @objc(query:limit:resolver:rejecter:)
  func query(
    _ query: String,
    limit: NSNumber,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let raw: UnsafeMutablePointer<CChar>? = query.withCString { cstr in
      torah_search_query(cstr, UInt32(truncating: limit))
    }
    guard let raw else {
      rejecter("E_QUERY", "Tantivy query failed", nil)
      return
    }
    let json = String(cString: raw)
    torah_search_free(raw)
    resolver(json)
  }

  @objc(close:rejecter:)
  func close(
    _ resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    torah_search_close()
    resolver(nil)
  }
}
