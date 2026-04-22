Pod::Spec.new do |s|
  s.name             = 'LiquidGlass'
  s.version          = '1.0.0'
  s.summary          = 'iOS 26 Liquid Glass native view for TorahWeb (UIGlassEffect with UIBlurEffect fallback).'
  s.description      = 'Bridges UIKit Liquid Glass (iOS 26+) to React Native, falling back to ultra-thin material blur on older iOS.'
  s.homepage         = 'https://github.com/yydiamen/TorahWebApp'
  s.license          = { :type => 'MIT' }
  s.author           = { 'TorahWeb' => 'tanidiament@gmail.com' }
  s.source           = { :git => '' }
  s.platforms        = { :ios => '15.1' }
  s.source_files     = 'ios/**/*.{swift,h,m,mm}'
  s.swift_version    = '5.0'
  s.dependency 'React-Core'
end
