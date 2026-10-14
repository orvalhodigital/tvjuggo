@echo off
cd /d "%~dp0"
chcp 65001 >nul
title IPTV Multi-Channel Proxy Server
cls
echo =======================================================
echo    Iniciando IPTV Multi-Channel Proxy Server...
echo =======================================================
echo.
echo Dashboard: http://localhost:3000
echo Playlist M3U8 Multiplexada: http://localhost:3000/playlist.m3u8
echo.
start http://localhost:3000
node proxy_server.js
pause
