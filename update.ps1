# update.ps1  —  Get the latest code from GitHub.
# Safe to run even if you have unsaved edits: your edits are tucked aside,
# the latest code is pulled in, then your edits are put back on top.
# Usage:
#   .\update.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "`n==> Getting the latest code from GitHub..." -ForegroundColor Cyan
git pull --rebase --autostash

Write-Host "`nDone - you now have the latest code.`n" -ForegroundColor Green
