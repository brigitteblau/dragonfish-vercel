const {
  getAllProducts,
  updateVariantStock,
  normalizeSku,
  getVariantStock,
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

function buildDragonfishCandidates(row) {
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

  const directSku = cleanPart(
    row.SKU ??
      row.Sku ??
      row.sku ??
      row.CodBarra ??
      row.codBarra ??
      row.CodigoBarras ??
      row.codigoBarras
  );

  const candidates = [];

  if (directSku) {
    candidates.push(directSku);
  }

  if (articulo) {
    if (color && talle) {
      candidates.push(`${articulo}!${color}!${talle}`);
      candidates.push(`${articulo}#${color}#${talle}`);
      candidates.push(`${articulo}##${color}##${talle}`);
      candidates.push(`${articulo}${color}${talle}`);
    }

    if (!color && talle) {
      candidates.push(`${articulo}!${talle}`);
      candidates.push(`${articulo}#${talle}`);
      candidates.push(`${articulo}##${talle}`);
      candidates.push(`${articulo}${talle}`);
    }

    if (color && !talle) {
      candidates.push(`${articulo}!${color}`);
      candidates.push(`${articulo}#${color}`);
      candidates.push(`${articulo}##${color}`);
      candidates.push(`${articulo}${color}`);
    }

    candidates.push(articulo);
  }

  return [...new Set(candidates.filter(Boolean))];
}

function getArticuloFromRow(row) {
  return cleanPart(
    row.Articulo ??
      row.articulo ??
      row.CodigoArticulo ??
      row.codigoArticulo ??
      row.Codigo ??
      row.codigo
  );
}

function getTalleFromRow(row) {
  return cleanPart(row.Talle ?? row.talle);
}

function getColorFromRow(row) {
  return cleanPart(row.Color ?? row.color);
}

function buildDragonfishStockMap(stock) {
  const map = {};
  const filasSinSku = [];
  const duplicados = [];

  for (const row of stock) {
    const candidates = buildDragonfishCandidates(row);

    if (!candidates.length) {
      filasSinSku.push(row);
      continue;
    }

    const disponible = getDisponible(row);
    const articulo = getArticuloFromRow(row);
    const color = getColorFromRow(row);
    const talle = getTalleFromRow(row);

    for (const candidate of candidates) {
      const normalizedSku = normalizeSku(candidate);

      if (!normalizedSku) continue;

      if (map[normalizedSku]) {
        duplicados.push({
          normalizedSku,
          existente: map[normalizedSku].displaySku,
          nuevo: candidate,
        });
      }

      map[normalizedSku] = {
        normalizedSku,
        displaySku: candidate,
        stock: disponible,
        articulo,
        color,
        talle,
        originalRow: row,
      };
    }
  }

  return {
    map,
    filasSinSku,
    duplicados,
  };
}

function getTiendanubeVariants(products) {
  const variants = [];

  for (const product of products) {
    for (const variant of product.variants || []) {
      if (!variant.sku) continue;

      const originalSku = String(variant.sku).trim();
      const normalizedSku = normalizeSku(originalSku);

      if (!normalizedSku) continue;

      variants.push({
        productId: product.id,
        productName: product.name,
        variantId: variant.id,
        originalSku,
        normalizedSku,
        currentStock: getVariantStock(variant),
      });
    }
  }

  return variants;
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
    console.log(`[sync] Recibidas ${stock.length} filas de Dragonfish`);

    const {
      map: dragonfishStockMap,
      filasSinSku,
      duplicados,
    } = buildDragonfishStockMap(stock);

    console.log(`[sync] SKUs posibles Dragonfish: ${Object.keys(dragonfishStockMap).length}`);

    const products = await getAllProducts();
    const tnVariants = getTiendanubeVariants(products);

    console.log(`[sync] Variantes con SKU en Tiendanube: ${tnVariants.length}`);

    const resultados = {
      actualizados: 0,
      sinCambios: 0,
      noEncontrados: [],
      errores: [],
      filasSinSku: filasSinSku.length,
      duplicadosDragonfish: duplicados.length,
    };

    for (const tnVariant of tnVariants) {
      const dfItem = dragonfishStockMap[tnVariant.normalizedSku];

      if (!dfItem) {
        resultados.noEncontrados.push({
          tiendanubeSku: tnVariant.originalSku,
          normalizedSku: tnVariant.normalizedSku,
          productId: tnVariant.productId,
          productName: tnVariant.productName,
          variantId: tnVariant.variantId,
          currentStockTiendanube: tnVariant.currentStock,
        });

        continue;
      }

      if (Number(tnVariant.currentStock) === Number(dfItem.stock)) {
        resultados.sinCambios++;
        continue;
      }

      try {
        await updateVariantStock(tnVariant.productId, tnVariant.variantId, dfItem.stock);

        console.log(
          `[sync] Actualizado TN SKU ${tnVariant.originalSku} usando Dragonfish ${dfItem.displaySku}: ${tnVariant.currentStock} -> ${dfItem.stock}`
        );

        resultados.actualizados++;
      } catch (err) {
        console.error(
          `[sync] Error actualizando ${tnVariant.originalSku}:`,
          err?.response?.data || err.message
        );

        resultados.errores.push({
          tiendanubeSku: tnVariant.originalSku,
          normalizedSku: tnVariant.normalizedSku,
          productId: tnVariant.productId,
          productName: tnVariant.productName,
          variantId: tnVariant.variantId,
          error: err?.response?.data || err.message,
        });
      }
    }

    console.log(
      `[sync] Resultado: ${resultados.actualizados} actualizados, ${resultados.sinCambios} sin cambios, ${resultados.noEncontrados.length} SKUs de Tiendanube sin match en Dragonfish`
    );

    return res.status(200).json({
      ok: true,
      actualizados: resultados.actualizados,
      sinCambios: resultados.sinCambios,

      // Mantengo este nombre para que tu PowerShell actual siga mostrando .noEncontrados.Count
      noEncontrados: resultados.noEncontrados,

      noEncontradosCantidad: resultados.noEncontrados.length,
      noEncontradosSample: resultados.noEncontrados.slice(0, 30),

      errores: resultados.errores,
      filasSinSku: resultados.filasSinSku,
      duplicadosDragonfish: resultados.duplicadosDragonfish,
    });
  } catch (err) {
    console.error("[sync] Error general:", err?.response?.data || err.message);

    return res.status(500).json({
      ok: false,
      error: err?.response?.data || err.message,
    });
  }
};