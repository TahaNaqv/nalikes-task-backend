const mongoose = require("mongoose");

const playerSessionSchema = new mongoose.Schema({
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GameSession',
        required: [true, 'Session ID is required'],
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    score: {
        type: Number,
        default: 0,
        min: [0, 'Score cannot be negative'],
        index: true
    },
    tasksCompleted: {
        type: Number,
        default: 0,
        min: [0, 'Tasks completed cannot be negative'],
        index: true
    },
    joinedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    leftAt: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    lastActivityAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    rank: {
        type: Number,
        default: null,
        min: 1
    },
    finalRank: {
        type: Number,
        default: null,
        min: 1
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
// Compound unique index on (sessionId, userId) - prevents duplicate entries
playerSessionSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

// Compound index on (sessionId, score) - for leaderboard queries (descending)
playerSessionSchema.index({ sessionId: 1, score: -1 });

// Compound index on (sessionId, tasksCompleted) - for task-based leaderboard
playerSessionSchema.index({ sessionId: 1, tasksCompleted: -1 });

// Compound index on (sessionId, isActive, score) - for active player leaderboard
playerSessionSchema.index({ sessionId: 1, isActive: 1, score: -1 });

// Index on rank (for quick rank lookups)
playerSessionSchema.index({ rank: 1 });

// Virtuals
// Calculate time spent in session
playerSessionSchema.virtual('duration').get(function() {
    const endTime = this.leftAt || new Date();
    return endTime.getTime() - this.joinedAt.getTime();
});

// Calculate total points (score + tasks * pointsPerTask)
playerSessionSchema.virtual('totalPoints').get(function() {
    // This would need session config, so might be better as a method
    return this.score;
});

// Instance Methods
// Increment score
playerSessionSchema.methods.incrementScore = async function(points) {
    if (points < 0) {
        throw new Error('Cannot add negative points');
    }
    this.score += points;
    this.lastActivityAt = new Date();
    return this.save();
};

// Complete a task
playerSessionSchema.methods.completeTask = async function(pointsPerTask = 10) {
    this.tasksCompleted += 1;
    this.score += pointsPerTask;
    this.lastActivityAt = new Date();
    return this.save();
};

// Update score and tasks
playerSessionSchema.methods.updatePerformance = async function(score, tasks) {
    if (score < 0 || tasks < 0) {
        throw new Error('Score and tasks cannot be negative');
    }
    this.score = score;
    this.tasksCompleted = tasks;
    this.lastActivityAt = new Date();
    return this.save();
};

// Leave the session
playerSessionSchema.methods.leaveSession = async function() {
    if (!this.isActive) {
        throw new Error('Player is already inactive');
    }
    this.isActive = false;
    this.leftAt = new Date();
    return this.save();
};

// Rejoin the session (if allowed)
playerSessionSchema.methods.rejoinSession = async function() {
    if (this.isActive) {
        throw new Error('Player is already active');
    }
    this.isActive = true;
    this.leftAt = null;
    this.lastActivityAt = new Date();
    return this.save();
};

// Static Methods
// Find player session by session and user
playerSessionSchema.statics.findBySessionAndUser = function(sessionId, userId) {
    return this.findOne({ sessionId, userId });
};

// Get all players in a session
playerSessionSchema.statics.findBySession = function(sessionId, activeOnly = false) {
    const query = { sessionId };
    if (activeOnly) {
        query.isActive = true;
    }
    return this.find(query).sort({ score: -1, tasksCompleted: -1 });
};

// Get leaderboard for a session
playerSessionSchema.statics.getLeaderboard = function(sessionId, limit = 10) {
    return this.find({ sessionId, isActive: true })
        .sort({ score: -1, tasksCompleted: -1, joinedAt: 1 })
        .limit(limit)
        .populate('userId', 'username walletAddress');
};

// Get player rank in session
playerSessionSchema.statics.getPlayerRank = async function(sessionId, userId) {
    const player = await this.findOne({ sessionId, userId });
    if (!player) return null;
    
    const playersAhead = await this.countDocuments({
        sessionId,
        isActive: true,
        $or: [
            { score: { $gt: player.score } },
            { 
                score: player.score,
                tasksCompleted: { $gt: player.tasksCompleted }
            },
            {
                score: player.score,
                tasksCompleted: player.tasksCompleted,
                joinedAt: { $lt: player.joinedAt }
            }
        ]
    });
    
    return playersAhead + 1;
};

// Calculate ranks for all players in session
playerSessionSchema.statics.calculateRanks = async function(sessionId) {
    const players = await this.find({ sessionId, isActive: true })
        .sort({ score: -1, tasksCompleted: -1, joinedAt: 1 });
    
    for (let i = 0; i < players.length; i++) {
        players[i].rank = i + 1;
        await players[i].save();
    }
    
    return players;
};

// Pre-save Hook
// Ensure score and tasks are non-negative
playerSessionSchema.pre('save', function(next) {
    if (this.score < 0) this.score = 0;
    if (this.tasksCompleted < 0) this.tasksCompleted = 0;
    next();
});

module.exports = mongoose.model("PlayerSession", playerSessionSchema);

