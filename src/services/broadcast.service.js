const { SOCKET_EVENTS } = require('../utils/constants');

class BroadcastService {
  constructor(io) {
    this.io = io;
  }

  // Broadcast to all players in a session
  broadcastToSession(sessionId, event, data) {
    this.io.to(sessionId).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  // Broadcast to all players except sender
  broadcastToSessionExcept(sessionId, socketId, event, data) {
    this.io.to(sessionId).except(socketId).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  // Notify player joined
  notifyPlayerJoined(sessionId, user, playerCount) {
    this.broadcastToSession(sessionId, SOCKET_EVENTS.PLAYER_JOINED, {
      userId: user._id || user,
      username: user.username,
      playerCount
    });
  }

  // Notify player left
  notifyPlayerLeft(sessionId, user, playerCount) {
    this.broadcastToSession(sessionId, SOCKET_EVENTS.PLAYER_LEFT, {
      userId: user._id || user,
      username: user.username,
      playerCount
    });
  }

  // Notify score update
  notifyScoreUpdate(sessionId, userId, scoreData, leaderboard) {
    this.broadcastToSession(sessionId, SOCKET_EVENTS.SCORE_UPDATED, {
      userId,
      score: scoreData.score,
      tasksCompleted: scoreData.tasksCompleted,
      leaderboard
    });
  }

  // Notify session started
  notifySessionStarted(sessionId, sessionData) {
    this.broadcastToSession(sessionId, SOCKET_EVENTS.SESSION_STARTED, {
      sessionId,
      startTime: sessionData.startTime,
      duration: sessionData.durationMinutes,
      scheduledEndTime: sessionData.scheduledEndTime
    });
  }

  // Notify session ended
  notifySessionEnded(sessionId, sessionData, winner, leaderboard) {
    this.broadcastToSession(sessionId, SOCKET_EVENTS.SESSION_ENDED, {
      sessionId,
      winner: winner ? {
        userId: winner._id || winner,
        username: winner.username
      } : null,
      leaderboard,
      endTime: sessionData.endTime
    });
  }

  // Notify token reward
  notifyTokenRewarded(sessionId, userId, rewardData) {
    this.broadcastToSession(sessionId, SOCKET_EVENTS.TOKEN_REWARDED, {
      sessionId,
      userId,
      tokenAmount: rewardData.tokenAmount,
      transactionHash: rewardData.transactionHash,
      status: rewardData.status
    });
  }

  // Send error to specific socket
  sendError(socket, message, code) {
    socket.emit(SOCKET_EVENTS.ERROR, {
      message,
      code,
      timestamp: new Date().toISOString()
    });
  }

  // Get connected players in a session
  getSessionPlayers(sessionId) {
    const room = this.io.sockets.adapter.rooms.get(sessionId);
    return room ? Array.from(room) : [];
  }
}

module.exports = BroadcastService;

