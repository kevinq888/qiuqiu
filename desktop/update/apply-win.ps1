param([string]$ConfigPath)
$ErrorActionPreference = 'Stop'
$c = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
function Save-Result($value) {
  $json = $value | ConvertTo-Json -Compress
  [IO.File]::WriteAllText($c.result, $json, (New-Object Text.UTF8Encoding($false)))
}
$backupComplete = $false
try {
  $old = Get-Process -Id $c.pid -ErrorAction SilentlyContinue
  if ($old) { $old.WaitForExit(120000) | Out-Null }
  if (Get-Process -Id $c.pid -ErrorAction SilentlyContinue) { throw 'Player did not exit' }
  # Keep the current application intact until a complete backup exists.
  Copy-Item -LiteralPath $c.target -Destination $c.backup -Recurse
  $backupComplete = $true
  $install = Start-Process -FilePath $c.installer -ArgumentList @('/S', '--updated', ('/D=' + $c.target)) -PassThru -Wait
  if ($install.ExitCode -ne 0) { throw ('Installer failed: ' + $install.ExitCode) }
  $new = Start-Process -FilePath $c.exe -ArgumentList @('--updated', ('"--user-data-dir=' + $c.userData + '"')) -PassThru
  for ($i = 0; $i -lt 90; $i++) {
    if (Test-Path -LiteralPath $c.healthy) {
      Save-Result $c.success
      Remove-Item -LiteralPath $c.backup -Recurse -Force
      Get-ChildItem -LiteralPath (Split-Path $c.result) -File | Where-Object { $_.Extension -in @('.zip', '.exe') } | Remove-Item -Force
      exit 0
    }
    if ($new.HasExited) { break }
    Start-Sleep -Seconds 1
    $new.Refresh()
  }
  if (-not $new.HasExited) { $new.Kill(); $new.WaitForExit() }
  throw 'New application did not confirm startup'
} catch {
  $_ | Out-File -LiteralPath $c.log -Append -Encoding UTF8
  if ($backupComplete -and (Test-Path -LiteralPath $c.backup)) {
    Get-ChildItem -LiteralPath $c.backup -Force | Copy-Item -Destination $c.target -Recurse -Force
    Start-Process -FilePath $c.exe -ArgumentList @('--update-rollback', ('"--user-data-dir=' + $c.userData + '"'))
  }
  Save-Result $c.failure
  exit 1
}
