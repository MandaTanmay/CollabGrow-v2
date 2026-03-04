const { query } = require('./db');

async function listSkills() {
  const result = await query(
    `SELECT id, name, description, created_at, updated_at FROM skills ORDER BY name ASC`
  );
  return result.rows;
}

async function addSkillToUser(userId, skillId, proficiency_level, years_experience) {
  await query(
    `INSERT INTO user_skills (user_id, skill_id, proficiency_level, years_experience)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, skill_id) DO UPDATE SET proficiency_level = EXCLUDED.proficiency_level, years_experience = EXCLUDED.years_experience`,
    [userId, skillId, proficiency_level, years_experience]
  );
  return true;
}

async function removeSkillFromUser(userId, skillId) {
  await query('DELETE FROM user_skills WHERE user_id = $1 AND skill_id = $2', [userId, skillId]);
  return true;
}

module.exports = {
  listSkills,
  addSkillToUser,
  removeSkillFromUser
};
