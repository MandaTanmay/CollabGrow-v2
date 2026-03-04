/**
 * Socket Manager
 * Provides access to the Socket.IO instance across the application
 */

let io = null;

module.exports = {
    /**
     * Set the Socket.IO instance
     * Called from server.js after io is initialized
     */
    setIO(ioInstance) {
        io = ioInstance;
    },

    /**
     * Get the Socket.IO instance
     */
    getIO() {
        if (!io) {
            throw new Error('Socket.IO not initialized. Call setIO first.');
        }
        return io;
    },

    /**
     * Check if Socket.IO is initialized
     */
    isInitialized() {
        return io !== null;
    }
};
