// 코스피/코스닥 실시간 지수 — KIS Open API(한국투자증권) 프록시
// 필요한 환경변수: KIS_APP_KEY, KIS_APP_SECRET
// 실전투자 도메인 기준(openapi.koreainvestment.com:9443). 모의투자 계좌면
// KIS_BASE를 https://openapivts.koreainvestment.com:29443 로 바꿀 것.

const KIS_BASE = "https://openapi.koreainvestment.com:9443";
const INDEX_CODE = { KOSPI: "0001", KOSDAQ: "1001" };

// 콜드스타트마다 초기화되는 메모리 캐시. 워밍 상태에서는 재사용되어
// 토큰 재발급/업스트림 호출 빈도를 줄여준다.
let tokenCache = { token: null, expiresAt: 0 };
const quoteCache = new Map(); // index -> { at, data }
const QUOTE_TTL_MS = 20_000;

async function getAccessToken() {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }
  const r = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: process.env.KIS_APP_KEY,
      appsecret: process.env.KIS_APP_SECRET,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) {
    throw new Error(`KIS 토큰 발급 실패 (${r.status}): ${JSON.stringify(data).slice(0, 300)}`);
  }
  tokenCache = {
    token: data.access_token,
    expiresAt: now + (Number(data.expires_in) || 86400) * 1000,
  };
  return tokenCache.token;
}

function num(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isKrMarketOpen(d) {
  const kst = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kst.getDay(); // 0 일, 6 토
  if (day === 0 || day === 6) return false;
  const mins = kst.getHours() * 60 + kst.getMinutes();
  return mins >= 540 && mins <= 930; // 09:00~15:30
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");

  const indexParam = String(req.query.index || "KOSPI").toUpperCase();
  const code = INDEX_CODE[indexParam];
  if (!code) {
    res.status(400).json({ ok: false, error: "index는 KOSPI 또는 KOSDAQ 이어야 합니다." });
    return;
  }

  const cached = quoteCache.get(indexParam);
  if (cached && Date.now() - cached.at < QUOTE_TTL_MS) {
    res.status(200).json(cached.data);
    return;
  }

  try {
    const token = await getAccessToken();
    const url = new URL(`${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-index-price`);
    url.searchParams.set("FID_COND_MRKT_DIV_CODE", "U");
    url.searchParams.set("FID_INPUT_ISCD", code);

    const r = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        appkey: process.env.KIS_APP_KEY,
        appsecret: process.env.KIS_APP_SECRET,
        tr_id: "FHPUP02100000",
        custtype: "P",
      },
    });
    const raw = await r.json().catch(() => ({}));

    if (!r.ok || raw.rt_cd !== "0") {
      res.status(502).json({
        ok: false,
        error: raw.msg1 || `KIS API 오류 (HTTP ${r.status})`,
        raw,
      });
      return;
    }

    const o = raw.output || {};
    const payload = {
      ok: true,
      index: indexParam,
      asOf: new Date().toISOString(),
      marketOpen: isKrMarketOpen(new Date()),
      price: num(o.bstp_nmix_prpr),
      change: num(o.bstp_nmix_prdy_vrss),
      changeSign: o.prdy_vrss_sign ?? null, // 1/2 상승, 3 보합, 4/5 하락 (KIS 관례)
      changeRate: num(o.bstp_nmix_prdy_ctrt),
      open: num(o.bstp_nmix_oprc),
      high: num(o.bstp_nmix_hgpr),
      low: num(o.bstp_nmix_lwpr),
      advances: num(o.ascn_issu_cnt),
      unchanged: num(o.stnr_issu_cnt),
      declines: num(o.down_issu_cnt),
      // 필드명이 실제 응답과 다르면 위 값들이 null로 나온다.
      // 그럴 때 이 raw를 보고 정확한 키로 바꾸면 됨(디버깅용, 문제 없으면 나중에 지워도 됨).
      raw: o,
    };
    quoteCache.set(indexParam, { at: Date.now(), data: payload });
    res.status(200).json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, error: String((err && err.message) || err) });
  }
};
