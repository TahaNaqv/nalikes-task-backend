const sessionService = require('../services/session.service');
const { HTTP_STATUS } = require('../utils/constants');

// Create session
exports.createSession = async (req, res, next) => {
  try {
    const { durationMinutes, maxPlayers, minPlayersToStart, config } = req.body;
    const userId = req.userId;
    
    const session = await sessionService.createSession(userId, {
      durationMinutes,
      maxPlayers,
      minPlayersToStart,
      config
    });
    
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

// Get session
exports.getSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await sessionService.getSession(sessionId);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

// List sessions
exports.listSessions = async (req, res, next) => {
  try {
    const { status, limit } = req.query;
    const sessions = await sessionService.listSessions(status, limit);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: sessions
    });
  } catch (error) {
    next(error);
  }
};

// Join session
exports.joinSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.userId;
    
    const session = await sessionService.joinSession(sessionId, userId);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: session,
      message: 'Successfully joined session'
    });
  } catch (error) {
    next(error);
  }
};

// Leave session
exports.leaveSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.userId;
    
    await sessionService.leaveSession(sessionId, userId);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Successfully left session'
    });
  } catch (error) {
    next(error);
  }
};

// End session
exports.endSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.userId;
    
    const session = await sessionService.endSession(sessionId, userId);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: session,
      message: 'Session ended successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get leaderboard
exports.getLeaderboard = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { limit } = req.query;
    
    const leaderboard = await sessionService.getLeaderboard(sessionId, limit);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    next(error);
  }
};

// Update score
exports.updateScore = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.userId;
    const { score, tasksCompleted } = req.body;
    
    const playerData = await sessionService.updatePlayerScore(
      sessionId,
      userId,
      score,
      tasksCompleted
    );
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: playerData
    });
  } catch (error) {
    next(error);
  }
};

