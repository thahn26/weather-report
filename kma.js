import { latLonToGrid } from './grid';
import { getMidLandRegId, getMidTaRegId } from './regionCodes';

const KEY = process.env.KMA_SERVICE_KEY;

function toBaseDateTime(now = new Date()) {
  const times = [23, 20, 17, 14, 11, 8, 5, 2];
  let h = now.getHours();
  let baseDate = now;
  let baseTime = times.find(t => h >= t);
  if (baseTime === undefined) {
    // 자정~새벽2시는 전날 23시 발표자료 사용
    baseDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    baseTime = 23;
  }
  const y = baseDate.getFullYear();
  const m = String(baseDate.getMonth() + 1).padStart(2, '0');
  const d = String(baseDate.getDate()).padStart(2, '0');
  return { base_date: `${y}${m}${d}`, base_time: String(baseTime).padStart(2, '0') + '00' };
}

function daysBetween(targetDateStr) {
  // targetDateStr: YYYYMMDD
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const y = +targetDateStr.slice(0, 4);
  const m = +targetDateStr.slice(4, 6) - 1;
  const d = +targetDateStr.slice(6, 8);
  const target = new Date(y, m, d);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

// 단기예보: 오늘 ~ +3일 (모레/글피)
export async function fetchShortTerm(lat, lon, targetDateStr) {
  const { nx, ny } = latLonToGrid(lat, lon);
  const { base_date, base_time } = toBaseDateTime();
  const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst`
    + `?serviceKey=${KEY}&pageNo=1&numOfRows=1000&dataType=JSON`
    + `&base_date=${base_date}&base_time=${base_time}&nx=${nx}&ny=${ny}`;

  const res = await fetch(url);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`[KMA-SHORT] 응답이 JSON이 아닙니다 (요청 URL 또는 키 문제 가능성): ${text.slice(0, 400)}`);
  }
  const header = json?.response?.header;
  if (!header || header.resultCode !== '00') {
    throw new Error(`[KMA-SHORT] API 오류 (${header ? header.resultCode : '?'}): ${header ? header.resultMsg : JSON.stringify(json).slice(0, 300)}`);
  }
  const items = json.response.body.items.item || [];

  // targetDateStr 하루치만 필터링
  const dayItems = items.filter(it => it.fcstDate === targetDateStr);

  const byTime = {};
  dayItems.forEach(it => {
    if (!byTime[it.fcstTime]) byTime[it.fcstTime] = {};
    byTime[it.fcstTime][it.category] = it.fcstValue;
  });

  // 시간대별 (03~24) -> D(06~18)/N(18~06) 그룹으로 요약
  const times = Object.keys(byTime).sort();
  let popD = [], popN = [], pcpD = [], pcpN = [];
  times.forEach(t => {
    const hour = parseInt(t.slice(0, 2), 10);
    const row = byTime[t];
    const isDay = hour >= 6 && hour < 18;
    if (row.POP !== undefined) (isDay ? popD : popN).push(parseInt(row.POP, 10));
    if (row.PCP !== undefined && row.PCP !== '강수없음') {
      const num = parseFloat(row.PCP);
      if (!isNaN(num)) (isDay ? pcpD : pcpN).push(num);
    }
  });

  return {
    granularity: 'short', // 시간단위 표 가능
    hourly: times.map(t => ({ time: t, ...byTime[t] })),
    summary: {
      D: { pop: popD.length ? Math.max(...popD) : null, pcp: pcpD.length ? pcpD.reduce((a, b) => a + b, 0) : 0 },
      N: { pop: popN.length ? Math.max(...popN) : null, pcp: pcpN.length ? pcpN.reduce((a, b) => a + b, 0) : 0 },
    },
    nx, ny, base_date, base_time,
  };
}

// 중기예보: +4일 ~ +10일 (강수확률만, mm 없음, 오전/오후 개념)
export async function fetchMidTerm(address, targetDateStr) {
  const regIdLand = getMidLandRegId(address);
  const { base_date, base_time } = (() => {
    // 중기예보는 하루 2회(06,18시) 발표 - 가장 최근 발표를 사용
    const now = new Date();
    const h = now.getHours();
    const bt = h >= 18 ? '1800' : (h >= 6 ? '0600' : '1800');
    const bd = h >= 6 ? now : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const y = bd.getFullYear(), m = String(bd.getMonth() + 1).padStart(2, '0'), d = String(bd.getDate()).padStart(2, '0');
    return { base_date: `${y}${m}${d}`, base_time: bt };
  })();

  const url = `https://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst`
    + `?serviceKey=${KEY}&pageNo=1&numOfRows=10&dataType=JSON`
    + `&regId=${regIdLand}&tmFc=${base_date}${base_time}`;

  const res = await fetch(url);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`[KMA-MID] 응답이 JSON이 아닙니다 (요청 URL 또는 키 문제 가능성): ${text.slice(0, 400)}`);
  }
  const header = json?.response?.header;
  if (!header || header.resultCode !== '00') {
    throw new Error(`[KMA-MID] API 오류 (${header ? header.resultCode : '?'}): ${header ? header.resultMsg : JSON.stringify(json).slice(0, 300)}`);
  }
  const item = json.response.body.items.item?.[0];
  if (!item) throw new Error('중기예보 응답에 데이터가 없습니다.');

  const dayN = daysBetween(targetDateStr); // 4~10
  const popD = item[`rnSt${dayN}Am`] ?? item[`rnSt${dayN}`];
  const popN = item[`rnSt${dayN}Pm`] ?? item[`rnSt${dayN}`];

  return {
    granularity: 'mid', // 간단 표만 가능 (시간단위 없음)
    summary: {
      D: { pop: popD !== undefined ? popD : null, pcp: null }, // 중기예보는 강수량(mm) 미제공
      N: { pop: popN !== undefined ? popN : null, pcp: null },
    },
    regIdLand, base_date, base_time,
  };
}

export async function fetchKmaForecast(lat, lon, address, targetDateStr) {
  const diff = daysBetween(targetDateStr);
  if (diff < 0) throw new Error('과거 날짜는 조회할 수 없습니다.');
  if (diff > 10) throw new Error('기상청 예보는 10일 이후 날짜를 제공하지 않습니다.');
  if (diff <= 3) {
    // 단기예보(getVilageFcst)는 오늘부터 글피(+3일)까지 제공됩니다.
    return fetchShortTerm(lat, lon, targetDateStr);
  }
  return fetchMidTerm(address, targetDateStr);
}
