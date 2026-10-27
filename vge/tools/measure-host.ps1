# Starts N game processes at once against the running Vite server, waits until each logs
# "[vge] entry ready at X s", lets them settle, then reports time-to-scene and memory per process.
param(
  [int]$Count = 1,
  [string]$Mode = "render",   # render | nullrhi
  [int]$SettleSeconds = 15
)
$root = (Resolve-Path "$PSScriptRoot\..\..").Path
$exe = "$root\Build\Package\Windows\VibeGameEngine\Binaries\Win64\VibeGameEngine.exe"
$logDir = "$root\Saved\measure"
New-Item -ItemType Directory -Force $logDir | Out-Null
$modeArgs = if ($Mode -eq "nullrhi") { "-nullrhi" } else { "-windowed -ResX=1280 -ResY=720" }
$procs = @()
for ($i = 0; $i -lt $Count; $i++) {
  $log = Join-Path $logDir "$Mode-$i.log"
  if (Test-Path $log) { Remove-Item $log -Force }
  $procs += [pscustomobject]@{ P = (Start-Process $exe -ArgumentList "$modeArgs -abslog=`"$log`"" -PassThru); Log = $log }
}
$deadline = (Get-Date).AddSeconds(120)
foreach ($x in $procs) {
  while ((Get-Date) -lt $deadline -and -not ((Test-Path $x.Log) -and (Select-String -Path $x.Log -Pattern "\[vge\] entry (ready|failed)" -Quiet))) { Start-Sleep -Milliseconds 200 }
}
Start-Sleep $SettleSeconds
foreach ($x in $procs) {
  $x.P.Refresh()
  $line = (Select-String -Path $x.Log -Pattern "\[vge\] entry (ready|failed).*" | Select-Object -First 1).Matches.Value
  "{0} pid={1} {2} ws={3}MB private={4}MB" -f $Mode, $x.P.Id, $line, [math]::Round($x.P.WorkingSet64 / 1MB), [math]::Round($x.P.PrivateMemorySize64 / 1MB)
  Stop-Process -Id $x.P.Id -Force
}
