// 기상청 단기예보 API용 위경도 -> 격자좌표(nx, ny) 변환
// 출처: 기상청 "기상청41_단기예보 조회서비스_오픈API활용가이드" 부록의 공식 (Lambert Conformal Conic)
// 이 공식은 기상청이 공식 문서에 공개한 표준 변환식으로, 위경도만 있으면
// 대한민국 어느 주소든 (읍/면/동 단위 포함) nx, ny를 계산할 수 있습니다.

const RE = 6371.00877; // 지구 반경(km)
const GRID = 5.0;      // 격자 간격(km)
const SLAT1 = 30.0;    // 투영 위도1
const SLAT2 = 60.0;    // 투영 위도2
const OLON = 126.0;    // 기준점 경도
const OLAT = 38.0;     // 기준점 위도
const XO = 43;         // 기준점 X좌표
const YO = 136;        // 기준점 Y좌표

const DEGRAD = Math.PI / 180.0;

export function latLonToGrid(lat, lon) {
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  const ra_lat = lat * DEGRAD;
  let ra = Math.tan(Math.PI * 0.25 + ra_lat * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const x = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const y = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);

  return { nx: x, ny: y };
}
