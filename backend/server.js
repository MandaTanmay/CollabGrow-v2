const express = require('express');
const cors = require('cors');
require('dotenv').config();
const cookieParser = require('cookie-parser');

// Import configuration and utilities
const { validateEnvironment, getConfig } = require('./config/environment');
const logger = require('./utils/logger');
const { apiRateLimiter } = require('./middleware/rateLimiting');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Validate environment before starting
validateEnvironment();
const config = getConfig();

const app = express();
const PORT = config.port;

// CORS configuration - more permissive in development
app.use(cors({
    origin: config.isDevelopment ? true : config.cors.origin, // Allow all origins in dev
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
    exposedHeaders: config.isDevelopment ? ['X-User-Id'] : [],
    maxAge: 86400, // 24 hours
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logging middleware (development only)
if (config.isDevelopment) {
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            logger.http(req.method, req.path, res.statusCode, req.user?.userId, duration);
        });
        next();
    });
}

// Apply rate limiting to all routes
app.use(apiRateLimiter);

// Import routes
const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');
const projectsRoutes = require('./routes/projects');
const storageRoutes = require('./routes/storage');
const usersRoutes = require('./routes/users');
const requestsRoutes = require('./routes/requests');
const queriesRoutes = require('./routes/queries');
const collaboratorsRoutes = require('./routes/collaborators');
const compatibilityRoutes = require('./routes/compatibility');
const milestonesRoutes = require('./routes/milestones');
const performanceRoutes = require('./routes/performance');

const recommendRoutes = require('./routes/recommend');
const recommendAdminRoutes = require('./routes/recommend-admin');
const applicationsRoutes = require('./routes/applications');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/storage-setup', storageRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/queries', queriesRoutes);
app.use('/api/collaborators', collaboratorsRoutes);
app.use('/api/compatibility', compatibilityRoutes);
app.use('/api/milestones', milestonesRoutes);
app.use('/api/performance', performanceRoutes);

app.use('/api/recommend', recommendRoutes);
app.use('/api/recommend', recommendAdminRoutes);
app.use('/api/applications', applicationsRoutes);


// Health check endpoints
app.get('/health', (req, res) => {
    return res.json({ 
        success: true,
        status: 'OK', 
        message: 'CollabGrow Backend API is running',
        environment: config.env,
        timestamp: new Date().toISOString(),
    });
});

// Database connectivity check
const { query } = require('./services/db');
app.get('/api/health/db', async (req, res) => {
    try {
        const start = Date.now();
        await query('SELECT 1');
        const duration = Date.now() - start;
        return res.json({ 
            success: true,
            status: 'OK', 
            message: 'Database connection successful',
            responseTime: `${duration}ms`,
        });
    } catch (err) {
        logger.error('Database health check failed', err);
        return res.status(500).json({ 
            success: false,
            status: 'ERROR', 
            message: 'Database connection failed',
        });
    }
});

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Start HTTP and Socket.IO server
const http = require('http');
const server = http.createServer(app);

// --- SOCKET.IO SETUP ---
const { Server } = require('socket.io');
const socketManager = require('./services/socketManager');
const { verifyAccessToken } = require('./utils/tokenUtils');

const io = new Server(server, {
    cors: {
        origin: config.isDevelopment ? true : config.cors.origin,
        methods: ['GET', 'POST'],
        credentials: true,
    }
});

// Make io instance available to other modules
socketManager.setIO(io);

// Socket.IO JWT authentication middleware
io.use((socket, next) => {
    try {
        // Parse cookies from handshake headers
        const cookies = socket.handshake.headers.cookie;
        if (!cookies) {
            logger.warn('Socket.IO connection without cookies - allowing connection but marking as unauthenticated', {
                socketId: socket.id,
                ip: socket.handshake.address,
            });
            // Allow connection but mark as unauthenticated
            socket.userId = null;
            socket.userEmail = null;
            socket.isAuthenticated = false;
            return next();
        }

        // Parse cookie string manually
        const cookieObj = {};
        cookies.split(';').forEach(cookie => {
            const [key, value] = cookie.trim().split('=');
            if (key && value) {
                cookieObj[key] = value;
            }
        });

        const accessToken = cookieObj.accessToken;
        
        if (!accessToken) {
            logger.warn('Socket.IO connection without access token - allowing connection but marking as unauthenticated', {
                socketId: socket.id,
                ip: socket.handshake.address,
            });
            // Allow connection but mark as unauthenticated
            socket.userId = null;
            socket.userEmail = null;
            socket.isAuthenticated = false;
            return next();
        }

        // Verify JWT token
        try {
            const decoded = verifyAccessToken(accessToken);
            
            // Attach user data to socket for easy access
            socket.userId = decoded.userId;
            socket.userEmail = decoded.email;
            socket.isAuthenticated = true;
            
            logger.debug('Socket.IO authenticated', {
                socketId: socket.id,
                userId: decoded.userId,
            });
        } catch (tokenError) {
            logger.warn('Socket.IO token verification failed - allowing connection but marking as unauthenticated', {
                socketId: socket.id,
                error: tokenError.message,
            });
            // Allow connection but mark as unauthenticated
            socket.userId = null;
            socket.userEmail = null;
            socket.isAuthenticated = false;
        }
        
        next();
    } catch (error) {
        logger.error('Socket.IO authentication middleware error', {
            socketId: socket.id,
            error: error.message,
        });
        // Still allow connection to avoid disrupting the app
        socket.userId = null;
        socket.userEmail = null;
        socket.isAuthenticated = false;
        next();
    }
});

io.on('connection', (socket) => {
    logger.debug('Socket.IO connection established', { socketId: socket.id });

    // Auto-join per-user room for notifications (and any other user-targeted events)
    if (socket.isAuthenticated && socket.userId) {
        const userRoom = `user:${socket.userId}`;
        socket.join(userRoom);
        logger.debug('Socket.IO user room joined', {
            socketId: socket.id,
            userId: socket.userId,
            room: userRoom,
        });
    }

    // Join a project chat room
    socket.on('joinRoom', async (roomId) => {
        try {
            // Validate roomId format
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId)) {
                return socket.emit('error', { message: 'Invalid room ID' });
            }

            socket.join(roomId);
            
            // Fetch chat history
            const { rows } = await query(
                `SELECT 
                    id, 
                    user_id as "userId", 
                    user_name as "userName", 
                    user_logo as "userLogo", 
                    content, 
                    timestamp,
                    is_system as "isSystem"
                FROM project_chat_messages 
                WHERE project_id = $1 
                ORDER BY timestamp ASC 
                LIMIT 100`,
                [roomId]
            );
            
            socket.emit('chatHistory', rows);
            logger.debug('User joined chat room', { socketId: socket.id, roomId });
        } catch (err) {
            logger.error('Error fetching chat history', err, { roomId });
            socket.emit('chatHistory', []);
        }
    });

    // Handle new chat message
    socket.on('chatMessage', async (msg) => {
        try {
            // Validate message structure
            if (!msg || !msg.roomId || !msg.userId || !msg.content) {
                return socket.emit('error', { message: 'Invalid message format' });
            }

            // Sanitize content (prevent XSS)
            const { sanitizeString } = require('./utils/validation');
            const sanitizedContent = sanitizeString(msg.content, 5000);

            if (!sanitizedContent || sanitizedContent.length === 0) {
                return socket.emit('error', { message: 'Message content is required' });
            }

            // Lookup internal UUID from users table
            let userUuid = msg.userId;
            if (userUuid && userUuid.length < 36) {
                // Firebase UID, need to convert
                const userRes = await query('SELECT id FROM users WHERE firebase_uid = $1', [msg.userId]);
                if (userRes.rows.length > 0) {
                    userUuid = userRes.rows[0].id;
                } else {
                    return socket.emit('error', { message: 'User not found' });
                }
            }

            // Verify user has access to this project
            const accessCheck = await query(
                `SELECT 1 FROM projects WHERE id = $1 AND (creator_id = $2 OR id IN (
                    SELECT project_id FROM project_collaborators WHERE user_id = $2 AND status = 'Active'
                ))`,
                [msg.roomId, userUuid]
            );

            if (accessCheck.rows.length === 0) {
                logger.security('Unauthorized chat message attempt', {
                    projectId: msg.roomId,
                    userId: userUuid,
                });
                return socket.emit('error', { message: 'Access denied' });
            }

            // Fetch user's real name and profile image from database (don't trust client data)
            const userDataRes = await query(
                'SELECT full_name, profile_image_url FROM users WHERE id = $1',
                [userUuid]
            );
            
            const userName = userDataRes.rows[0]?.full_name || 'User';
            const userLogo = userDataRes.rows[0]?.profile_image_url || null;

            // Insert message
            const insertRes = await query(
                `INSERT INTO project_chat_messages 
                    (project_id, user_id, user_name, user_logo, content, timestamp) 
                VALUES ($1, $2, $3, $4, $5, $6) 
                RETURNING 
                    id, 
                    project_id as "roomId", 
                    user_id as "userId", 
                    user_name as "userName", 
                    user_logo as "userLogo", 
                    content, 
                    timestamp`,
                [
                    msg.roomId, 
                    userUuid, 
                    userName, 
                    userLogo, 
                    sanitizedContent, 
                    msg.timestamp || new Date().toISOString()
                ]
            );
            
            const savedMsg = insertRes.rows[0];
            io.to(msg.roomId).emit('chatMessage', savedMsg);
            
            logger.debug('Chat message sent', { 
                roomId: msg.roomId, 
                userId: userUuid,
                messageId: savedMsg.id,
            });
        } catch (err) {
            logger.error('Error saving chat message', err);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Handle project update posted
    socket.on('projectUpdatePosted', async (data) => {
        try {
            const { projectId, update } = data;
            
            if (!projectId || !update) {
                return socket.emit('error', { message: 'Invalid update data' });
            }

            // Broadcast the update to all users in the project room
            io.to(projectId).emit('projectUpdatePosted', update);
            
            logger.debug('Project update broadcasted', { 
                projectId, 
                updateId: update.id 
            });
        } catch (err) {
            logger.error('Error broadcasting project update', err);
        }
    });

    // Handle project update edited
    socket.on('projectUpdateEdited', async (data) => {
        try {
            const { projectId, update } = data;
            
            if (!projectId || !update) {
                return socket.emit('error', { message: 'Invalid update data' });
            }

            // Broadcast the updated update to all users in the project room
            io.to(projectId).emit('projectUpdateEdited', update);
            
            logger.debug('Project update edit broadcasted', { 
                projectId, 
                updateId: update.id 
            });
        } catch (err) {
            logger.error('Error broadcasting update edit', err);
        }
    });

    // Handle project update deleted
    socket.on('projectUpdateDeleted', async (data) => {
        try {
            const { projectId, updateId } = data;
            
            if (!projectId || !updateId) {
                return socket.emit('error', { message: 'Invalid delete data' });
            }

            // Broadcast the deletion to all users in the project room
            io.to(projectId).emit('projectUpdateDeleted', { updateId });
            
            logger.debug('Project update deletion broadcasted', { 
                projectId, 
                updateId 
            });
        } catch (err) {
            logger.error('Error broadcasting update deletion', err);
        }
    });

    socket.on('disconnect', () => {
        logger.debug('Socket.IO disconnection', { socketId: socket.id });
    });

    socket.on('error', (err) => {
        logger.error('Socket.IO error', err, { socketId: socket.id });
    });
});

// Start server
server.listen(PORT, () => {
    logger.info(`CollabGrow Backend started`, {
        port: PORT,
        environment: config.env,
        nodeVersion: process.version,
    });
});
