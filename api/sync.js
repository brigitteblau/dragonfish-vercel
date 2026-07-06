const {
  getAllProducts,
  buildSkuMap,
  updateVariantStock,
  normalizeSku,
} = require("./_tiendanube");

function cleanPart(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function getDisponible(row) {
  const value =
    row.Disponible ??
    row.disponible ??
    row.Stock ??
    row.stock ??
    row.Cantidad ??
    row.cantidad ??
    0;

  const number = Number(value);

  if (Number.isNaN(number)) return 0;

  return number >= 0 ? number : 0;
}

/**
 * Arma candidatos de SKU desde Dragonfish.
 *
 * Dragonfish / Znube / Tiendanube pueden usar:
 * - SW1001!31!L
 * - SW1001##31##L
 * - SW1001#31#L
 *
 * Nosotros generamos varios formatos, pero para matchear usamos normalizeSku().
 */
function buildDragonfishSkuCandidates(row) {
  const articulo = cleanPart(
    row.Articulo ??
      row.articulo ??
      row.CodigoArticulo ??
      row.codigoArticulo ??
      row.Codigo ??
      row.codigo
  );

  const color = cleanPart(row.Color ?? row.color);
  const talle = cleanPart(row.Talle ?? row.talle);

  if (!articulo) return [];

  const partes = [articulo];

  if (color) partes.push(color);
  if (talle) partes.push(talle);

  const candidates = [
    partes.join("!"),
    partes.join("##"),
    partes.join("#"),
    partes.join("-"),
    partes.join(""),
  ];

  // Por si Dragonfish trae un SKU ya armado en otro campo.
  const possibleDirectSku =
    row.SKU ??
    row.Sku ??
    row.sku ??
    row.CodBarra ??
    row.codBarra ??
    row.CodigoBarras ??
    row.codigoBarras;

  if (possibleDirectSku) {
    candidates.push(cleanPart(possibleDirectSku));
  }

  return [...new Set(candidates.filter(Boolean))];
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  const { secret, stock } = req.body;

  if (!secret || secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized",
    });
  }

  if (!Array.isArray(stock) || stock.length === 0) {
    return res.status(400).json({
      ok: false,
      error: "stock debe ser un array no vacío",
    });
  }

  try {
    console.log(`[sync] Recibidas ${stock.length} filas desde Dragonfish`);

    const dfStockMap = {};
    const filasSinSku = [];

    for (const row of stock) {
      const candidates = buildDragonfishSkuCandidates(row);

      if (!candidates.length) {
        filasSinSku.push(row);
        continue;
      }

      const displaySku = candidates[0];
      const normalizedSku = normalizeSku(displaySku);
      const disponible = getDisponible(row);

      if (!normalizedSku) {
        filasSinSku.push(row);
        continue;
      }

      // Si Dragonfish manda la misma variante más de una vez, pisamos con el último valor.
      dfStockMap[normalizedSku] = {
        displaySku,
        normalizedSku,
        candidates,
        stock: disponible,
        originalRow: row,
      };
    }

    console.log(`[sync] SKUs Dragonfish procesados: ${Object.keys(dfStockMap).length}`);

    const tnProducts = await getAllProducts();

    console.log(`[sync] Productos Tiendanube encontrados: ${tnProducts.length}`);

    const { map: tnSkuMap, duplicados } = buildSkuMap(tnProducts);

    console.log(`[sync] SKUs Tiendanube encontrados: ${Object.keys(tnSkuMap).length}`);

    if (duplicados.length > 0) {
      console.log(`[sync] OJO: Hay ${duplicados.length} SKUs duplicados normalizados en Tiendanube`);
      console.log(JSON.stringify(duplicados.slice(0, 20), null, 2));
    }

    const resultados = {
      actualizados: 0,
      sinCambios: 0,
      noEncontrados: [],
      errores: [],
      duplicadosTiendanube: duplicados.length,
      filasSinSku: filasSinSku.length,
    };

    for (const item of Object.values(dfStockMap)) {
      const tnVariant = tnSkuMap[item.normalizedSku];

      if (!tnVariant) {
        resultados.noEncontrados.push({
          dragonfishSku: item.displaySku,
          normalizedSku: item.normalizedSku,
          candidates: item.candidates,
        });

        continue;
      }

      if (Number(tnVariant.currentStock) === Number(item.stock)) {
        resultados.sinCambios++;
        continue;
      }

      try {
        await updateVariantStock(tnVariant.productId, tnVariant.variantId, item.stock);

        console.log(
          `[sync] Actualizado ${tnVariant.originalSku} | normalizado ${item.normalizedSku}: ${tnVariant.currentStock} -> ${item.stock}`
        );

        resultados.actualizados++;
      } catch (err) {
        console.error(
          `[sync] Error actualizando ${tnVariant.originalSku}:`,
          err?.response?.data || err.message
        );

        resultados.errores.push({
          dragonfishSku: item.displaySku,
          tiendanubeSku: tnVariant.originalSku,
          productId: tnVariant.productId,
          variantId: tnVariant.variantId,
          error: err?.response?.data || err.message,
        });
      }
    }

    console.log(
      `[sync] Resultado: ${resultados.actualizados} actualizados, ${resultados.sinCambios} sin cambios, ${resultados.noEncontrados.length} no encontrados, ${resultados.errores.length} errores`
    );

    return res.status(200).json({
      ok: true,
      actualizados: resultados.actualizados,
      sinCambios: resultados.sinCambios,
      noEncontradosCantidad: resultados.noEncontrados.length,
      noEncontradosSample: resultados.noEncontrados.slice(0, 30),
      errores: resultados.errores,
      duplicadosTiendanube: resultados.duplicadosTiendanube,
      filasSinSku: resultados.filasSinSku,
    });
  } catch (err) {
    console.error("[sync] Error general:", err?.response?.data || err.message);

    return res.status(500).json({
      ok: false,
      error: err?.response?.data || err.message,
    });
  }
};