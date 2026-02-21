Start-Sleep -Seconds 1
$result = @()
try {
    $tcp9001 = Test-NetConnection -ComputerName localhost -Port 9001 -WarningAction SilentlyContinue
    $result += "Port 9001 (backend): $($tcp9001.TcpTestSucceeded)"
} catch { $result += "Port 9001: ERROR $_" }
try {
    $tcp5173 = Test-NetConnection -ComputerName localhost -Port 5173 -WarningAction SilentlyContinue
    $result += "Port 5173 (frontend): $($tcp5173.TcpTestSucceeded)"
} catch { $result += "Port 5173: ERROR $_" }
try {
    $r = Invoke-WebRequest -Uri "http://localhost:5173/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"proxytest","password":"proxytest"}' -UseBasicParsing -ErrorAction Stop
    $result += "Proxy test: OK $($r.StatusCode) $($r.Content)"
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    $detail = $_.ErrorDetails.Message
    if ($status) {
        $result += "Proxy test: HTTP $status - $detail"
    } else {
        $result += "Proxy test: FAIL $($_.Exception.Message)"
    }
}
$result | Out-File -FilePath "c:\Users\user\Desktop\BackendSigurChat\webrtc-chat-backend\test-result.txt" -Encoding utf8
