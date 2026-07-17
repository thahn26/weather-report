import { geocodeAddress } from '../../lib/geocode';
import { fetchKmaForecast } from '../../lib/kma';

export default async function handler(req, res) {
  const { address, date } = req.query; // date: YYYYMMDD
  if (!address || !date) {
    return res.status(400).json({ error: 'address와 date 파라미터가 필요합니다.' });
  }
  try {
    const geo = await geocodeAddress(address);
    const forecast = await fetchKmaForecast(geo.lat, geo.lon, address, date);
    return res.status(200).json({ address, date, geo, ...forecast });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
