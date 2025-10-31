const express = require("express");
const mongoose = require("mongoose");
const Category = require("../models/categories");
const Product = require("../models/products"); // for delete guard

const router = express.Router();
const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Create
router.post("/addCategory", async (req, res) => {
  try {
    const cat = await Category.create(req.body);
    res.status(201).json(cat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List
router.get("/", async (_req, res) => {
  try {
    const cats = await Category.find().sort({ name: 1 }).lean();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get by id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!isObjectId(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const cat = await Category.findById(id).lean();
    if (!cat) return res.status(404).json({ error: "Not found" });
    res.json(cat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Replace (PUT)
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  if (!isObjectId(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const cat = await Category.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!cat) return res.status(404).json({ error: "Not found" });
    res.json(cat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete (blocked if products exist)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  if (!isObjectId(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const inUse = await Product.countDocuments({ category: id });
    if (inUse > 0) {
      return res.status(409).json({
        error: "Category in use by products",
        products_count: inUse,
      });
    }
    const del = await Category.findByIdAndDelete(id);
    if (!del) return res.status(404).json({ error: "Not found" });
    res.json({ deleted: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
