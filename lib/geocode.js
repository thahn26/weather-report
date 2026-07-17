// 무료 지오코딩(Nominatim, OpenStreetMap 기반) - API 키 불필요
// 사용정책상 요청 시 User-Agent를 반드시 지정해야 합니다.

export async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'weather-report-app/1.0 (internal tool)'
    }
  });
  if (!res.ok) {
    throw new Error(`지오코딩 요청 실패 (status ${res.status})`);
  }
  const data = await res.json();
  if (!data || data.length === 0) {
    throw new Error(`"${address}" 주소를 찾을 수 없습니다. 더 구체적으로 입력해보세요 (예: "파주시 탄현면").`);
  }
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    displayName: data[0].display_name
  };
}
