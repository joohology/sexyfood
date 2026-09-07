// 미국 지표 — Twelve Data(무료 플랜: QQQ·SPY 정규장 실시간) + CNN 공포탐욕지수(실시간)
// + VIX/10년물/WTI(무료 플랜에서 제외되는 지수·채권·원자재라 수동 갱신 값)
//
// 필요한 환경변수: TWELVE_DATA_KEY
//
// VIX·10년물·WTI 갱신 방법: 아래 STATIC 객체 값만 고쳐서 다시 배포(git push)하면 됨.

const STATIC = {
  vix: 14.53,
  y10: 4.79,
  wti: 91.87,
  asOf: "2026-09-04 종가 기준 (WTI 2026-09-07)", // 값 바꿀 때 이 문구도 같이 바꿀 것
};

let quoteCache = { at: 0, data: null };
let fngCache = { at: 0, data: null };
const QUOTE_TTL_MS = 60_000; // Twelve Data 무료 한도(일 800건) 보호용
const FNG_TTL_MS = 60_000;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchTwelveData() {
  if (quoteCache.data && Date.now() - quoteCache.at < QUOTE_TTL_MS) {
    return quoteCache.data;
  }
  const key = process.env.TWELVE_DATA_KEY;
  const url = `https://api.twelvedata.com/quote?symbol=QQQ,SPY&apikey=${key}`;
  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));

  // 심볼 하나만 요청하면 객체, 여러 개면 {symbol: {...}} 형태로 옴
  const qqq = data.QQQ || (data.symbol === "QQQ" ? data : null);
  const spy = data.SPY || (data.symbol === "SPY" ? data : null);

  const result = {
    qqq: qqq && !qqq.code ? {
      price: num(qqq.close),
      changePct: num(qqq.percent_change),
      marketOpen: qqq.is_market_open ?? null,
    } : { error: qqq && qqq.message ? qqq.message : "응답 없음" },
    spy: spy && !spy.code ? {
      price: num(spy.close),
      changePct: num(spy.percent_change),
      marketOpen: spy.is_market_open ?? null,
    } : { error: spy && spy.message ? spy.message : "응답 없음" },
    raw: data,
  };
  quoteCache = { at: Date.now(), data: result };
  return result;
}

async function fetchFearGreed() {
  if (fngCache.data && Date.now() - fngCache.at < FNG_TTL_MS) {
    return fngCache.data;
  }
  try {
    const r = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: { "user-agent": "Mozilla/5.0 (compatible; market-board/1.0)" },
    });
    const data = await r.json();
    const now = data.fear_and_greed || {};
    const result = {
      score: num(now.score),
      rating: now.rating || null,
      asOf: now.timestamp || null,
    };
    fngCache = { at: Date.now(), data: result };
    return result;
  } catch (err) {
    return { error: String((err && err.message) || err) };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");

  try {
    const [td, fng] = await Promise.all([
      fetchTwelveData().catch((err) => ({ error: String((err && err.message) || err) })),
      fetchFearGreed(),
    ]);

    res.status(200).json({
      ok: true,
      asOf: new Date().toISOString(),
      fearGreed: fng,
      vix: STATIC.vix,
      y10: STATIC.y10,
      wti: STATIC.wti,
      staticAsOf: STATIC.asOf,
      qqq: td.qqq,
      spy: td.spy,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String((err && err.message) || err) });
  }
};
