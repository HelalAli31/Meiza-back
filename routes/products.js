// routes/products.js
const express = require("express");
const mongoose = require("mongoose");

const Product = require("../models/products");

const {
  upload,
  saveMain,
  saveOption,
  deleteProductFolder,
  deleteOption,
  renameProductFolder,
  renameOption,
  deleteByPublicUrl,
} = require("../lib/imageFS");

const router = express.Router();
const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Some browsers send utf8 filenames as latin1 in multipart.
// Decode to proper utf8 so Hebrew/Arabic survive.
const decodeLatin1 = (s) => Buffer.from(s, "latin1").toString("utf8");

/**
 * POST /products/addNewProduct
 * Create product + optional main image (multipart)
 * fields: name, desc, category, options(JSON)
 * files:  mainImage
 */
router.post(
  "/addNewProduct",
  upload.fields([{ name: "mainImage", maxCount: 1 }]),
  async (req, res) => {
    try {
      // parse options if sent as JSON string
      if (typeof req.body.options === "string") {
        req.body.options = JSON.parse(req.body.options);
      }

      // create document
      const doc = await Product.create(req.body);

      // optional main image
      if (req.files?.mainImage?.[0]) {
        const url = await saveMain(doc.name, req.files.mainImage[0]);
        await Product.findByIdAndUpdate(doc._id, { $set: { img: url } });
        doc.img = url;
      }

      const populated = await doc.populate("category");
      res.status(201).json(populated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

/**
 * GET /products
 * List all products
 */
router.get("/", async (_req, res) => {
  try {
    const products = await Product.find().populate("category").lean();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /products/:id
 * Single product
 */
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

/**
 * POST /products/:id/upload-main
 * Upload/replace main image
 * file: mainImage
 */
router.post(
  "/:id/upload-main",
  upload.single("mainImage"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!isObjectId(id)) return res.status(400).json({ error: "Invalid id" });

      const product = await Product.findById(id);
      if (!product) return res.status(404).json({ error: "Not found" });

      if (!req.file)
        return res.status(400).json({ error: "mainImage is required" });

      const url = await saveMain(product.name, req.file);
      product.img = url;
      await product.save();

      res.json({ ok: true, img: url });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * POST /products/:id/upload-options
 * Upload option images. Each file name should equal the option name.
 * files: optionImages[]
 */
router.post(
  "/:id/upload-options",
  upload.array("optionImages", 20),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!isObjectId(id)) return res.status(400).json({ error: "Invalid id" });

      const product = await Product.findById(id);
      if (!product) return res.status(404).json({ error: "Not found" });

      const saved = [];
      for (const f of req.files || []) {
        // recover utf8 name, remove extension, keep RTL chars
        const decoded = decodeLatin1(f.originalname);
        const optionName = decoded.replace(/\.[^.]+$/, "");
        const url = await saveOption(product.name, optionName, f);
        saved.push({ option: optionName, url });

        // update matching option document
        await Product.updateOne(
          { _id: id, "options.name": optionName },
          { $set: { "options.$.img": url } }
        );
      }

      res.json({ uploaded: saved.length, files: saved });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * DELETE /products/:id/option-image/:optionName
 * Delete a single option image and clear its img field.
 * optionName must match the option's name exactly.
 */
router.delete("/:id/option-image/:optionName", async (req, res) => {
  try {
    const { id } = req.params;
    const optionName = decodeURIComponent(req.params.optionName);
    console.log("=== DELETE /products/:id/option-image/:optionName ===");
    console.log("Incoming ID:", id);
    console.log("Decoded optionName:", optionName);

    if (!isObjectId(id)) {
      console.log("❌ Invalid ObjectId");
      return res.status(400).json({ error: "Invalid id" });
    }

    const product = await Product.findById(id);
    if (!product) {
      console.log("❌ Product not found for id:", id);
      return res.status(404).json({ error: "Not found" });
    }

    console.log("Current product:", product.name);
    const opt = (product.options || []).find((o) => o.name === optionName);
    console.log("Matched option:", opt ? opt.name : "none");

    let ok = false;

    // 1️⃣ Try deleting using the exact URL
    if (opt?.img) {
      console.log("Attempting deleteByPublicUrl:", opt.img);
      ok = await deleteByPublicUrl(opt.img);
      console.log("deleteByPublicUrl result:", ok);
    }

    // 2️⃣ Fallback delete by name (any extension)
    if (!ok) {
      console.log("Fallback to deleteOption() using name:", optionName);
      ok = await deleteOption(product.name, optionName);
      console.log("deleteOption() result:", ok);
    }

    // 3️⃣ Clear from DB if deleted
    if (ok) {
      console.log("✅ Image deleted, clearing from DB...");
      await Product.updateOne(
        { _id: id, "options.name": optionName },
        { $unset: { "options.$.img": "" } }
      );
    } else {
      console.log("⚠️ Image not found for deletion");
    }

    console.log("=== DELETE done ===\n");
    res.json({ deleted: ok });
  } catch (err) {
    console.error("❌ Error in delete route:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /products/:id
 * Update product. If name changes, rename folder and rewrite stored URLs.
 * Ignores empty category sent from client.
 */
const pick = (obj, keys) =>
  keys.reduce(
    (acc, k) => (obj[k] !== undefined ? ((acc[k] = obj[k]), acc) : acc),
    {}
  );

// Coerce and strip client-only fields
function normalizeOption(o) {
  const sale = o?.sale || {};
  const norm = {
    // keep _id so Mongoose matches subdocs
    ...(o._id ? { _id: o._id } : {}),
    name: String(o.name || "").trim(),
    price: Number(o.price ?? 0),
    quantity: Number(o.quantity ?? 0),
    img: o.img || "",
    isDefault: !!o.isDefault,
    sale: {
      start: sale.start || "",
      end: sale.end || "",
      // omit undefined so schema with Number doesn't choke
      ...(sale.price === "" || sale.price == null
        ? {}
        : { price: Number(sale.price) }),
    },
  };
  return norm;
}

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("\n=== PUT /products/:id ===");
    console.log("Incoming ID:", id);
    console.log("Incoming body keys:", Object.keys(req.body));

    if (!isObjectId(id)) {
      console.warn("Invalid ObjectId:", id);
      return res.status(400).json({ error: "Invalid id" });
    }

    const current = await Product.findById(id);
    if (!current) {
      console.warn("No product found for ID:", id);
      return res.status(404).json({ error: "Not found" });
    }

    console.log("Current product name:", current.name);
    console.log("Incoming name:", req.body.name);
    console.log("Incoming category:", req.body.category);

    if (req.body.category === "") delete req.body.category;

    const nextName = req.body.name || current.name;
    console.log("Final product name to use:", nextName);

    // ---------- rename product folder ----------
    if (nextName !== current.name) {
      console.log("Renaming folder:", current.name, "→", nextName);
      await renameProductFolder(current.name, nextName);

      const rewrite = (u) =>
        typeof u === "string"
          ? u.replace(`/${current.name}/`, `/${nextName}/`)
          : u;

      const newImg = rewrite(current.img);
      const newOptions = (current.options || []).map((o) => ({
        ...(o.toObject?.() || o),
        img: rewrite(o.img),
      }));

      console.log("Rewritten URLs count:", newOptions.length);

      await Product.updateOne(
        { _id: id },
        { $set: { img: newImg, options: newOptions, name: nextName } }
      );
    }

    // ---------- rename option files if option names changed ----------
    if (Array.isArray(req.body.options)) {
      const curById = new Map(
        (current.options || []).map((o) => [String(o._id), o.toObject?.() || o])
      );
      const curByName = new Map(
        (current.options || []).map((o) => [
          String(o.name),
          o.toObject?.() || o,
        ])
      );

      console.log("Incoming options:", req.body.options.length);

      for (const newOpt of req.body.options) {
        const cur =
          (newOpt._id && curById.get(String(newOpt._id))) ||
          (newOpt.prevName && curByName.get(String(newOpt.prevName))) ||
          (newOpt.name && curByName.get(String(newOpt.name)));

        if (!cur) {
          console.log(
            "Option not found in current map:",
            newOpt.name || newOpt.prevName
          );
          continue;
        }

        const oldName = cur.name;
        const newName = newOpt.name;
        if (newName && oldName && newName !== oldName) {
          console.log(`Renaming option image file: ${oldName} → ${newName}`);
          const newUrl = await renameOption(
            nextName,
            oldName,
            newName,
            cur.img /* use exact current url */
          );
          console.log("renameOption() returned:", newUrl);
          if (newUrl) newOpt.img = newUrl;
          else newOpt.img = cur.img;
        }
      }
    } else {
      console.log("No options array provided.");
    }

    // ---------- persist changes ----------
    const payload = { ...req.body, name: nextName };
    console.log(
      "Updating product in DB with payload keys:",
      Object.keys(payload)
    );

    const updated = await Product.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    }).populate("category");

    console.log("✅ Update completed for:", updated?.name);
    res.json(updated);
  } catch (err) {
    console.error("❌ PUT /products/:id failed:", err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /products/:id
 * Delete product and its image folder.
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ error: "Invalid id" });

    const doc = await Product.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    await deleteProductFolder(doc.name);
    res.json({ deleted: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
