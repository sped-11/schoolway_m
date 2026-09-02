export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://sped-11.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { origin, destination, mode = 'TRANSIT' } = req.query;

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
    const [originX, originY] = String(origin).split(',');
    const [destinationX, destinationY] = String(destination).split(',');
    if (![originX, originY, destinationX, destinationY].every(value => Number.isFinite(Number(value)))) {
      return res.status(400).json({ ok: false, error: 'origin and destination must be x,y coordinates.' });
    }

    const isWalk = String(mode).toUpperCase() === 'WALK';
    const kakaoUrl = new URL(`https://dapi.kakao.com/v2/routing/${isWalk ? 'walk' : 'publictraffic'}`);
    kakaoUrl.searchParams.set('start_x', originX);
    kakaoUrl.searchParams.set('start_y', originY);
    kakaoUrl.searchParams.set('end_x', destinationX);
    kakaoUrl.searchParams.set('end_y', destinationY);
    kakaoUrl.searchParams.set('input_coord', 'WGS84');
    kakaoUrl.searchParams.set('output_coord', 'WGS84');
    if (isWalk) kakaoUrl.searchParams.set('route_mode', 'SHORTEST');

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

    if (payload.status !== 'OK') {
      return res.status(422).json({ ok: false, error: `Kakao ${isWalk ? 'walking' : 'public transit'} route unavailable.`, payload });
    }

    const route = isWalk ? payload.route : (payload.routes || [])
      .filter(item => item?.properties)
      .sort((a, b) => Number(a.properties.totalDistance || 0) - Number(b.properties.totalDistance || 0))[0];
    const properties = isWalk ? route?.properties : route?.properties;
    const distance = isWalk ? properties?.totalDistance : properties?.totalDistance;
    const duration = isWalk ? properties?.totalTime : properties?.totalTime;
    if (!route || !Number(distance) || !Number(duration)) {
      return res.status(422).json({ ok: false, error: 'Kakao route did not include distance and duration.', payload });
    }

    return res.status(200).json({
      ok: true,
      routes: [{
        summary: {
          distance: Number(distance),
          duration: Number(duration)
        },
        routeType: isWalk ? 'WALK' : properties.type,
        routeMode: isWalk ? 'SHORTEST' : 'SHORTEST_DISTANCE',
        landingUrl: isWalk
          ? route.properties?.landingUrl
          : payload.properties?.landingURL,
        source: 'kakao-map-rest'
      }],
      kakao: payload
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'Failed to fetch Kakao Directions route.',
      detail: error.message
    });
  }
}
