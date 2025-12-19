const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { ConflictError, ValidationError } = require("../utils/errors");
const { HTTP_STATUS } = require("../utils/constants");

exports.register = async (req, res, next) => {
    try {
        const { username, walletAddress } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [
                { username },
                { walletAddress: walletAddress?.toUpperCase() }
            ]
        });

        if (existingUser) {
            if (existingUser.username === username) {
                return next(new ConflictError('Username already exists'));
            }
            if (existingUser.walletAddress === walletAddress?.toUpperCase()) {
                return next(new ConflictError('Wallet address already registered'));
            }
        }

        const user = await User.create({ username, walletAddress });

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: {
                userId: user._id,
                username: user.username,
                token
            }
        });
    } catch (error) {
        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(e => e.message);
            return next(new ValidationError('Validation failed', errors));
        }
        
        // Handle duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return next(new ConflictError(`${field} already exists`));
        }
        
        next(error);
    }
};
