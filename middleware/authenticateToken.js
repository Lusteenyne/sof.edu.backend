const jwt = require("jsonwebtoken");

// Middleware to authenticate the token
const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(403).json({ message: "Token is required", status: false });
  }

  if (!process.env.SECRETKEY) {
    console.error("SECRETKEY not set in environment variables");
    return res.status(500).json({ message: "Server configuration error", status: false });
  }

  try {
    const decoded = jwt.verify(token, process.env.SECRETKEY);
    req.user = decoded;

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
