# dragonfishXtiendanube — Sync en Vercel

## Arquitectura

```
[WorkSpace de Hernán]              [Vercel]                [Tienda Nube]
dragonfish-sync.ps1
  │
  ├─ lee Dragonfish (localhost:8000)
  │
  └─ POST /api/sync ──────────────► sync.js
                                      │
                                      ├─ GET products (TN)
                                      ├─ compara stock
                                      └─ PUT variants (TN) ──► actualiza stock
```

## Paso 1: Deploy en Vercel

1. Crear cuenta en vercel.com (gratis).
2. Instalar Vercel CLI en tu Mac:
   ```
   npm install -g vercel
   ```
3. Desde la carpeta de este proyecto:
   ```
   vercel
   ```
   Seguir los pasos (login, nombre del proyecto, etc.).

4. Configurar variables de entorno en Vercel (panel web o CLI):
   ```
   vercel env add TN_STORE_ID
   # valor: 7875743

   vercel env add TN_ACCESS_TOKEN
   # valor: el access_token de Tienda Nube

   vercel env add SYNC_SECRET
   # valor: inventate un string largo, ej: "mirrow-sync-2026-aBcXyZ"
   ```

5. Hacer el deploy definitivo:
   ```
   vercel --prod
   ```
   Te da una URL tipo `https://dragonfish-vercel.vercel.app`.

6. Verificar que anda:
   ```
   curl https://TU-URL.vercel.app/api/health
   ```
   Debe devolver `{"ok":true, ...}`.

## Paso 2: Configurar el PowerShell en el WorkSpace

1. Copiar `dragonfish-sync.ps1` al WorkSpace de Hernán
   (por ej. en `C:\sync\dragonfish-sync.ps1`).

2. Editar las 5 variables del bloque CONFIG al principio:
   - `$dragonfishUrl`: dejar como esta (localhost:8000)
   - `$idCliente`: API-B
   - `$token`: el JWT de Dragonfish
   - `$vercelUrl`: la URL de Vercel + /api/sync
   - `$syncSecret`: el mismo string que pusiste en SYNC_SECRET de Vercel

3. Probarlo a mano una vez:
   ```
   powershell -ExecutionPolicy Bypass -File "C:\sync\dragonfish-sync.ps1"
   ```
   Debe imprimir cuántas variantes actualizó, cuántas no cambiaron, y cuántas no encontró.

## Paso 3: Programar en Task Scheduler (Windows)

1. Abrir "Programador de tareas" (Task Scheduler) en el WorkSpace.
2. "Crear tarea básica".
3. Nombre: "Sync Dragonfish Tienda Nube".
4. Disparador: "Diariamente", repetir cada 30 minutos.
5. Acción: "Iniciar un programa".
   - Programa: `powershell`
   - Argumentos: `-ExecutionPolicy Bypass -File "C:\sync\dragonfish-sync.ps1"`
6. Finalizar.

El sync va a correr solo cada 30 minutos sin que nadie toque nada.

## Estado actual del matching de SKUs

El script arma el SKU de Dragonfish como: `ARTICULO-COLOR-TALLE`
Ejemplo: artículo `10A`, color `AZUL`, talle `38` → SKU `10A-AZUL-38`
Si no tiene color: `10A-38`
Si no tiene talle: `10A-AZUL`

Para que el matching funcione, las variantes en Tienda Nube tienen que tener
ese mismo formato en el campo SKU. Si los SKUs de TN son distintos, hay que
armar una tabla de equivalencias (lo vemos cuando veamos los SKUs reales de TN).

## Notas

- El Access Token de TN no expira (lo confirma la doc oficial de TN).
- El JWT de Dragonfish expira en 2 años (según la config que hiciste).
- Si Dragonfish devuelve Disponible negativo, el script manda 0 a TN
  (no tiene sentido poner stock negativo en la tienda).
