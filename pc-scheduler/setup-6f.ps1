# ============================================================
# InfoDisplay PC 스케줄러 설정 - 6층
# 관리자 권한으로 실행하세요: Right-click → Run as Administrator
# ============================================================

$FLOOR      = "6"
$API_URL    = "https://info-display-next.vercel.app/api/heartbeat"

Write-Host "=== InfoDisplay 6층 PC 설정 시작 ===" -ForegroundColor Cyan

# ── 1. 모니터 30초 후 끄기 (절전/동면 정책 변경 없음) ──────────
Write-Host "[1/4] 모니터 전원 설정 (30초 후 끄기)..."
powercfg /setacvalueindex SCHEME_CURRENT SUB_VIDEO VIDEOIDLE 30
powercfg /setdcvalueindex SCHEME_CURRENT SUB_VIDEO VIDEOIDLE 30
powercfg /setactive SCHEME_CURRENT

# ── 2. Wake Timer 활성화 ─────────────────────────────────────
Write-Host "[2/4] Wake Timer 활성화..."
powercfg /setacvalueindex SCHEME_CURRENT SUB_SLEEP RTCWAKE 1
powercfg /setdcvalueindex SCHEME_CURRENT SUB_SLEEP RTCWAKE 1
powercfg /setactive SCHEME_CURRENT

# ── 3. OS 하트비트 태스크 등록 (시작 시 실행, 60초 루프) ────────
Write-Host "[3/4] 하트비트 태스크 등록..."
$TASK_HB = "InfoDisplay_Heartbeat_6F"
$HB_CMD  = "while(`$true){ try { Invoke-RestMethod -Uri '$API_URL' -Method POST -ContentType 'application/json' -Body ('{""floor"":""$FLOOR"",""source"":""os"",""pcStatus"":""on""}') | Out-Null } catch {} ; Start-Sleep -Seconds 60 }"

$HB_Action    = New-ScheduledTaskAction -Execute "powershell.exe" `
                  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -Command `"$HB_CMD`""
$HB_Trigger   = New-ScheduledTaskTrigger -AtStartup
$HB_Settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 5 `
                  -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable $true
$HB_Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Unregister-ScheduledTask -TaskName $TASK_HB -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TASK_HB -Action $HB_Action -Trigger $HB_Trigger `
  -Settings $HB_Settings -Principal $HB_Principal | Out-Null
Write-Host "  등록 완료: $TASK_HB"

# ── 4. 자동 켜기/끄기 태스크 ────────────────────────────────────
Write-Host "[4/4] 자동 켜기/끄기 태스크 등록..."

# 자동 켜기: 평일 08:00 (시간 변경 시 수정)
$TASK_WAKE    = "InfoDisplay_Wake_6F"
$WAKE_Trigger = New-ScheduledTaskTrigger -Weekly `
                  -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At "08:00AM"
$WAKE_Action  = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c echo wake"
$WAKE_Settings= New-ScheduledTaskSettingsSet -WakeToRun $true -StartWhenAvailable $true
$WAKE_Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Unregister-ScheduledTask -TaskName $TASK_WAKE -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TASK_WAKE -Action $WAKE_Action -Trigger $WAKE_Trigger `
  -Settings $WAKE_Settings -Principal $WAKE_Principal | Out-Null
Write-Host "  등록 완료: $TASK_WAKE (평일 08:00 켜기)"

# 자동 끄기: 평일 21:00 (시간 변경 시 수정)
$TASK_SLEEP    = "InfoDisplay_Sleep_6F"
$SLEEP_Trigger = New-ScheduledTaskTrigger -Weekly `
                   -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At "09:00PM"
$SLEEP_Action  = New-ScheduledTaskAction -Execute "powershell.exe" `
                   -Argument "-NoProfile -WindowStyle Hidden -Command `"Add-Type -Assembly System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState('Sleep', `$false, `$false)`""
$SLEEP_Settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable $true
$SLEEP_Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Unregister-ScheduledTask -TaskName $TASK_SLEEP -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TASK_SLEEP -Action $SLEEP_Action -Trigger $SLEEP_Trigger `
  -Settings $SLEEP_Settings -Principal $SLEEP_Principal | Out-Null
Write-Host "  등록 완료: $TASK_SLEEP (평일 21:00 끄기)"

# ── 완료 ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== 6층 설정 완료 ===" -ForegroundColor Green
Write-Host "  모니터 끄기    : 30초 후 (절전/동면 정책 유지)"
Write-Host "  Wake Timer     : 활성화"
Write-Host "  OS 하트비트    : 시작 시 자동 실행, 60초마다"
Write-Host "  자동 켜기      : 평일 08:00"
Write-Host "  자동 끄기      : 평일 21:00"
Write-Host ""
Write-Host "시작 시간 변경: Task Scheduler → InfoDisplay_Wake_6F / InfoDisplay_Sleep_6F"
