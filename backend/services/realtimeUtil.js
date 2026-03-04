// Utility to emit real-time events to users via Socket.IO

function emitToUser(io, userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = { emitToUser };
