const { query } = require('./db');
const { emitToUser } = require('./realtimeUtil');

async function listNotifications(userId, limit = 20, offset = 0) {
  const result = await query(
    `SELECT id, recipient_id, sender_id, type, title, message, related_project_id, related_entity_id, priority, is_read, created_at
     FROM notifications
     WHERE recipient_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
}

async function markNotificationRead(id) {
  await query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id]);
  return true;
}

async function createNotificationAndEmit(io, notification) {
  const result = await query(
    `INSERT INTO notifications (
        recipient_id,
        sender_id,
        type,
        title,
        message,
        related_project_id,
        related_entity_id,
        priority,
        is_read,
        created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())
     RETURNING id, recipient_id, sender_id, type, title, message, related_project_id, related_entity_id, priority, is_read, created_at`,
    [
      notification.recipient_id,
      notification.sender_id || null,
      notification.type || null,
      notification.title || null,
      notification.message || null,
      notification.related_project_id || null,
      notification.related_entity_id || null,
      notification.priority || 'medium',
      false,
    ]
  );

  const inserted = result.rows[0];

  // Enrich with sender details to match the GET notifications payload shape
  let enriched = inserted;
  if (inserted.sender_id) {
    const senderResult = await query(
      `SELECT id, username, full_name, profile_image_url
       FROM users
       WHERE id = $1`,
      [inserted.sender_id]
    );
    const sender = senderResult.rows?.[0] || null;
    enriched = {
      ...inserted,
      sender: sender
        ? {
            id: sender.id,
            username: sender.username,
            full_name: sender.full_name,
            profile_image_url: sender.profile_image_url,
          }
        : null,
    };
  }

  if (io) {
    emitToUser(io, notification.recipient_id, 'notification', enriched);
  }

  return enriched;
}

module.exports = {
  listNotifications,
  markNotificationRead,
  createNotificationAndEmit
};
