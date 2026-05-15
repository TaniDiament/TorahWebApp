import UIKit

@objc public class TorahWebLiquidGlassView: UIView {
  // Persistent visual hierarchy — created once, mutated in place.
  private let backdropView = UIVisualEffectView()
  private let highlightLayer = CAGradientLayer()
  private let borderLayer = CAGradientLayer()
  private let borderMask = CAShapeLayer()
  private let highlightMask = CAShapeLayer()
  private let tintOverlay = UIView()
  private let solidFallback = UIView()

  private var reduceTransparencyObserver: NSObjectProtocol?

  @objc public var variant: NSString = "regular" {
    didSet { applyEffect() }
  }

  @objc public var glassTintColor: UIColor? {
    didSet { applyTint() }
  }

  @objc public var cornerRadius: CGFloat = 22 {
    didSet { applyCornerRadius() }
  }

  @objc public var isInteractive: Bool = false {
    didSet { applyEffect() }
  }

  public override init(frame: CGRect) {
    super.init(frame: frame)
    commonInit()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    commonInit()
  }

  deinit {
    if let token = reduceTransparencyObserver {
      NotificationCenter.default.removeObserver(token)
    }
  }

  private func commonInit() {
    backgroundColor = .clear
    clipsToBounds = true

    // Solid fallback (hidden unless Reduce Transparency is active).
    solidFallback.translatesAutoresizingMaskIntoConstraints = false
    solidFallback.isUserInteractionEnabled = false
    solidFallback.isHidden = true
    addSubview(solidFallback)
    NSLayoutConstraint.activate([
      solidFallback.topAnchor.constraint(equalTo: topAnchor),
      solidFallback.bottomAnchor.constraint(equalTo: bottomAnchor),
      solidFallback.leadingAnchor.constraint(equalTo: leadingAnchor),
      solidFallback.trailingAnchor.constraint(equalTo: trailingAnchor),
    ])

    // Visual-effect backdrop.
    backdropView.translatesAutoresizingMaskIntoConstraints = false
    backdropView.isUserInteractionEnabled = false
    addSubview(backdropView)
    sendSubviewToBack(backdropView)
    NSLayoutConstraint.activate([
      backdropView.topAnchor.constraint(equalTo: topAnchor),
      backdropView.bottomAnchor.constraint(equalTo: bottomAnchor),
      backdropView.leadingAnchor.constraint(equalTo: leadingAnchor),
      backdropView.trailingAnchor.constraint(equalTo: trailingAnchor),
    ])

    // Tint overlay lives once inside the backdrop's contentView.
    tintOverlay.translatesAutoresizingMaskIntoConstraints = false
    tintOverlay.isUserInteractionEnabled = false
    tintOverlay.isHidden = true
    backdropView.contentView.addSubview(tintOverlay)
    NSLayoutConstraint.activate([
      tintOverlay.topAnchor.constraint(equalTo: backdropView.contentView.topAnchor),
      tintOverlay.bottomAnchor.constraint(equalTo: backdropView.contentView.bottomAnchor),
      tintOverlay.leadingAnchor.constraint(equalTo: backdropView.contentView.leadingAnchor),
      tintOverlay.trailingAnchor.constraint(equalTo: backdropView.contentView.trailingAnchor),
    ])

    // Persistent specular highlight + border gradient layers.
    highlightLayer.startPoint = CGPoint(x: 0.5, y: 0.0)
    highlightLayer.endPoint = CGPoint(x: 0.5, y: 0.55)
    highlightLayer.colors = [
      UIColor(white: 1, alpha: 0.45).cgColor,
      UIColor(white: 1, alpha: 0.0).cgColor,
    ]
    highlightLayer.mask = highlightMask
    layer.addSublayer(highlightLayer)

    borderMask.fillColor = UIColor.clear.cgColor
    borderMask.strokeColor = UIColor.black.cgColor
    borderMask.lineWidth = 1
    borderLayer.startPoint = CGPoint(x: 0, y: 0)
    borderLayer.endPoint = CGPoint(x: 1, y: 1)
    borderLayer.mask = borderMask
    layer.addSublayer(borderLayer)

    // Listen for Reduce-Transparency toggles so we can swap to the solid
    // fallback without a re-mount.
    reduceTransparencyObserver = NotificationCenter.default.addObserver(
      forName: UIAccessibility.reduceTransparencyStatusDidChangeNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.applyEffect()
    }

    applyEffect()
    applyTint()
    applyCornerRadius()
  }

  // MARK: - Effect

  private func applyEffect() {
    let reduceTransparency = UIAccessibility.isReduceTransparencyEnabled

    if reduceTransparency {
      backdropView.isHidden = true
      tintOverlay.isHidden = true
      highlightLayer.isHidden = true
      borderLayer.isHidden = true
      solidFallback.isHidden = false
      solidFallback.backgroundColor = reducedTransparencyFill()
      return
    }

    solidFallback.isHidden = true
    backdropView.isHidden = false
    highlightLayer.isHidden = false
    backdropView.effect = makeGlassEffect()
    applyTint()
    applyBorderForVariant()
    highlightLayer.opacity = (variant as String) == "clear" ? 0.55 : 0.85
    borderLayer.opacity = isInteractive ? 1.0 : 0.85
  }

  private func makeGlassEffect() -> UIVisualEffect {
    // iOS 26+ gets the actual Liquid Glass material. To build this branch
    // you need Xcode with the iOS 26 SDK; if your toolchain is older, comment
    // the `if #available` block out and the legacy UIBlurEffect path below
    // will be used unconditionally.
    if #available(iOS 26.0, *) {
      let style: UIGlassEffect.Style = (variant as String) == "clear" ? .clear : .regular
      let effect = UIGlassEffect(style: style)
      if let tint = glassTintColor {
        effect.tintColor = tint
      }
      effect.isInteractive = isInteractive
      return effect
    }

    // Legacy fallback: system-adaptive UIBlurEffect (handles light/dark).
    let style: UIBlurEffect.Style
    switch variant as String {
    case "clear":
      style = .systemUltraThinMaterial
    case "tinted":
      style = .systemThinMaterial
    case "prominent":
      style = .systemMaterial
    default:
      style = .systemThinMaterial
    }
    return UIBlurEffect(style: style)
  }

  private func reducedTransparencyFill() -> UIColor {
    if let tint = glassTintColor {
      return tint.withAlphaComponent(1)
    }
    if traitCollection.userInterfaceStyle == .dark {
      return UIColor(white: 0.12, alpha: 1)
    }
    return UIColor(white: 0.96, alpha: 1)
  }

  // MARK: - Tint

  private func applyTint() {
    guard !UIAccessibility.isReduceTransparencyEnabled else {
      solidFallback.backgroundColor = reducedTransparencyFill()
      return
    }
    // UIGlassEffect carries its own tint; the overlay would double-tint.
    if #available(iOS 26.0, *), backdropView.effect is UIGlassEffect {
      tintOverlay.isHidden = true
      return
    }
    guard let tint = glassTintColor else {
      tintOverlay.isHidden = true
      return
    }
    let inputAlpha = tint.cgColor.alpha
    let alpha: CGFloat = inputAlpha > 0 ? min(0.55, inputAlpha) : 0.22
    tintOverlay.backgroundColor = tint.withAlphaComponent(alpha)
    tintOverlay.isHidden = false
  }

  // MARK: - Border

  private func applyBorderForVariant() {
    switch variant as String {
    case "clear":
      // `clear` is meant to be edgeless.
      borderLayer.isHidden = true
    case "tinted":
      borderLayer.isHidden = false
      if let tint = glassTintColor {
        borderLayer.colors = [
          tint.withAlphaComponent(0.75).cgColor,
          tint.withAlphaComponent(0.20).cgColor,
          tint.withAlphaComponent(0.55).cgColor,
        ]
      } else {
        borderLayer.colors = whiteBorderColors()
      }
    default:
      borderLayer.isHidden = false
      borderLayer.colors = whiteBorderColors()
    }
  }

  private func whiteBorderColors() -> [CGColor] {
    [
      UIColor(white: 1, alpha: 0.85).cgColor,
      UIColor(white: 1, alpha: 0.18).cgColor,
      UIColor(white: 1, alpha: 0.55).cgColor,
    ]
  }

  // MARK: - Corner radius

  private func applyCornerRadius() {
    layer.cornerRadius = cornerRadius
    layer.cornerCurve = .continuous
    backdropView.layer.cornerRadius = cornerRadius
    backdropView.layer.cornerCurve = .continuous
    backdropView.clipsToBounds = true
    solidFallback.layer.cornerRadius = cornerRadius
    solidFallback.layer.cornerCurve = .continuous
    setNeedsLayout()
  }

  public override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)
    if UIAccessibility.isReduceTransparencyEnabled {
      solidFallback.backgroundColor = reducedTransparencyFill()
    }
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    // Avoid implicit animations on the bordering layers during a resize.
    CATransaction.begin()
    CATransaction.setDisableActions(true)

    let inset: CGFloat = 0.5
    let borderRect = bounds.insetBy(dx: inset, dy: inset)
    borderMask.path = UIBezierPath(
      roundedRect: borderRect,
      cornerRadius: max(0, cornerRadius - inset)
    ).cgPath
    borderMask.frame = bounds
    borderLayer.frame = bounds

    highlightLayer.frame = bounds
    highlightMask.path = UIBezierPath(
      roundedRect: bounds,
      cornerRadius: cornerRadius
    ).cgPath
    highlightMask.frame = bounds

    CATransaction.commit()
  }
}
