const GameSession = require('../models/GameSession');
const PlayerSession = require('../models/PlayerSession');
const User = require('../models/User');
const { NotFoundError, ConflictError, ValidationError, AuthorizationError } = require('../utils/errors');
const { SESSION_STATUS, DEFAULTS, ERROR_CODES } = require('../utils/constants');
const scoringService = require('./scoring.service');
const blockchainService = require('./blockchain.service');
const mongoose = require('mongoose');

class SessionService {
  // Helper method to find session by sessionId or _id
  async findSessionById(sessionIdOrId) {
    // Try to find by sessionId (UUID string) first
    let session = await GameSession.findOne({ sessionId: sessionIdOrId });
    
    // If not found and it's a valid ObjectId, try by _id
    if (!session && mongoose.Types.ObjectId.isValid(sessionIdOrId)) {
      session = await GameSession.findById(sessionIdOrId);
    }
    
    return session;
  }

  // Create a new game session
  async createSession(userId, config = {}) {
    const {
      durationMinutes = DEFAULTS.SESSION_DURATION,
      maxPlayers = DEFAULTS.MAX_PLAYERS,
      minPlayersToStart = DEFAULTS.MIN_PLAYERS_TO_START,
      config: sessionConfig = {}
    } = config;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Create session
    const session = await GameSession.create({
      creatorId: userId,
      durationMinutes,
      maxPlayers,
      minPlayersToStart,
      config: {
        scoringType: sessionConfig.scoringType || 'POINTS',
        pointsPerTask: sessionConfig.pointsPerTask || DEFAULTS.POINTS_PER_TASK,
        enableRandomWinner: sessionConfig.enableRandomWinner || false,
        autoStart: sessionConfig.autoStart !== undefined ? sessionConfig.autoStart : true,
        autoEnd: sessionConfig.autoEnd !== undefined ? sessionConfig.autoEnd : true
      }
    });

    // Populate creator
    await session.populate('creatorId', 'username walletAddress');

    return this.formatSessionData(session);
  }

  // Get session by ID or sessionId
  async getSession(sessionIdOrId) {
    const session = await this.findSessionById(sessionIdOrId);
    
    if (!session) {
      throw new NotFoundError('Session');
    }

    await session.populate('creatorId', 'username walletAddress');
    await session.populate('players', 'username walletAddress');
    await session.populate('winner', 'username walletAddress');

    return this.formatSessionData(session);
  }

  // List active/waiting sessions
  async listSessions(status = null, limit = 50) {
    const query = {};
    
    if (status) {
      query.status = status;
    } else {
      // Default: show WAITING and LIVE sessions
      query.status = { $in: [SESSION_STATUS.WAITING, SESSION_STATUS.LIVE] };
    }

    const sessions = await GameSession.find(query)
      .populate('creatorId', 'username walletAddress')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    return sessions.map(session => this.formatSessionData(session));
  }

  // Join a session
  async joinSession(sessionId, userId) {
    // Get session
    const session = await this.findSessionById(sessionId);

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Check if session is joinable
    if (!session.isJoinable()) {
      if (session.status === SESSION_STATUS.ENDED || session.status === SESSION_STATUS.CANCELLED) {
        throw new ConflictError('Session has already ended');
      }
      if (session.isFull) {
        throw new ConflictError('Session is full');
      }
      throw new ValidationError('Session is not joinable');
    }

    // Check if user is already in session
    const existingPlayerSession = await PlayerSession.findOne({
      sessionId: session._id,
      userId
    });

    if (existingPlayerSession && existingPlayerSession.isActive) {
      throw new ConflictError('User is already in this session');
    }

    // Check if user exists and is active
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    if (!user.isActive) {
      throw new ValidationError('User account is not active');
    }

    // Create or reactivate PlayerSession
    let playerSession;
    if (existingPlayerSession) {
      // Reactivate existing session
      existingPlayerSession.isActive = true;
      existingPlayerSession.leftAt = null;
      existingPlayerSession.lastActivityAt = new Date();
      playerSession = await existingPlayerSession.save();
    } else {
      // Create new PlayerSession
      playerSession = await PlayerSession.create({
        sessionId: session._id,
        userId,
        score: 0,
        tasksCompleted: 0
      });
    }

    // Add user to session players if not already there
    if (!session.players.some(id => id.toString() === userId.toString())) {
      await session.addPlayer(userId);
    }

    // Increment user's session count
    await user.incrementSessionsJoined();

    // Get updated session
    const updatedSession = await this.getSession(session._id);

    return updatedSession;
  }

  // Leave a session
  async leaveSession(sessionId, userId) {
    // Get session
    const session = await this.findSessionById(sessionId);

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Find PlayerSession
    const playerSession = await PlayerSession.findOne({
      sessionId: session._id,
      userId
    });

    if (!playerSession) {
      throw new NotFoundError('Player session');
    }

    if (!playerSession.isActive) {
      throw new ValidationError('Player is not active in this session');
    }

    // Leave session
    await playerSession.leaveSession();

    // Remove from session players
    await session.removePlayer(userId);

    return { success: true };
  }

  // End a session
  async endSession(sessionId, userId) {
    // Get session
    const session = await this.findSessionById(sessionId);

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Verify user is creator
    if (session.creatorId.toString() !== userId.toString()) {
      throw new AuthorizationError('Only session creator can end the session');
    }

    // Check if already ended
    if (session.status === SESSION_STATUS.ENDED || session.status === SESSION_STATUS.CANCELLED) {
      throw new ConflictError('Session is already ended');
    }

    // End session
    await session.end();

    // Get updated session
    const updatedSession = await this.getSession(session._id);

    return updatedSession;
  }

  // End session and process rewards
  async endSessionAndProcessRewards(sessionId, userId, broadcastService = null) {
    // Get session
    const session = await this.findSessionById(sessionId);

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Verify user is creator (if userId provided, otherwise allow system/auto-end)
    if (userId && session.creatorId.toString() !== userId.toString()) {
      throw new AuthorizationError('Only session creator can end the session');
    }

    // Check if already ended
    if (session.status === SESSION_STATUS.ENDED || session.status === SESSION_STATUS.CANCELLED) {
      throw new ConflictError('Session is already ended');
    }

    // End session
    await session.end();

    // Calculate winner
    const winner = await scoringService.calculateWinner(session._id);

    // Get final leaderboard
    const leaderboard = await scoringService.getFinalLeaderboard(session._id);

    // Award token to winner if exists
    let rewardData = null;
    if (winner) {
      try {
        // Get winner userId (handle both ObjectId and populated object)
        const winnerUserId = winner.userId._id || winner.userId;
        
        rewardData = await blockchainService.awardToken(session._id, winnerUserId, null);
        
        // Update user's sessions won count
        const winnerUser = await User.findById(winnerUserId);
        if (winnerUser) {
          await winnerUser.incrementSessionsWon();
        }
      } catch (error) {
        console.error('Error awarding token:', error);
        // Continue even if token award fails - reward will be in PENDING status
        rewardData = {
          status: 'PENDING',
          error: error.message
        };
      }
    }

    // Get updated session
    const updatedSession = await this.getSession(session._id);

    // Broadcast events if broadcast service provided
    if (broadcastService) {
      broadcastService.notifySessionEnded(
        session.sessionId,
        updatedSession,
        winner,
        leaderboard
      );

      if (rewardData && rewardData.transactionHash) {
        const winnerUserId = winner.userId._id || winner.userId;
        broadcastService.notifyTokenRewarded(
          session.sessionId,
          winnerUserId,
          rewardData
        );
      }
    }

    return {
      session: updatedSession,
      winner: winner ? {
        userId: winner.userId,
        username: winner.username,
        walletAddress: winner.walletAddress,
        score: winner.score,
        tasksCompleted: winner.tasksCompleted
      } : null,
      leaderboard,
      reward: rewardData
    };
  }

  // Get leaderboard
  async getLeaderboard(sessionId, limit = 10) {
    // Get session to verify it exists
    const session = await this.findSessionById(sessionId);

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Get leaderboard
    const leaderboard = await PlayerSession.getLeaderboard(session._id, parseInt(limit));

    return leaderboard.map((player, index) => ({
      rank: index + 1,
      userId: player.userId._id,
      username: player.userId.username,
      walletAddress: player.userId.walletAddress,
      score: player.score,
      tasksCompleted: player.tasksCompleted,
      joinedAt: player.joinedAt
    }));
  }

  // Update player score
  async updatePlayerScore(sessionId, userId, score, tasksCompleted) {
    // Get session
    const session = await this.findSessionById(sessionId);

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Check if session is active
    if (session.status !== SESSION_STATUS.LIVE) {
      throw new ValidationError('Can only update score in LIVE sessions');
    }

    // Find PlayerSession
    const playerSession = await PlayerSession.findOne({
      sessionId: session._id,
      userId,
      isActive: true
    });

    if (!playerSession) {
      throw new NotFoundError('Player session');
    }

    // Update score
    await playerSession.updatePerformance(
      score !== undefined ? score : playerSession.score,
      tasksCompleted !== undefined ? tasksCompleted : playerSession.tasksCompleted
    );

    // Get updated player data
    const updatedPlayer = await PlayerSession.findById(playerSession._id)
      .populate('userId', 'username walletAddress');

    return {
      userId: updatedPlayer.userId._id,
      username: updatedPlayer.userId.username,
      score: updatedPlayer.score,
      tasksCompleted: updatedPlayer.tasksCompleted,
      lastActivityAt: updatedPlayer.lastActivityAt
    };
  }

  // Check if session is joinable
  async isSessionJoinable(sessionId) {
    const session = await this.findSessionById(sessionId);

    if (!session) {
      return false;
    }

    return session.isJoinable();
  }

  // Format session data for response
  formatSessionData(session) {
    const sessionObj = session.toObject ? session.toObject() : session;
    
    return {
      _id: sessionObj._id,
      sessionId: sessionObj.sessionId,
      status: sessionObj.status,
      creator: sessionObj.creatorId ? {
        _id: sessionObj.creatorId._id || sessionObj.creatorId,
        username: sessionObj.creatorId.username,
        walletAddress: sessionObj.creatorId.walletAddress
      } : null,
      players: sessionObj.players ? sessionObj.players.map(p => ({
        _id: p._id || p,
        username: p.username,
        walletAddress: p.walletAddress
      })) : [],
      playerCount: sessionObj.players ? sessionObj.players.length : 0,
      winner: sessionObj.winner ? {
        _id: sessionObj.winner._id || sessionObj.winner,
        username: sessionObj.winner.username,
        walletAddress: sessionObj.winner.walletAddress
      } : null,
      startTime: sessionObj.startTime,
      endTime: sessionObj.endTime,
      scheduledEndTime: sessionObj.scheduledEndTime,
      durationMinutes: sessionObj.durationMinutes,
      maxPlayers: sessionObj.maxPlayers,
      minPlayersToStart: sessionObj.minPlayersToStart,
      config: sessionObj.config,
      isFull: sessionObj.players ? sessionObj.players.length >= sessionObj.maxPlayers : false,
      remainingTime: sessionObj.scheduledEndTime && sessionObj.status === SESSION_STATUS.LIVE
        ? Math.max(0, sessionObj.scheduledEndTime.getTime() - Date.now())
        : null,
      createdAt: sessionObj.createdAt,
      updatedAt: sessionObj.updatedAt
    };
  }
}

module.exports = new SessionService();

