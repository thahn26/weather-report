import { useState, useRef } from 'react';
import Head from 'next/head';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function emptyLoc() {
  return {
    date: todayStr(),
    address: '',
    accD: '', accN: '', mmD: '', mmN: '',   // 간단 모드용
    startHour: '9',                          // 상세 모드용 시작시간
    accHourly: Array(15).fill(null).map(() => ({ pop: '', mm: '' })), // 상세 모드용 아큐웨더 시간별 값(15칸 x {pop, mm})
    kma: null,
    kmaError: null,
    loading: false,
  };
}

function fmtPct(v) {
  if (v === null || v === undefined || v === '') return '-';
  const s = String(v).replace('%', '');
  return `${s}%`;
}
function fmtMm(v) {
  if (v === null || v === undefined || v === '' || v === 0) return '-';
  const s = String(v).replace('mm', '');
  return `${s}mm`;
}

// 강수확률(%)에 따라 색을 진하게: 원본 사진 톤(연한 파랑 계열)에 맞춰 톤 다운.
function popColorStyle(rawVal) {
  if (rawVal === null || rawVal === undefined || rawVal === '') return { background: '#ffffff', color: '#999' };
  const num = parseFloat(String(rawVal).replace('%', ''));
  if (isNaN(num)) return { background: '#ffffff', color: '#999' };
  if (num < 20) return { background: '#EDF4FB', color: '#1a4fa0' };
  if (num < 40) return { background: '#DCEAF7', color: '#1a4fa0' };
  if (num < 60) return { background: '#C7DFF3', color: '#1a4fa0' };
  if (num < 80) return { background: '#AFD1ED', color: '#1a4fa0' };
  return { background: '#93BFE3', color: '#1a4fa0' };
}

export default function Home() {
  const [locations, setLocations] = useState([emptyLoc()]);
  const [detailMode, setDetailMode] = useState(false); // false=간단(D/N), true=시간단위 상세
  const [built, setBuilt] = useState(false);
  const captureRef = useRef(null);

  function update(i, key, val) {
    setLocations(prev => prev.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  }
  function updateHourly(i, hourIdx, field, val) {
    setLocations(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      const next = [...l.accHourly];
      next[hourIdx] = { ...next[hourIdx], [field]: val };
      return { ...l, accHourly: next };
    }));
  }
  function addLoc() { setLocations(prev => [...prev, emptyLoc()]); }
  function removeLoc(i) { setLocations(prev => prev.filter((_, idx) => idx !== i)); }

  async function fetchKma(i) {
    const loc = locations[i];
    if (!loc.address || !loc.date) return;
    update(i, 'loading', true);
    update(i, 'kmaError', null);
    try {
      const dateParam = loc.date.replaceAll('-', '');
      let url = `/api/weather?address=${encodeURIComponent(loc.address)}&date=${dateParam}&_t=${Date.now()}`;
      if (detailMode) url += `&startHour=${encodeURIComponent(loc.startHour)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '조회 실패');
      update(i, 'kma', json);
    } catch (err) {
      update(i, 'kmaError', err.message);
      update(i, 'kma', null);
    } finally {
      update(i, 'loading', false);
    }
  }

  async function fetchAll() {
    for (let i = 0; i < locations.length; i++) {
      await fetchKma(i);
    }
  }

  function buildTable() {
    setBuilt(true);
    setTimeout(() => captureRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function downloadImage() {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(captureRef.current, { backgroundColor: '#ffffff', scale: 2 });
    const link = document.createElement('a');
    link.download = '날씨비교표.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <>
      <Head><title>촬영지 날씨 비교표</title></Head>
      <main className="wrap">
        <h1>촬영지 날씨 비교표</h1>
        <p className="sub">
          {detailMode
            ? '시작시간을 입력하고 "기상청 조회"를 누르면 시작시간부터 +14시간의 시간별 값이 자동으로 채워져요. 아큐웨더는 같은 시간대에 맞춰 값만 입력해주세요.'
            : '지역과 날짜를 입력하고 "기상청 조회"를 누르면 자동으로 값이 채워져요. 아큐웨더는 직접 입력해주세요.'}
        </p>

        <label className="modeToggle">
          <input type="checkbox" checked={detailMode} onChange={e => setDetailMode(e.target.checked)} />
          시간단위 상세 표로 만들기 (체크 해제 시 D/N 간단 표)
        </label>

        {locations.map((loc, i) => (
          <div className="card" key={i}>
            <div className="cardHead">
              <span>지역 {i + 1}</span>
              {locations.length > 1 && <button className="rm" onClick={() => removeLoc(i)}>삭제</button>}
            </div>
            <div className="row">
              <div className="field">
                <label>날짜</label>
                <input type="date" value={loc.date} onChange={e => update(i, 'date', e.target.value)} />
              </div>
              <div className="field grow">
                <label>지역 (예: 파주시 탄현면)</label>
                <input type="text" value={loc.address} placeholder="파주시 탄현면"
                  onChange={e => update(i, 'address', e.target.value)} />
              </div>
              {detailMode && (
                <div className="field">
                  <label>시작시간 (+14시간 자동계산)</label>
                  <select value={loc.startHour} onChange={e => update(i, 'startHour', e.target.value)}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}시</option>
                    ))}
                  </select>
                </div>
              )}
              <button className="fetchBtn" disabled={loc.loading} onClick={() => fetchKma(i)}>
                {loc.loading ? '조회중...' : '기상청 조회'}
              </button>
            </div>

            {loc.kmaError && <div className="err">⚠ {loc.kmaError}</div>}

            {!detailMode && loc.kma && (
              <div className="ok">
                ✅ 기상청 값 확인됨 ({loc.kma.granularity === 'short' ? '단기예보 · 시간단위 가능' : '중기예보 · 강수확률만 (mm 없음)'})
                — D {fmtPct(loc.kma.summary.D.pop)} / N {fmtPct(loc.kma.summary.N.pop)}
                <div style={{ marginTop: 4, fontSize: 11, color: '#555' }}>
                  📍 인식된 위치: {loc.kma.geo?.displayName || '(정보 없음)'} (nx={loc.kma.nx}, ny={loc.kma.ny})
                </div>
                {loc.kma.debug && (loc.kma.summary.D.pop === null || loc.kma.summary.N.pop === null) && (
                  <details style={{ marginTop: 6, fontSize: 11, color: '#555' }}>
                    <summary>값이 비어있어요 — 디버그 정보 보기</summary>
                    <div>찾으려던 필드: {loc.kma.debug.lookedFor.join(', ')}</div>
                    <div>응답에 실제로 있는 필드: {loc.kma.debug.itemKeys.join(', ')}</div>
                  </details>
                )}
                {loc.kma.hourly && (
                  <details style={{ marginTop: 6, fontSize: 11, color: '#555' }}>
                    <summary>시간별 원본값 보기 (디버그)</summary>
                    <table style={{ marginTop: 4, borderCollapse: 'collapse', fontSize: 11 }}>
                      <tbody>
                        <tr>{loc.kma.hourly.map((h, idx) => <td key={idx} style={{ border: '1px solid #ddd', padding: '2px 4px' }}>{h.time.slice(0,2)}시</td>)}</tr>
                        <tr>{loc.kma.hourly.map((h, idx) => <td key={idx} style={{ border: '1px solid #ddd', padding: '2px 4px' }}>{h.POP ?? '-'}%</td>)}</tr>
                      </tbody>
                    </table>
                  </details>
                )}
              </div>
            )}

            {detailMode && loc.kma && loc.kma.range && (
              <div className="ok">✅ {loc.kma.range[0].hour}시 ~ {loc.kma.range[14].hour}시, 총 15개 시간대 조회됨</div>
            )}
            {detailMode && loc.kma && !loc.kma.range && (
              <div className="err">⚠ 이 날짜는 시간별 데이터가 없어요 (4일 이후는 중기예보라 시간단위 조회 불가).</div>
            )}

            {!detailMode && (
              <>
                <div className="groupTitle">아큐웨더 (직접입력)</div>
                <div className="row">
                  <div className="field"><label>D %</label><input value={loc.accD} onChange={e => update(i, 'accD', e.target.value)} placeholder="72" /></div>
                  <div className="field"><label>N %</label><input value={loc.accN} onChange={e => update(i, 'accN', e.target.value)} placeholder="55" /></div>
                  <div className="field"><label>D mm</label><input value={loc.mmD} onChange={e => update(i, 'mmD', e.target.value)} placeholder="2.1" /></div>
                  <div className="field"><label>N mm</label><input value={loc.mmN} onChange={e => update(i, 'mmN', e.target.value)} placeholder="1" /></div>
                </div>
              </>
            )}

            {detailMode && loc.kma && loc.kma.range && (
              <>
                <div className="groupTitle">아큐웨더 (시간대별 직접입력 — 강수확률% / 강수량mm)</div>
                <div className="hourlyGrid">
                  {loc.kma.range.map((pt, hIdx) => (
                    <div className="hourPair" key={hIdx}>
                      <label className="hourPairLabel">{pt.hour}시</label>
                      <input className="hourInput" value={loc.accHourly[hIdx].pop}
                        onChange={e => updateHourly(i, hIdx, 'pop', e.target.value)} placeholder="%" />
                      <input className="hourInput" value={loc.accHourly[hIdx].mm}
                        onChange={e => updateHourly(i, hIdx, 'mm', e.target.value)} placeholder="mm" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}

        <div className="actions">
          <button className="ghost" onClick={addLoc}>+ 지역 추가</button>
          <button className="secondary" onClick={fetchAll}>전체 기상청 조회</button>
          <button className="primary" onClick={buildTable}>표 만들기</button>
          {built && <button className="secondary" onClick={downloadImage}>이미지로 저장</button>}
        </div>

        {built && !detailMode && (
          <div className="tableOuter">
            <div ref={captureRef} className="capture">
              {chunk(locations, 2).map((pair, ri) => (
                <div className="pairRow" key={ri}>
                  {pair.map((loc, ci) => (
                    <SimpleBlock key={ci} loc={loc} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {built && detailMode && (
          <div className="tableOuter">
            <div ref={captureRef} className="capture">
              {locations.map((loc, i) => (
                <div className="hourlyRowWrap" key={i}>
                  <HourlyBlock loc={loc} />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin:0; font-family: Arial, "Malgun Gothic", sans-serif; color:#111; background:#fff; }
      `}</style>
      <style jsx>{`
        .wrap { max-width: 1100px; margin: 0 auto; padding: 24px 20px 60px; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .sub { font-size: 13px; color:#555; margin: 0 0 16px; }
        .modeToggle { display:flex; align-items:center; gap:8px; font-size:13px; margin-bottom:16px; }
        .card { border:1px solid #ddd; border-radius:8px; padding:14px 16px; margin-bottom:12px; background:#fafafa; }
        .cardHead { display:flex; justify-content:space-between; margin-bottom:8px; font-weight:bold; font-size:13px; color:#333; }
        .rm { background:none; border:none; color:#b33; cursor:pointer; font-size:13px; font-weight:bold; }
        .row { display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; margin-bottom:8px; }
        .field { display:flex; flex-direction:column; gap:3px; min-width: 90px; }
        .field.grow { flex:1; min-width:180px; }
        .field label { font-size:11px; color:#666; }
        .field input, .field select { border:1px solid #ccc; border-radius:5px; padding:7px 8px; font-size:13px; }
        .fetchBtn { background:#2563eb; color:white; border:none; padding:9px 14px; border-radius:6px; font-size:13px; font-weight:bold; cursor:pointer; height:34px; }
        .fetchBtn:disabled { background:#9ab4e8; }
        .err { background:#fdecea; color:#b3261e; border:1px solid #f3c2be; padding:8px 10px; border-radius:6px; font-size:12px; margin-bottom:8px; }
        .ok { background:#e6f4ea; color:#1a7a34; border:1px solid #b7e0c3; padding:8px 10px; border-radius:6px; font-size:12px; margin-bottom:8px; }
        .groupTitle { font-size:11px; font-weight:bold; color:#888; margin:8px 0 4px; text-transform:uppercase; letter-spacing:.03em; }
        .hourlyGrid { display:grid; grid-template-columns: repeat(5, 1fr); gap:8px; }
        .hourPair { display:flex; flex-direction:column; gap:3px; border:1px solid #e2e2e2; border-radius:6px; padding:6px; background:#fff; }
        .hourPairLabel { font-size:11px; color:#666; font-weight:bold; }
        .hourInput { border:1px solid #ccc; border-radius:5px; padding:5px 6px; font-size:12px; }
        .actions { display:flex; gap:10px; margin:18px 0 26px; flex-wrap:wrap; }
        button.primary { background:#2563eb; color:white; border:none; padding:10px 18px; border-radius:6px; font-size:14px; font-weight:bold; cursor:pointer; }
        button.secondary { background:white; color:#2563eb; border:1px solid #2563eb; padding:10px 18px; border-radius:6px; font-size:14px; font-weight:bold; cursor:pointer; }
        button.ghost { background:white; color:#444; border:1px dashed #999; padding:9px 14px; border-radius:6px; font-size:13px; cursor:pointer; }
        .tableOuter { overflow-x:auto; }
        .capture { background:white; padding:10px; display:inline-block; }
        .hourlyRowWrap { margin-bottom: 14px; }
      `}</style>
    </>
  );
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// 간단(D/N) 모드 표 블록 하나 = 지역 하나. 크기 고정(110px x 34px) -> 지역이 늘어나도 안 줄어듦.
function SimpleBlock({ loc }) {
  const dateLabel = loc.date ? formatDateLabel(loc.date) : '날짜';
  const nameLabel = loc.address || '지역명';
  const kmaD = loc.kma ? fmtPct(loc.kma.summary.D.pop) : '-';
  const kmaN = loc.kma ? fmtPct(loc.kma.summary.N.pop) : '-';
  const accD = loc.accD ? fmtPct(loc.accD) : '-';
  const accN = loc.accN ? fmtPct(loc.accN) : '-';
  const mmD = loc.mmD ? fmtMm(loc.mmD) : '-';
  const mmN = loc.mmN ? fmtMm(loc.mmN) : '-';

  return (
    <table className="weather">
      <tbody>
        <tr>
          <td className="head fixed">{dateLabel}</td>
          <td className="head fixed">시간</td>
          <td className="head fixed">D</td>
          <td className="head fixed">N</td>
        </tr>
        <tr>
          <td className="loc fixed" rowSpan={4}>{nameLabel.replace(/ /g, '\n')}</td>
          <td className="srcLabel fixed">기상청</td>
          <td className="kmaVal fixed" style={popColorStyle(loc.kma ? loc.kma.summary.D.pop : null)}>{kmaD}</td>
          <td className="kmaVal fixed" style={popColorStyle(loc.kma ? loc.kma.summary.N.pop : null)}>{kmaN}</td>
        </tr>
        <tr>
          <td className="fixed" />
          <td className="dash fixed">-</td>
          <td className="dash fixed">-</td>
        </tr>
        <tr>
          <td className="srcLabel fixed">아큐웨더</td>
          <td className="accVal fixed" style={popColorStyle(loc.accD)}>{accD}</td>
          <td className="accVal fixed" style={popColorStyle(loc.accN)}>{accN}</td>
        </tr>
        <tr>
          <td className="fixed" />
          <td className="mm fixed">{mmD}</td>
          <td className="mm fixed">{mmN}</td>
        </tr>
      </tbody>
      <style jsx>{`
        .weather { border-collapse: collapse; table-layout: fixed; }
        .fixed { width: 110px; height: 34px; }
        td { border: 1px solid #000; text-align:center; font-size:15px; padding:2px 6px; vertical-align:middle; }
        .head { background:#FFFF00; font-weight:bold; }
        .loc { font-weight:bold; white-space: pre-line; line-height:1.25; }
        .srcLabel { font-weight:bold; }
        .kmaVal, .accVal { font-weight:normal; }
        .dash, .mm { color:#333; }
      `}</style>
    </table>
  );
}

// 상세(시간단위) 모드 표 블록 하나 = 지역 하나, 15개 시간 컬럼.
// 원본 사진과 동일한 5행 구조: 헤더 / 기상청% / 기상청mm / 아큐웨더% / 아큐웨더mm
function HourlyBlock({ loc }) {
  const nameLabel = loc.address || '지역명';
  const range = loc.kma?.range || Array(15).fill({ date: '', hour: '--', pop: null, pcp: null });

  return (
    <table className="hourly">
      <tbody>
        <tr>
          <td className="head fixed locHead">{formatDateLabel(loc.date)}</td>
          <td className="head fixed">시간</td>
          {range.map((pt, idx) => (
            <td className="head fixed" key={idx}>{pt.hour}시</td>
          ))}
        </tr>
        <tr>
          <td className="loc fixed" rowSpan={4}>{nameLabel.replace(/ /g, '\n')}</td>
          <td className="srcLabel fixed">기상청</td>
          {range.map((pt, idx) => (
            <td className="kmaVal fixed" key={idx} style={popColorStyle(pt.pop)}>{fmtPct(pt.pop)}</td>
          ))}
        </tr>
        <tr>
          <td className="srcLabel fixed" />
          {range.map((pt, idx) => (
            <td className="mm fixed" key={idx}>{fmtMm(pt.pcp)}</td>
          ))}
        </tr>
        <tr>
          <td className="srcLabel fixed">아큐웨더</td>
          {range.map((pt, idx) => (
            <td className="accVal fixed" key={idx} style={popColorStyle(loc.accHourly[idx].pop)}>{fmtPct(loc.accHourly[idx].pop)}</td>
          ))}
        </tr>
        <tr>
          <td className="srcLabel fixed" />
          {range.map((pt, idx) => (
            <td className="mm fixed" key={idx}>{fmtMm(loc.accHourly[idx].mm)}</td>
          ))}
        </tr>
      </tbody>
      <style jsx>{`
        .hourly { border-collapse: collapse; table-layout: fixed; }
        .fixed { width: 56px; height: 34px; }
        .locHead { width: 100px; }
        td { border: 1px solid #000; text-align:center; font-size:12px; padding:2px 3px; vertical-align:middle; }
        .head { background:#FFFF00; font-weight:bold; }
        .loc { font-weight:bold; width:100px; font-size:13px; white-space: pre-line; line-height:1.2; }
        .srcLabel { font-weight:bold; width:70px; }
        .mm { color:#333; }
      `}</style>
    </table>
  );
}

function formatDateLabel(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
}
