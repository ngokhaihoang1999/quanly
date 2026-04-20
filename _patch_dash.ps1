$f = Get-Content "c:\Users\ADMIN\OneDrive\Desktop\quan_ly\mini-app\dashboard.js" -Raw
$old = "  // Show a mini loading state`r`n  listEl.innerHTML = '<div style=""text-align:center;padding:12px;color:var(--text3);font-size:13px;"">&#272;ang t&#7843;i...</div>';"
$new = "  // Show skeleton loading state`r`n  if (typeof showSkeleton === 'function') showSkeleton(listEl, 2);`r`n  else listEl.innerHTML = '<div style=""text-align:center;padding:12px;color:var(--text3);font-size:13px;"">&#272;ang t&#7843;i...</div>';"
if ($f.Contains("Show a mini loading")) {
  $f = $f.Replace("// Show a mini loading state", "// Show skeleton loading state")
  $f = $f.Replace("  listEl.innerHTML = '<div style=", "  if (typeof showSkeleton === 'function') showSkeleton(listEl, 2);`r`n  else listEl.innerHTML = '<div style=")
  Set-Content "c:\Users\ADMIN\OneDrive\Desktop\quan_ly\mini-app\dashboard.js" $f -NoNewline
  Write-Output "Dashboard skeleton patched"
} else {
  Write-Output "Target not found - skipping"
}
