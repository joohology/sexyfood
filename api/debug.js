// 진단용. 실제 값은 절대 노출하지 않고, Vercel이 이 함수에 환경변수를
// 실제로 넘겨주고 있는지(존재 여부/길이)만 확인한다.
// 문제 해결되면 이 파일은 지워도 됨.
module.exports = function handler(req, res) {
  function info(name) {
    var v = process.env[name];
    return {
      present: typeof v === "string" && v.length > 0,
      length: typeof v === "string" ? v.length : 0,
    };
  }
  res.status(200).json({
    KIS_APP_KEY: info("KIS_APP_KEY"),
    KIS_APP_SECRET: info("KIS_APP_SECRET"),
    TWELVE_DATA_KEY: info("TWELVE_DATA_KEY"),
    nodeEnv: process.env.VERCEL_ENV || null,
    region: process.env.VERCEL_REGION || null,
  });
};
