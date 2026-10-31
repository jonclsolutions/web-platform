<#
=============================================================================
 @file dev.ps1
 @path dev/windows/dev.ps1
 @project RPSW Web
 @author RPSW
 @created 2026-10-31
 @description WINDOWS entry point of ./dev.sh - start it with dev.cmd (`.\dev.cmd`,
   `.\dev.cmd up -d`, `.\dev.cmd logs api`, ... - the same commands as ./dev.sh). Starts Docker
   Desktop when it does not run, then runs ./dev.sh inside WSL in the project folder:
   the WSL copy made by init-workspace.cmd (dev/wsl-workspace), a project opened from
   \\wsl.localhost\..., or this folder on the Windows drive.
 @refactor-note (2026-10-31) Moved to dev/windows/ (root clean-up); marker dev/wsl-workspace,
   the former .wsl-workspace in the root is still read.
 @note Only ASCII characters (Windows PowerShell 5.1 reads a script without BOM as ANSI).
 @usage
   dev.cmd                 start everything, follow the logs (Ctrl+C stops everything)
   dev.cmd help            every command of ./dev.sh
=============================================================================
#>
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
$env:WSL_UTF8 = '1'

# Repository root = two levels above dev/windows/.
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Marker = Join-Path $Root 'dev\wsl-workspace'
$OldMarker = Join-Path $Root '.wsl-workspace'
if (-not (Test-Path $Marker) -and (Test-Path $OldMarker)) { $Marker = $OldMarker }
$DockerExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'

function Stop-Dev([string]$Text) { Write-Host "[dev] ERROR: $Text" -ForegroundColor Red; exit 1 }

# @description Exit code + output of a program (stderr dropped - see init-workspace.ps1).
function Invoke-Native([string]$Exe, [string[]]$Arguments) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $Exe @Arguments 2>$null
        return [pscustomobject]@{ Code = $LASTEXITCODE; Out = ((@($output) -join "`n") -replace "`0", '').Trim() }
    } finally {
        $ErrorActionPreference = $previous
    }
}

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { Stop-Dev 'WSL is not installed - run init-workspace.cmd first.' }

# Where the project lives inside WSL.
$distro = ''
$path = ''
if (Test-Path $Marker) {
    foreach ($line in Get-Content $Marker) {
        if ($line -match '^distro=(.*)$') { $distro = $Matches[1] }
        if ($line -match '^path=(.*)$')   { $path = $Matches[1] }
    }
} elseif ($Root -match '^\\\\wsl(\.localhost|\$)\\([^\\]+)(\\.*)$') {
    $distro = $Matches[2]
    $path = $Matches[3] -replace '\\', '/'
} else {
    $path = (Invoke-Native 'wsl.exe' @('-e', 'wslpath', '-a', $Root)).Out
}
if (-not $path) { Stop-Dev 'cannot find the project inside WSL - run init-workspace.cmd first.' }

$base = @()
if ($distro) { $base = @('-d', $distro) }

# Docker Desktop must run (dev.sh inside WSL talks to it).
$probe = $base + @('-e', 'sh', '-c', 'docker info >/dev/null 2>&1 && echo yes')
if ((Invoke-Native 'wsl.exe' $probe).Out -ne 'yes') {
    if (-not (Test-Path $DockerExe)) { Stop-Dev 'Docker Desktop is not installed - run init-workspace.cmd first.' }
    Write-Host '[dev] starting Docker Desktop and waiting for it...'
    Start-Process -FilePath $DockerExe | Out-Null
    $deadline = (Get-Date).AddMinutes(3)
    while ((Invoke-Native 'wsl.exe' $probe).Out -ne 'yes' -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 3 }
    if ((Invoke-Native 'wsl.exe' $probe).Out -ne 'yes') {
        Stop-Dev 'Docker does not answer in WSL - check Docker Desktop (Settings > Resources > WSL integration).'
    }
}

$wslArgs = $base + @('--cd', $path, '-e', 'bash', './dev.sh') + @($args)
& wsl.exe @wslArgs
exit $LASTEXITCODE
