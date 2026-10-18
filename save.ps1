# save.ps1  —  Save all your changes and upload them to GitHub.
# Usage:
#   .\save.ps1                 (uses an automatic message with the date/time)
#   .\save.ps1 "what I did"    (uses your own message)

param([string]$Message)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not $Message -or $Message.Trim() -eq "") {
    $Message = "Update - " + (Get-Date -Format "yyyy-MM-dd HH:mm")
}

Write-Host "`n==> Staging all changes..." -ForegroundColor Cyan
git add -A

# Nothing to commit? Just make sure GitHub is up to date and stop.
if ((git status --porcelain).Length -eq 0) {
    Write-Host "Nothing new to save. Pushing anything already committed..." -ForegroundColor Yellow
    git push
    Write-Host "`nDone - GitHub is up to date.`n" -ForegroundColor Green
    return
}

Write-Host "==> Committing: $Message" -ForegroundColor Cyan
git commit -m "$Message"

Write-Host "==> Uploading to GitHub..." -ForegroundColor Cyan
git push

Write-Host "`nDone - your changes are saved on GitHub.`n" -ForegroundColor Green
