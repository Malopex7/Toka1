/**
 * Curated discover metadata. Video counts and previews are enriched at runtime
 * from MongoDB using the tag / keywords on each entry.
 */
export const DISCOVER_FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'trending', label: 'Trending', icon: 'local_fire_department', color: 'text-toka-flare' },
  { id: 'afrobeats', label: 'Afrobeats', icon: 'music_note', color: 'text-amber-400' },
  { id: 'amapiano', label: 'Amapiano', icon: 'graphic_eq', color: 'text-emerald-400' },
  { id: 'dance', label: 'Dance', icon: 'directions_walk', color: 'text-rose-400' },
  { id: 'cuisine', label: 'Cuisine', icon: 'restaurant', color: 'text-orange-400' },
  { id: 'fashion', label: 'Fashion', icon: 'styler', color: 'text-purple-400' },
  { id: 'tech', label: 'Tech', icon: 'devices', color: 'text-cyan-400' },
  { id: 'comedy', label: 'Comedy', icon: 'theater_comedy', color: 'text-yellow-400' },
];

export const DISCOVER_CATEGORIES = [
  {
    id: 'afrobeats',
    title: 'Afrobeats & Sounds',
    tag: '#Afrobeats',
    keywords: ['afrobeats', 'afrobeat', 'afro pop', 'afropop'],
    image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80',
    icon: 'music_note',
  },
  {
    id: 'dance',
    title: 'Dance & Choreography',
    tag: '#DanceChallenge',
    keywords: ['dance', 'choreography', 'dancechallenge'],
    image: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=600&auto=format&fit=crop&q=80',
    icon: 'self_improvement',
  },
  {
    id: 'cuisine',
    title: 'African Cuisine & Flavors',
    tag: '#JollofNation',
    keywords: ['jollof', 'cuisine', 'cooking', 'recipe', 'food'],
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80',
    icon: 'soup_kitchen',
  },
  {
    id: 'fashion',
    title: 'Fashion & Streetwear',
    tag: '#LagosFashion',
    keywords: ['fashion', 'streetwear', 'style', 'outfit', 'ankara'],
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&auto=format&fit=crop&q=80',
    icon: 'checkroom',
  },
  {
    id: 'tech',
    title: 'Tech & African Innovation',
    tag: '#TechToka',
    keywords: ['tech', 'technology', 'startup', 'coding', 'ai'],
    image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
    icon: 'devices',
  },
  {
    id: 'comedy',
    title: 'Comedy & Sketches',
    tag: '#TokaComedy',
    keywords: ['comedy', 'sketch', 'funny', 'humor'],
    image: 'https://images.unsplash.com/photo-1514306191717-452ec28c7814?w=600&auto=format&fit=crop&q=80',
    icon: 'sentiment_very_satisfied',
  },
  {
    id: 'sports',
    title: 'Sports & Football',
    tag: '#AfricanFootball',
    keywords: ['football', 'soccer', 'sports', 'afcon'],
    image: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&auto=format&fit=crop&q=80',
    icon: 'sports_soccer',
  },
  {
    id: 'art',
    title: 'Digital Art & Culture',
    tag: '#BlackExcellence',
    keywords: ['art', 'culture', 'digital art', 'creative'],
    image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80',
    icon: 'palette',
  },
];

export const DISCOVER_TRENDING_CHALLENGES = [
  {
    id: 'amapiano',
    hashtag: '#AmapianoMix',
    keywords: ['amapiano', 'log drum', 'piano'],
    description: 'The hottest underground basslines and viral dance routines from Pretoria to the world.',
  },
  {
    id: 'jollof',
    hashtag: '#JollofNation',
    keywords: ['jollof', 'jollonation'],
    description: 'The eternal firewood smoke debate: Ghana vs Nigeria vs Senegal recipes tested live.',
  },
  {
    id: 'lagosfashion',
    hashtag: '#LagosFashionWeek',
    keywords: ['lagos fashion', 'lagosfashion', 'runway'],
    description: 'Avant-garde streetwear, runway drops, and bold African silhouettes taking over.',
  },
];

/** Resolve catalog entry keywords + tag into a MongoDB title regex filter. */
export function buildTitleMatchFilter(entry) {
  const terms = new Set();
  if (entry.tag) {
    terms.add(entry.tag.replace(/^#/, ''));
  }
  (entry.keywords || []).forEach((kw) => terms.add(kw));

  const pattern = Array.from(terms)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  return { title: { $regex: pattern, $options: 'i' } };
}

export function getCategoryById(categoryId) {
  if (categoryId === 'trending') {
    return { id: 'trending', keywords: [], tag: null };
  }
  return DISCOVER_CATEGORIES.find((cat) => cat.id === categoryId) || null;
}

export function formatCompactCount(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(value);
}
