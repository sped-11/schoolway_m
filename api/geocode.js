export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://sped-11.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = String(req.query.query || '').trim();
  if (!query) {
    return res.status(400).json({ ok: false, verified: false, error: 'query is required.' });
  }

  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    return res.status(500).json({ ok: false, verified: false, error: 'KAKAO_REST_API_KEY is missing.' });
  }

  try {
    const kakaoUrl = new URL('https://dapi.kakao.com/v2/local/search/address.json');
    kakaoUrl.searchParams.set('query', query);
    const response = await fetch(kakaoUrl, {
      headers: { Authorization: `KakaoAK ${key}` }
    });
    const payload = await response.json();
    const document = payload.documents?.[0];

    if (!response.ok || !document) {
      return res.status(response.ok ? 404 : response.status).json({ ok: false, verified: false, payload });
    }

    return res.status(200).json({
      ok: true,
      verified: true,
      lat: Number(document.y),
      lng: Number(document.x),
      matchedAddress: document.address_name || document.road_address?.address_name || query
    });
  } catch (error) {
    return res.status(500).json({ ok: false, verified: false, error: error.message });
  }
}