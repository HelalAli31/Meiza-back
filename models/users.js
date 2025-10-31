const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: { type: String, required: true },
    roles: {
      type: [String],
      enum: ["admin", "customer"],
      default: ["customer"],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true });

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model("users", UserSchema);
