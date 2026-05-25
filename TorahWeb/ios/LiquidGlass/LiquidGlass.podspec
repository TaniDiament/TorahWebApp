Pod::Spec.new do |s|
  s.name             = 'LiquidGlass'
  s.version          = '1.0.0'
  s.summary          = 'iOS 26 Liquid Glass Fabric component for TorahWeb.'
  s.description      = 'SwiftUI-backed Liquid Glass surface bridged to React Native via a Fabric component view. Falls back to SwiftUI Material on iOS 15-25.'
  s.homepage         = 'https://github.com/yydiamen/TorahWebApp'
  s.license          = { :type => 'MIT' }
  s.author           = { 'TorahWeb' => 'tanidiament@gmail.com' }
  s.source           = { :path => '.' }
  s.platforms        = { :ios => '15.1' }
  s.source_files     = 'ios/**/*.{swift,h,m,mm}'
  s.swift_version    = '5.9'

  # DEFINES_MODULE is required so the Obj-C++ Fabric component can import the
  # generated `<LiquidGlass/LiquidGlass-Swift.h>` umbrella header that exposes
  # TorahWebLiquidGlassView (Swift) to .mm callers.
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
  }

  # Pulls in React-Core plus all the Fabric / TurboModule dependencies the
  # codegen-generated headers expect. Equivalent to the React Native CLI's
  # default per-pod dependency block.
  install_modules_dependencies(s)
end
