const COUNTRY_MAP = {
  "tanzania": "TZ",
  "nigeria": "NG",
  "uganda": "UG",
  "sudan": "SD",
  "united states": "US",
  "madagascar": "MG",
  "united kingdom": "GB",
  "india": "IN",
  "cameroon": "CM",
  "cape verde": "CV",
  "republic of the congo": "CG",
  "mozambique": "MZ",
  "south africa": "ZA",
  "mali": "ML",
  "angola": "AO",
  "dr congo": "CD",
  "france": "FR",
  "kenya": "KE",
  "zambia": "ZM",
  "eritrea": "ER",
  "gabon": "GA",
  "rwanda": "RW",
  "senegal": "SN",
  "namibia": "NA",
  "gambia": "GM",
  "côte d'ivoire": "CI",
  "ivory coast": "CI",
  "ethiopia": "ET",
  "morocco": "MA",
  "malawi": "MW",
  "brazil": "BR",
  "tunisia": "TN",
  "somalia": "SO",
  "ghana": "GH",
  "zimbabwe": "ZW",
  "egypt": "EG",
  "benin": "BJ",
  "western sahara": "EH",
  "australia": "AU",
  "china": "CN",
  "botswana": "BW",
  "canada": "CA",
  "liberia": "LR",
  "mauritania": "MR",
  "burundi": "BI",
  "burkina faso": "BF",
  "central african republic": "CF",
  "mauritius": "MU",
  "algeria": "DZ",
  "japan": "JP",
  "guinea-bissau": "GW",
  "eswatini": "SZ",
  "sierra leone": "SL",
  "comoros": "KM",
  "seychelles": "SC",
  "south sudan": "SS",
  "germany": "DE",
  "djibouti": "DJ",
  "niger": "NE",
  "togo": "TG",
  "lesotho": "LS",
  "chad": "TD",
  "são tomé and príncipe": "ST",
  "sao tome and principe": "ST",
  "libya": "LY",
  "guinea": "GN",
  "equatorial guinea": "GQ",
};

function resolveCountry(text) {
  const lower = text.toLowerCase().trim();
  if (COUNTRY_MAP[lower]) return COUNTRY_MAP[lower];
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    if (lower.includes(name) || name.includes(lower)) return code;
  }
  return null;
}

function parseQuery(q) {
  if (!q || typeof q !== 'string') return {};
  const filters = {};
  const lower = q.toLowerCase().trim();

  // Gender — if both are mentioned, omit the filter (e.g. "male and female")
  const hasMale = /\bmales?\b/.test(lower);
  const hasFemale = /\bfemales?\b/.test(lower);
  if (hasMale && !hasFemale) filters.gender = 'male';
  if (hasFemale && !hasMale) filters.gender = 'female';

  // Age groups
  if (/\bchildren\b|\bchild\b/.test(lower)) filters.age_group = 'child';
  if (/\bteenagers?\b/.test(lower)) filters.age_group = 'teenager';
  if (/\badults?\b/.test(lower)) filters.age_group = 'adult';
  if (/\bseniors?\b/.test(lower)) filters.age_group = 'senior';

  // "young" maps to ages 16-24 (parsing only, not a stored age_group)
  if (/\byoung\b/.test(lower)) {
    filters.min_age = 16;
    filters.max_age = 24;
  }

  // above N / over N → min_age
  const aboveMatch = lower.match(/\b(?:above|over)\s+(\d+)/);
  if (aboveMatch) filters.min_age = parseInt(aboveMatch[1], 10);

  // below N / under N → max_age
  const belowMatch = lower.match(/\b(?:below|under)\s+(\d+)/);
  if (belowMatch) filters.max_age = parseInt(belowMatch[1], 10);

  // aged N / age N → exact age
  const agedMatch = lower.match(/\b(?:aged?)\s+(\d+)/);
  if (agedMatch) {
    const age = parseInt(agedMatch[1], 10);
    filters.min_age = age;
    filters.max_age = age;
  }

  // from <country> / in <country>
  const countryMatch = lower.match(/\b(?:from|in)\s+([a-zA-Z\s'ôé]+?)(?:\s*$|\s+(?:and|with|who|aged?|above|over|below|under))/);
  if (countryMatch) {
    const code = resolveCountry(countryMatch[1].trim());
    if (code) filters.country_id = code;
  } else {
    // fallback: try "from X" to end of string
    const fallback = lower.match(/\b(?:from|in)\s+(.+)$/);
    if (fallback) {
      const code = resolveCountry(fallback[1].trim());
      if (code) filters.country_id = code;
    }
  }

  return filters;
}

module.exports = { parseQuery };
