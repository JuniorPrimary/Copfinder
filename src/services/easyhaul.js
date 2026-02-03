import axios from 'axios';

const BASE_URL = 'https://www.easyhaul.com/data/v1';
const TIMEOUT_MS = 15000;
const DELIVERY_FEE = 250;

/**
 * Fetches delivery quote total (quote.total + 250) for a lot from EasyHaul.
 * @param {string|number} lotNumber - Lot number
 * @param {number} auction - 1 = Copart, 2 = IAAI
 * @returns {Promise<number|null>} Delivery total or null on any error
 */
export async function getDeliveryTotal(lotNumber, auction) {
  if (lotNumber == null || lotNumber === '') return null;
  const lot = String(lotNumber).trim();
  if (!lot) return null;

  const token = process.env.EASYHAUL_TOKEN || 'EHULCO';

  try {
    const stockRes = await axios.get(`${BASE_URL}/vehicle-vin-stock/${encodeURIComponent(lot)}/all`, {
      timeout: TIMEOUT_MS,
      validateStatus: () => true,
    });

    if (stockRes.status !== 200 || !stockRes.data || !Array.isArray(stockRes.data.vehicles)) {
      return null;
    }

    const vehicles = stockRes.data.vehicles;
    const vehicle = vehicles.find((v) => Number(v.auction) === Number(auction));
    const zip = vehicle?.location?.zip;
    if (!zip) {
      return null;
    }

    const quoteRes = await axios.get(`${BASE_URL}/quote`, {
      timeout: TIMEOUT_MS,
      validateStatus: () => true,
      params: {
        type: 'I',
        origin_zip: zip,
        drivable: 'true',
        auction: String(auction),
        lot_number: lot,
        destination_country: '123',
        token,
      },
    });

    if (quoteRes.status !== 200 || !quoteRes.data?.quote) {
      return null;
    }

    const total = quoteRes.data.quote.total;
    if (typeof total !== 'number') {
      return null;
    }

    return total + DELIVERY_FEE;
  } catch {
    return null;
  }
}
