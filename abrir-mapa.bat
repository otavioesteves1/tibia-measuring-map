@echo off
setlocal
title Mapa do Tibia - servidor local
cd /d "%~dp0"

set PORTA=8765

rem --- procura um Python instalado -------------------------------------------
set PY=
where py >nul 2>&1 && set PY=py -3
if not defined PY ( where python >nul 2>&1 && set PY=python )
if not defined PY if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set PY="%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not defined PY if exist "C:\Program Files\Python314\python.exe" set PY="C:\Program Files\Python314\python.exe"

if not defined PY (
  echo.
  echo  Python nao encontrado.
  echo.
  echo  Sem problema: o mapa tambem funciona abrindo o index.html direto.
  echo  Vou abrir para voce agora...
  echo.
  start "" "%~dp0index.html"
  pause
  exit /b
)

rem --- gera os dados se ainda nao existirem -----------------------------------
if not exist "data\mapdata.js" (
  echo Gerando os dados do mapa...
  %PY% "tools\gerar_dados.py"
  echo.
)

echo.
echo  ============================================
echo   Mapa do Tibia rodando em:
echo   http://localhost:%PORTA%
echo.
echo   Feche esta janela para desligar o servidor.
echo  ============================================
echo.

start "" "http://localhost:%PORTA%"
%PY% -m http.server %PORTA% --bind 127.0.0.1
