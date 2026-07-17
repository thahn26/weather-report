// 기상청 중기예보(육상예보) regId 매핑표
// 주의: 중기예보는 "시군구/읍면동" 단위가 아니라 광역(도) 단위로만 제공됩니다.
// 아래 코드는 기상청 공식 가이드 기준 값이지만, 배포 전 반드시
// data.go.kr에서 다운로드한 "오픈API활용가이드" 문서의 지역코드표와 대조해서
// 확인해주세요 (기상청이 가끔 코드를 개정합니다).
export const MID_LAND_REG_ID = [
  { keywords: ['서울', '인천', '경기'], regId: '11B00000' },
  { keywords: ['강원영서', '춘천', '원주', '홍천', '영월'], regId: '11D10000' },
  { keywords: ['강원영동', '강릉', '속초', '동해', '삼척'], regId: '11D20000' },
  { keywords: ['충북', '청주', '충주', '제천'], regId: '11C10000' },
  { keywords: ['대전', '세종', '충남', '천안', '공주', '보령'], regId: '11C20000' },
  { keywords: ['전북', '전주', '군산', '익산'], regId: '11F10000' },
  { keywords: ['광주', '전남', '목포', '여수', '순천'], regId: '11F20000' },
  { keywords: ['대구', '경북', '포항', '안동', '경주'], regId: '11H10000' },
  { keywords: ['부산', '울산', '경남', '창원', '진주', '거제'], regId: '11H20000' },
  { keywords: ['제주'], regId: '11G00000' },
];

// 기온 예보(getMidTa)용 regId (도시별로 별도 표가 필요 - 대표 도시만 우선 포함)
// 필요한 지역이 없으면 가장 가까운 대표도시로 대체됩니다.
export const MID_TA_REG_ID = [
  { keywords: ['서울'], regId: '11B10101' },
  { keywords: ['인천'], regId: '11B20201' },
  { keywords: ['수원', '경기'], regId: '11B20601' },
  { keywords: ['춘천', '강원영서'], regId: '11D10301' },
  { keywords: ['강릉', '강원영동'], regId: '11D20401' },
  { keywords: ['청주', '충북'], regId: '11C10301' },
  { keywords: ['대전', '세종', '충남'], regId: '11C20401' },
  { keywords: ['전주', '전북'], regId: '11F10201' },
  { keywords: ['광주', '전남'], regId: '11F20501' },
  { keywords: ['대구', '경북'], regId: '11H10701' },
  { keywords: ['부산'], regId: '11H20201' },
  { keywords: ['울산', '경남', '창원'], regId: '11H20101' },
  { keywords: ['제주'], regId: '11G00201' },
];

function findByKeywords(address, table) {
  const found = table.find(row => row.keywords.some(k => address.includes(k)));
  return found ? found.regId : table[0].regId; // 매칭 실패 시 서울/수도권 기본값
}

export function getMidLandRegId(address) {
  return findByKeywords(address, MID_LAND_REG_ID);
}

export function getMidTaRegId(address) {
  return findByKeywords(address, MID_TA_REG_ID);
}
