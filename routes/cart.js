const express = require("express");
const mongoose = require("mongoose");
const Cart = require("../models/cart");
const Product = require("../models/products");
const { auth } = require("../middleware/auth");

const router = express.Router();
const isId = (id) => mongoose.Types.ObjectId.isValid(id);

// ensure cart
async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

// GET my cart
router.get("/", auth, async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  res.json({ cart, subtotal: cart.subtotal() });
});

// ADD item
router.post("/items", auth, async (req, res) => {
  try {
    const { productId, optionId, quantity = 1 } = req.body;
    if (!isId(productId) || !isId(optionId))
      return res.status(400).json({ error: "Invalid ids" });
    if (quantity <= 0)
      return res.status(400).json({ error: "Quantity must be >= 1" });

    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ error: "Product not found" });
    const option = (product.options || []).find(
      (o) => o._id?.toString() === optionId
    );
    if (!option) return res.status(404).json({ error: "Option not found" });
    if ((option.quantity || 0) < quantity)
      return res.status(400).json({ error: "Not enough stock" });
    if (typeof option.price !== "number")
      return res.status(400).json({ error: "Option price is required" });

    const cart = await getOrCreateCart(req.user._id);
    const existing = cart.items.find(
      (it) =>
        it.product.toString() === productId &&
        it.optionId.toString() === optionId
    );
    if (existing) existing.quantity += quantity;
    else
      cart.items.push({
        product: product._id,
        optionId,
        name: product.name,
        optionName: option.name,
        img: option.img || product.img || "",
        price: option.price,
        quantity,
      });

    await cart.save();
    res.status(201).json({ cart, subtotal: cart.subtotal() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// UPDATE item quantity
router.patch("/items/:itemId", auth, async (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;
  if (!isId(itemId)) return res.status(400).json({ error: "Invalid itemId" });
  if (quantity <= 0)
    return res.status(400).json({ error: "Quantity must be >= 1" });

  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.id(itemId);
  if (!item) return res.status(404).json({ error: "Item not found" });

  // stock check
  const product = await Product.findById(item.product).lean();
  const option = (product?.options || []).find(
    (o) => o._id?.toString() === item.optionId.toString()
  );
  if (!option || (option.quantity || 0) < quantity)
    return res.status(400).json({ error: "Not enough stock" });

  item.quantity = quantity;
  await cart.save();
  res.json({ cart, subtotal: cart.subtotal() });
});

// DELETE item
router.delete("/items/:itemId", auth, async (req, res) => {
  const { itemId } = req.params;
  if (!isId(itemId)) return res.status(400).json({ error: "Invalid itemId" });

  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.id(itemId);
  if (!item) return res.status(404).json({ error: "Item not found" });
  item.remove();
  await cart.save();
  res.json({ cart, subtotal: cart.subtotal() });
});

// CLEAR cart
router.delete("/", auth, async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = [];
  await cart.save();
  res.json({ cleared: true });
});

module.exports = router;
