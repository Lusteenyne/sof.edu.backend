const jwt = require('jsonwebtoken');

// Middleware to authenticate the token
const authenticateToken = (req, res, next) => {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return res.status(403).json({ message: "Token is required", status: false });
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRETKEY);
        req.user = decoded; // Store the decoded token in the request for further use

        // Debugging log to verify the token's decoded data
        console.log("Decoded JWT:", decoded);

        next();
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(403).json({ message: "Token has expired", status: false });
        }
        return res.status(403).json({ message: "Invalid token", status: false });
    }
};

module.exports = authenticateToken;
