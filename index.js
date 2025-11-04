require("dotenv").config();
const express = require("express");
const cors = require("cors");
const createConnection = require("./connection/index");
const bodyParser = require("body-parser");
const Product = require("./models/products");
require("./models/categories");
const productsRoute = require("./routes/products");
const categoriesRoute = require("./routes/categories");
const { auth } = require("./middleware/auth");
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const cartRouter = require("./routes/cart");
const ordersRouter = require("./routes/orders");
const contactRoutes = require("./routes/contact");
createConnection();
//Routes
const app = express();

const path = require("path");

app.use(cors());
app.use(express.static("public"));

app.use(bodyParser.json());

// app.use("/auth", userRoute);
app.use("/products", productsRoute);
app.use("/categories", categoriesRoute);
//
console.log("before");
app.use("/auth", authRouter);
app.use("/contact", contactRoutes);
// protected example for /auth/me
app.use("/", auth, (req, _res, next) => next());

// admin + protected
app.use("/users", usersRouter);
app.use("/cart", cartRouter);
app.use("/orders", ordersRouter);

app.use((error, req, res, next) => {
  console.log("in error handler...");
  res.send("Something went wrong");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
