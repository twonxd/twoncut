# Installs the panel straight from this repo for development (no setup exe needed).
# Usage: powershell -ExecutionPolicy Bypass -File scripts\dev-install.ps1
$ErrorActionPreference = 'Stop'
$src = Join-Path (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)) 'extension'
$extensions = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
$dest = Join-Path $extensions 'com.twonedit.twoncut'

if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
Copy-Item $src $dest -Recurse

# Versions before 5.0 used another folder
$legacy = Join-Path $extensions 'com.sessizkes.panel'
if (Test-Path $legacy) { Remove-Item $legacy -Recurse -Force }

# CEP debug mode lets Premiere load unsigned panels
foreach ($v in 9..13) {
    $key = "HKCU:\Software\Adobe\CSXS.$v"
    if (-not (Test-Path $key)) { New-Item $key -Force | Out-Null }
    Set-ItemProperty $key -Name PlayerDebugMode -Value '1'
}

Write-Host "Installed to $dest"
Write-Host "Restart Premiere Pro, then open Window > Extensions > twoncut."
