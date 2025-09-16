@echo off
title Instalador WhatsApp Bot VIP
echo ============================================
echo INSTALANDO DEPENDÊNCIAS...
echo ============================================
echo.

:: Verifica se Node está instalado
node -v >nul 2>&1 || (
  echo ❌ Node.js não está instalado!
  echo Baixe em: https://nodejs.org
  pause
  exit /b
)

:: Instala dependências
npm install electron whatsapp-web.js qrcode puppeteer node-schedule axios

echo.
echo ✅ Dependências instaladas com sucesso!
pause
