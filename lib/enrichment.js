const COUNTRY_NAMES = {
  "TZ": "Tanzania", "NG": "Nigeria", "UG": "Uganda", "SD": "Sudan",
  "US": "United States", "MG": "Madagascar", "GB": "United Kingdom",
  "IN": "India", "CM": "Cameroon", "CV": "Cape Verde", "CG": "Republic of the Congo",
  "MZ": "Mozambique", "ZA": "South Africa", "ML": "Mali", "AO": "Angola",
  "CD": "DR Congo", "FR": "France", "KE": "Kenya", "ZM": "Zambia",
  "ER": "Eritrea", "GA": "Gabon", "RW": "Rwanda", "SN": "Senegal",
  "NA": "Namibia", "GM": "Gambia", "CI": "Côte d'Ivoire", "ET": "Ethiopia",
  "MA": "Morocco", "MW": "Malawi", "BR": "Brazil", "TN": "Tunisia",
  "SO": "Somalia", "GH": "Ghana", "ZW": "Zimbabwe", "EG": "Egypt",
  "BJ": "Benin", "EH": "Western Sahara", "AU": "Australia", "CN": "China",
  "BW": "Botswana", "CA": "Canada", "LR": "Liberia", "MR": "Mauritania",
  "BI": "Burundi", "BF": "Burkina Faso", "CF": "Central African Republic",
  "MU": "Mauritius", "DZ": "Algeria", "JP": "Japan", "GW": "Guinea-Bissau",
  "SZ": "Eswatini", "SL": "Sierra Leone", "KM": "Comoros", "SC": "Seychelles",
  "SS": "South Sudan", "DE": "Germany", "DJ": "Djibouti", "NE": "Niger",
  "TG": "Togo", "LS": "Lesotho", "TD": "Chad", "ST": "São Tomé and Príncipe",
  "LY": "Libya", "GN": "Guinea", "GQ": "Equatorial Guinea",
};

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
    age: agify.age,
    age_group: classifyAgeGroup(agify.age),
    country_id: topCountry.country_id,
    country_name: COUNTRY_NAMES[topCountry.country_id] || topCountry.country_id,
    country_probability: topCountry.probability,
  };
}

module.exports = { enrichName, UpstreamError };
