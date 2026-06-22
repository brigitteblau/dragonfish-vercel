/**
 * POST /api/sync
 *
 * Recibe el stock de Dragonfish desde el PowerShell del WorkSpace,
 * lo compara con lo que hay en Tienda Nube, y actualiza solo lo que cambio.
 *
 * Body esperado:
 * {
 *   secret: "...",           <- clave de seguridad (definida en env SYNC_SECRET)
 *   stock: [                 <- array de ConsultaStockYPrecios de Dragonfish
 *     { Articulo, Color, Talle, Disponible, ... },
 *     ...
 *   ]
 * }
 */

const { getAllProducts, buildSkuMap, updateVariantStock } = require("./_tiendanube");

module.exports = async (req, res) => {
  // Solo POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Validar clave de seguridad
  const { secret, stock } = req.body;
  if (!secret || secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!Array.isArray(stock) || stock.length === 0) {
    return res.status(400).json({ error: "stock debe ser un array no vacio" });
  }

  try {
    console.log(`[sync] Recibidas ${stock.length} variantes de Dragonfish`);

    // 1. Construir mapa de SKUs de Dragonfish
    // Formato del SKU que usamos: "ARTICULO-TALLE" o "ARTICULO-COLOR-TALLE"
    // Ejemplo: "10A-38", "10A-AZUL-38"
    // Si no tiene color, queda "10A-38". Si no tiene talle, "10A-AZUL".
    const dfStockMap = {};
    for (const row of stock) {
      // Filtramos filas resumen (Talle Y Color vacios)
      if (!row.Talle && !row.Color) continue;
      const partes = [row.Articulo];
      if (row.Color) partes.push(row.Color);
      if (row.Talle) partes.push(row.Talle);
      const sku = partes.join("-");
      dfStockMap[sku] = row.Disponible >= 0 ? row.Disponible : 0;
    }

    console.log(`[sync] SKUs de Dragonfish procesados: ${Object.keys(dfStockMap).length}`);

    // 2. Traer productos de Tienda Nube y construir mapa de SKUs
    const tnProducts = await getAllProducts();
    const tnSkuMap = buildSkuMap(tnProducts);
    console.log(`[sync] SKUs encontrados en Tienda Nube: ${Object.keys(tnSkuMap).length}`);

    // 3. Comparar y actualizar solo lo que cambio
    const resultados = { actualizados: 0, sinCambios: 0, noEncontrados: [] };

    for (const [sku, stockDf] of Object.entries(dfStockMap)) {
      const tnVariant = tnSkuMap[sku];

      if (!tnVariant) {
        // SKU de Dragonfish no existe en TN (puede ser producto no publicado)
        resultados.noEncontrados.push(sku);
        continue;
      }

      if (tnVariant.currentStock === stockDf) {
        // Ya tiene el stock correcto, no hace falta actualizar
        resultados.sinCambios++;
        continue;
      }

      // Stock diferente -> actualizar
      await updateVariantStock(tnVariant.productId, tnVariant.variantId, stockDf);
      console.log(`[sync] Actualizado SKU ${sku}: ${tnVariant.currentStock} -> ${stockDf}`);
      resultados.actualizados++;
    }

    console.log(`[sync] Resultado: ${resultados.actualizados} actualizados, ${resultados.sinCambios} sin cambios, ${resultados.noEncontrados.length} no encontrados`);

    return res.status(200).json({
      ok: true,
      ...resultados,
    });
  } catch (err) {
    console.error("[sync] Error:", err?.response?.data || err.message);
    return res.status(500).json({
      error: err?.response?.data || err.message,
    });
  }
};
