import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type { ColorValue, HostComponent, ViewProps } from 'react-native';
import type {
  Float,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';

/**
 * Fabric codegen spec for a native SF Symbol view (iOS only). Renders an
 * `UIImage(systemName:)` in a UIImageView so the audio transport controls use
 * real Apple SF Symbols instead of the Material Design glyph font.
 *
 * Lives in the same `TorahWebSpecs` codegen group as the Liquid Glass view and
 * is registered in package.json's `codegenConfig.ios.componentProvider`. On
 * Android the JS wrapper falls back to the Material icon, so this component is
 * never instantiated there.
 */
interface NativeProps extends ViewProps {
  symbolName?: WithDefault<string, ''>;
  pointSize?: Float;
  weight?: WithDefault<string, 'regular'>;
  tintColor?: ColorValue | null;
}

export default codegenNativeComponent<NativeProps>(
  'TorahWebSFSymbolView',
) as HostComponent<NativeProps>;
