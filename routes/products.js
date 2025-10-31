// routes/products.js
const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/products"); // adjust path if needed

const router = express.Router();

// sample data (your snippet)
// const sampleProducts = [
//   {
//     name: "פלייסמט שעבניה",
//     desc: "",
//     category: "6904a59ce067d10d56fe4f31",
//     options: [
//       {
//         name: "30/50 שילוב עור",
//         price: 58,
//         isDefault: true,
//         quantity: 10,
//         img: "",
//         sale: { start: "", end: "", price: null },
//       },
//     ],
//   },
//   {
//     name: "כרית שילוב עוד",
//     desc: "",
//     category: "67759289eca0466ca85bfab9",
//     options: [
//       {
//         name: "30/50",
//         price: 120,
//         isDefault: true,
//         quantity: 5,
//         img: "",
//         sale: { start: "", end: "", price: null },
//       },
//       {
//         name: "45/45",
//         price: 130,
//         quantity: 5,
//         img: "",
//         sale: { start: "", end: "", price: null },
//       },
//     ],
//   },
//   {
//     name: "מפה שילוב עור",
//     desc: "",
//     category: "6904a59ce067d10d56fe4f31",
//     options: [
//       {
//         name: "RUNER 90/30 רנר",
//         price: 118,
//         isDefault: true,
//         quantity: 5,
//         img: "",
//         sale: { start: "", end: "", price: null },
//       },
//       {
//         name: "100/100",
//         price: 258,
//         quantity: 5,
//         img: "",
//         sale: { start: "", end: "", price: null },
//       },
//       {
//         name: "RUNER 150/30",
//         price: 130,
//         quantity: 5,
//         img: "",
//         sale: { start: "", end: "", price: null },
//       },
//     ],
//   },
// ];

// // Seed: insert sample products once
// router.post("/seed", async (req, res) => {
//   try {
//     const count = await Product.countDocuments();
//     if (count > 0) return res.status(409).json({ message: "Already seeded" });
//     const docs = await Product.insertMany(sampleProducts);
//     res.status(201).json({ inserted: docs.length, products: docs });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// helpers
const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Create product
router.post("/addNewProduct", async (req, res) => {
  try {
    const doc = await Product.create(req.body);
    const populated = await doc.populate("category");
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all products
router.get("/", async (_req, res) => {
  try {
    const products = await Product.find().populate("category").lean();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get product by id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ error: "Invalid id" });
    const product = await Product.findById(id).populate("category").lean();
    if (!product) return res.status(404).json({ error: "Not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product (replace fields)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ error: "Invalid id" });
    const updated = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    }).populate("category");
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete product
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ error: "Invalid id" });
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ deleted: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
