import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "TorahWeb",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  // iOS calls this when it relaunches the app in the background to deliver
  // events for a background URLSession — e.g. an audio download (started with
  // `IOSBackgroundTask: true`, see src/services/download.ts) that finished while
  // the app was suspended. react-native-blob-util owns the session and its
  // delegate and exposes no hook to forward this handler to, so the most we can
  // correctly do is acknowledge the wake-up. Calling the completion handler lets
  // iOS take a fresh UI snapshot and re-suspend the app promptly (and avoids the
  // system warning you get for never invoking it). The transfer that's still
  // in flight resumes and saves via the library once the app is foregrounded.
  func application(
    _ application: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
  ) {
    completionHandler()
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
