const axios = require("axios");

const STORE_ID = process.env.TN_STORE_ID;
const ACCESS_TOKEN = process.env.TN_ACCESS_TOKEN;

const BASE_URL = `https://api.tiendanube.com/2025-03/${STORE_ID}`;

const HEADERS = {
  Authorization: `Bearer ${ACCESS_TOKEN}`,
  Authentication: `bearer ${ACCESS_TOKEN}`,
  "Content-Type": "application/json",
  "User-Agent": "dragonfishXtiendanube (brigitteyaelblau@gmail.com)",
};

function normalizeSku(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/!/g, "")
    .replace(/#/g, "")
    .replace(/-/g, "")
    .replace(/_/g, "")
    .replace(/\./g, "")
    .replace(/\//g, "");
}

function getVariantStock(variant) {
  if (Array.isArray(variant.inventory_levels) && variant.inventory_levels.length > 0) {
    return Number(variant.inventory_levels[0]?.stock ?? 0);
  }

  return Number(variant.stock ?? 0);
}

async function getAllProducts() {
  let products = [];
  let page = 1;

  while (true) {
    const res = await axios.get(`${BASE_URL}/products`, {
      headers: HEADERS,
      params: {
        page,
        per_page: 200,
        fields: "id,name,variants",
      },
    });

    if (!Array.isArray(res.data)) break;

    products = products.concat(res.data);

    if (res.data.length < 200) break;

    page++;
  }

  return products;
}

async function updateVariantStock(productId, variantId, stock) {
  const cleanStock = Math.max(0, Number(stock || 0));

  const res = await axios.put(
    `${BASE_URL}/products/${productId}/variants/${variantId}`,
    {
      stock: cleanStock,
    },
    {
      headers: HEADERS,
    }
  );

  return res.data;
}

module.exports = {
  getAllProducts,
  updateVariantStock,
  normalizeSku,
  getVariantStock,
};