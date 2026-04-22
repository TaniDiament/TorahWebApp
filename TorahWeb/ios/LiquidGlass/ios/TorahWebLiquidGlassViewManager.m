#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE (TorahWebLiquidGlassViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(variant, NSString)
RCT_EXPORT_VIEW_PROPERTY(glassTintColor, UIColor)
RCT_EXPORT_VIEW_PROPERTY(cornerRadius, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(isInteractive, BOOL)

@end