# scripts/check_actions.ps1
# Script to check the status of recent GitHub Actions runs and print diagnostic errors

Write-Host "Checking recent GitHub Actions runs..." -ForegroundColor Cyan

$repo = "ngokhaihoang1999/quanly"
$url = "https://api.github.com/repos/$repo/actions/runs?per_page=5"

try {
    $response = curl.exe -s -L $url
    $data = $response | ConvertFrom-Json
    $runs = $data.workflow_runs
    
    if (-not $runs) {
        Write-Host "No workflow runs found." -ForegroundColor Yellow
        exit
    }
    
    foreach ($run in $runs) {
        $id = $run.id
        $name = $run.name
        $num = $run.run_number
        $status = $run.status
        $conclusion = $run.conclusion
        $sha = $run.head_sha
        
        Write-Host "----------------------------------------"
        Write-Host "Run #$($num): $name" -ForegroundColor White
        Write-Host "  Status: $status, Conclusion: $conclusion"
        
        if ($status -eq "completed") {
            if ($conclusion -eq "success") {
                Write-Host "  Conclusion: Success" -ForegroundColor Green
            } else {
                Write-Host "  Conclusion: Failure" -ForegroundColor Red
                
                # Fetch detailed annotations from check-runs
                $checkUrl = "https://api.github.com/repos/$repo/commits/$sha/check-runs"
                $checkRes = curl.exe -s -L $checkUrl | ConvertFrom-Json
                $checkRuns = $checkRes.check_runs
                
                foreach ($cr in $checkRuns) {
                    if ($cr.conclusion -eq "failure") {
                        Write-Host "  > Job failed: $($cr.name)" -ForegroundColor Yellow
                        $annUrl = $cr.output.annotations_url
                        if ($annUrl) {
                            $annotations = curl.exe -s -L $annUrl | ConvertFrom-Json
                            foreach ($ann in $annotations) {
                                Write-Host "    [Error] $($ann.message)" -ForegroundColor DarkRed
                            }
                        }
                    }
                }
            }
        } else {
            Write-Host "  Conclusion: In Progress" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "Error fetching action status: $_" -ForegroundColor Red
}
