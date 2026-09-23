# RESTART-Madastock.ps1 - Relance serveur Madastock + tunnel Cloudflare (aprés coupure/freeze)
# Usage : clic droit sur ce fichier -> Exécuter avec PowerShell
$ErrorActionPreference = 'Stop'
Write-Host "=== Relance Madastock (WSL) ==="

# 1. Arret des anciens processus serveur+tunnel
wsl -d Ubuntu -- bash -c "pkill -f 'node dist/server.js'; pkill -f cloudflared; sleep 1; echo anciens_processus_arretes"

# 2. Relance du serveur Madastock (tache detachee)
Start-Process wsl.exe -ArgumentList '-d','Ubuntu','--','bash','/home/mada/run_server.sh' -WindowStyle Hidden

# 3. Relance du tunnel Cloudflare (tache detachee)
Start-Process wsl.exe -ArgumentList '-d','Ubuntu','--','bash','/home/mada/run_cf.sh' -WindowStyle Hidden

Start-Sleep -Seconds 20

# 4. Nouvelle URL publique du tunnel
$url = (wsl -d Ubuntu -- bash -c "grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' ~/cf_tunnel.log | head -1").Trim()
Write-Host ""
Write-Host "=== Site en local :  http://localhost:5000 ==="
Write-Host "=== URL publique  :  $url ==="
Write-Host "Partage cette URL - ton site est visible partout tant que le PC reste allume !"