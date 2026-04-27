// ObjC bridge that exposes the Swift `TorahSearch` class to React Native.
// The Swift implementation lives in TorahSearch.swift; this file only
// declares the JS-callable surface.

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(TorahSearch, NSObject)

RCT_EXTERN_METHOD(open:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(query:(NSString *)query
                  limit:(nonnull NSNumber *)limit
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(close:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)

@end
