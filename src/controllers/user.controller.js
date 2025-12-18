const User = require("../models/User");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
    const { username, walletAddress } = req.body;

    const user = await User.create({ username, walletAddress });

    const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET
    );

    res.json({ userId: user._id, token });
};
