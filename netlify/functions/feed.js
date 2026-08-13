const Parser = require('rss-parser');

// ============================================================
//  YOUR PUBLICATIONS  ->  one line each.
//  - name:  what shows on the little coloured tag
//  - color: the tag colour
//  - url:   that publication's RSS feed URL from beehiiv
// ============================================================
const FEEDS = [
  { name: 'West Vic Brolga',        color: '#D98A89', url: 'https://rss.beehiiv.com/feeds/rWU61eTKgk.xml' }, // off pink
  { name: 'The Eastern Melburnian', color: '#F1BF94', url: 'https://rss.beehiiv.com/feeds/v4KqR6IYHV.xml' }, // tan
  { name: 'The Gippsland Monitor',  color: '#8DA35C', url: 'https://rss.beehiiv.com/feeds/GfknAGg8bz.xml' }, // off green
  { name: 'North Shore Lorikeet',   color: '#31BBE3', url: 'https://rss.beehiiv.com/feeds/o4BOumGiEp.xml' }, // blue
  { name: 'Mid North Coaster',      color: '#FBDA3B', url: 'https://rss.beehiiv.com/feeds/yTW1DMWzXw.xml' }, // yellow
];

// How many stories the column shows. Lower this if the column runs
// taller than FEATURED and you want them to line up; raise it to show more.
const MAX_ITEMS = 6;

// ------------------------------------------------------------
// You shouldn't need to touch anything below this line.
// ------------------------------------------------------------

const parser = new Parser({
  customFields: { item: [['media:content', 'media', { keepArray: false }]] },
});

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function pickImage(item) {
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;
  if (item.media && item.media.$ && item.media.$.url) return item.media.$.url;
  const html = item['content:encoded'] || item.content || '';
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function shorten(text, limit) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > limit ? clean.slice(0, limit).trim() + '\u2026' : clean;
}

async function loadFeed(f) {
  try {
    const res = await fetch(f.url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    if (!res.ok) return { items: [] };
    const xml = await res.text();
    const parsed = await parser.parseString(xml);
    const items = (parsed.items || []).map((item) => ({
      masthead: f.name,
      color: f.color,
      title: (item.title || '').trim(),
      link: item.link || '',
      date: item.isoDate || item.pubDate || null,
      snippet: shorten(item.contentSnippet || item.content || '', 140),
      image: pickImage(item),
    }));
    return { items };
  } catch (e) {
    return { items: [] };
  }
}

exports.handler = async function () {
  const loaded = await Promise.all(FEEDS.map(loadFeed));

  let items = loaded.flatMap((r) => r.items);

  const seen = new Set();
  items = items.filter((it) => {
    if (!it.link || seen.has(it.link)) return false;
    seen.add(it.link);
    return true;
  });

  items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  items = items.slice(0, MAX_ITEMS);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=600',
    },
    body: JSON.stringify({ items, updated: new Date().toISOString() }),
  };
};
