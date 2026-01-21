import * as cheerio from 'cheerio';

export function parseLots(html) {
  const $ = cheerio.load(html);
  const rows = $('div.table-row.table-row-border');

  const lots = [];

  rows.each((_, el) => {
    const row = $(el);
    const linkEl = row.find('a[href^=\"/VehicleDetail/\"]').first();
    if (!linkEl.length) return;

    let href = linkEl.attr('href') || '';
    if (!href.startsWith('http')) {
      href = 'https://www.iaai.com' + href;
    }

    let title = linkEl.text().trim().replace(/\s+/g, ' ');
    if (!title) {
      const h4 = row.find('h4').first();
      title = h4.text().trim().replace(/\s+/g, ' ');
    }

    let year = null;
    const yearMatch = title.match(/(\d{4})/);
    if (yearMatch) {
      year = yearMatch[1];
    }

    let imgEl = row.find('.table-cell--image img').first();
    let imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';

    if (imageUrl && imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    } else if (imageUrl && imageUrl.startsWith('/')) {
      imageUrl = 'https://www.iaai.com' + imageUrl;
    }

    const textAll = row.text().replace(/\s+/g, ' ');
    let buyNow = null;
    const buyMatch = textAll.match(/Buy Now\s*\$?([\d,]+)/i);
    if (buyMatch) {
      buyNow = `$${buyMatch[1]} USD`;
    }

    // Извлекаем пробег (odometer)
    let odometer = null;
    const odometerEl = row.find('span.data-list__value.rtl-disabled[title^="Odometer:"]').first();
    if (odometerEl.length) {
      const odometerText = odometerEl.text().trim();
      if (odometerText) {
        odometer = odometerText;
      } else {
        // Если текста нет, извлекаем из title атрибута
        const titleAttr = odometerEl.attr('title') || '';
        const titleMatch = titleAttr.match(/Odometer:\s*(.+)/i);
        if (titleMatch) {
          odometer = titleMatch[1].trim();
        }
      }
    }

    lots.push({
      title,
      year,
      url: href,
      imageUrl,
      buyNow,
      odometer,
    });
  });

  return lots;
}

