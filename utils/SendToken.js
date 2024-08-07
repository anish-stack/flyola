const jwt = require('jsonwebtoken');

const SendToken = async (res, user, status) => {
    try {
        // Create JWT token with user id and secret key
        const token = jwt.sign({ id: user.agentId,userName:user.username }, process.env.JWT_SECRET_KEY, {
            expiresIn: '6h'
        });

        // Set cookie options
        const option = {
            httpOnly: true,
            expires: new Date(Date.now() + 6 * 3600000),
        };

        // Set the token as a cookie and return response
        res.status(status).cookie('token', token, option).json({
            success: true,
            token,
            user: {
                id: user.agentId,
                username: user.username,
            }
        });
    } catch (error) {
        // Handle any errors
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = SendToken;
