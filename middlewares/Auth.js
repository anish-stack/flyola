const jwt = require('jsonwebtoken');

const Protect = async (req, res, next) => {
    try {
        // Retrieve the token from the cookies, request body, or headers
        const token = req.cookies.token || req.body.token || req.headers.authorization.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

        // Attach the decoded token payload to the request object
        req.user = decoded;

        // Call the next middleware function
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
};

module.exports = Protect;