const { query } = require('./db');

async function listUserActivities(userId, limit = 20, offset = 0) {
  const result = await query(
    `SELECT id, user_id, activity_type, activity_data, is_public, created_at, updated_at FROM user_activities WHERE user_id = $1 AND is_public = TRUE ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
}

module.exports = {
  listUserActivities
};
