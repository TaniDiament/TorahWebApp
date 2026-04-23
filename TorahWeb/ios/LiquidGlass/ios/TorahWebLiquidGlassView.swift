import UIKit

@objc public class TorahWebLiquidGlassView: UIView {
  private let backdropView = UIVisualEffectView()
  private let highlightLayer = CAGradientLayer()
  private let borderLayer = CAGradientLayer()
  private let borderMask = CAShapeLayer()

  @objc public var variant: NSString = "regular" {
    didSet { applyEffect() }
  }

  @objc public var glassTintColor: UIColor? {
    didSet { applyEffect() }
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

  private func commonInit() {
    backgroundColor = .clear
    clipsToBounds = true

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

    highlightLayer.colors = [
      UIColor(white: 1, alpha: 0.45).cgColor,
      UIColor(white: 1, alpha: 0.0).cgColor,
    ]
    highlightLayer.startPoint = CGPoint(x: 0.5, y: 0.0)
    highlightLayer.endPoint = CGPoint(x: 0.5, y: 0.55)
    layer.addSublayer(highlightLayer)

    borderLayer.colors = [
      UIColor(white: 1, alpha: 0.85).cgColor,
      UIColor(white: 1, alpha: 0.18).cgColor,
      UIColor(white: 1, alpha: 0.55).cgColor,
    ]
    borderLayer.startPoint = CGPoint(x: 0, y: 0)
    borderLayer.endPoint = CGPoint(x: 1, y: 1)
    borderLayer.mask = borderMask
    borderMask.fillColor = UIColor.clear.cgColor
    borderMask.strokeColor = UIColor.black.cgColor
    borderMask.lineWidth = 1
    layer.addSublayer(borderLayer)

    applyEffect()
    applyCornerRadius()
  }

  private func applyEffect() {
    let effect: UIVisualEffect = makeGlassEffect()
    backdropView.effect = effect

    if let tint = glassTintColor {
      backdropView.contentView.subviews.forEach { $0.removeFromSuperview() }
      let overlay = UIView()
      overlay.translatesAutoresizingMaskIntoConstraints = false
      overlay.backgroundColor = tint.withAlphaComponent(min(0.55, tint.cgColor.alpha == 0 ? 0.18 : 0.22))
      backdropView.contentView.addSubview(overlay)
      NSLayoutConstraint.activate([
        overlay.topAnchor.constraint(equalTo: backdropView.contentView.topAnchor),
        overlay.bottomAnchor.constraint(equalTo: backdropView.contentView.bottomAnchor),
        overlay.leadingAnchor.constraint(equalTo: backdropView.contentView.leadingAnchor),
        overlay.trailingAnchor.constraint(equalTo: backdropView.contentView.trailingAnchor),
      ])
    } else {
      backdropView.contentView.subviews.forEach { $0.removeFromSuperview() }
    }

    highlightLayer.opacity = (variant as String) == "clear" ? 0.55 : 0.85
    borderLayer.opacity = isInteractive ? 1.0 : 0.85
  }

  private func makeGlassEffect() -> UIVisualEffect {
    // UIBlurEffect fallback works from iOS 15.1 through iOS 26+.
    // A native UIGlassEffect integration for iOS 26 can be added once the
    // project can be compiled against the iOS 26 SDK on a Mac.
    let style: UIBlurEffect.Style
    switch variant as String {
    case "clear": style = .systemUltraThinMaterial
    case "tinted": style = .systemThinMaterial
    default: style = .systemThinMaterial
    }
    return UIBlurEffect(style: style)
  }

  private func applyCornerRadius() {
    layer.cornerRadius = cornerRadius
    layer.cornerCurve = .continuous
    backdropView.layer.cornerRadius = cornerRadius
    backdropView.layer.cornerCurve = .continuous
    backdropView.clipsToBounds = true
    setNeedsLayout()
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    let inset: CGFloat = 0.5
    let rect = bounds.insetBy(dx: inset, dy: inset)
    let path = UIBezierPath(roundedRect: rect, cornerRadius: max(0, cornerRadius - inset))
    borderMask.path = path.cgPath
    borderMask.frame = bounds
    borderLayer.frame = bounds

    highlightLayer.frame = CGRect(x: 0, y: 0, width: bounds.width, height: bounds.height)
    let highlightPath = UIBezierPath(roundedRect: bounds, cornerRadius: cornerRadius)
    let highlightMask = CAShapeLayer()
    highlightMask.path = highlightPath.cgPath
    highlightLayer.mask = highlightMask
  }
}
