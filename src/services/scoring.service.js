const GameSession = require('../models/GameSession');
const PlayerSession = require('../models/PlayerSession');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { SCORING_TYPE, SESSION_STATUS } = require('../utils/constants');
const mongoose = require('mongoose');

class ScoringService {
  // Helper method to find session by sessionId or _id
  async findSessionById(sessionIdOrId) {
    let session = await GameSession.findOne({ sessionId: sessionIdOrId });
    
    if (!session && mongoose.Types.ObjectId.isValid(sessionIdOrId)) {
      session = await GameSession.findById(sessionIdOrId);
    }
    
    return session;
  }

  // Calculate winner based on session config
  async calculateWinner(sessionId) {
    const session = await this.findSessionById(sessionId);
    
    if (!session) {
      throw new NotFoundError('Session');
    }

    // Check if session is ended
    if (session.status !== SESSION_STATUS.ENDED) {
      throw new ValidationError('Session must be ended before calculating winner');
    }

    // Get all active players
    const players = await PlayerSession.findBySession(session._id, true);
    
    if (!players || players.length === 0) {
      return null; // No players, no winner
    }

    let winner = null;
    const scoringType = session.config?.scoringType || SCORING_TYPE.POINTS;

    // Calculate winner based on scoring type
    switch (scoringType) {
      case SCORING_TYPE.POINTS:
        winner = await this.calculateWinnerByPoints(session._id);
        break;
      case SCORING_TYPE.TASKS:
        winner = await this.calculateWinnerByTasks(session._id);
        break;
      case SCORING_TYPE.RANDOM:
        winner = await this.calculateWinnerRandom(session._id);
        break;
      case SCORING_TYPE.COMBINED:
        winner = await this.calculateWinnerCombined(session._id, session.config);
        break;
      default:
        winner = await this.calculateWinnerByPoints(session._id);
    }

    // If enableRandomWinner is true, override with random selection
    if (session.config?.enableRandomWinner) {
      winner = await this.calculateWinnerRandom(session._id);
    }

    // Update session with winner
    if (winner) {
      // Ensure userId is populated
      if (!winner.userId || typeof winner.userId === 'string') {
        await winner.populate('userId', 'username walletAddress');
      }
      
      session.winner = winner.userId._id || winner.userId;
      await session.save();
    }

    // Calculate and save final ranks
    await this.calculateFinalRanks(session._id);

    if (!winner) {
      return null;
    }

    // Ensure userId is populated
    if (!winner.userId || typeof winner.userId === 'string') {
      await winner.populate('userId', 'username walletAddress');
    }

    return {
      userId: winner.userId._id || winner.userId,
      username: winner.userId.username,
      walletAddress: winner.userId.walletAddress,
      score: winner.score,
      tasksCompleted: winner.tasksCompleted
    };
  }

  // Calculate winner by points
  async calculateWinnerByPoints(sessionId) {
    const players = await PlayerSession.find({
      sessionId,
      isActive: true
    })
      .populate('userId', 'username walletAddress')
      .sort({ score: -1, tasksCompleted: -1, joinedAt: 1 })
      .limit(1);

    return players.length > 0 ? players[0] : null;
  }

  // Calculate winner by tasks
  async calculateWinnerByTasks(sessionId) {
    const players = await PlayerSession.find({
      sessionId,
      isActive: true
    })
      .populate('userId', 'username walletAddress')
      .sort({ tasksCompleted: -1, score: -1, joinedAt: 1 })
      .limit(1);

    return players.length > 0 ? players[0] : null;
  }

  // Calculate winner randomly
  async calculateWinnerRandom(sessionId) {
    const players = await PlayerSession.find({
      sessionId,
      isActive: true
    }).populate('userId', 'username walletAddress');

    if (players.length === 0) {
      return null;
    }

    // Randomly select one player
    const randomIndex = Math.floor(Math.random() * players.length);
    return players[randomIndex];
  }

  // Calculate winner by combined criteria
  async calculateWinnerCombined(sessionId, sessionConfig) {
    const pointsPerTask = sessionConfig?.pointsPerTask || 10;
    
    const players = await PlayerSession.find({
      sessionId,
      isActive: true
    }).populate('userId', 'username walletAddress');

    if (players.length === 0) {
      return null;
    }

    // Calculate weighted score for each player
    const playersWithWeightedScore = players.map(player => ({
      player,
      weightedScore: player.score + (player.tasksCompleted * pointsPerTask)
    }));

    // Sort by weighted score (desc), then by score (desc), then by tasks (desc), then by joinedAt (asc)
    playersWithWeightedScore.sort((a, b) => {
      if (b.weightedScore !== a.weightedScore) {
        return b.weightedScore - a.weightedScore;
      }
      if (b.player.score !== a.player.score) {
        return b.player.score - a.player.score;
      }
      if (b.player.tasksCompleted !== a.player.tasksCompleted) {
        return b.player.tasksCompleted - a.player.tasksCompleted;
      }
      return a.player.joinedAt.getTime() - b.player.joinedAt.getTime();
    });

    return playersWithWeightedScore[0].player;
  }

  // Calculate and save final ranks for all players
  async calculateFinalRanks(sessionId) {
    const players = await PlayerSession.calculateRanks(sessionId);
    
    // Also save final ranks
    for (let i = 0; i < players.length; i++) {
      players[i].finalRank = players[i].rank;
      await players[i].save();
    }
    
    return players;
  }

  // Get final leaderboard with ranks
  async getFinalLeaderboard(sessionId) {
    const session = await this.findSessionById(sessionId);
    
    if (!session) {
      throw new NotFoundError('Session');
    }

    const players = await PlayerSession.find({
      sessionId: session._id,
      isActive: true
    })
      .populate('userId', 'username walletAddress')
      .sort({ finalRank: 1, rank: 1 });

    return players.map(player => ({
      rank: player.finalRank || player.rank,
      userId: player.userId._id,
      username: player.userId.username,
      walletAddress: player.userId.walletAddress,
      score: player.score,
      tasksCompleted: player.tasksCompleted,
      joinedAt: player.joinedAt
    }));
  }
}

module.exports = new ScoringService();

