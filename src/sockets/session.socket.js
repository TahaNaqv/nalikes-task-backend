const { authenticateSocket } = require('../middlewares/auth.middleware');
const BroadcastService = require('../services/broadcast.service');
const sessionService = require('../services/session.service');
const { SOCKET_EVENTS, ERROR_CODES } = require('../utils/constants');
const User = require('../models/User');

module.exports = (io) => {
  const broadcastService = new BroadcastService(io);
  
  // Socket authentication middleware
  io.use(authenticateSocket);
  
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id, 'User:', socket.userId);
    
    // Store user sessions for this socket
    const userSessions = new Set();
    
    // Join session
    socket.on(SOCKET_EVENTS.JOIN_SESSION, async ({ sessionId }) => {
      try {
        if (!sessionId) {
          return broadcastService.sendError(socket, 'Session ID is required', ERROR_CODES.VALIDATION_ERROR);
        }

        if (!socket.userId) {
          return broadcastService.sendError(socket, 'Authentication required', ERROR_CODES.AUTHENTICATION_ERROR);
        }

        // Validate and join via service
        const session = await sessionService.joinSession(sessionId, socket.userId);
        
        // Join Socket.IO room
        socket.join(sessionId);
        userSessions.add(sessionId);
        
        // Get user info
        const user = await User.findById(socket.userId).select('username walletAddress');
        
        // Emit confirmation to the joining player
        socket.emit(SOCKET_EVENTS.SESSION_JOINED, {
          sessionId,
          playerCount: session.playerCount,
          sessionData: session,
          timestamp: new Date().toISOString()
        });
        
        // Broadcast to other players in the session
        broadcastService.notifyPlayerJoined(sessionId, user, session.playerCount);
        
        // If session just started, notify all players
        if (session.status === 'LIVE' && session.startTime) {
          const startTime = new Date(session.startTime);
          const now = new Date();
          // Only notify if session started very recently (within 5 seconds)
          if (now.getTime() - startTime.getTime() < 5000) {
            broadcastService.notifySessionStarted(sessionId, session);
          }
        }
        
      } catch (error) {
        console.error('Error joining session:', error);
        broadcastService.sendError(
          socket,
          error.message || 'Failed to join session',
          error.errorCode || ERROR_CODES.INTERNAL_ERROR
        );
      }
    });
    
    // Leave session
    socket.on(SOCKET_EVENTS.LEAVE_SESSION, async ({ sessionId }) => {
      try {
        if (!sessionId) {
          return broadcastService.sendError(socket, 'Session ID is required', ERROR_CODES.VALIDATION_ERROR);
        }

        if (!socket.userId) {
          return broadcastService.sendError(socket, 'Authentication required', ERROR_CODES.AUTHENTICATION_ERROR);
        }

        // Leave via service
        await sessionService.leaveSession(sessionId, socket.userId);
        
        // Leave Socket.IO room
        socket.leave(sessionId);
        userSessions.delete(sessionId);
        
        // Get session to get updated player count
        const session = await sessionService.getSession(sessionId);
        
        // Get user info
        const user = await User.findById(socket.userId).select('username walletAddress');
        
        // Emit confirmation
        socket.emit(SOCKET_EVENTS.SESSION_LEFT, {
          sessionId,
          timestamp: new Date().toISOString()
        });
        
        // Broadcast to other players
        broadcastService.notifyPlayerLeft(sessionId, user, session.playerCount);
        
      } catch (error) {
        console.error('Error leaving session:', error);
        broadcastService.sendError(
          socket,
          error.message || 'Failed to leave session',
          error.errorCode || ERROR_CODES.INTERNAL_ERROR
        );
      }
    });
    
    // Update score
    socket.on(SOCKET_EVENTS.UPDATE_SCORE, async ({ sessionId, score, tasksCompleted }) => {
      try {
        if (!sessionId) {
          return broadcastService.sendError(socket, 'Session ID is required', ERROR_CODES.VALIDATION_ERROR);
        }

        if (!socket.userId) {
          return broadcastService.sendError(socket, 'Authentication required', ERROR_CODES.AUTHENTICATION_ERROR);
        }

        if (score === undefined && tasksCompleted === undefined) {
          return broadcastService.sendError(socket, 'Score or tasksCompleted is required', ERROR_CODES.VALIDATION_ERROR);
        }

        // Update via service
        const playerData = await sessionService.updatePlayerScore(
          sessionId,
          socket.userId,
          score,
          tasksCompleted
        );
        
        // Get leaderboard
        const leaderboard = await sessionService.getLeaderboard(sessionId, 10);
        
        // Broadcast score update
        broadcastService.notifyScoreUpdate(sessionId, socket.userId, playerData, leaderboard);
        
      } catch (error) {
        console.error('Error updating score:', error);
        broadcastService.sendError(
          socket,
          error.message || 'Failed to update score',
          error.errorCode || ERROR_CODES.INTERNAL_ERROR
        );
      }
    });
    
    // Request session data
    socket.on(SOCKET_EVENTS.REQUEST_SESSION_DATA, async ({ sessionId }) => {
      try {
        if (!sessionId) {
          return broadcastService.sendError(socket, 'Session ID is required', ERROR_CODES.VALIDATION_ERROR);
        }

        // Get session data
        const session = await sessionService.getSession(sessionId);
        
        // Get leaderboard
        const leaderboard = await sessionService.getLeaderboard(sessionId, 10);
        
        // Emit session data
        socket.emit(SOCKET_EVENTS.BROADCAST_DATA, {
          type: 'session_data',
          data: {
            session,
            leaderboard
          },
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Error requesting session data:', error);
        broadcastService.sendError(
          socket,
          error.message || 'Failed to get session data',
          error.errorCode || ERROR_CODES.INTERNAL_ERROR
        );
      }
    });
    
    // Ping/Pong heartbeat
    socket.on(SOCKET_EVENTS.PING, () => {
      socket.emit(SOCKET_EVENTS.PONG, {
        timestamp: new Date().toISOString()
      });
    });
    
    // Disconnect handling
    socket.on('disconnect', async () => {
      console.log('Socket disconnected:', socket.id, 'User:', socket.userId);
      
      try {
        // Leave all sessions this socket was in
        for (const sessionId of userSessions) {
          try {
            if (socket.userId) {
              await sessionService.leaveSession(sessionId, socket.userId);
              
              // Get session to get updated player count
              const session = await sessionService.getSession(sessionId);
              
              // Get user info
              const user = await User.findById(socket.userId).select('username walletAddress');
              
              // Broadcast to other players
              broadcastService.notifyPlayerLeft(sessionId, user, session.playerCount);
            }
          } catch (error) {
            console.error(`Error leaving session ${sessionId} on disconnect:`, error);
          }
        }
        
        // Clear sessions
        userSessions.clear();
        
      } catch (error) {
        console.error('Error during disconnect cleanup:', error);
      }
    });
  });
};
