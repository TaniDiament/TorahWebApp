import Foundation
import React

@objc(TorahWebLiquidGlassViewManager)
class TorahWebLiquidGlassViewManager: RCTViewManager {
  override func view() -> UIView! {
    return TorahWebLiquidGlassView()
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}