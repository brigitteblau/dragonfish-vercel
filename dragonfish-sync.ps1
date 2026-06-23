# ============================================================
# dragonfish-sync.ps1
# Lee TODO el stock de Dragonfish y lo manda al endpoint de Vercel.
# Configurar las variables de abajo y programar en Task Scheduler.
# ============================================================

# ====== CONFIG: completar con tus datos ======
$dragonfishUrl = "http://localhost:8000/api.Dragonfish"
$idCliente     = "API-B"
$token         = "223993f00e1f02fb411d0a68104f7c53e56c4927"
$vercelUrl     = "https://dragonfish-vercel.vercel.app/api/sync"
$syncSecret    = "8e04c6b16accd3deb65c7ef52c95afa9bee0bcd2cf8ac3ac"
# ==============================================

$headers = @{
    "IdCliente"     = $idCliente
    "Authorization" = $token
}

Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Iniciando sync Dragonfish -> Tienda Nube..."

# ---- Traer TODO el stock paginando de a 200 ----
$todoElStock = @()
$pagina = 1
$totalRegistros = $null

do {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Trayendo pagina $pagina de stock..."
    $url = "$dragonfishUrl/ConsultaStockYPrecios/?limit=200&page=$pagina"
    $response = Invoke-RestMethod -Uri $url -Method GET -Headers $headers
    
    if ($null -eq $totalRegistros) {
        $totalRegistros = $response.TotalRegistros
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Total de variantes en Dragonfish: $totalRegistros"
    }
    
    $todoElStock += $response.Resultados
    $pagina++

} while ($todoElStock.Count -lt $totalRegistros -and $response.Resultados.Count -gt 0)

Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Stock descargado: $($todoElStock.Count) filas"

# ---- Mandar a Vercel ----
$payload = @{
    secret = $syncSecret
    stock  = $todoElStock
} | ConvertTo-Json -Depth 6

Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Mandando a Vercel..."

try {
    $resultado = Invoke-RestMethod -Uri $vercelUrl -Method POST -Body $payload -ContentType "application/json"
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Sync completado:"
    Write-Host "  Actualizados  : $($resultado.actualizados)"
    Write-Host "  Sin cambios   : $($resultado.sinCambios)"
    Write-Host "  No encontrados: $($resultado.noEncontrados.Count)"
} catch {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR al mandar a Vercel: $_"
}

Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Listo."
