const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || '';

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'SchoolWay API is running.',
    hasKakaoRestKey: Boolean(KAKAO_REST_API_KEY)
  });
});

app.get('/api/geocode', async (req, res) => {
  const query = String(req.query.query || '').trim();
  if (!query) {
    return res.status(400).json({ ok: false, error: 'query is required.' });
  }

  if (!KAKAO_REST_API_KEY) {
    return res.status(500).json({ ok: false, error: 'KAKAO_REST_API_KEY is not set.' });
  }

  try {
    const kakaoUrl = new URL('https://dapi.kakao.com/v2/local/search/address.json');
    kakaoUrl.searchParams.set('query', query);
    const response = await fetch(kakaoUrl, {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` }
    });
    const payload = await response.json();
    const document = payload.documents?.[0];

    if (!response.ok || !document) {
      return res.status(response.ok ? 404 : response.status).json({ ok: false, verified: false, payload });
    }

    return res.json({
      ok: true,
      verified: true,
      lat: Number(document.y),
      lng: Number(document.x),
      matchedAddress: document.address_name || document.road_address?.address_name || query
    });
  } catch (error) {
    return res.status(500).json({ ok: false, verified: false, error: error.message });
  }
});

app.get('/api/directions', async (req, res) => {
  const { origin, destination, mode = 'TRANSIT', priority = 'RECOMMEND' } = req.query;

  if (!origin || !destination) {
    return res.status(400).json({
      ok: false,
      error: 'origin and destination are required.'
    });
  }

  if (!KAKAO_REST_API_KEY) {
    return res.status(500).json({
      ok: false,
      error: 'KAKAO_REST_API_KEY is not set. Add it to .env or your environment.'
    });
  }

  try {
    const kakaoUrl = new URL('https://apis-navi.kakaomobility.com/v1/directions');
    kakaoUrl.searchParams.set('origin', origin);
    kakaoUrl.searchParams.set('destination', destination);
    kakaoUrl.searchParams.set('priority', priority);
    kakaoUrl.searchParams.set('mode', String(mode).toUpperCase());
    kakaoUrl.searchParams.set('alternatives', 'false');
    kakaoUrl.searchParams.set('road_details', 'false');

    const response = await fetch(kakaoUrl, {
      method: 'GET',
      headers: {
        Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
        'Content-Type': 'application/json',
        Origin: `http://localhost:${PORT}`,
        Referer: `http://localhost:${PORT}/`
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

    return res.json(payload);
  } catch (error) {
    console.error('Kakao directions proxy error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to fetch Kakao Directions route.',
      detail: error.message
    });
  }
});

app.use(express.static(path.join(__dirname)));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SchoolWay server running at http://localhost:${PORT}`);
});
