// Official USD→KZT rate of the National Bank of Kazakhstan for a given day.
// The feed is public (no key); one request per day is cached for an hour.

const FEED_URL = 'https://nationalbank.kz/rss/get_rates.cfm?fdate=';
const USD_ITEM = /<item>\s*<fullname>[^<]*<\/fullname>\s*<title>USD<\/title>\s*<description>([\d.,]+)<\/description>\s*<quant>(\d+)<\/quant>/;

/** Rate for `day` (YYYY-MM-DD) in tenge per 1 USD, or null if the feed has none. */
export async function fetchUsdRate(day: string): Promise<number | null> {
  const [y, m, d] = day.split('-');
  try {
    const res = await fetch(`${FEED_URL}${d}.${m}.${y}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const match = (await res.text()).match(USD_ITEM);
    if (!match) return null;
    const rate = Number(match[1].replace(',', '.')) / Number(match[2]);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}
