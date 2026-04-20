$f = Get-Content "c:\Users\ADMIN\OneDrive\Desktop\quan_ly\mini-app\index.html" -Raw
$f = $f.Replace("core.js?v=2026042003", "core.js?v=2026042004")
$f = $f.Replace("dashboard.js?v=2026041307", "dashboard.js?v=2026042004")
$f = $f.Replace("notification.js?v=2026042003", "notification.js?v=2026042004")
$f = $f.Replace("styles.css?v=2026041802", "styles.css?v=2026042004")
Set-Content "c:\Users\ADMIN\OneDrive\Desktop\quan_ly\mini-app\index.html" $f -NoNewline
Write-Output "Cache versions bumped"
