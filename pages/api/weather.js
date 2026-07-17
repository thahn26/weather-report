import { geocodeAddress } from '../../lib/geocode';
import { fetchKmaForecast } from '../../lib/kma';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const { address, date, startHour } = req.query; // date: YYYYMMDD, startHour: '0'~'23' (선택)
  if (!address || !date) {
    return res.status(400).json({ error: 'address와 date 파라미터가 필요합니다.' });
  }
  try {
    const geo = await geocodeAddress(address);
    const forecast = await fetchKmaForecast(geo.lat, geo.lon, address, date, startHour);
    return res.status(200).json({ address, date, geo, ...forecast });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
