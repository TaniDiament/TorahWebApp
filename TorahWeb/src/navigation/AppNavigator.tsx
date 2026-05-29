import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import type { LinkingOptions, NavigationState, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import type { NativeBottomTabIcon } from '@react-navigation/bottom-tabs/unstable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static';
import HomeScreen from '../screens/HomeScreen';
import MenuScreen from '../screens/MenuScreen';
import SearchScreen from '../screens/SearchScreen';
import ContentScreen from '../screens/ContentScreen';
import DownloadsScreen from '../screens/DownloadsScreen';
import { radii, spacing, useTheme } from '../theme';
import { GlassButton } from '../components/ui/Glass';
import Icon from '../components/ui/Icon';
import type {
  HomeStackParamList,
  LibraryStackParamList,
  NewStackParamList,
  RootTabParamList,
  SearchStackParamList,
} from './types';

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const NewStack = createNativeStackNavigator<NewStackParamList>();
const SearchStack = createNativeStackNavigator<SearchStackParamList>();
const LibraryStack = createNativeStackNavigator<LibraryStackParamList>();
// Native bottom tabs render through UITabBarController on iOS (which adopts
// the iOS 26 Liquid Glass tab bar — including the morphing selection and
// drag-across-to-select — automatically when the app is built with Xcode 26)
// and a Material BottomNavigationView on Android. Provided by
// react-native-screens; no extra dependency required.
const Tabs = createNativeBottomTabNavigator<RootTabParamList>();

// Each tab keeps its own navigation history so switching tabs preserves
// drill-down state — same model as the previous hand-rolled
// Record<Tab, Screen[]>. Native-stack gives us slide transitions and the
// iOS edge-swipe-back gesture for free.
const HomeTabStack = () => (
  <HomeStack.Navigator screenOptions={{ headerShown: false }}>
    <HomeStack.Screen name="Home" component={HomeScreen} />
    <HomeStack.Screen name="Menu" component={MenuScreen} />
    <HomeStack.Screen name="Search" component={SearchScreen} />
    <HomeStack.Screen name="Content" component={ContentScreen} />
  </HomeStack.Navigator>
);

const SearchTabStack = () => (
  <SearchStack.Navigator screenOptions={{ headerShown: false }}>
    <SearchStack.Screen name="SearchRoot" component={SearchScreen} />
    <SearchStack.Screen name="Content" component={ContentScreen} />
  </SearchStack.Navigator>
);

// Recently Added feed: SearchScreen seeded with showAll renders every item
// sorted newest-first (same path as Home's "See All → Newest").
const NewTabStack = () => (
  <NewStack.Navigator screenOptions={{ headerShown: false }}>
    <NewStack.Screen
      name="NewRoot"
      component={SearchScreen}
      initialParams={{ showAll: true, title: 'Recently Added' }}
    />
    <NewStack.Screen name="Content" component={ContentScreen} />
  </NewStack.Navigator>
);

const LibraryTabStack = () => (
  <LibraryStack.Navigator screenOptions={{ headerShown: false }}>
    <LibraryStack.Screen name="Library" component={DownloadsScreen} />
    <LibraryStack.Screen name="Content" component={ContentScreen} />
  </LibraryStack.Navigator>
);

type SFSymbolName = Extract<NativeBottomTabIcon, { type: 'sfSymbol' }>['name'];
type MDIGlyph = Parameters<typeof MaterialDesignIcons.getImageSourceSync>[0];

// iOS renders SF Symbols, which the iOS 26 tab bar turns into Liquid Glass
// controls. Android's Material tab bar takes raster images, so we rasterize a
// Material Design glyph from the icon font once (Material applies the active
// tint itself). The glyph names mirror Icon.tsx's SF-Symbol → MDI mapping.
const makeTabIcon = (
  sfSymbol: SFSymbolName,
  mdiGlyph: MDIGlyph,
  tint: string,
): NativeBottomTabIcon =>
  Platform.OS === 'ios'
    ? { type: 'sfSymbol', name: sfSymbol }
    : {
        type: 'image',
        source: MaterialDesignIcons.getImageSourceSync(mdiGlyph, 24, tint),
      };

// Tapping an already-active tab returns to its root screen — match the
// previous behavior where pressing the highlighted tab popped the stack.
const getRootScreen = (tabName: string): string => {
  switch (tabName) {
    case 'HomeTab':
      return 'Home';
    case 'NewTab':
      return 'NewRoot';
    case 'SearchTab':
      return 'SearchRoot';
    case 'LibraryTab':
      return 'Library';
    default:
      return 'Home';
  }
};

// Renders the floating glass back chevron when the active tab's stack has
// pushed at least one route. Lives as a sibling of the navigator so its
// position is unaffected by per-screen layout — matches the previous
// AppShell's overlay model. Because it sits outside any navigator, it
// can't use useNavigationState/useNavigation; state is lifted from
// NavigationContainer's onStateChange and the container ref drives goBack.
type FloatingBackOverlayProps = {
  visible: boolean;
  onPress: () => void;
};
const FloatingBackOverlay: React.FC<FloatingBackOverlayProps> = ({ visible, onPress }) => {
  const insets = useSafeAreaInsets();
  const c = useTheme();
  if (!visible) return null;
  return (
    <View
      style={[styles.floatingBackWrap, { top: insets.top }]}
      pointerEvents="box-none">
      <GlassButton
        style={styles.floatingBack}
        contentStyle={styles.floatingBackInner}
        cornerRadius={radii.pill}
        variant="regular"
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        onPress={onPress}>
        <Icon name="chevron.left" size={22} color={c.text} />
      </GlassButton>
    </View>
  );
};

const computeCanGoBack = (state: NavigationState | undefined): boolean => {
  if (!state) return false;
  const focusedTab = state.routes[state.index];
  const nested = focusedTab.state;
  return nested ? (nested.index ?? 0) > 0 : false;
};

const linking: LinkingOptions<RootTabParamList> = {
  prefixes: ['torahweb://', 'https://torahweb.org', 'https://www.torahweb.org'],
  config: {
    screens: {
      HomeTab: {
        // A shared Content URL drops the user into the Home tab's stack so
        // tapping back returns Home (most intuitive landing). The first
        // segment is the kind ("article" | "video" | "audio") so we can
        // route to the right provider call without inspecting the id.
        screens: {
          Home: '',
          Search: 'search',
          Content: 'content/:contentKind/:contentId',
        },
      },
      NewTab: {
        screens: { NewRoot: 'tabs/new' },
      },
      SearchTab: {
        screens: { SearchRoot: 'tabs/search' },
      },
      LibraryTab: {
        screens: { Library: 'tabs/library' },
      },
    },
  },
};

const AppNavigator: React.FC = () => {
  const navigationRef = useNavigationContainerRef();
  const [canGoBack, setCanGoBack] = React.useState(false);
  const c = useTheme();
  const scheme = useColorScheme();
  // React Navigation draws the native tab bar background, screen backgrounds,
  // and default tints from the NavigationContainer theme — not our palette.
  // Without this prop it falls back to the built-in light DefaultTheme, so the
  // tab bar (colors.card) stays white in dark mode. Follow the OS scheme and
  // map our palette onto the navigation theme so they switch together.
  const navTheme = React.useMemo<Theme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: c.accent,
        background: c.background,
        card: c.surface,
        text: c.text,
        border: c.border,
        notification: c.destructive,
      },
    };
  }, [scheme, c]);
  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      linking={linking}
      onStateChange={(state) => setCanGoBack(computeCanGoBack(state))}>
      <View style={styles.root}>
        <Tabs.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: c.accent,
            // Let iOS render its native Liquid Glass tab bar. React Navigation
            // otherwise defaults tabBarBlurEffect to a concrete systemMaterial
            // blur, which makes react-native-screens set an explicit
            // UIBlurEffect backgroundEffect and *overrides* the iOS 26 Liquid
            // Glass material. 'systemDefault' tells RNS to leave the appearance
            // alone so the system glass (translucent, auto dark/light via the
            // navigation theme's `dark` flag) shows through. No-op on Android.
            tabBarBlurEffect: 'systemDefault',
            // Always show the label under every tab's icon (Android's Material
            // bottom-nav otherwise hides labels for unselected tabs once there
            // are 4+ items; iOS shows them all regardless).
            tabBarLabelVisibilityMode: 'labeled',
          }}
          screenListeners={({ navigation, route }) => ({
            // Re-pressing the active tab returns it to its root screen. The
            // native tab bar emits `tabPress`; on a switch the pressed route
            // differs from the focused one, so this is a no-op and the default
            // switch happens.
            tabPress: () => {
              const tabState = navigation.getState();
              const focused = tabState.routes[tabState.index]?.name === route.name;
              if (!focused) return;
              (navigation.navigate as (
                name: string,
                params?: { screen: string },
              ) => void)(route.name, { screen: getRootScreen(route.name) });
            },
          })}>
          <Tabs.Screen
            name="HomeTab"
            component={HomeTabStack}
            options={{
              tabBarLabel: 'Home',
              tabBarIcon: makeTabIcon('house.fill', 'home', c.accent),
            }}
          />
          <Tabs.Screen
            name="NewTab"
            component={NewTabStack}
            options={{
              tabBarLabel: 'New',
              tabBarIcon: makeTabIcon('square.grid.2x2.fill', 'view-grid', c.accent),
            }}
          />
          <Tabs.Screen
            name="LibraryTab"
            component={LibraryTabStack}
            options={{
              tabBarLabel: 'Library',
              tabBarIcon: makeTabIcon('rectangle.stack.fill', 'file-multiple', c.accent),
            }}
          />
          <Tabs.Screen
            name="SearchTab"
            component={SearchTabStack}
            options={{
              tabBarLabel: 'Search',
              tabBarIcon: makeTabIcon('magnifyingglass', 'magnify', c.accent),
            }}
          />
        </Tabs.Navigator>
        <FloatingBackOverlay
          visible={canGoBack}
          onPress={() => navigationRef.current?.goBack()}
        />
      </View>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  floatingBackWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 50,
  },
  floatingBack: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    zIndex: 2,
    elevation: 4,
  },
  floatingBackInner: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppNavigator;
