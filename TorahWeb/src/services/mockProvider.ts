import { Article, Audio, Author, Content, SearchParams, Topic, Video } from '../types';
import { ContentProvider } from './provider';

const TW_BASE = 'https://www.torahweb.org';
const portrait = (slug: string) => `${TW_BASE}/img/portraits/480/${slug}-480.jpg`;

export const AUTHORS: Author[] = [
  { id: 'rhab', slug: 'rhab', name: 'Rabbi Yakov Haber', portraitUrl: portrait('rhab') },
  { id: 'rkoe', slug: 'rkoe', name: 'Rabbi Eliakim Koenigsberg', portraitUrl: portrait('rkoe') },
  { id: 'rleb', slug: 'rleb', name: 'Rabbi Aryeh Lebowitz', portraitUrl: portrait('rleb') },
  { id: 'rlop', slug: 'rlop', name: 'Rabbi Ahron Lopiansky', portraitUrl: portrait('rlop') },
  { id: 'rneu', slug: 'rneu', name: 'Rabbi Yaakov Neuburger', portraitUrl: portrait('rneu') },
  { id: 'rros', slug: 'rros', name: 'Rabbi Michael Rosensweig', portraitUrl: portrait('rros') },
  { id: 'rsac', slug: 'rsac', name: 'Rabbi Yonason Sacks', portraitUrl: portrait('rsac') },
  { id: 'rsch', slug: 'rsch', name: 'Rabbi Hershel Schachter', portraitUrl: portrait('rsch') },
  { id: 'rsob', slug: 'rsob', name: 'Rabbi Zvi Sobolofsky', portraitUrl: portrait('rsob') },
  { id: 'rdst', slug: 'rdst', name: 'Rabbi Daniel Stein', portraitUrl: portrait('rdst') },
  { id: 'dtwe', slug: 'dtwe', name: 'Rabbi Dr. Abraham J. Twerski', portraitUrl: portrait('dtwe') },
  { id: 'rtwe', slug: 'rtwe', name: 'Rabbi Mayer Twersky', portraitUrl: portrait('rtwe') },
  { id: 'rwil', slug: 'rwil', name: 'Rabbi Mordechai Willig', portraitUrl: portrait('rwil') },
  { id: 'ryud', slug: 'ryud', name: 'Rabbi Benjamin Yudin', portraitUrl: portrait('ryud') },
];

export const TOPICS: Topic[] = [
  {
    id: 'audiovideo',
    slug: 'audiovideo',
    name: 'Audio/Video',
    description:
      'Covering a wide range of topics to enhance our personal and communal avodas Hashem.',
    thumbnailUrl: `${TW_BASE}/img/home1/course/video.jpg`,
    cta: 'Watch videos',
  },
  {
    id: 'parsha',
    slug: 'parsha',
    name: 'Parsha',
    description:
      'Written divrei Torah on every parsha, written weekly by the rebbeim since Feb. 1999!',
    thumbnailUrl: `${TW_BASE}/img/home1/course/parsha.jpg`,
    cta: 'Take a look',
  },
  {
    id: 'yomtov',
    slug: 'yomtov',
    name: 'Yom Tov',
    description:
      'Written divrei Torah focused on the yomim tovim and other special occasions on the Jewish calendar.',
    thumbnailUrl: `${TW_BASE}/img/home1/course/yomtov.jpg`,
    cta: 'Prepare for yom tov',
  },
  {
    id: 'special',
    slug: 'special',
    name: 'Special Topics',
    description:
      'Writings on the "issues of the day" — guidance on many contemporary religious and social issues.',
    thumbnailUrl: `${TW_BASE}/img/home1/course/special.jpg`,
    cta: 'Live by the Mesorah',
  },
  {
    id: 'thisweek',
    slug: 'thisweek',
    name: 'This Week',
    description: "Hot off the press! This week's written dvar Torah.",
    thumbnailUrl: `${TW_BASE}/img/home1/course/thisweek.jpg`,
    cta: 'Read it now',
  },
];

const byId = (id: string) => AUTHORS.find((a) => a.id === id || a.slug === id);

const topic = (slug: string): Topic => TOPICS.find((t) => t.slug === slug)!;

const RECENT: Article[] = [
  {
    id: 'rneu_metzora_2026',
    title: 'Tahor Only Together',
    parshaLabel: 'Metzora',
    author: byId('rneu')!,
    topics: [topic('parsha')],
    publishedDate: '2026-04-17',
    excerpt:
      'The parsha repetitively refers to the metzora as the "m\'taher" — the one becoming cleansed.',
    content:
      'The parsha repetitively refers to the metzora, once the kohein enters him into the process of communal rehabilitation (14:4), as the "m\'taher — the one becoming cleansed". In place of the expected pronoun or referring to him as a metzora the Torah calls him a m\'taher eleven times...\n\n(Full essay will be served from the TorahWeb database once the backend is ready.)',
  },
  {
    id: 'rsob_shmini_2026',
    title: 'Reaching a Life of Purity',
    parshaLabel: 'Shmini',
    author: byId('rsob')!,
    topics: [topic('parsha')],
    publishedDate: '2026-04-10',
    excerpt:
      'Parshas Shmini introduces the laws of kashrus and their role in creating a life of kedusha.',
    content:
      'Parshas Shmini introduces the laws of kashrus and the path toward becoming a nation of purity...\n\n(Full essay will be served from the TorahWeb database once the backend is ready.)',
  },
  {
    id: 'rkoe_pesach_2026',
    title: 'The Message of Shabbos Hagadol: Be a Leader',
    parshaLabel: 'Pesach',
    author: byId('rkoe')!,
    topics: [topic('yomtov')],
    publishedDate: '2026-04-03',
    excerpt: 'The lessons of Shabbos Hagadol and what they demand of every Jew.',
    content:
      'Shabbos Hagadol marks the moment klal Yisrael stepped forward as a nation of leaders...\n\n(Full essay will be served from the TorahWeb database once the backend is ready.)',
  },
  {
    id: 'ryud_vayikra_2026',
    title: 'Mixed Emotions',
    parshaLabel: 'Vayikra',
    author: byId('ryud')!,
    topics: [topic('parsha')],
    publishedDate: '2026-03-20',
    excerpt: 'Opening Sefer Vayikra with a mixture of awe and closeness.',
    content:
      'As we open Sefer Vayikra, we encounter the tension between the awe of the mishkan and the closeness it invites...\n\n(Full essay will be served from the TorahWeb database once the backend is ready.)',
  },
];

const VIDEOS: Video[] = [
  {
    id: 'rtwe_091524',
    title: 'Is There Room for Simcha Amidst Protracted Suffering?',
    vimeoId: '1009865098',
    author: byId('rtwe')!,
    topics: [topic('audiovideo'), topic('special')],
    publishedDate: '2024-09-15',
    description:
      'A Yemei Iyun shiur from Rabbi Mayer Twersky on finding simcha during difficult times.',
  },
  {
    id: 'rlop_092825',
    title: 'Doing Teshuva Wisely and Effectively',
    vimeoId: '1009865098',
    author: byId('rlop')!,
    topics: [topic('audiovideo')],
    publishedDate: '2025-09-28',
    description: 'Yemei Iyun shiur from Rabbi Ahron Lopiansky on teshuva.',
  },
];

const AUDIOS: Audio[] = [
  {
    id: 'rtwe_041926',
    title:
      'Insulation and Integration: Balancing Withdrawing From, and Navigating Within, Society',
    audioUrl: `${TW_BASE}/torah/audio/2026/april19-2026/rtwe_041926.m4a`,
    author: byId('rtwe')!,
    topics: [topic('audiovideo'), topic('special')],
    publishedDate: '2026-04-19',
  },
  {
    id: 'rleb_041926',
    title: 'Identifying, and Reacting to, Misrepresentations of Torah',
    audioUrl: `${TW_BASE}/torah/audio/2026/april19-2026/rleb_041926.m4a`,
    author: byId('rleb')!,
    topics: [topic('audiovideo')],
    publishedDate: '2026-04-19',
  },
];

const ALL_CONTENT: Content[] = [...RECENT, ...VIDEOS, ...AUDIOS];

const delay = <T>(v: T, ms = 150): Promise<T> =>
  new Promise((res) => setTimeout(() => res(v), ms));

export class MockProvider implements ContentProvider {
  getAuthors() {
    return delay(AUTHORS);
  }
  getAuthor(idOrSlug: string) {
    return delay(byId(idOrSlug) ?? null);
  }
  getTopics() {
    return delay(TOPICS);
  }
  getRecent(limit = 4) {
    return delay(RECENT.slice(0, limit));
  }
  getThisWeek() {
    return delay(RECENT[0] ?? null);
  }
  getContentByAuthor(authorId: string) {
    return delay(ALL_CONTENT.filter((c) => c.author.id === authorId));
  }
  getContentByTopic(topicSlug: string) {
    return delay(
      ALL_CONTENT.filter((c) => c.topics.some((t) => t.slug === topicSlug)),
    );
  }
  getArticle(id: string) {
    return delay(RECENT.find((a) => a.id === id) ?? null);
  }
  getVideo(id: string) {
    return delay(VIDEOS.find((v) => v.id === id) ?? null);
  }
  getAudio(id: string) {
    return delay(AUDIOS.find((a) => a.id === id) ?? null);
  }
  searchContent({ query, authorId, topicId, contentType }: SearchParams) {
    const q = (query ?? '').trim().toLowerCase();
    const matches = ALL_CONTENT.filter((c) => {
      if (authorId && c.author.id !== authorId) return false;
      if (topicId && !c.topics.some((t) => t.id === topicId || t.slug === topicId))
        return false;
      if (contentType === 'article' && !('content' in c)) return false;
      if (contentType === 'video' && !('vimeoId' in c || 'videoUrl' in c))
        return false;
      if (
        contentType === 'audio' &&
        !('audioUrl' in c && !('videoUrl' in c) && !('vimeoId' in c))
      )
        return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.author.name.toLowerCase().includes(q)
      );
    });
    return delay(matches);
  }
}
