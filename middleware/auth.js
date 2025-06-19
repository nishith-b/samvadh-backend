const jwt = require("jsonwebtoken");
const User = require("../models/user");

exports.protect = async (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

  if (!token) {
    return res.status(401).json({ message: "Not Authorised, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    res.status(401).json({ message: "Not authorised, token failed" });
  }
};
