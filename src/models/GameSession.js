const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const gameSessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        default: () => uuidv4(),
        index: true
    },
    status: {
        type: String,
        enum: {
            values: ['WAITING', 'LIVE', 'ENDED', 'CANCELLED'],
            message: 'Status must be WAITING, LIVE, ENDED, or CANCELLED'
        },
        default: 'WAITING',
        index: true
    },
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Session creator is required'],
        index: true
    },
    players: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    startTime: {
        type: Date,
        default: null,
        index: true
    },
    endTime: {
        type: Date,
        default: null
    },
    scheduledEndTime: {
        type: Date,
        default: null,
        index: true // For querying sessions to auto-end
    },
    durationMinutes: {
        type: Number,
        required: true,
        default: 10,
        min: [1, 'Duration must be at least 1 minute'],
        max: [120, 'Duration cannot exceed 120 minutes']
    },
    maxPlayers: {
        type: Number,
        required: true,
        default: 50,
        min: [2, 'Must allow at least 2 players'],
        max: [1000, 'Cannot exceed 1000 players']
    },
    minPlayersToStart: {
        type: Number,
        required: true,
        default: 2,
        min: [1, 'Must require at least 1 player to start'],
        validate: {
            validator: function(v) {
                return v <= this.maxPlayers;
            },
            message: 'Minimum players to start cannot exceed maximum players'
        }
    },
    config: {
        scoringType: {
            type: String,
            enum: ['POINTS', 'TASKS', 'RANDOM', 'COMBINED'],
            default: 'POINTS'
        },
        pointsPerTask: {
            type: Number,
            default: 10,
            min: 0
        },
        enableRandomWinner: {
            type: Boolean,
            default: false
        },
        autoStart: {
            type: Boolean,
            default: true // Auto-start when min players join
        },
        autoEnd: {
            type: Boolean,
            default: true // Auto-end after duration
        }
    },
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
gameSessionSchema.index({ status: 1, startTime: 1 }); // Compound index for active session queries
gameSessionSchema.index({ status: 1, scheduledEndTime: 1 }); // Compound index for sessions ending soon

// Virtuals
// Get current player count
gameSessionSchema.virtual('playerCount').get(function() {
    return this.players ? this.players.length : 0;
});

// Check if session is full
gameSessionSchema.virtual('isFull').get(function() {
    return this.playerCount >= this.maxPlayers;
});

// Get remaining time in milliseconds
gameSessionSchema.virtual('remainingTime').get(function() {
    if (!this.scheduledEndTime || this.status !== 'LIVE') {
        return null;
    }
    const remaining = this.scheduledEndTime.getTime() - Date.now();
    return remaining > 0 ? remaining : 0;
});

// Get elapsed time in milliseconds
gameSessionSchema.virtual('elapsedTime').get(function() {
    if (!this.startTime) return null;
    return Date.now() - this.startTime.getTime();
});

// Instance Methods
// Check if session can accept new players
gameSessionSchema.methods.isJoinable = function() {
    return this.status === 'WAITING' || 
           (this.status === 'LIVE' && !this.isFull);
};

// Check if session is currently active
gameSessionSchema.methods.isActive = function() {
    return this.status === 'LIVE';
};

// Start the session
gameSessionSchema.methods.start = async function() {
    if (this.status !== 'WAITING') {
        throw new Error('Session can only be started from WAITING status');
    }
    if (this.playerCount < this.minPlayersToStart) {
        throw new Error(`Need at least ${this.minPlayersToStart} players to start`);
    }
    
    this.status = 'LIVE';
    this.startTime = new Date();
    
    if (this.config.autoEnd) {
        this.scheduledEndTime = new Date(
            this.startTime.getTime() + (this.durationMinutes * 60 * 1000)
        );
    }
    
    return this.save();
};

// End the session
gameSessionSchema.methods.end = async function() {
    if (this.status === 'ENDED' || this.status === 'CANCELLED') {
        throw new Error('Session is already ended');
    }
    
    this.status = 'ENDED';
    this.endTime = new Date();
    this.scheduledEndTime = null;
    
    return this.save();
};

// Cancel the session
gameSessionSchema.methods.cancel = async function() {
    if (this.status === 'ENDED') {
        throw new Error('Cannot cancel an ended session');
    }
    
    this.status = 'CANCELLED';
    this.endTime = new Date();
    this.scheduledEndTime = null;
    
    return this.save();
};

// Add player to session
gameSessionSchema.methods.addPlayer = async function(userId) {
    if (!this.isJoinable()) {
        throw new Error('Session is not joinable');
    }
    if (this.players.some(id => id.toString() === userId.toString())) {
        throw new Error('Player already in session');
    }
    
    this.players.push(userId);
    
    // Auto-start if conditions met
    if (this.config.autoStart && 
        this.status === 'WAITING' && 
        this.playerCount >= this.minPlayersToStart) {
        await this.start();
    }
    
    return this.save();
};

// Remove player from session
gameSessionSchema.methods.removePlayer = async function(userId) {
    this.players = this.players.filter(
        id => id.toString() !== userId.toString()
    );
    return this.save();
};

// Static Methods
// Find active sessions
gameSessionSchema.statics.findActive = function() {
    return this.find({ status: 'LIVE' });
};

// Find waiting sessions
gameSessionSchema.statics.findWaiting = function() {
    return this.find({ status: 'WAITING' });
};

// Find sessions ending soon (for auto-end job)
gameSessionSchema.statics.findEndingSoon = function(minutes = 1) {
    const threshold = new Date(Date.now() + minutes * 60 * 1000);
    return this.find({
        status: 'LIVE',
        scheduledEndTime: { $lte: threshold }
    });
};

// Find session by sessionId
gameSessionSchema.statics.findBySessionId = function(sessionId) {
    return this.findOne({ sessionId });
};

// Pre-save Hook
// Validate minPlayersToStart <= maxPlayers
gameSessionSchema.pre('save', function(next) {
    if (this.minPlayersToStart > this.maxPlayers) {
        next(new Error('minPlayersToStart cannot exceed maxPlayers'));
    } else {
        next();
    }
});

module.exports = mongoose.model("GameSession", gameSessionSchema);
