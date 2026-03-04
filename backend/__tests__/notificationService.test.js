// Basic Jest test for notificationService
const { createNotificationAndEmit, listNotifications } = require('../services/notificationService');
const { query } = require('../services/db');

describe('notificationService', () => {
  let testUserId = 99999;
  let ioMock;

  beforeAll(async () => {
    // Clean up test notifications
    await query('DELETE FROM notifications WHERE recipient_id = $1', [testUserId]);
    ioMock = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
  });

  it('should create and emit a notification', async () => {
    const notif = await createNotificationAndEmit(ioMock, {
      recipient_id: testUserId,
      sender_id: 1,
      type: 'test',
      title: 'Test Notification',
      message: 'This is a test',
      related_project_id: 1,
      priority: 'low'
    });
    expect(notif).toBeDefined();
    expect(notif.recipient_id).toBe(testUserId);
    expect(ioMock.to).toHaveBeenCalledWith(`user:${testUserId}`);
    expect(ioMock.emit).toHaveBeenCalledWith('notification', expect.objectContaining({ recipient_id: testUserId }));
  });

  it('should list notifications for user', async () => {
    const notifs = await listNotifications(testUserId, 10, 0);
    expect(Array.isArray(notifs)).toBe(true);
    expect(notifs.some(n => n.recipient_id === testUserId)).toBe(true);
  });
});
