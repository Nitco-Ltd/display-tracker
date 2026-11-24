# Display Tracker - creates the two Windows scheduled tasks. Run once, in PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts\windows\setup-tasks.ps1
# Optional: -Time "07:00"   -NoDashboard   -RunWhetherLoggedOnOrNot
param(
  [string]$Time = "07:00",
  [switch]$NoDashboard,
  [switch]$RunWhetherLoggedOnOrNot
)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..\..").Path
$folder = "\Display Tracker\"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 15) -MultipleInstances IgnoreNew

# 1) Daily sync at $Time (runs as soon as possible if the PC was off at that time)
$daily = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$root\scripts\windows\run-daily.cmd`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
if ($RunWhetherLoggedOnOrNot) {
  $cred = Get-Credential -Message "Your Windows password (needed to run while you are logged off)" -UserName "$env:USERDOMAIN\$env:USERNAME"
  Register-ScheduledTask -TaskPath $folder -TaskName "Daily sync" -Action $daily -Trigger $trigger -Settings $settings `
    -User $cred.UserName -Password $cred.GetNetworkCredential().Password -RunLevel Limited -Force | Out-Null
} else {
  Register-ScheduledTask -TaskPath $folder -TaskName "Daily sync" -Action $daily -Trigger $trigger -Settings $settings -RunLevel Limited -Force | Out-Null
}
Write-Host "Created task 'Display Tracker\Daily sync' at $Time every day."

# 2) Dashboard at logon
if (-not $NoDashboard) {
  $dash = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$root\scripts\windows\start-dashboard.cmd`"" -WorkingDirectory $root
  $dashSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskPath $folder -TaskName "Dashboard" -Action $dash -Trigger (New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME") `
    -Settings $dashSettings -RunLevel Limited -Force | Out-Null
  Write-Host "Created task 'Display Tracker\Dashboard' (starts at logon; open http://localhost:3000)."
}
Write-Host "Done. Open Task Scheduler > Task Scheduler Library > Display Tracker to see them."
