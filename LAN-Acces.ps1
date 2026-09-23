# LAN-Access.ps1 - Ouvrir Madastock a l'echelle du reseau (Wifi) pour quelques secondes
# Usage : clic droit -> Exécuter en tant qu'administrateur (ou ce script le fait lui-même si lancé normalement)
$ErrorActionPreference = 'Continue'

Write-Host "=== [1] IP WSL ==="
$wslIp = (wsl -d Ubuntu -- bash -c "hostname -I").Trim() -split ' ' | Select-Object -First 1
Write-Host "WSL IP: $wslIp"

Write-Host "=== [2] Regle Firewall (port 5000) ==="
if ($IS_WINDOWS -eq $null -or $true) {
  if (-not (Get-NetFirewallRule -DisplayName 'Madastock-LAN' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'Madastock-LAN' -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow | Out-Null
    Write-Host "Regle creee."
  } else {
    Write-Host "Regle existe deja."
  }
}

Write-Host "=== [3] Portproxy 5000 -> WSL ==="
netsh interface portproxy delete v4tov4 listenport=5000 listenaddress=0.0.0.0 2>$null | Out-Null
netsh interface portproxy add v4tov4 listenport=5000 listenaddress=0.0.0.0 connectport=5000 connectaddress=$wslIp
netsh interface portproxy show all

Write-Host ""
Write-Host "==============================================="
$lan = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } | Select-Object -First 1).IPAddress
$pub = (wsl -d Ubuntu -- bash -c "grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' ~/cf_tunnel.log | tail -1").Trim()
Write-Host "=== SITE (meme Wifi) : http://$lan`:5000 ==="
Write-Host "=== SITE (public, PC on) : $pub ==="
Write-Host "==============================================="