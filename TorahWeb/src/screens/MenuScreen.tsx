import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { colors, radii, shadows, spacing, typography } from '../theme';
import Icon from '../components/ui/Icon';
import { TORAH_BOOKS, YOMIM_TOVIM, getBook } from '../data/torahStructure';
import type { HomeStackParamList } from '../navigation/types';
import { useScreenChromeInsets } from '../navigation/chromeInsets';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Menu'>;
type MenuRoute = RouteProp<HomeStackParamList, 'Menu'>;

interface Row {
  key: string;
  label: string;
  onPress: () => void;
}

const MenuScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<MenuRoute>();
  const chrome = useScreenChromeInsets();
  const params = route.params;

  const { title, rows } = buildMenu(params, navigation);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: chrome.top, paddingBottom: chrome.bottom },
      ]}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.largeTitle}>{title}</Text>
      <View style={styles.group}>
        {rows.map((row, i) => (
          <MenuRow key={row.key} label={row.label} onPress={row.onPress} last={i === rows.length - 1} />
        ))}
      </View>
    </ScrollView>
  );
};

// Resolve the menu params into a title and the list of tappable rows. Books
// push another Menu (the chumash's parshiyos); leaf parsha / yom tov rows
// navigate to Search filtered by parshaLabel.
function buildMenu(
  params: MenuRoute['params'],
  navigation: Nav,
): { title: string; rows: Row[] } {
  if (params.menu === 'parshaBooks') {
    return {
      title: params.title ?? 'Parsha',
      rows: TORAH_BOOKS.map((book) => ({
        key: book.id,
        label: book.name,
        onPress: () =>
          navigation.push('Menu', {
            menu: 'parshaBook',
            bookId: book.id,
            title: book.name,
          }),
      })),
    };
  }

  if (params.menu === 'parshaBook') {
    const book = getBook(params.bookId);
    return {
      title: params.title ?? book?.name ?? 'Parsha',
      rows: (book?.parshas ?? []).map((label) => ({
        key: label,
        label,
        onPress: () =>
          navigation.navigate('Search', { parshaLabel: label, title: label }),
      })),
    };
  }

  // yomtov
  return {
    title: params.title ?? 'Yomim Tovim',
    rows: YOMIM_TOVIM.map((label) => ({
      key: label,
      label,
      onPress: () =>
        navigation.navigate('Search', { parshaLabel: label, title: label }),
    })),
  };
}

const MenuRow: React.FC<{ label: string; onPress: () => void; last: boolean }> = ({
  label,
  onPress,
  last,
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}
    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Icon name="chevron.right" size={18} color={colors.textTertiary} />
    {last ? null : <View style={styles.separator} />}
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  largeTitle: {
    ...typography.largeTitle,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  rowPressed: {
    backgroundColor: colors.surfaceTint,
  },
  rowLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  separator: {
    position: 'absolute',
    left: spacing.lg,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
});

export default MenuScreen;