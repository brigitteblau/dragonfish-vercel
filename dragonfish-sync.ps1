# ============================================================
# dragonfish-sync.ps1
# Lee TODO el stock de Dragonfish y lo manda al endpoint de Vercel.
# Corre desde el WorkSpace con Task Scheduler cada 30 minutos.
# ============================================================

$logDir = "C:\sync\logs"

if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$logFile = "$logDir\dragonfish-sync-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').log"

Start-Transcript -Path $logFile -Append

# ====== CONFIG ======
$dragonfishUrl = "http://localhost:8000/api.Dragonfish"
$idCliente     = "API-B"
$token         = "PEGAR_TOKEN_REAL_DRAGONFISH"
$vercelUrl     = "https://dragonfish-vercel.vercel.app/api/sync"
$syncSecret    = "briguXdragonfish"

$headers = @{
    "IdCliente"     = $idCliente
    "Authorization" = $token
}

Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Iniciando sync Dragonfish -> Tiendanube..."

try {
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

        if ($null -ne $response.Resultados) {
            $todoElStock += $response.Resultados
        }

        $pagina++

    } while ($todoElStock.Count -lt $totalRegistros -and $response.Resultados.Count -gt 0)

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Stock descargado: $($todoElStock.Count) filas"

    # ---- Mandar a Vercel ----
    $payload = @{
        secret = $syncSecret
        stock  = $todoElStock
    } | ConvertTo-Json -Depth 10

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Mandando a Vercel..."

    $resultado = Invoke-RestMethod -Uri $vercelUrl -Method POST -Body $payload -ContentType "application/json"

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Sync completado:"
    Write-Host "  OK                    : $($resultado.ok)"
    Write-Host "  Actualizados          : $($resultado.actualizados)"
    Write-Host "  Sin cambios           : $($resultado.sinCambios)"
    Write-Host "  No encontrados        : $($resultado.noEncontradosCantidad)"
    Write-Host "  Duplicados Tiendanube : $($resultado.duplicadosTiendanube)"
    Write-Host "  Filas sin SKU         : $($resultado.filasSinSku)"

    if ($resultado.noEncontradosSample -and $resultado.noEncontradosSample.Count -gt 0) {
        Write-Host ""
        Write-Host "Primeros SKUs no encontrados:"
        $resultado.noEncontradosSample | ConvertTo-Json -Depth 6
    }

    if ($resultado.errores -and $resultado.errores.Count -gt 0) {
        Write-Host ""
        Write-Host "Errores:"
        $resultado.errores | ConvertTo-Json -Depth 6
    }

} catch {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR GENERAL:"
    Write-Host $_
}

Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Listo."

Stop-Transcript