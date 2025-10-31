const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/users");

const router = express.Router();

const sign = (user) =>
  jwt.sign(
    { sub: user._id.toString(), roles: user.roles },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
console.log("inside")
// Register


router.post("/register", async (req, res) => {
  try {
    console.log("inside reigster")
    const { name, email, password, roles } = req.body;
    const user = await User.create({ name, email, password, roles });
    const token = sign(user);
    res
      .status(201)
      .json({
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          roles: user.roles,
        },
      });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: "Invalid credentials" });
    const token = sign(user);
    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Me
router.get("/me", async (req, res) => {
  // attach auth middleware at mount point
  const u = req.user;
  res.json({
    user: {
      _id: u._id,
      name: u.name,
      email: u.email,
      roles: u.roles,
      isActive: u.isActive,
    },
  });
});

module.exports = router;
