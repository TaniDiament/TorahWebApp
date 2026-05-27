// Canonical Torah structure used to build the Parsha / Yom Tov drill-down
// menus, mirroring the navigation on torahweb.org (Parsha → chumash → parsha →
// divrei torah; Yom Tov → list → divrei torah).
//
// The string in each `parshas` / YOMIM_TOVIM entry is the *content* parshaLabel
// exactly as it appears in the backend's content.json — NOT the website's
// book-page spelling. The two transliterations differ in places (website
// "Breishis" / "Lech L'cha" / "Shmini" vs. content "Bereishis" / "Lech Lecha"
// / "Shemini"), and the website also bundles some double-parshiyos that the
// data stores separately (Tazria / Metzora, Vayakhel / Pekudei, Nitzavim /
// Vayelech). We follow the data so a tapped parsha actually resolves to its
// articles via getContentByParsha.

export interface TorahBook {
  id: string;
  /** Display name of the chumash. */
  name: string;
  /** Ordered parsha labels — each matches a content.json `parshaLabel`. */
  parshas: string[];
}

export const TORAH_BOOKS: TorahBook[] = [
  {
    id: 'breishis',
    name: 'Bereishis',
    parshas: [
      'Bereishis',
      'Noach',
      'Lech Lecha',
      'Vayera',
      'Chayei Sarah',
      'Toldos',
      'Vayetze',
      'Vayishlach',
      'Vayeshev',
      'Mikeitz',
      'Vayigash',
      'Vayechi',
    ],
  },
  {
    id: 'shemos',
    name: 'Shemos',
    parshas: [
      'Shemos',
      'Vaera',
      'Bo',
      'Beshalach',
      'Yisro',
      'Mishpatim',
      'Terumah',
      'Tetzaveh',
      'Ki Sisa',
      'Vayakhel',
      'Pekudei',
    ],
  },
  {
    id: 'vayikra',
    name: 'Vayikra',
    parshas: [
      'Vayikra',
      'Tzav',
      'Shemini',
      'Tazria',
      'Metzora',
      'Acharei Mos',
      'Kedoshim',
      'Emor',
      'Behar',
      'Bechukosai',
    ],
  },
  {
    id: 'bamidbar',
    name: 'Bamidbar',
    parshas: [
      'Bamidbar',
      'Naso',
      'Behaaloscha',
      'Shelach',
      'Korach',
      'Chukas',
      'Balak',
      'Pinchas',
      'Matos',
      'Masei',
    ],
  },
  {
    id: 'devarim',
    name: 'Devarim',
    parshas: [
      'Devarim',
      'Vaeschanan',
      'Eikev',
      "Re'eh",
      'Shoftim',
      'Ki Seitzei',
      'Ki Savo',
      'Nitzavim',
      'Vayelech',
      'Haazinu',
      'Vezos Habracha',
    ],
  },
];

// Yom Tov labels in roughly calendar order, each matching a content.json
// `parshaLabel` on a yomtov-tagged item. Includes every yomtov label present
// in the data so nothing is dropped from the menu.
export const YOMIM_TOVIM: string[] = [
  'Elul / Yamim Noraim',
  'Rosh Hashana',
  'Yom Kippur',
  'Sukkos',
  'Shemini Atzeres',
  'Simchas Torah',
  'Rosh Chodesh',
  'Chanukah',
  "Asara B'Teves",
  'Shovavim',
  'The Four Parshios',
  'Purim',
  'Pesach',
  'Sefiras HaOmer',
  'Yom Yerushalayim',
  'Shavuos',
  'The Three Weeks',
];

export const getBook = (id: string): TorahBook | undefined =>
  TORAH_BOOKS.find((b) => b.id === id);