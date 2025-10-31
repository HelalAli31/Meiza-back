const jwt = require("jsonwebtoken");
const User = require("../models/users");

const auth = async (req, res, next) => {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(payload.sub).lean();
    if (!req.user || req.user.isActive === false)
      return res.status(401).json({ error: "Invalid user" });
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

const requireRole =
  (...roles) =>
  (req, res, next) => {
    const userRoles = req.user?.roles || [];
    const ok = userRoles.some((r) => roles.includes(r));
    if (!ok) return res.status(403).json({ error: "Forbidden" });
    next();
  };

module.exports = { auth, requireRole };
