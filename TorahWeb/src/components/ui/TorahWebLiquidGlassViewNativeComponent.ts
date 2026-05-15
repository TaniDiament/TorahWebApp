import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type { ColorValue, HostComponent, ViewProps } from 'react-native';
import type {
  Float,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';

/**
 * Fabric codegen spec for the native Liquid Glass view.
 *
 * `codegenNativeComponent` is a drop-in replacement for the legacy
 * `requireNativeComponent` — under the New Architecture it produces a
 * proper Fabric host component; under the legacy bridge (or until the
 * codegen step runs against this spec) it falls back to the
 * `requireNativeComponent` path, which the existing UIKit view manager
 * already supports.
 *
 * Codegen requires the specific `Int32` / `Float` / `Double` aliases for
 * numeric props (plain `number` is rejected at build time) and turns the
 * `ColorValue` into the right native color type on each platform.
 */
interface NativeProps extends ViewProps {
  variant?: WithDefault<string, 'regular'>;
  glassTintColor?: ColorValue | null;
  cornerRadius?: Float;
  isInteractive?: WithDefault<boolean, false>;
}

export default codegenNativeComponent<NativeProps>(
  'TorahWebLiquidGlassView',
) as HostComponent<NativeProps>;
