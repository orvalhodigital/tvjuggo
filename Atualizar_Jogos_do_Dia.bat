@echo off
chcp 65001 >nul
title Atualizador de Jogos do Dia - IPTV Brasil
color 0A
echo ========================================================
echo    ATUALIZANDO JOGOS DO DIA (FUTEBOL AO VIVO)
echo ========================================================
echo.
node "%~dp0atualizar_jogos_do_dia.js"
echo.
echo ========================================================
echo Atualizacao concluida! Pressione qualquer tecla para sair.
echo ========================================================
pause >nul
