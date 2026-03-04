const { query } = require('./db');

async function followUser(followerId, followingId) {
  await query(
    `INSERT INTO user_connections (follower_id, following_id, status)
     VALUES ($1, $2, 'active')
     ON CONFLICT DO NOTHING`,
    [followerId, followingId]
  );
  return true;
}

async function unfollowUser(followerId, followingId) {
  await query('DELETE FROM user_connections WHERE follower_id = $1 AND following_id = $2', [followerId, followingId]);
  return true;
}

async function getConnectionsForUser(userId) {
  const result = await query(
    `SELECT id, follower_id, following_id, status, created_at, updated_at FROM user_connections WHERE follower_id = $1 OR following_id = $1`,
    [userId]
  );
  return result.rows;
}

module.exports = {
  followUser,
  unfollowUser,
  getConnectionsForUser
};
