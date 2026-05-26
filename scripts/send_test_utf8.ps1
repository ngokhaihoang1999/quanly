# scripts/send_test_utf8.ps1
# Script to send a test notification using UTF-8 encoding in Windows PowerShell

$apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtem9vbWVreXZsbHNncHBndnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyODg3MjcsImV4cCI6MjA4ODg2NDcyN30.TJ1BPyG8IlnxPSClIlJoOCpYUMhHHBmyL3cKFoXBJBY"
$url = "https://smzoomekyvllsgppgvxw.supabase.co/functions/v1/send-notification"

# Configure console output to UTF-8 to prevent console display corruption
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$bodyObj = @{
    staff_codes = @("000142-NKH")
    event_type = "new_btvn"
    title = "Bài tập về nhà mới"
    body = "[TEST] Học viên Nguyễn Tiến Nam vừa được giao bài tập về nhà mới: Đọc sách và làm bài tập tuần 5."
    profile_id = "bd88348a-9971-4e50-9d89-ddeeccb3e147"
}

# Convert body to JSON string
$bodyJson = $bodyObj | ConvertTo-Json -Compress

# Convert JSON string to raw UTF-8 bytes to ensure correct byte sending in Windows PowerShell 5.1
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyJson)

Write-Host "Sending UTF-8 payload..."

$headers = @{
    "apikey" = $apiKey
    "Authorization" = "Bearer $apiKey"
}

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $bodyBytes -ContentType "application/json; charset=utf-8"
    Write-Host "Response received:" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "Error occurred:" -ForegroundColor Red
    $_ | Format-List *
}
