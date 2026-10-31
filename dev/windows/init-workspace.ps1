<#
=============================================================================
 @file init-workspace.ps1
 @path dev/windows/init-workspace.ps1
 @project RPSW Web
 @author RPSW
 @created 2026-10-31
 @description WINDOWS entry point of the workspace setup - start it with init-workspace.cmd
   (double-click or `.\init-workspace.cmd`). The application runs in Docker on Linux, so on
   Windows it uses WSL 2 + Docker Desktop (the setup Docker recommends for Windows):
     1. WSL 2 with a Linux distribution (offers `wsl --install -d Ubuntu`, then a restart)
     2. Docker Desktop installed (offers `winget install Docker.DockerDesktop`) and running,
        with its WSL integration
     3. the project INSIDE WSL: a checkout on a Windows drive (C:\...) is cloned into the Linux
        home (~/<folder>) - Docker on C:\ is very slow and `ng serve` does not see changes
        there (-InPlace keeps it where it is)
     4. runs ./init-workspace.sh inside WSL - the same setup as on Linux / macOS
   Afterwards: dev.cmd (or ./dev.sh in the Linux terminal) starts the application.
 @refactor-note (2026-10-31) Moved to dev/windows/ (root clean-up); the marker file is
   dev/wsl-workspace (read by dev.cmd).
 @note Only ASCII characters in this file: Windows PowerShell 5.1 reads a script without BOM in
   the ANSI code page.
 @note Output of wsl.exe itself is UTF-16; the script uses only its exit codes and the UTF-8
   output of Linux commands (WSL_UTF8=1 is set as well).
 @security Administrator rights only for `wsl --install` (UAC prompt, asked first). Nothing is
   downloaded by the script itself - WSL and Docker Desktop come from Microsoft / winget.
 @usage
   init-workspace.cmd              full setup (asks before every installation)
   init-workspace.cmd -InPlace     keep the project on the Windows drive (slow, not recommended)
=============================================================================
#>
[CmdletBinding()]
param(
    [switch]$InPlace,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
$env:WSL_UTF8 = '1'

# Repository root = two levels above dev/windows/.
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Folder = Split-Path -Leaf $Root
$Marker = Join-Path $Root 'dev\wsl-workspace'
$DockerExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'

# -----------------------------------------------------------------------------
# Output helpers
# -----------------------------------------------------------------------------
function Write-Step([string]$Text) { Write-Host ''; Write-Host "[Windows] $Text" -ForegroundColor Cyan }
function Write-Ok([string]$Text)   { Write-Host "   OK  $Text" -ForegroundColor Green }
function Write-Info([string]$Text) { Write-Host "   -   $Text" }
function Write-Warn([string]$Text) { Write-Host "   !   $Text" -ForegroundColor Yellow }
function Stop-Setup([string]$Text) { Write-Host ''; Write-Host "ERROR: $Text" -ForegroundColor Red; exit 1 }

# @description Yes / no question; Enter = the default.
function Confirm-Choice([string]$Question, [bool]$DefaultYes) {
    $suffix = '[y/N]'
    if ($DefaultYes) { $suffix = '[Y/n]' }
    $answer = Read-Host "   $Question $suffix"
    if ([string]::IsNullOrWhiteSpace($answer)) { return $DefaultYes }
    return ($answer.Trim() -match '^(y|yes|a|ano)$')
}

# @description Runs a program, returns exit code + output (stderr dropped). Windows PowerShell 5.1
# would turn stderr of a native program into a terminating error under 'Stop'.
function Invoke-Native([string]$Exe, [string[]]$Arguments) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $Exe @Arguments 2>$null
        $text = (@($output) -join "`n") -replace "`0", ''
        return [pscustomobject]@{ Code = $LASTEXITCODE; Out = $text.Trim() }
    } finally {
        $ErrorActionPreference = $previous
    }
}

# @description Runs a shell command in the default WSL distribution.
function Invoke-Wsl([string]$Command) { return Invoke-Native 'wsl.exe' @('-e', 'sh', '-c', $Command) }

# -----------------------------------------------------------------------------
# 1. WSL 2
# -----------------------------------------------------------------------------
function Initialize-Wsl {
    Write-Step 'WSL 2 (Linux inside Windows)'
    if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
        Stop-Setup 'WSL is not available - Windows 10 2004+ or Windows 11 is needed.'
    }
    $probe = Invoke-Wsl 'echo ready'
    if ($probe.Code -ne 0 -or $probe.Out -ne 'ready') {
        Write-Info 'WSL 2 with a Linux distribution is not installed yet.'
        if (-not (Confirm-Choice 'Install WSL 2 with Ubuntu now (wsl --install -d Ubuntu, administrator rights)?' $true)) {
            Stop-Setup 'WSL 2 is required - install it (wsl --install -d Ubuntu), then run init-workspace.cmd again.'
        }
        Start-Process -FilePath 'wsl.exe' -ArgumentList '--install', '-d', 'Ubuntu' -Verb RunAs -Wait
        Write-Host ''
        Write-Warn 'WSL is being installed. Next:'
        Write-Info '1) restart Windows'
        Write-Info '2) open "Ubuntu" from the Start menu once and create your Linux user'
        Write-Info '3) run init-workspace.cmd again'
        exit 0
    }
    $kernel = Invoke-Native 'wsl.exe' @('-e', 'uname', '-r')
    if ($kernel.Out -notmatch 'WSL2') {
        Stop-Setup 'the default WSL distribution runs WSL 1 - convert it: wsl --set-version <distribution> 2 (list: wsl -l -v), then run init-workspace.cmd again.'
    }
    $script:Distro = (Invoke-Wsl 'printf %s "$WSL_DISTRO_NAME"').Out
    $script:LinuxHome = (Invoke-Wsl 'printf %s "$HOME"').Out
    if (-not (Invoke-Wsl 'command -v git >/dev/null && echo yes').Out) {
        Stop-Setup "git is missing in WSL ($script:Distro) - open the Linux terminal and run: sudo apt install git (or the package manager of your distribution)."
    }
    Write-Ok "WSL 2 - $script:Distro"
}

# -----------------------------------------------------------------------------
# 2. Docker Desktop (installed, running, WSL integration)
# -----------------------------------------------------------------------------
function Test-WslDocker { return ((Invoke-Wsl 'docker info >/dev/null 2>&1 && echo yes').Out -eq 'yes') }

function Initialize-DockerDesktop {
    Write-Step 'Docker Desktop'
    if (-not (Test-Path $DockerExe)) {
        if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
            Stop-Setup 'Docker Desktop is not installed - install it (https://docs.docker.com/desktop/setup/install/windows-install/), start it once, then run init-workspace.cmd again.'
        }
        if (-not (Confirm-Choice 'Docker Desktop is not installed. Install it now (winget install Docker.DockerDesktop)?' $true)) {
            Stop-Setup 'Docker Desktop is required - install it, start it once, then run init-workspace.cmd again.'
        }
        & winget.exe install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) { Stop-Setup 'winget could not install Docker Desktop - install it from https://docs.docker.com/desktop/setup/install/windows-install/' }
        Write-Host ''
        Write-Warn 'Docker Desktop is installed. Next:'
        Write-Info '1) log out of Windows and in again (or restart)'
        Write-Info '2) start Docker Desktop once and accept its terms (the WSL 2 backend is the default)'
        Write-Info '3) run init-workspace.cmd again'
        exit 0
    }
    if (-not (Test-WslDocker)) {
        Write-Info 'starting Docker Desktop and waiting for it (up to 3 minutes)'
        Start-Process -FilePath $DockerExe | Out-Null
        $deadline = (Get-Date).AddMinutes(3)
        while (-not (Test-WslDocker) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 3 }
    }
    if (-not (Test-WslDocker)) {
        Stop-Setup ("Docker does not answer inside WSL. In Docker Desktop: wait until it is running, then " +
            "Settings > Resources > WSL integration > enable it for '$script:Distro' > Apply & restart. Then run init-workspace.cmd again.")
    }
    Write-Ok 'Docker Desktop is running and available in WSL'
}

# -----------------------------------------------------------------------------
# 3. Project location inside WSL
# -----------------------------------------------------------------------------
# @description The project path inside WSL: \\wsl$ / \\wsl.localhost path, the project copied
# into WSL (recommended), or the Windows drive itself (-InPlace).
function Resolve-LinuxPath {
    Write-Step 'Project location'
    if ($Root -match '^\\\\wsl(\.localhost|\$)\\([^\\]+)(\\.*)$') {
        $script:Distro = $Matches[2]
        $script:LinuxPath = $Matches[3] -replace '\\', '/'
        Write-Ok "the project is inside WSL already: $script:LinuxPath ($script:Distro)"
        return
    }
    $source = (Invoke-Native 'wsl.exe' @('-e', 'wslpath', '-a', $Root)).Out
    if (-not $source) { Stop-Setup "cannot translate $Root to a WSL path" }

    if ($InPlace) {
        Write-Warn "the project stays on the Windows drive ($Root) - Docker is slow there and ng serve does not see changes"
        $script:LinuxPath = $source
        return
    }

    $target = "$script:LinuxHome/$Folder"
    Write-Info 'Docker runs much faster (and ng serve notices your changes) when the project lives inside WSL.'
    if (-not (Confirm-Choice "Clone the project into WSL ($target)? (recommended)" $true)) {
        Write-Warn 'the project stays on the Windows drive (slow) - you can run init-workspace.cmd again later'
        $script:LinuxPath = $source
        return
    }

    if ((Invoke-Wsl "test -d '$target/.git' && echo yes").Out -eq 'yes') {
        Write-Ok "using the existing clone $target"
    } else {
        if ((Invoke-Wsl "test -e '$target' && echo yes").Out -eq 'yes') {
            Stop-Setup "$target exists in WSL and is not a git repository - move it away, then run init-workspace.cmd again."
        }
        if (Get-Command git.exe -ErrorAction SilentlyContinue) {
            $dirty = (Invoke-Native 'git.exe' @('-C', $Root, 'status', '--porcelain')).Out
            if ($dirty) {
                Write-Warn 'this checkout has uncommitted changes - they are NOT copied (only commits are).'
                if (-not (Confirm-Choice 'Continue anyway?' $false)) { Stop-Setup 'commit or stash the changes first, then run init-workspace.cmd again.' }
            }
        }
        & wsl.exe -e git -c 'safe.directory=*' clone $source $target
        if ($LASTEXITCODE -ne 0) { Stop-Setup "git clone into $target failed - see the output above." }
        # The clone points to the Windows folder - give it the real remote of this checkout.
        if (Get-Command git.exe -ErrorAction SilentlyContinue) {
            $origin = (Invoke-Native 'git.exe' @('-C', $Root, 'remote', 'get-url', 'origin')).Out
            if ($origin) {
                & wsl.exe -e git -C $target remote set-url origin $origin
                Write-Info "remote origin: $origin"
            }
        }
        Write-Ok "project cloned into WSL: $target"
    }
    $script:LinuxPath = $target
    Set-Content -Path $Marker -Encoding Ascii -Value @("distro=$script:Distro", "path=$target")
    Write-Info "dev.cmd in this folder now starts the WSL copy ($target)"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
Write-Host '------------------------------------------'
Write-Host "Workspace setup (Windows / WSL 2) - $Folder"
Write-Host '------------------------------------------'
$script:Distro = ''
$script:LinuxHome = ''
$script:LinuxPath = ''

Initialize-Wsl
Initialize-DockerDesktop
Resolve-LinuxPath

Write-Step "running ./init-workspace.sh inside WSL ($($script:Distro): $($script:LinuxPath))"
$wslArgs = @('-d', $script:Distro, '--cd', $script:LinuxPath, '-e', 'bash', './init-workspace.sh')
if ($Rest) { $wslArgs += $Rest }
& wsl.exe @wslArgs
$code = $LASTEXITCODE

Write-Host ''
Write-Host 'WINDOWS - HOW TO WORK WITH THE PROJECT'
Write-Info "files:  \\wsl.localhost\$script:Distro$($script:LinuxPath -replace '/', '\')"
Write-Info "editor: VS Code with the WSL extension - code --remote wsl+$script:Distro $script:LinuxPath"
Write-Info 'start:  dev.cmd (this folder) or ./dev.sh in the Linux terminal of the project'
if ($code -eq 0 -and (Get-Command code -ErrorAction SilentlyContinue)) {
    if (Confirm-Choice 'Open the project in VS Code now?' $true) {
        & code --remote "wsl+$script:Distro" $script:LinuxPath
    }
}
exit $code
