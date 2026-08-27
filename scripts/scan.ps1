# Launcher Deck app scanner - ASCII-only script body (PS5.1 BOM-less UTF-8 pitfall)
# Outputs JSON to -OutFile (UTF-8 no BOM) for the Electron main process.
# Fields per app: name pub ver date exe icon cat-hints + launch info:
#   src=registry -> exe path (launch via cmd start)
#   src=appx     -> uwpId = PackageFamilyName!ApplicationId (launch via shell:AppsFolder)

param(
    [string]$OutFile = ""
)

$ErrorActionPreference = "Continue"
Add-Type -AssemblyName System.Drawing

if (-not $OutFile) {
    # default: %APPDATA%\launcher-deck\apps.json
    $dir = Join-Path $env:APPDATA "launcher-deck"
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $OutFile = Join-Path $dir "apps.json"
}

function IconToDataUri([System.Drawing.Icon]$icon) {
    if (-not $icon) { return $null }
    try {
        $bmp = $icon.ToBitmap()
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        $bytes = $ms.ToArray()
        $ms.Dispose()
        return "data:image/png;base64," + [Convert]::ToBase64String($bytes)
    } catch { return $null }
}

function Get-ExeIcon([string]$exePath) {
    if (-not $exePath -or -not (Test-Path $exePath)) { return $null }
    try {
        $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exePath)
        if ($icon) {
            $uri = IconToDataUri $icon
            $icon.Dispose()
            return $uri
        }
    } catch {}
    return $null
}

function Resolve-DisplayIcon([string]$displayIcon, [string]$installLocation) {
    $cand = $null
    if ($displayIcon) {
        $s = [Environment]::ExpandEnvironmentVariables($displayIcon)
        $comma = $s.LastIndexOf(",")
        if ($comma -gt 3) { $s = $s.Substring(0, $comma) }
        $s = $s.Trim('"')
        if ($s -and (Test-Path $s)) { $cand = $s }
    }
    if (-not $cand -and $installLocation -and (Test-Path $installLocation)) {
        try {
            $first = Get-ChildItem -Path $installLocation -Filter *.exe -File -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($first) { $cand = $first.FullName }
        } catch {}
    }
    return $cand
}

function IconFromFile([string]$path) {
    if (-not $path) { return $null }
    $ext = [System.IO.Path]::GetExtension($path).ToLower()
    if ($ext -eq ".exe" -or $ext -eq ".dll") { return Get-ExeIcon $path }
    if ($ext -eq ".ico") {
        try {
            $icon = New-Object System.Drawing.Icon($path)
            $uri = IconToDataUri $icon
            $icon.Dispose()
            return $uri
        } catch { return $null }
    }
    if ($ext -eq ".png" -or $ext -eq ".jpg" -or $ext -eq ".bmp") {
        try {
            $bytes = [System.IO.File]::ReadAllBytes($path)
            return "data:image/png;base64," + [Convert]::ToBase64String($bytes)
        } catch { return $null }
    }
    return $null
}

# ---------- launch target resolution (exe for launching, icon path only for icons) ----------
# Start-menu pre-index: one recursive pass + one COM parse per lnk
# (per-app recursive lookup degrades scan from seconds to minutes)
$script:LnkIndex = $null
function Build-LnkIndex() {
    $dirs = @(
        (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"),
        (Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs")
    )
    $map = @{}
    try { $ws = New-Object -ComObject WScript.Shell } catch { return $map }
    foreach ($d in $dirs) {
        if (-not (Test-Path $d)) { continue }
        Get-ChildItem -Path $d -Filter *.lnk -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                $t = $ws.CreateShortcut($_.FullName).TargetPath
                if ($t -and $t -like '*.exe' -and (Test-Path $t)) {
                    if (-not $map.ContainsKey($_.BaseName)) { $map[$_.BaseName] = $t }
                }
            } catch {}
        }
    }
    return $map
}
function Resolve-FromStartMenu([string]$name) {
    if (-not $script:LnkIndex) { $script:LnkIndex = Build-LnkIndex }
    if ($script:LnkIndex.ContainsKey($name)) { return $script:LnkIndex[$name] }
    $clean = ($name -replace '[0-9.]+$','').Trim()
    if ($script:LnkIndex.ContainsKey($clean)) { return $script:LnkIndex[$clean] }
    foreach ($k in $script:LnkIndex.Keys) {
        if ($k -like "$name*" -or $k -like "$clean*") { return $script:LnkIndex[$k] }
    }
    return $null
}

# exes that must never become the launch target (uninstallers/updaters/installers/helpers/background parts)
$badTarget = 'unins|uninstall|update[r]?\.exe$|setup\.exe$|help\.exe$|_server\.exe$|_service\.exe$|_renderer\.exe$|installer\.exe$|crashpad|elevation|python-.*-amd64\.exe$'

function Resolve-LaunchTarget($it, [string]$iconPath) {
    # 1) DisplayIcon itself is an exe
    if ($iconPath -and $iconPath -like '*.exe' -and $iconPath -notmatch $badTarget) { return $iconPath }
    # 2) Start-menu shortcut FIRST (exact beats prefix) - closest to user double-click
    #    (but vendor shortcuts sometimes point to updaters - filter those, fall through)
    $sm = Resolve-FromStartMenu ([string]$it.DisplayName)
    if ($sm -and $sm -notmatch $badTarget) { return $sm }
    # 3) InstallLocation: exe named like DisplayName, else biggest clean exe (>200KB)
    if ($it.InstallLocation -and (Test-Path $it.InstallLocation)) {
        try {
            $n = [System.IO.Path]::GetFileNameWithoutExtension([string]$it.DisplayName)
            $same = Get-ChildItem -Path $it.InstallLocation -Filter "$n.exe" -File -Recurse -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -notmatch $badTarget } | Select-Object -First 1
            if ($same) { return $same.FullName }
            $big = Get-ChildItem -Path $it.InstallLocation -Filter *.exe -File -Recurse -ErrorAction SilentlyContinue |
                Where-Object { $_.Length -gt 200KB -and $_.Name -notmatch $badTarget } |
                Sort-Object Length -Descending | Select-Object -First 1
            if ($big) { return $big.FullName }
        } catch {}
    }
    # 4) biggest clean exe in UninstallString dir
    try {
        $u = ([string]$it.UninstallString).Trim('"')
        if ($u -match '^([^,]+\.exe)') {
            $dir = Split-Path $Matches[1]
            if ($dir -and (Test-Path $dir)) {
                $big2 = Get-ChildItem -Path $dir -Filter *.exe -File -ErrorAction SilentlyContinue |
                    Where-Object { $_.Length -gt 200KB -and $_.Name -notmatch $badTarget } |
                    Sort-Object Length -Descending | Select-Object -First 1
                if ($big2) { return $big2.FullName }
            }
        }
    } catch {}
    return ""
}

$paths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
)

$noise = "Redistributable|Update for|Hotfix|^(KB\d|Windows Driver)|Driver Update|Intel\(R\) (Graphics|Audio)|NVIDIA (Graphics|PhysX|Display)|AMD Chipset|Realtek.*Audio|Microsoftedge.*Core|WebView2 Runtime|Microsoft Edge Update|Microsoft Edge Webview|HP Update$|HP LaserJet|^HPLJPro|Microsoft Build of OpenJDK"

$apps = New-Object System.Collections.Generic.List[object]
$seen = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)

foreach ($p in $paths) {
    $items = Get-ItemProperty -Path $p -ErrorAction SilentlyContinue
    foreach ($it in $items) {
        $name = $it.DisplayName
        if (-not $name) { continue }
        if ($it.SystemComponent -eq 1) { continue }
        if ($it.WindowsInstaller -eq 1 -and -not $it.DisplayIcon -and -not $it.InstallLocation) {
            # MSI 三无多为运行库噪音——但开始菜单有快捷方式的是正经应用（RealVNC Viewer 实测被此规则误杀）
            if (-not (Resolve-FromStartMenu $name)) { continue }
        }
        if ($name -match $noise) { continue }
        if (-not $seen.Add($name)) { continue }

        $iconPath = Resolve-DisplayIcon $it.DisplayIcon $it.InstallLocation
        $icon = IconFromFile $iconPath
        if (-not $icon -and $it.UninstallString) {
            try {
                $u = $it.UninstallString.Trim('"')
                if ($u -match '^([^,]+\.exe)') {
                    $dir = Split-Path $Matches[1]
                    if ($dir -and (Test-Path $dir)) {
                        $first = Get-ChildItem -Path $dir -Filter *.exe -File -ErrorAction SilentlyContinue | Select-Object -First 1
                        if ($first) { $icon = Get-ExeIcon $first.FullName }
                    }
                }
            } catch {}
        }

        $date = ""
        if ($it.InstallDate) {
            try {
                if ($it.InstallDate -match '^\d{8}$') {
                    $date = $it.InstallDate.Substring(0,4) + "-" + $it.InstallDate.Substring(4,2) + "-" + $it.InstallDate.Substring(6,2)
                } else { $date = [string]$it.InstallDate }
            } catch {}
        }

        $exeTarget = Resolve-LaunchTarget $it $iconPath   # real launch target, separate from icon path
        if (-not $exeTarget) { continue }   # 四级链都解析不到启动目标：死牌不入阵（SangforVNC 类组件，留着点不开）
        if (-not $icon) { try { $icon = Get-ExeIcon $exeTarget } catch {} }
        # 图标兜底：直接从启动目标 exe 提（MSI 三无救援牌实测缺图标）

        $apps.Add([PSCustomObject]@{
            name = $name
            pub  = [string]$it.Publisher
            ver  = [string]$it.DisplayVersion
            date = $date
            exe  = $exeTarget
            icon = $icon
            src  = "registry"
            uwp  = ""
        })
    }
}

# ---------- UWP with launch id (PackageFamilyName!AppId) ----------
try {
    $pkgs = Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object {
        $_.IsFramework -eq $false -and $_.NonRemovable -eq $false -and $_.IsResourcePackage -eq $false
    }
    foreach ($pkg in $pkgs) {
        $name = $pkg.Name
        if (-not $name) { continue }
        if (-not $seen.Add("appx:" + $name)) { continue }
        $icon = $null
        $appId = ""
        try {
            $manifest = Join-Path $pkg.InstallLocation "AppxManifest.xml"
            if (Test-Path $manifest) {
                [xml]$xml = Get-Content $manifest -Encoding UTF8
                $appNode = $xml.Package.Applications.Application | Select-Object -First 1
                if ($appNode -and $appNode.Id) { $appId = [string]$appNode.Id }
                $logo = $xml.Package.Properties.Logo
                if (-not $logo -and $appNode) { $logo = $appNode.VisualElements.Square44x44Logo }
                if ($logo) {
                    $base = [System.IO.Path]::GetDirectoryName($logo)
                    $file = [System.IO.Path]::GetFileNameWithoutExtension($logo)
                    $dir = Join-Path $pkg.InstallLocation $base
                    $cands = @(
                        (Join-Path $dir ($file + ".targetsize-256.png")),
                        (Join-Path $dir ($file + ".targetsize-96.png")),
                        (Join-Path $dir ($file + ".scale-200.png")),
                        (Join-Path $dir ($file + ".png"))
                    )
                    foreach ($c in $cands) {
                        if (Test-Path $c) {
                            $bytes = [System.IO.File]::ReadAllBytes($c)
                            $icon = "data:image/png;base64," + [Convert]::ToBase64String($bytes)
                            break
                        }
                    }
                }
            }
        } catch {}

        $disp = $name
        $parts = $name -split "\."
        if ($parts.Count -gt 2) { $disp = $parts[-1] }

        $apps.Add([PSCustomObject]@{
            name = $disp
            pub  = ""
            ver  = [string]$pkg.Version
            date = ""
            exe  = ""
            icon = $icon
            src  = "appx"
            uwp  = ($pkg.PackageFamilyName + "!" + $appId)
        })
    }
} catch { Write-Host "appx scan skipped: $_" }

$out = [ordered]@{
    generated = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    count     = $apps.Count
    apps      = $apps
}

$dir2 = Split-Path $OutFile
if ($dir2 -and -not (Test-Path $dir2)) { New-Item -ItemType Directory -Path $dir2 -Force | Out-Null }

$json = $out | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($OutFile, $json, (New-Object System.Text.UTF8Encoding($false)))

$withIcon = ($apps | Where-Object { $_.icon }).Count
Write-Host ("apps: " + $apps.Count + " with icon: " + $withIcon)
Write-Host ("saved: " + $OutFile)
