$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$appUrl = 'http://127.0.0.1:17863'
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$nodeExe = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodeExe)) { throw '找不到 Node.js。请安装 Node.js 24 LTS。' }
$major = [int]((& $nodeExe --version).TrimStart('v').Split('.')[0])
if ($major -lt 24) { throw '本程序需要 Node.js 24 或更高版本。' }
$running = $false
try { $health = Invoke-RestMethod "$appUrl/health" -TimeoutSec 2; $running = $health.app -eq 'igxe-personal-rental-manager' } catch {}
if (-not $running) {
    $dataPath = Join-Path $projectRoot 'data'
    New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
    $serverScript = Join-Path $projectRoot 'src\server.mjs'
    Start-Process -FilePath $nodeExe -ArgumentList @('"' + $serverScript + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dataPath 'server.log') -RedirectStandardError (Join-Path $dataPath 'server-error.log') | Out-Null
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 300
        try { $health = Invoke-RestMethod "$appUrl/health" -TimeoutSec 1; if ($health.app -eq 'igxe-personal-rental-manager') { $running = $true; break } } catch {}
    }
    if (-not $running) { throw '启动失败。请查看项目 data\server-error.log。' }
}
$edgeCandidates = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")
$edgeExe = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if ($edgeExe) { Start-Process -FilePath $edgeExe -ArgumentList @("--app=$appUrl", '--window-size=1360,920') }
else { Start-Process $appUrl }
