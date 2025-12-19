const GameSession = require('../models/GameSession');
const sessionService = require('./session.service');
const BroadcastService = require('./broadcast.service');
const { SESSION_STATUS } = require('../utils/constants');

class SessionAutoEndService {
  constructor(io) {
    this.io = io;
    this.intervalId = null;
    this.broadcastService = io ? new BroadcastService(io) : null;
  }

  // Start auto-end job
  start() {
    if (this.intervalId) {
      console.log('Auto-end job already running');
      return;
    }

    console.log('Starting session auto-end job...');
    
    // Check every minute for sessions ending soon
    this.intervalId = setInterval(async () => {
      await this.checkAndEndSessions();
    }, 60000); // Check every minute
  }

  // Check and end sessions
  async checkAndEndSessions() {
    try {
      // Find sessions that should end now (scheduledEndTime <= now)
      const now = new Date();
      const sessionsToEnd = await GameSession.find({
        status: SESSION_STATUS.LIVE,
        scheduledEndTime: { $lte: now }
      }).populate('creatorId', 'username');

      if (sessionsToEnd.length === 0) {
        return;
      }

      console.log(`Found ${sessionsToEnd.length} session(s) to end`);

      // Process each session
      for (const session of sessionsToEnd) {
        try {
          console.log(`Ending session ${session.sessionId}...`);
          
          // End session and process rewards
          await sessionService.endSessionAndProcessRewards(
            session._id,
            session.creatorId._id,
            this.broadcastService
          );

          console.log(`Session ${session.sessionId} ended successfully`);
        } catch (error) {
          console.error(`Error ending session ${session.sessionId}:`, error);
          // Continue with other sessions even if one fails
        }
      }
    } catch (error) {
      console.error('Error in auto-end job:', error);
    }
  }

  // Stop auto-end job
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Session auto-end job stopped');
    }
  }
}

module.exports = SessionAutoEndService;

