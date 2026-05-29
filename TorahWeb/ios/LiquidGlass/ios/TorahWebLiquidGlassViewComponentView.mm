#ifdef RCT_NEW_ARCH_ENABLED

#import "TorahWebLiquidGlassViewComponentView.h"

#import <react/renderer/components/TorahWebSpecs/ComponentDescriptors.h>
#import <react/renderer/components/TorahWebSpecs/EventEmitters.h>
#import <react/renderer/components/TorahWebSpecs/Props.h>
#import <react/renderer/components/TorahWebSpecs/RCTComponentViewHelpers.h>

#import <React/RCTConversions.h>

// The Swift-generated interface header is imported differently depending on how
// the pod is linked: as a framework (USE_FRAMEWORKS) it's <LiquidGlass/...>; as
// a static library (React Native's default, and what EAS builds) it's the
// quoted form. DEFINES_MODULE = YES in the podspec generates the header either
// way; the __has_include guard picks the path that actually exists.
#if __has_include(<LiquidGlass/LiquidGlass-Swift.h>)
#import <LiquidGlass/LiquidGlass-Swift.h>
#else
#import "LiquidGlass-Swift.h"
#endif

using namespace facebook::react;

@interface TorahWebLiquidGlassViewComponentView () <RCTTorahWebLiquidGlassViewViewProtocol>
@end

@implementation TorahWebLiquidGlassViewComponentView {
  TorahWebLiquidGlassView *_glassView;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<TorahWebLiquidGlassViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const TorahWebLiquidGlassViewProps>();
    _props = defaultProps;

    _glassView = [[TorahWebLiquidGlassView alloc] init];
    _glassView.frame = self.bounds;
    _glassView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;

    self.contentView = _glassView;
  }
  return self;
}

- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
  const auto &oldViewProps = *std::static_pointer_cast<const TorahWebLiquidGlassViewProps>(_props);
  const auto &newViewProps = *std::static_pointer_cast<const TorahWebLiquidGlassViewProps>(props);

  if (oldViewProps.variant != newViewProps.variant) {
    _glassView.variant = [NSString stringWithUTF8String:newViewProps.variant.c_str()];
  }

  if (oldViewProps.cornerRadius != newViewProps.cornerRadius) {
    _glassView.cornerRadius = (CGFloat)newViewProps.cornerRadius;
  }

  if (oldViewProps.isInteractive != newViewProps.isInteractive) {
    _glassView.isInteractive = newViewProps.isInteractive;
  }

  if (oldViewProps.glassTintColor != newViewProps.glassTintColor) {
    _glassView.glassTintColor = RCTUIColorFromSharedColor(newViewProps.glassTintColor);
  }

  [super updateProps:props oldProps:oldProps];
}

@end

// Exposed factory so the codegen registry can link this component into the
// Fabric renderer without needing the symbol stripped at link-time.
Class<RCTComponentViewProtocol> TorahWebLiquidGlassViewCls(void)
{
  return TorahWebLiquidGlassViewComponentView.class;
}

#endif
