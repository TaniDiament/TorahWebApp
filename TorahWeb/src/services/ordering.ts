import { Author, Content } from '../types';

/**
 * Surname used for alphabetizing the author directory. Names are
 * "Rabbi [Dr.] First [M.] Last" (e.g. "Rabbi Dr. Abraham J. Twerski"), so the
 * surname is the final whitespace-delimited token — honorifics and middle
 * initials all precede it and can be ignored for ordering.
 */
export const authorLastName = (name: string): string =>
  name.trim().split(/\s+/).pop()?.toLowerCase() ?? '';

/** Alphabetical by surname, with the full name as a stable tiebreak. */
export const byAuthorLastName = (a: Author, b: Author): number =>
  authorLastName(a.name).localeCompare(authorLastName(b.name)) ||
  a.name.localeCompare(b.name);

/**
 * Most recently published first. `publishedDate` is `YYYY-MM-DD`, which sorts
 * chronologically as a plain string — comparing the strings directly sidesteps
 * Hermes' limited `Date` parsing and any timezone shifts from `new Date()`.
 */
export const byNewestFirst = (a: Content, b: Content): number =>
  b.publishedDate.localeCompare(a.publishedDate);
