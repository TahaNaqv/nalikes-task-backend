const router = require('express').Router();
const sessionController = require('../controllers/session.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const {
  validateCreateSession,
  validateJoinSession,
  validateUpdateScore
} = require('../middlewares/validation.middleware');

// Create session (auth required)
router.post(
  '/create',
  authenticateToken,
  validateCreateSession,
  sessionController.createSession
);

// List sessions (public)
router.get('/', sessionController.listSessions);

// Get session details (public)
router.get(
  '/:sessionId',
  validateJoinSession,
  sessionController.getSession
);

// Join session (auth required)
router.post(
  '/:sessionId/join',
  authenticateToken,
  validateJoinSession,
  sessionController.joinSession
);

// Leave session (auth required)
router.post(
  '/:sessionId/leave',
  authenticateToken,
  validateJoinSession,
  sessionController.leaveSession
);

// End session (auth required, creator only)
router.post(
  '/:sessionId/end',
  authenticateToken,
  validateJoinSession,
  sessionController.endSession
);

// Get leaderboard (public)
router.get(
  '/:sessionId/leaderboard',
  validateJoinSession,
  sessionController.getLeaderboard
);

// Update score (auth required)
router.post(
  '/:sessionId/update-score',
  authenticateToken,
  validateJoinSession,
  validateUpdateScore,
  sessionController.updateScore
);

module.exports = router;

