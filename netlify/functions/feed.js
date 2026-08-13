const Parser = require('rss-parser');

// ============================================================
//  YOUR PUBLICATIONS  ->  one line each.
//  - name:  what shows on the little coloured tag
//  - color: the tag colour
//  - url:   that publication's RSS feed URL from beehiiv
//  To change a colour or name, just edit the line. To add another
//  masthead later, copy a line. Keep the commas and { } brackets.
// ============================================================
const FEEDS = [
  { name: 'West Vic Brolga',        color: '#89C540', url: 'https://rss.beehiiv.com/feeds/rWU61eTKgk.xml' },
  { name: 'The Eastern Melburnian', color: '#F1BF94', url: 'https://rss.beehiiv.com/feeds/v4KqR6IYHV.xml' },
  { name: 'The Gippsland Monitor',  color: '#31BBE3', url: 'https://rss.beehiiv.com/feeds/GfknAGg8bz.xml' },
  { name: 'North Shore Lorikeet',   color: '#EE363A', url: 'https://rss.beehiiv.com/feeds/o4BOumGiEp.xml' },
  { name: 'Mid North Coaster',      color: '#FBDA3B', url: 'https://rss.beehiiv.com/feeds/yTW1DMWzXw.xml' },
];

// How many stories the column shows at once.
const MAX_ITEMS = 12;

// ------------------------------------------------------------
// You shouldn't need to touch anything below this line.
// ------------------------------------------------------------

const parser = new Parser({
  timeout: 8000,
  customFields: { item: [['media:content', 'media', { keepArray: false }]] },
});

// beehiiv can put the article image in a few different spots.
// Try each one in turn until we find one.
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

exports.handler = async function () {
  // Fetch every feed at the same time. allSettled means one broken
  // feed won't take the whole column down with it.
  const results = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const feed = await parser.parseURL(f.url);
      return (feed.items || []).map((item) => ({
        masthead: f.name,
        color: f.color,
        title: (item.title || '').trim(),
        link: item.link || '',
        date: item.isoDate || item.pubDate || null,
        snippet: shorten(item.contentSnippet || item.content || '', 140),
        image: pickImage(item),
      }));
    })
  );

  // Keep only the feeds that loaded, and flatten them into one list.
  let items = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  // Drop anything with no link, and remove duplicates (same link twice).
  const seen = new Set();
  items = items.filter((it) => {
    if (!it.link || seen.has(it.link)) return false;
    seen.add(it.link);
    return true;
  });

  // Newest first, then trim to the number we want to show.
  items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  items = items.slice(0, MAX_ITEMS);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      // Netlify keeps this result cached for 10 minutes, so the page
      // loads fast and we're not hammering beehiiv on every visit.
      'Cache-Control': 'public, max-age=600',
    },
    body: JSON.stringify({ items, updated: new Date().toISOString() }),
  };
};
