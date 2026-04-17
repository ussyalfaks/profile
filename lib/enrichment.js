// Fetches data from Genderize, Agify, and Nationalize in parallel.
// Throws a tagged error if any API returns invalid data so the route
// handler can respond with the correct 502 message.

class UpstreamError extends Error {
  constructor(apiName) {
    super(`${apiName} returned an invalid response`);
    this.name = 'UpstreamError';
    this.apiName = apiName;
  }
}

async function fetchJson(url, apiName) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new UpstreamError(apiName);
    return await res.json();
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    throw new UpstreamError(apiName);
  }
}

function classifyAgeGroup(age) {
  if (age <= 12) return 'child';
  if (age <= 19) return 'teenager';
  if (age <= 59) return 'adult';
  return 'senior';
}

async function enrichName(name) {
  const encoded = encodeURIComponent(name);

  const [genderize, agify, nationalize] = await Promise.all([
    fetchJson(`https://api.genderize.io?name=${encoded}`, 'Genderize'),
    fetchJson(`https://api.agify.io?name=${encoded}`, 'Agify'),
    fetchJson(`https://api.nationalize.io?name=${encoded}`, 'Nationalize'),
  ]);

  if (!genderize.gender || !genderize.count || genderize.count === 0) {
    throw new UpstreamError('Genderize');
  }

  if (agify.age === null || agify.age === undefined) {
    throw new UpstreamError('Agify');
  }

  if (!Array.isArray(nationalize.country) || nationalize.country.length === 0) {
    throw new UpstreamError('Nationalize');
  }

  const topCountry = nationalize.country.reduce((best, c) =>
    c.probability > best.probability ? c : best
  );

  return {
    gender: genderize.gender,
    gender_probability: genderize.probability,
    sample_size: genderize.count,
    age: agify.age,
    age_group: classifyAgeGroup(agify.age),
    country_id: topCountry.country_id,
    country_probability: topCountry.probability,
  };
}

module.exports = { enrichName, UpstreamError };
