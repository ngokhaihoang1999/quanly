$f = Get-Content "c:\Users\ADMIN\OneDrive\Desktop\quan_ly\mini-app\styles.css" -Raw
$skeleton = @"
    /* Skeleton Loading */
    @keyframes skeleton-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    .skeleton { background: linear-gradient(90deg, var(--surface2) 25%, var(--border) 50%, var(--surface2) 75%); background-size: 200% 100%; animation: skeleton-shimmer 1.5s ease-in-out infinite; border-radius: var(--radius-sm); color: transparent !important; pointer-events: none; user-select: none; }
    .skeleton * { visibility: hidden; }
    .skeleton-line { height: 14px; margin: 6px 0; border-radius: 6px; }
    .skeleton-circle { border-radius: 50%; }
    .skeleton-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 10px; }
    .skeleton-card .skeleton-line:first-child { width: 60%; height: 18px; }
    .skeleton-card .skeleton-line:nth-child(2) { width: 85%; }
    .skeleton-card .skeleton-line:nth-child(3) { width: 40%; }
    /* Offline Banner */
    .offline-banner { position: fixed; top: 0; left: 0; right: 0; z-index: 99999; background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; text-align: center; padding: 6px 12px; font-size: 12px; font-weight: 600; transform: translateY(-100%); transition: transform 0.3s ease; }
    .offline-banner.show { transform: translateY(0); }
"@
$target = "    * { box-sizing"
$f = $f.Replace($target, $skeleton + "`r`n" + $target)
Set-Content "c:\Users\ADMIN\OneDrive\Desktop\quan_ly\mini-app\styles.css" $f -NoNewline
Write-Output "Skeleton CSS inserted OK"
