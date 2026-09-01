export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://sped-11.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { origin, destination, mode = 'TRANSIT', priority = 'RECOMMEND' } = req.query;

  if (!origin || !destination) {
    return res.status(400).json({
      ok: false,
      error: 'origin and destination are required.'
    });
  }

  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    return res.status(500).json({
      ok: false,
      error: 'KAKAO_REST_API_KEY is missing.'
    });
  }

  try {
    const kakaoUrl = new URL('https://apis-navi.kakaomobility.com/v1/directions');
    kakaoUrl.searchParams.set('origin', String(origin));
    kakaoUrl.searchParams.set('destination', String(destination));
    kakaoUrl.searchParams.set('mode', String(mode).toUpperCase());
    kakaoUrl.searchParams.set('priority', String(priority));
    kakaoUrl.searchParams.set('alternatives', 'false');
    kakaoUrl.searchParams.set('road_details', 'false');

    const response = await fetch(kakaoUrl, {
      method: 'GET',
      headers: {
        Authorization: `KakaoAK ${key}`,
        'Content-Type': 'application/json'
      }
    });

    const text = await response.text();
    let payload;

    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: 'Kakao directions request failed.',
        status: response.status,
        payload
      });
    }

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'Failed to fetch Kakao Directions route.',
      detail: error.message
    });
  }
}
