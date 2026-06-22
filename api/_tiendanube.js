const axios = require("axios");

const STORE_ID = process.env.TN_STORE_ID;
const ACCESS_TOKEN = process.env.TN_ACCESS_TOKEN;
const BASE_URL = `https://api.tiendanube.com/2025-03/${STORE_ID}`;
const HEADERS = {
  Authentication: `bearer ${ACCESS_TOKEN}`,
  "Content-Type": "application/json",
  "User-Agent": "dragonfishXtiendanube (brigitteyaelblau@gmail.com)",
};

/**
 * Trae todos los productos de Tienda Nube con paginacion automatica.
 * Cada producto tiene variantes (combinaciones de talle/color) con su stock.
 */
async function getAllProducts() {
  let products = [];
  let page = 1;
  while (true) {
    const res = await axios.get(`${BASE_URL}/products`, {
      headers: HEADERS,
      params: { page, per_page: 200, fields: "id,variants" },
    });
    products = products.concat(res.data);
    if (res.data.length < 200) break;
    page++;
  }
  return products;
}

/**
 * Construye un mapa SKU -> { productId, variantId }
 * para poder buscar rapidamente la variante de TN por SKU de Dragonfish.
 * El SKU en TN deberia ser algo tipo "10A-38" (Articulo-Talle)
 * o solo "10A" si no tiene talles/colores.
 */
function buildSkuMap(tnProducts) {
  const map = {};
  for (const product of tnProducts) {
    for (const variant of product.variants || []) {
      if (variant.sku) {
        map[variant.sku] = {
          productId: product.id,
          variantId: variant.id,
          currentStock: variant.stock,
        };
      }
    }
  }
  return map;
}

/**
 * Actualiza el stock de una variante en Tienda Nube.
 */
async function updateVariantStock(productId, variantId, stock) {
  await axios.put(
    `${BASE_URL}/products/${productId}/variants/${variantId}`,
    { stock },
    { headers: HEADERS }
  );
}

module.exports = { getAllProducts, buildSkuMap, updateVariantStock };
