#ifdef RCT_NEW_ARCH_ENABLED

#import "TorahWebSFSymbolViewComponentView.h"

#import <react/renderer/components/TorahWebSpecs/ComponentDescriptors.h>
#import <react/renderer/components/TorahWebSpecs/EventEmitters.h>
#import <react/renderer/components/TorahWebSpecs/Props.h>
#import <react/renderer/components/TorahWebSpecs/RCTComponentViewHelpers.h>

#import <React/RCTConversions.h>

using namespace facebook::react;

// Pure Obj-C++ — no Swift, so there's no generated `-Swift.h` umbrella header
// to import (the part that needed the static-vs-framework guard for the
// Liquid Glass view). SF Symbols ship in UIKit, so a plain UIImageView is all
// that's required.
static UIImageSymbolWeight TorahWebSymbolWeightFromString(const std::string &weight)
{
  if (weight == "ultraLight") return UIImageSymbolWeightUltraLight;
  if (weight == "thin") return UIImageSymbolWeightThin;
  if (weight == "light") return UIImageSymbolWeightLight;
  if (weight == "medium") return UIImageSymbolWeightMedium;
  if (weight == "semibold") return UIImageSymbolWeightSemibold;
  if (weight == "bold") return UIImageSymbolWeightBold;
  if (weight == "heavy") return UIImageSymbolWeightHeavy;
  if (weight == "black") return UIImageSymbolWeightBlack;
  return UIImageSymbolWeightRegular;
}

@interface TorahWebSFSymbolViewComponentView () <RCTTorahWebSFSymbolViewViewProtocol>
@end

@implementation TorahWebSFSymbolViewComponentView {
  UIImageView *_imageView;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<TorahWebSFSymbolViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const TorahWebSFSymbolViewProps>();
    _props = defaultProps;

    _imageView = [[UIImageView alloc] init];
    _imageView.frame = self.bounds;
    _imageView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    _imageView.contentMode = UIViewContentModeScaleAspectFit;
    // Template rendering lets `tintColor` recolor the glyph (SF Symbols are
    // monochrome templates here, matching the Material icons they replace).
    _imageView.tintColor = UIColor.labelColor;

    self.contentView = _imageView;
  }
  return self;
}

- (void)applySymbolFromProps:(const TorahWebSFSymbolViewProps &)props
{
  if (props.symbolName.empty()) {
    _imageView.image = nil;
    return;
  }
  NSString *name = [NSString stringWithUTF8String:props.symbolName.c_str()];
  CGFloat pointSize = props.pointSize > 0 ? (CGFloat)props.pointSize : 17.0;
  UIImageSymbolConfiguration *config =
      [UIImageSymbolConfiguration configurationWithPointSize:pointSize
                                                      weight:TorahWebSymbolWeightFromString(props.weight)];
  UIImage *image = [UIImage systemImageNamed:name withConfiguration:config];
  _imageView.image = [image imageWithRenderingMode:UIImageRenderingModeAlwaysTemplate];
}

- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
  const auto &oldViewProps = *std::static_pointer_cast<const TorahWebSFSymbolViewProps>(_props);
  const auto &newViewProps = *std::static_pointer_cast<const TorahWebSFSymbolViewProps>(props);

  if (oldViewProps.symbolName != newViewProps.symbolName ||
      oldViewProps.pointSize != newViewProps.pointSize ||
      oldViewProps.weight != newViewProps.weight) {
    [self applySymbolFromProps:newViewProps];
  }

  if (oldViewProps.tintColor != newViewProps.tintColor) {
    UIColor *tint = RCTUIColorFromSharedColor(newViewProps.tintColor);
    if (tint) {
      _imageView.tintColor = tint;
    }
  }

  [super updateProps:props oldProps:oldProps];
}

@end

// Exposed factory so the codegen registry can link this component into the
// Fabric renderer (matches the TorahWebLiquidGlassView pattern).
Class<RCTComponentViewProtocol> TorahWebSFSymbolViewCls(void)
{
  return TorahWebSFSymbolViewComponentView.class;
}

#endif
