const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SOURCE_URL = process.env.SOURCE_URL || 'https://fitnur.com/alooytv';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function normalizeTitle(raw) {
  if (!raw) return 'غير معروف';
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function getBestImage($, item) {
  const candidates = [
    $(item).find('img').first().attr('src'),
    $(item).find('img').first().attr('data-src'),
    $(item).find('img').first().attr('srcset'),
    $(item).find('source').first().attr('srcset')
  ];

  for (const c of candidates) {
    if (c) {
      if (c.startsWith('//')) return 'https:' + c;
      if (c.startsWith('/')) return 'https://fitnur.com' + c;
      return c;
    }
  }

  return 'https://placehold.co/800x1200/0f172a/f8fafc?text=No+Image';
}

function extractItemsFromHtml(html) {
  const $ = cheerio.load(html);
  const items = [];

  $('a, article, .movie, .series, .item, .post, li').each((idx, el) => {
    const title = normalizeTitle($(el).find('h2, h3, h5, h1, .title, .name').first().text());
    const image = getBestImage($, el);
    const link = $(el).find('a').first().attr('href');

    if (!title || title.length < 2) return;

    const url = link
      ? (link.startsWith('http') ? link : 'https://fitnur.com' + link)
      : SOURCE_URL;

    items.push({
      id: `${title}-${idx}`,
      title,
      type: /مسلسل|series|tv|show/i.test(title) ? 'مسلسل' : 'فيلم',
      year: new Date().getFullYear(),
      rating: '8.5',
      image,
      watchLink: url
    });
  });

  // تصفية العناصر المكررة
  const dedup = [];
  const seen = new Set();
  for (const it of items) {
    if (!seen.has(it.title)) {
      dedup.push(it);
      seen.add(it.title);
    }
  }

  return dedup.slice(0, 20);
}

app.get('/api/import', async (req, res) => {
  try {
    const response = await axios.get(SOURCE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 20000
    });

    const items = extractItemsFromHtml(response.data);
    res.json(items);
  } catch (error) {
    console.error(error.response?.status, error.message);
    res.status(500).json({
      error: 'فشل استخراج البيانات من الموقع',
      details: error.message
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, source: SOURCE_URL });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Source: ${SOURCE_URL}`);
});
