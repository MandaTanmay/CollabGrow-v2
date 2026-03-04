const { query } = require('./db');

async function getPostById(id) {
  const result = await query(
    `SELECT id, user_id, content, post_type, project_id, media_urls, tags, likes_count, comments_count, shares_count, is_pinned, visibility, created_at, updated_at FROM posts WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

async function listPosts({ limit = 20, offset = 0 } = {}) {
  const result = await query(
    `SELECT id, user_id, content, post_type, project_id, media_urls, tags, likes_count, comments_count, shares_count, is_pinned, visibility, created_at, updated_at FROM posts WHERE visibility = 'public' ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

async function createPost(post) {
  const result = await query(
    `INSERT INTO posts (user_id, content, post_type, project_id, media_urls, tags, is_pinned, visibility)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, user_id, content, post_type, project_id, media_urls, tags, likes_count, comments_count, shares_count, is_pinned, visibility, created_at, updated_at`,
    [post.user_id, post.content, post.post_type, post.project_id, post.media_urls, post.tags, post.is_pinned, post.visibility]
  );
  return result.rows[0];
}

module.exports = {
  getPostById,
  listPosts,
  createPost
};

async function listPosts({ limit = 20, offset = 0 } = {}) {
  const result = await query(
    `SELECT id, user_id, content, post_type, project_id, media_urls, tags, likes_count, comments_count, shares_count, is_pinned, visibility, created_at, updated_at FROM posts WHERE visibility = 'public' ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

async function createPost(post) {
  const result = await query(
    `INSERT INTO posts (user_id, content, post_type, project_id, media_urls, tags, is_pinned, visibility)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, user_id, content, post_type, project_id, media_urls, tags, likes_count, comments_count, shares_count, is_pinned, visibility, created_at, updated_at`,
    [post.user_id, post.content, post.post_type, post.project_id, post.media_urls, post.tags, post.is_pinned, post.visibility]
  );
  return result.rows[0];
}

module.exports = {
  getPostById,
  listPosts,
  createPost
};
