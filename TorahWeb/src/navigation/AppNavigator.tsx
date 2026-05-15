import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  NavigationContainer,
  useNavigation,
  useNavigationState,
} from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import ContentScreen from '../screens/ContentScreen';
import DownloadsScreen from '../screens/DownloadsScreen';
import { colors, radii, spacing, typography } from '../theme';
import { GlassButton, GlassSurface } from '../components/ui/Glass';
import Icon, { type IconName } from '../components/ui/Icon';
import type {
  HomeStackParamList,
  LibraryStackParamList,
  RootTabParamList,
  SearchStackParamList,
} from './types';

const TAB_BAR_HEIGHT = 64;
const TAB_BAR_BOTTOM_OFFSET = 14;

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const SearchStack = createNativeStackNavigator<SearchStackParamList>();
const LibraryStack = createNativeStackNavigator<LibraryStackParamList>();
const Tabs = createBottomTabNavigator<RootTabParamList>();

// Each tab keeps its own navigation history so switching tabs preserves
// drill-down state — same model as the previous hand-rolled
// Record<Tab, Screen[]>. Native-stack gives us slide transitions and the
// iOS edge-swipe-back gesture for free.
const HomeTabStack = () => (
  <HomeStack.Navigator screenOptions={{ headerShown: false }}>
    <HomeStack.Screen name="Home" component={HomeScreen} />
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

const LibraryTabStack = () => (
  <LibraryStack.Navigator screenOptions={{ headerShown: false }}>
    <LibraryStack.Screen name="Library" component={DownloadsScreen} />
    <LibraryStack.Screen name="Content" component={ContentScreen} />
  </LibraryStack.Navigator>
);

// Custom tab bar reuses the glass-pill design from the previous AppShell.
// We render via the `tabBar` prop so we keep visual parity (rounded pill,
// floating above the content) while the navigator owns route state.
const GlassTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.tabBarWrap,
        { bottom: TAB_BAR_BOTTOM_OFFSET + Math.max(insets.bottom, 8) },
      ]}>
      <GlassSurface
        variant="prominent"
        cornerRadius={radii.pill}
        style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;
          const icon = (options.tabBarAccessibilityLabel ?? route.name) as string;
          const iconName = TAB_ICONS[route.name as keyof RootTabParamList];
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (focused && !event.defaultPrevented) {
              // Tapping the active tab in iOS-style: pop to the tab's root.
              // The nested-navigate typing here is intentionally loose —
              // the navigator's per-tab stacks have different param shapes
              // so a strictly-typed call would need a per-tab branch.
              (navigation.navigate as (
                name: string,
                params?: { screen: string },
              ) => void)(route.name, { screen: getRootScreen(route.name) });
              return;
            }
            if (!event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityLabel={icon}
              accessibilityState={{ selected: focused }}
              android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true }}
              style={({ pressed }) => [
                styles.tabItem,
                pressed && { opacity: Platform.OS === 'ios' ? 0.7 : 1 },
              ]}>
              <Icon
                name={iconName}
                size={22}
                color={focused ? colors.navy : colors.textTertiary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: focused ? colors.navy : colors.textTertiary },
                ]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </GlassSurface>
    </View>
  );
};

const TAB_ICONS: Record<keyof RootTabParamList, IconName> = {
  HomeTab: 'house.fill',
  SearchTab: 'magnifyingglass',
  LibraryTab: 'rectangle.stack.fill',
};

const TAB_LABELS: Record<keyof RootTabParamList, string> = {
  HomeTab: 'Home',
  SearchTab: 'Search',
  LibraryTab: 'Library',
};

// Tapping an already-active tab returns to its root screen — match the
// previous behaviour where pressing the highlighted tab popped the stack.
const getRootScreen = (tabName: string): string => {
  switch (tabName) {
    case 'HomeTab':
      return 'Home';
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
// AppShell's overlay model.
const FloatingBackOverlay: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const canGoBack = useNavigationState((state) => {
    if (!state) return false;
    // Drill into the focused tab's nested stack to see its history depth.
    const focusedTab = state.routes[state.index];
    const nested = focusedTab.state;
    return nested ? (nested.index ?? 0) > 0 : false;
  });

  if (!canGoBack) return null;
  return (
    <View
      style={[styles.floatingBackWrap, { top: insets.top + 8 }]}
      pointerEvents="box-none">
      <GlassButton
        style={styles.floatingBack}
        contentStyle={styles.floatingBackInner}
        cornerRadius={radii.pill}
        variant="regular"
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        onPress={() => navigation.goBack()}>
        <View style={styles.backChevron} />
      </GlassButton>
    </View>
  );
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
  return (
    <NavigationContainer linking={linking}>
      <View style={styles.root}>
        <Tabs.Navigator
          screenOptions={{ headerShown: false }}
          tabBar={(props) => <GlassTabBar {...props} />}>
          <Tabs.Screen
            name="HomeTab"
            component={HomeTabStack}
            options={{ tabBarLabel: TAB_LABELS.HomeTab }}
          />
          <Tabs.Screen
            name="SearchTab"
            component={SearchTabStack}
            options={{ tabBarLabel: TAB_LABELS.SearchTab }}
          />
          <Tabs.Screen
            name="LibraryTab"
            component={LibraryTabStack}
            options={{ tabBarLabel: TAB_LABELS.LibraryTab }}
          />
        </Tabs.Navigator>
        <FloatingBackOverlay />
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
  backChevron: {
    // 12×12 square with two adjacent borders rotated -45° reads as a `<`
    // chevron. The translateX puts the visual apex back at centre — the
    // bounding box of a rotated ┌ sits left-of-centre by ~2px otherwise.
    width: 11,
    height: 11,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: colors.text,
    borderTopLeftRadius: 1,
    transform: [{ translateX: 2 }, { rotate: '-45deg' }],
  },
  tabBarWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
  tabBar: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: radii.pill,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  tabLabel: {
    ...typography.caption,
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
});

export default AppNavigator;
