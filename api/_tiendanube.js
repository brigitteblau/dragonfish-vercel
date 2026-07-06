//api/_tiendanube.js

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
    const stock = variant.inventory_levels[0]?.stock;
    return Number(stock ?? 0);
  }

  return Number(variant.stock ?? 0);
}

/**
 * Trae todos los productos de Tiendanube con paginación automática.
 * Cada producto tiene variantes con su SKU y stock.
 */
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

    products = products.concat(res.data);

    if (!Array.isArray(res.data) || res.data.length < 200) break;

    page++;
  }

  return products;
}

/**
 * Construye mapa de SKUs de Tiendanube.
 *
 * Ej:
 * TN tiene SW1001!31!L
 * Dragonfish manda SW1001##31##L
 *
 * Ambos se normalizan a SW100131L.
 */
function buildSkuMap(tnProducts) {
  const map = {};
  const duplicados = [];

  for (const product of tnProducts) {
    for (const variant of product.variants || []) {
      if (!variant.sku) continue;

      const originalSku = String(variant.sku).trim();
      const normalizedSku = normalizeSku(originalSku);

      if (!normalizedSku) continue;

      if (map[normalizedSku]) {
        duplicados.push({
          normalizedSku,
          skuExistente: map[normalizedSku].originalSku,
          skuDuplicado: originalSku,
          productIdExistente: map[normalizedSku].productId,
          productIdDuplicado: product.id,
          variantIdExistente: map[normalizedSku].variantId,
          variantIdDuplicado: variant.id,
        });

        continue;
      }

      map[normalizedSku] = {
        productId: product.id,
        variantId: variant.id,
        currentStock: getVariantStock(variant),
        originalSku,
        productName: product.name,
      };
    }
  }

  return {
    map,
    duplicados,
  };
}

/**
 * Actualiza stock de una variante.
 * Mantengo PUT individual porque es más seguro para este caso y más fácil de debuggear.
 */
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
  buildSkuMap,
  updateVariantStock,
  normalizeSku,
};