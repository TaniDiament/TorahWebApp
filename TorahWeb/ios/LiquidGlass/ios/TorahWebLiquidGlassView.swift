import UIKit
import SwiftUI

// UIView wrapper around a SwiftUI Liquid Glass surface. The Fabric component
// view holds an instance of this class and forwards prop updates; this class
// owns the UIHostingController and re-renders the SwiftUI tree whenever a
// prop mutates.
//
// Build requirement: Xcode 26+ (iOS 26 SDK). The runtime gracefully degrades
// to SwiftUI Material on iOS 15-25 inside `LiquidGlassSwiftUIView`.
@objc public final class TorahWebLiquidGlassView: UIView {
  @objc public var variant: NSString = "regular" {
    didSet { applyRootView() }
  }

  @objc public var glassTintColor: UIColor? {
    didSet { applyRootView() }
  }

  @objc public var cornerRadius: CGFloat = 22 {
    didSet { applyRootView() }
  }

  @objc public var isInteractive: Bool = false {
    didSet { applyRootView() }
  }

  private let hostingController: UIHostingController<LiquidGlassSwiftUIView>

  public override init(frame: CGRect) {
    self.hostingController = UIHostingController(
      rootView: LiquidGlassSwiftUIView(
        variant: "regular",
        tintColor: nil,
        cornerRadius: 22,
        isInteractive: false
      )
    )
    super.init(frame: frame)
    commonInit()
  }

  required init?(coder: NSCoder) {
    self.hostingController = UIHostingController(
      rootView: LiquidGlassSwiftUIView(
        variant: "regular",
        tintColor: nil,
        cornerRadius: 22,
        isInteractive: false
      )
    )
    super.init(coder: coder)
    commonInit()
  }

  private func commonInit() {
    backgroundColor = .clear
    clipsToBounds = true

    // SwiftUI's hosting view must be transparent so the glass material reads
    // against whatever sits behind the RN parent. UIHostingController defaults
    // to a system background colour on iOS 13+.
    hostingController.view.backgroundColor = .clear
    hostingController.view.translatesAutoresizingMaskIntoConstraints = false
    addSubview(hostingController.view)
    NSLayoutConstraint.activate([
      hostingController.view.topAnchor.constraint(equalTo: topAnchor),
      hostingController.view.bottomAnchor.constraint(equalTo: bottomAnchor),
      hostingController.view.leadingAnchor.constraint(equalTo: leadingAnchor),
      hostingController.view.trailingAnchor.constraint(equalTo: trailingAnchor),
    ])
  }

  private func applyRootView() {
    hostingController.rootView = LiquidGlassSwiftUIView(
      variant: variant as String,
      tintColor: glassTintColor,
      cornerRadius: cornerRadius,
      isInteractive: isInteractive
    )
  }
}

// MARK: - SwiftUI surface

struct LiquidGlassSwiftUIView: View {
  let variant: String
  let tintColor: UIColor?
  let cornerRadius: CGFloat
  let isInteractive: Bool

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

    if #available(iOS 26.0, *) {
      modernGlass(shape: shape)
    } else {
      legacyMaterial(shape: shape)
    }
  }

  // iOS 26+: the actual Liquid Glass material via SwiftUI's `.glassEffect()`.
  // `.regular` / `.clear` map to the only two first-class Glass styles; tint
  // and interactivity are applied via Glass modifiers so the chain remains
  // strongly typed.
  @available(iOS 26.0, *)
  @ViewBuilder
  private func modernGlass(shape: RoundedRectangle) -> some View {
    var glass: Glass = (variant == "clear") ? .clear : .regular
    if let tint = tintColor {
      glass = glass.tint(Color(tint))
    }
    if isInteractive {
      glass = glass.interactive()
    }

    Color.clear
      .glassEffect(glass, in: shape)
  }

  // iOS 15-25 fallback: SwiftUI's system Material, optionally over-tinted.
  // Reduce Transparency is honoured by the system Materials automatically,
  // so we don't need the manual observer the previous UIKit implementation
  // wired up.
  @ViewBuilder
  private func legacyMaterial(shape: RoundedRectangle) -> some View {
    let material: Material = {
      switch variant {
      case "clear":
        return .ultraThinMaterial
      case "tinted":
        return .thinMaterial
      case "prominent":
        return .regularMaterial
      default:
        return .thinMaterial
      }
    }()

    ZStack {
      shape.fill(material)
      if let tint = tintColor {
        shape.fill(Color(tint).opacity(0.22))
      }
    }
  }
}
