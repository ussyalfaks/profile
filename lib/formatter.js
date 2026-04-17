// Converts a Prisma profile record into the JSON shape the spec requires.
// created_at must be UTC ISO-8601 with a trailing "Z".

function formatProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    gender: profile.gender,
    gender_probability: profile.gender_probability,
    sample_size: profile.sample_size,
    age: profile.age,
    age_group: profile.age_group,
    country_id: profile.country_id,
    country_probability: profile.country_probability,
    created_at: profile.created_at.toISOString(),
  };
}

module.exports = { formatProfile };
