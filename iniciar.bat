@echo off
title Sistema WEB - Alcaldia de Shinahota
cls
echo =====================================================================
echo    SISTEMA WEB DE GESTION DE CONTROL Y SOLICITUDES DE MATERIAL
echo           INTEGRACION BLOCKCHAIN - ALCALDIA DE SHINAHOTA
echo =====================================================================
echo.

REM ─── PASO 1: Crear base de datos si no existe ─────────────────────────
echo [1/5] Verificando base de datos PostgreSQL...
cd /d "%~dp0backend"
python create_db.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] No se pudo conectar a PostgreSQL.
    echo         Asegurate de que PostgreSQL este corriendo y que la password sea 12345.
    echo         Revisa el archivo backend\.env si necesitas cambiarla.
    pause
    exit /b 1
)
echo.

REM ─── PASO 2: Aplicar migraciones ──────────────────────────────────────
echo [2/5] Aplicando migraciones a la base de datos...
python manage.py migrate --settings=config.settings
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo al aplicar migraciones. Revisa la configuracion del backend.
    pause
    exit /b 1
)
echo.

REM ─── PASO 3: Cargar usuarios y datos iniciales ────────────────────────
echo [3/5] Cargando usuarios y datos iniciales...
python manage.py seed_data --settings=config.settings
echo.

REM ─── PASO 4: Iniciar Blockchain ───────────────────────────────────────
echo [4/5] Iniciando Nodo Blockchain Local (Hardhat)...
start "WEG - Blockchain" cmd /k "cd /d "%~dp0blockchain" && npx hardhat node"
timeout /t 5 /nobreak >nul
echo.

REM ─── PASO 5: Iniciar Backend y Frontend ──────────────────────────────
echo [5/5] Iniciando Backend Django y Frontend React...
start "WEG - Backend"   cmd /k "cd /d "%~dp0backend"    && python manage.py runserver 0.0.0.0:8000 --settings=config.settings"
timeout /t 3 /nobreak >nul
start "WEG - Frontend"  cmd /k "cd /d "%~dp0frontend"   && npm run dev"

echo.
echo =====================================================================
echo  Todos los servicios han sido iniciados correctamente!
echo.
echo  Accesos del sistema:
echo   Frontend:    http://localhost:5173/
echo   Backend API: http://localhost:8000/api/
echo   Blockchain:  http://127.0.0.1:8545/
echo.
echo  CREDENCIALES DE ACCESO:
echo   Administrador:  admin@shinahota.bo      / 12345
echo   Jefe Almacen:   jefe@shinahota.bo       / 12345
echo   Solicitante:    solicitante@shinahota.bo / 12345
echo   Auditor:        auditor@shinahota.bo     / 12345
echo =====================================================================
pause
