@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo O Node.js nao esta instalado. Instala a versao LTS em https://nodejs.org e volta a abrir este ficheiro.
  pause
  exit /b 1
)
if not exist node_modules (
  echo A instalar dependencias ^(so na primeira vez, pode demorar uns minutos^)...
  call npm install
  if errorlevel 1 ( echo Falhou a instalacao. & pause & exit /b 1 )
)
call npm start
