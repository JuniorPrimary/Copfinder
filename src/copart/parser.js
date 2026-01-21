import * as cheerio from 'cheerio';

export function parseLots(html) {
  const $ = cheerio.load(html);
  const lots = [];
  const seenLotIds = new Set();

  // Ищем все карточки лотов через различные селекторы
  const selectors = [
    'a[href*="/lot/"]',
    'a[data-url*="/lot/"]',
    'a.search-results[href*="/lot/"]',
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href') || $link.attr('data-url') || '';
      
      if (!href || !/\/lot\/\d+/i.test(href)) return;

      // Извлекаем lot ID из URL
      const lotMatch = href.match(/\/lot\/(\d+)/i);
      const lotId = lotMatch ? lotMatch[1] : '';
      
      if (!lotId || seenLotIds.has(lotId)) return;
      seenLotIds.add(lotId);

      // Получаем абсолютный URL
      let url = href;
      if (url.startsWith('./')) {
        url = 'https://www.copart.com' + url.substring(1);
      } else if (url.startsWith('/')) {
        url = 'https://www.copart.com' + url;
      } else if (!url.startsWith('http')) {
        url = 'https://www.copart.com/' + url;
      }

      // Ищем родительский контейнер карточки (таблица или div)
      const $card = $link.closest('tr, tbody tr, div[data-uname], .search-results-row, .lot-row, [ng-click*="storeNavigationInfo"]').first();
      
      // Если не нашли контейнер, используем всю страницу для поиска цены
      const $searchScope = $card.length ? $card : $('body');
      
      // Извлекаем заголовок - сначала из img внутри ссылки
      let title = '';
      const $img = $link.find('img').first();
      if ($img.length) {
        title = $img.attr('title') || $img.attr('alt') || '';
      }
      
      // Если заголовок содержит "Lot Image" или "Image", ищем в других местах
      if (!title || title.toLowerCase().includes('lot image') || title.toLowerCase().includes('image') || title.length < 5) {
        // Ищем в data-uname атрибутах контейнера
        const $titleEl = $searchScope.find('[data-uname="lotsearchLotdescription"], [data-uname="lotsearchTitle"], [data-uname*="description"]').first();
        if ($titleEl.length) {
          title = $titleEl.text().trim();
        }
        
        // Ищем в текстовых ячейках таблицы
        if (!title || title.toLowerCase().includes('image')) {
          $searchScope.find('td, div, span').each((_, el) => {
            const $el = $(el);
            const text = $el.text().trim();
            // Пропускаем короткие тексты и те, что содержат "image"
            if (text && text.length > 10 && !text.toLowerCase().includes('lot image') && 
                !text.toLowerCase().includes('image') && /\d{4}/.test(text) && 
                !text.includes('$') && !text.toLowerCase().includes('buy')) {
              title = text;
              return false; // break
            }
          });
        }
      }

      // Извлекаем год из заголовка или URL
      let year = null;
      const yearMatch = title.match(/(\d{4})/) || href.match(/-(\d{4})-/);
      if (yearMatch) {
        year = yearMatch[1];
      }

      // Извлекаем изображение (уже нашли $img выше)
      let imageUrl = '';
      if ($img.length) {
        imageUrl = $img.attr('src') || $img.attr('lazy-src') || $img.attr('data-src') || '';
        if (imageUrl && imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        } else if (imageUrl && imageUrl.startsWith('/')) {
          imageUrl = 'https://www.copart.com' + imageUrl;
        }
      }

      // Ищем цену "Buy it now" - правильная структура: span.button-buyitnow > span.search_result_amount_block > span.currencyAmount
      let buyNow = null;
      
      // Стратегия 1: Ищем все ссылки с нашим lotId и проверяем span.button-buyitnow в том же контейнере
      $('a[href*="/lot/"]').each((_, linkEl) => {
        const $testLink = $(linkEl);
        const testHref = $testLink.attr('href') || '';
        const testLotMatch = testHref.match(/\/lot\/(\d+)/);
        if (testLotMatch && testLotMatch[1] === lotId) {
          // Нашли ссылку с нашим lotId, ищем span.button-buyitnow в том же контейнере
          const containers = ['tr', 'tbody', 'table', 'div[data-uname]', 'div'];
          for (const containerSelector of containers) {
            const $testContainer = $testLink.closest(containerSelector);
            if ($testContainer.length) {
              // Ищем span.button-buyitnow
              const $buttonBuyItNow = $testContainer.find('span.button-buyitnow').first();
              if ($buttonBuyItNow.length) {
                // Ищем span.currencyAmount внутри span.search_result_amount_block
                const $amountBlock = $buttonBuyItNow.find('span.search_result_amount_block span.currencyAmount').first();
                if ($amountBlock.length) {
                  const priceText = $amountBlock.text().trim();
                  const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
                  if (priceMatch) {
                    buyNow = `$${priceMatch[1]}`;
                    return false; // break из each
                  }
                }
              }
            }
          }
          // Если не нашли в контейнере, ищем в родительских элементах
          const $parents = $testLink.parents('tr, tbody, table, div');
          for (let i = 0; i < $parents.length && i < 5; i++) {
            const $parent = $($parents[i]);
            const $buttonBuyItNow = $parent.find('span.button-buyitnow').first();
            if ($buttonBuyItNow.length) {
              const $amountBlock = $buttonBuyItNow.find('span.search_result_amount_block span.currencyAmount').first();
              if ($amountBlock.length) {
                const priceText = $amountBlock.text().trim();
                const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
                if (priceMatch) {
                  buyNow = `$${priceMatch[1]}`;
                  return false; // break из each
                }
              }
            }
          }
        }
      });
      
      // Стратегия 2: Ищем span.button-buyitnow в контейнере карточки
      if (!buyNow && $card.length) {
        const $buttonBuyItNow = $card.find('span.button-buyitnow').first();
        if ($buttonBuyItNow.length) {
          const $amountBlock = $buttonBuyItNow.find('span.search_result_amount_block span.currencyAmount').first();
          if ($amountBlock.length) {
            const priceText = $amountBlock.text().trim();
            const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
            if (priceMatch) {
              buyNow = `$${priceMatch[1]}`;
            }
          }
        }
      }
      
      // Стратегия 3: Ищем в родительских элементах
      if (!buyNow && $card.length) {
        const $parents = $card.parents('tr, tbody, table, div');
        for (let i = 0; i < $parents.length && i < 5; i++) {
          const $parent = $($parents[i]);
          const $buttonBuyItNow = $parent.find('span.button-buyitnow').first();
          if ($buttonBuyItNow.length) {
            const $amountBlock = $buttonBuyItNow.find('span.search_result_amount_block span.currencyAmount').first();
            if ($amountBlock.length) {
              const priceText = $amountBlock.text().trim();
              const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
              if (priceMatch) {
                buyNow = `$${priceMatch[1]}`;
                break;
              }
            }
          }
        }
      }
      
      // Стратегия 4: Ищем во всей строке таблицы
      if (!buyNow && $card.is('tr')) {
        $card.find('td').each((_, td) => {
          const $td = $(td);
          const $buttonBuyItNow = $td.find('span.button-buyitnow').first();
          if ($buttonBuyItNow.length) {
            const $amountBlock = $buttonBuyItNow.find('span.search_result_amount_block span.currencyAmount').first();
            if ($amountBlock.length) {
              const priceText = $amountBlock.text().trim();
              const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
              if (priceMatch) {
                buyNow = `$${priceMatch[1]}`;
                return false; // break
              }
            }
          }
        });
      }
      
      // Стратегия 5: Ищем все span.button-buyitnow и проверяем по lotId
      if (!buyNow) {
        $('span.button-buyitnow').each((_, span) => {
          const $buttonBuyItNow = $(span);
          // Ищем в родительских элементах ссылку с нашим lotId
          const $parents = $buttonBuyItNow.parents('tr, div, tbody, table');
          for (let i = 0; i < $parents.length && i < 5; i++) {
            const $parent = $($parents[i]);
            const hasLotLink = $parent.find(`a[href*="/lot/${lotId}"]`).length > 0;
            if (hasLotLink) {
              const $amountBlock = $buttonBuyItNow.find('span.search_result_amount_block span.currencyAmount').first();
              if ($amountBlock.length) {
                const priceText = $amountBlock.text().trim();
                const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
                if (priceMatch) {
                  buyNow = `$${priceMatch[1]}`;
                  return false; // break
                }
              }
            }
          }
        });
      }

      // Формируем заголовок из года, марки и модели если не нашли или он содержит "image"
      if (!title || title === lotId || title.toLowerCase().includes('lot image') || title.toLowerCase().includes('image')) {
        const urlParts = href.split('/');
        const slug = urlParts[urlParts.length - 1] || '';
        // Пример: clean-title-2018-bmw-430xi-gran-coupe-nj-trenton
        const slugMatch = slug.match(/-(\d{4})-(.+?)-(.+?)(?:-nj|-tx|-ny|-fl|-ca|-ga|-oh|-pa|-ct|$)/i);
        if (slugMatch) {
          const [, urlYear, make, model] = slugMatch;
          title = `${urlYear} ${make.toUpperCase()} ${model.replace(/-/g, ' ')}`;
          if (!year) year = urlYear;
        } else {
          title = `Lot ${lotId}`;
        }
      }

      // Очищаем заголовок от лишних пробелов и проверяем на "Lot Image"
      title = title.trim().replace(/\s+/g, ' ');
      if (title.toLowerCase().includes('lot image') || title.toLowerCase() === 'image') {
        // Пробуем ещё раз извлечь из URL
        const urlParts = href.split('/');
        const slug = urlParts[urlParts.length - 1] || '';
        const slugMatch = slug.match(/-(\d{4})-(.+?)-(.+?)(?:-nj|-tx|-ny|-fl|-ca|-ga|-oh|-pa|-ct|$)/i);
        if (slugMatch) {
          const [, urlYear, make, model] = slugMatch;
          title = `${urlYear} ${make.toUpperCase()} ${model.replace(/-/g, ' ')}`;
          if (!year) year = urlYear;
        } else {
          title = `Lot ${lotId}`;
        }
      }

      // Извлекаем пробег (odometer)
      // Структура: div.search_result_veh_info_block > div.p-mb-3 > label "Odometer" + div с числом
      let odometer = null;
      
      // Стратегия 1: Ищем в строке таблицы, где находится ссылка
      if ($link.closest('tr').length) {
        const $row = $link.closest('tr');
        // Ищем блок с информацией о транспортном средстве
        const $vehInfoBlock = $row.find('div.search_result_veh_info_block').first();
        if ($vehInfoBlock.length) {
          // Ищем label с текстом "Odometer"
          $vehInfoBlock.find('label.search_result_meta_data_label').each((_, labelEl) => {
            const $label = $(labelEl);
            if ($label.text().trim().toLowerCase() === 'odometer') {
              // Нашли label "Odometer", ищем следующий div с числом
              const $odometerDiv = $label.next('div').first();
              if ($odometerDiv.length) {
                // Извлекаем текст, убираем "(ACTUAL)" и лишние пробелы
                let odometerText = $odometerDiv.text().trim();
                // Убираем "(ACTUAL)" и другие скобки
                odometerText = odometerText.replace(/\s*\([^)]*\)\s*/g, '').trim();
                // Убираем лишние пробелы
                odometerText = odometerText.replace(/\s+/g, ' ');
                if (odometerText && /^\d+/.test(odometerText)) {
                  odometer = odometerText;
                  return false; // break из each
                }
              }
            }
          });
        }
      }
      
      // Стратегия 2: Ищем в контейнере карточки
      if (!odometer && $card.length) {
        const $vehInfoBlock = $card.find('div.search_result_veh_info_block').first();
        if ($vehInfoBlock.length) {
          $vehInfoBlock.find('label.search_result_meta_data_label').each((_, labelEl) => {
            const $label = $(labelEl);
            if ($label.text().trim().toLowerCase() === 'odometer') {
              const $odometerDiv = $label.next('div').first();
              if ($odometerDiv.length) {
                let odometerText = $odometerDiv.text().trim();
                odometerText = odometerText.replace(/\s*\([^)]*\)\s*/g, '').trim();
                odometerText = odometerText.replace(/\s+/g, ' ');
                if (odometerText && /^\d+/.test(odometerText)) {
                  odometer = odometerText;
                  return false;
                }
              }
            }
          });
        }
      }
      
      // Стратегия 3: Ищем во всех строках таблицы с нашим lotId
      if (!odometer) {
        $('tr[data-lotnumber]').each((_, rowEl) => {
          const $row = $(rowEl);
          const rowLotId = $row.attr('data-lotnumber');
          if (rowLotId === lotId) {
            const $vehInfoBlock = $row.find('div.search_result_veh_info_block').first();
            if ($vehInfoBlock.length) {
              $vehInfoBlock.find('label.search_result_meta_data_label').each((_, labelEl) => {
                const $label = $(labelEl);
                if ($label.text().trim().toLowerCase() === 'odometer') {
                  const $odometerDiv = $label.next('div').first();
                  if ($odometerDiv.length) {
                    let odometerText = $odometerDiv.text().trim();
                    odometerText = odometerText.replace(/\s*\([^)]*\)\s*/g, '').trim();
                    odometerText = odometerText.replace(/\s+/g, ' ');
                    if (odometerText && /^\d+/.test(odometerText)) {
                      odometer = odometerText;
                      return false; // break из внешнего each
                    }
                  }
                }
              });
              if (odometer) {
                return false; // break из each по строкам
              }
            }
          }
        });
      }
      

      // Отладочное логирование для первого лота
      if (lots.length === 0 && !buyNow) {
        console.log(`[DEBUG] Lot ${lotId}: не найдена цена. Проверяем структуру...`);
        const $allButtonBuyItNow = $('span.button-buyitnow');
        console.log(`[DEBUG] Всего span.button-buyitnow на странице: ${$allButtonBuyItNow.length}`);
        
        if ($allButtonBuyItNow.length > 0) {
          $allButtonBuyItNow.each((i, span) => {
            if (i < 3) { // Показываем только первые 3 для отладки
              const $buttonBuyItNow = $(span);
              const $parent = $buttonBuyItNow.parents('tr, div').first();
              const hasLotLink = $parent.find(`a[href*="/lot/${lotId}"]`).length > 0;
              const $amountBlock = $buttonBuyItNow.find('span.search_result_amount_block span.currencyAmount').first();
              const priceText = $amountBlock.length ? $amountBlock.text().trim() : 'не найдено';
              console.log(`[DEBUG] span.button-buyitnow #${i}: цена="${priceText}", есть ссылка с lotId=${lotId}: ${hasLotLink}`);
            }
          });
        }
      }

      lots.push({
        lotId,
        title: title || `Lot ${lotId}`,
        year,
        url,
        imageUrl,
        buyNow,
        odometer,
      });
    });
  }

  return lots;
}

