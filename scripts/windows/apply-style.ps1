<#
  Ulising Launcher - Windows style engine.
  Applies wallpaper, colors (dark mode, accent, transparency) and taskbar
  settings for the current user (HKCU only, no admin rights required).

  Usage: powershell -ExecutionPolicy Bypass -File apply-style.ps1 -ConfigPath job.json

  job.json:
    { "mode": "apply" | "backup" | "restore", ... }

  The last line written to stdout is always a JSON object: { ok, steps, error }.
  Keep this file ASCII-only (Windows PowerShell 5.1 reads BOM-less files as ANSI).
#>
param(
  [Parameter(Mandatory = $true)][string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$results = New-Object System.Collections.ArrayList
function Add-Result([string]$Step, [bool]$Ok, [string]$Message) {
  [void]$results.Add([ordered]@{ step = $Step; ok = $Ok; message = $Message })
}
function Invoke-Step([string]$Name, [scriptblock]$Action) {
  try { & $Action; Add-Result $Name $true '' }
  catch { Add-Result $Name $false $_.Exception.Message }
}
function Write-Final([bool]$Ok, [string]$ErrorText) {
  $failed = @($results | Where-Object { -not $_.ok }).Count
  $out = [ordered]@{ ok = ($Ok -and $failed -eq 0); partial = ($Ok -and $failed -gt 0); steps = $results; error = $ErrorText }
  Write-Output ($out | ConvertTo-Json -Depth 5 -Compress)
}

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class UlisingNative {
  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, string pvParam, uint fWinIni);

  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam,
    uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);

  public static void Broadcast(string area) {
    UIntPtr result;
    SendMessageTimeout(new IntPtr(0xffff), 0x001A, UIntPtr.Zero, area, 0x0002, 3000, out result);
  }
}
'@

$PersonalizeKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'
$DwmKey         = 'HKCU:\Software\Microsoft\Windows\DWM'
$AccentKey      = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Accent'
$AdvancedKey    = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'
$DesktopKey     = 'HKCU:\Control Panel\Desktop'
$StuckRectsKey  = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3'
$SearchKey      = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Search'

$IsWin11 = [Environment]::OSVersion.Version.Build -ge 22000

# Registry values saved by "backup" and written back by "restore".
$BackupItems = @(
  @($PersonalizeKey, 'AppsUseLightTheme', 'DWord'),
  @($PersonalizeKey, 'SystemUsesLightTheme', 'DWord'),
  @($PersonalizeKey, 'EnableTransparency', 'DWord'),
  @($PersonalizeKey, 'ColorPrevalence', 'DWord'),
  @($DwmKey, 'AccentColor', 'DWord'),
  @($DwmKey, 'ColorizationColor', 'DWord'),
  @($DwmKey, 'ColorizationAfterglow', 'DWord'),
  @($DwmKey, 'ColorPrevalence', 'DWord'),
  @($AccentKey, 'AccentPalette', 'Binary'),
  @($AccentKey, 'AccentColorMenu', 'DWord'),
  @($AccentKey, 'StartColorMenu', 'DWord'),
  @($DesktopKey, 'AutoColorization', 'DWord'),
  @($DesktopKey, 'WallpaperStyle', 'String'),
  @($DesktopKey, 'TileWallpaper', 'String'),
  @($DesktopKey, 'WallPaper', 'String'),
  @($AdvancedKey, 'TaskbarAl', 'DWord'),
  @($AdvancedKey, 'ShowTaskViewButton', 'DWord'),
  @($AdvancedKey, 'TaskbarDa', 'DWord'),
  @($SearchKey, 'SearchboxTaskbarMode', 'DWord'),
  @($StuckRectsKey, 'Settings', 'Binary')
)

# ---------- Helpers ----------
function Get-RegValue([string]$Path, [string]$Name) {
  try { return (Get-ItemProperty -LiteralPath $Path -Name $Name -ErrorAction Stop).$Name } catch { return $null }
}

function Set-RegValue([string]$Path, [string]$Name, $Value, [string]$Type) {
  if (-not (Test-Path -LiteralPath $Path)) { New-Item -Path $Path -Force | Out-Null }
  New-ItemProperty -LiteralPath $Path -Name $Name -Value $Value -PropertyType $Type -Force | Out-Null
}

function Remove-RegValue([string]$Path, [string]$Name) {
  if (Test-Path -LiteralPath $Path) { Remove-ItemProperty -LiteralPath $Path -Name $Name -ErrorAction SilentlyContinue }
}

function ConvertFrom-HexColor([string]$Hex) {
  $h = $Hex.Trim().TrimStart('#')
  if ($h.Length -eq 3) { $h = ($h.ToCharArray() | ForEach-Object { "$_$_" }) -join '' }
  if ($h -notmatch '^[0-9a-fA-F]{6}$') { throw "Invalid color: $Hex" }
  return @([Convert]::ToByte($h.Substring(0, 2), 16), [Convert]::ToByte($h.Substring(2, 2), 16), [Convert]::ToByte($h.Substring(4, 2), 16))
}

# Factor > 0 lightens toward white, < 0 darkens toward black.
function Get-Shade([byte[]]$Rgb, [double]$Factor) {
  $out = New-Object byte[] 3
  for ($i = 0; $i -lt 3; $i++) {
    $c = [double]$Rgb[$i]
    if ($Factor -ge 0) { $v = $c + (255 - $c) * $Factor } else { $v = $c * (1 + $Factor) }
    $out[$i] = [byte][Math]::Max(0, [Math]::Min(255, [Math]::Round($v)))
  }
  return ,$out
}

# 0xAABBGGRR packed into a signed Int32 (what REG_DWORD expects from PowerShell).
function Get-Abgr([byte[]]$Rgb, [byte]$Alpha = 255) {
  return [BitConverter]::ToInt32([byte[]]@($Rgb[0], $Rgb[1], $Rgb[2], $Alpha), 0)
}
# 0xAARRGGBB packed into a signed Int32.
function Get-Argb([byte[]]$Rgb, [byte]$Alpha = 255) {
  return [BitConverter]::ToInt32([byte[]]@($Rgb[2], $Rgb[1], $Rgb[0], $Alpha), 0)
}

function Set-Wallpaper([string]$Path, [string]$Style) {
  if (-not (Test-Path -LiteralPath $Path)) { throw "Wallpaper file not found: $Path" }
  $map = @{ fill = @('10', '0'); fit = @('6', '0'); stretch = @('2', '0'); center = @('0', '0'); tile = @('0', '1'); span = @('22', '0') }
  if (-not $map.ContainsKey($Style)) { $Style = 'fill' }
  Set-ItemProperty -LiteralPath $DesktopKey -Name WallpaperStyle -Value $map[$Style][0]
  Set-ItemProperty -LiteralPath $DesktopKey -Name TileWallpaper -Value $map[$Style][1]
  # SPI_SETDESKWALLPAPER = 0x14, SPIF_UPDATEINIFILE | SPIF_SENDCHANGE = 3
  $ok = [UlisingNative]::SystemParametersInfo(0x0014, 0, $Path, 0x03)
  if (-not $ok) { throw ("SystemParametersInfo failed (Win32 error {0})" -f [Runtime.InteropServices.Marshal]::GetLastWin32Error()) }
}

function Set-AccentColor([string]$Hex) {
  $rgb = ConvertFrom-HexColor $Hex
  # Stop Windows from picking the accent automatically from the wallpaper.
  Set-RegValue $DesktopKey 'AutoColorization' 0 'DWord'

  $factors = @(0.62, 0.42, 0.22, 0.0, -0.22, -0.42, -0.62, -0.80)
  $palette = New-Object System.Collections.Generic.List[byte]
  foreach ($f in $factors) {
    $s = Get-Shade $rgb $f
    $palette.Add($s[0]); $palette.Add($s[1]); $palette.Add($s[2]); $palette.Add(0)
  }
  $dark1 = Get-Shade $rgb (-0.22)
  $dark2 = Get-Shade $rgb (-0.42)

  Set-RegValue $AccentKey 'AccentPalette' ([byte[]]$palette.ToArray()) 'Binary'
  Set-RegValue $AccentKey 'AccentColorMenu' (Get-Abgr $dark1) 'DWord'
  Set-RegValue $AccentKey 'StartColorMenu' (Get-Abgr $dark2) 'DWord'
  Set-RegValue $DwmKey 'AccentColor' (Get-Abgr $dark1) 'DWord'
  Set-RegValue $DwmKey 'ColorizationColor' (Get-Argb $rgb 0xC4) 'DWord'
  Set-RegValue $DwmKey 'ColorizationAfterglow' (Get-Argb $rgb 0xC4) 'DWord'
}

function Set-TaskbarAutoHide([bool]$Enabled) {
  $settings = Get-RegValue $StuckRectsKey 'Settings'
  if ($null -eq $settings) { throw 'StuckRects3 not found (open the taskbar settings once and try again).' }
  $bytes = [byte[]]$settings
  if ($Enabled) { $bytes[8] = 3 } else { $bytes[8] = 2 }
  Set-RegValue $StuckRectsKey 'Settings' $bytes 'Binary'
}

function Restart-Explorer {
  Get-Process -Name explorer -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Milliseconds 1500
  if (-not (Get-Process -Name explorer -ErrorAction SilentlyContinue)) { Start-Process explorer.exe }
}

function Test-Flag($Object, [string]$Name) {
  return ($null -ne $Object) -and ($null -ne $Object.PSObject.Properties[$Name]) -and ($null -ne $Object.$Name)
}

# ---------- Modes ----------
function Invoke-Apply($Cfg) {
  if ($Cfg.wallpaper) {
    Invoke-Step 'wallpaper' { Set-Wallpaper $Cfg.wallpaper.path ([string]$Cfg.wallpaper.style) }
  }

  if ($Cfg.colors) {
    $c = $Cfg.colors
    if (Test-Flag $c 'darkMode') {
      Invoke-Step 'darkMode' {
        $light = [int](-not [bool]$c.darkMode)
        Set-RegValue $PersonalizeKey 'AppsUseLightTheme' $light 'DWord'
        Set-RegValue $PersonalizeKey 'SystemUsesLightTheme' $light 'DWord'
      }
    }
    if (Test-Flag $c 'accent') { Invoke-Step 'accentColor' { Set-AccentColor ([string]$c.accent) } }
    if (Test-Flag $c 'transparency') {
      Invoke-Step 'transparency' { Set-RegValue $PersonalizeKey 'EnableTransparency' ([int][bool]$c.transparency) 'DWord' }
    }
    if (Test-Flag $c 'accentOnTaskbar') {
      Invoke-Step 'accentOnTaskbar' { Set-RegValue $PersonalizeKey 'ColorPrevalence' ([int][bool]$c.accentOnTaskbar) 'DWord' }
    }
    if (Test-Flag $c 'accentOnTitleBars') {
      Invoke-Step 'accentOnTitleBars' { Set-RegValue $DwmKey 'ColorPrevalence' ([int][bool]$c.accentOnTitleBars) 'DWord' }
    }
  }

  if ($Cfg.taskbar) {
    $t = $Cfg.taskbar
    if ((Test-Flag $t 'align') -and $IsWin11) {
      Invoke-Step 'taskbarAlign' {
        $v = 1; if ([string]$t.align -eq 'left') { $v = 0 }
        Set-RegValue $AdvancedKey 'TaskbarAl' $v 'DWord'
      }
    }
    if (Test-Flag $t 'autoHide') { Invoke-Step 'taskbarAutoHide' { Set-TaskbarAutoHide ([bool]$t.autoHide) } }
    if (Test-Flag $t 'search') {
      Invoke-Step 'taskbarSearch' {
        $mode = @{ hidden = 0; icon = 1; box = 2 }[[string]$t.search]
        if ($null -eq $mode) { $mode = 1 }
        Set-RegValue $SearchKey 'SearchboxTaskbarMode' $mode 'DWord'
      }
    }
    if (Test-Flag $t 'taskView') {
      Invoke-Step 'taskbarTaskView' { Set-RegValue $AdvancedKey 'ShowTaskViewButton' ([int][bool]$t.taskView) 'DWord' }
    }
    if ((Test-Flag $t 'widgets') -and $IsWin11) {
      Invoke-Step 'taskbarWidgets' { Set-RegValue $AdvancedKey 'TaskbarDa' ([int][bool]$t.widgets) 'DWord' }
    }
  }

  Invoke-Step 'broadcast' {
    [UlisingNative]::Broadcast('ImmersiveColorSet')
    [UlisingNative]::Broadcast('WindowsThemeElement')
    [UlisingNative]::Broadcast('TraySettings')
  }

  if ($Cfg.restartExplorer) { Invoke-Step 'restartExplorer' { Restart-Explorer } }
}

function Invoke-Backup($Cfg) {
  $entries = New-Object System.Collections.ArrayList
  foreach ($item in $BackupItems) {
    $value = Get-RegValue $item[0] $item[1]
    if ($value -is [byte[]]) { $value = @($value | ForEach-Object { [int]$_ }) }
    [void]$entries.Add([ordered]@{ path = $item[0]; name = $item[1]; type = $item[2]; exists = ($null -ne $value); value = $value })
  }
  $doc = [ordered]@{ createdAt = (Get-Date).ToString('o'); windowsBuild = [Environment]::OSVersion.Version.Build; entries = $entries }
  $json = $doc | ConvertTo-Json -Depth 6
  [IO.File]::WriteAllText($Cfg.backupPath, $json, (New-Object System.Text.UTF8Encoding($false)))
  Add-Result 'backup' $true $Cfg.backupPath
}

function Invoke-Restore($Cfg) {
  if (-not (Test-Path -LiteralPath $Cfg.backupPath)) { throw 'Backup file not found.' }
  $doc = Get-Content -LiteralPath $Cfg.backupPath -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($e in $doc.entries) {
    Invoke-Step ("restore:" + $e.name) {
      if (-not $e.exists) { Remove-RegValue $e.path $e.name; return }
      switch ($e.type) {
        'Binary' { Set-RegValue $e.path $e.name ([byte[]]@($e.value | ForEach-Object { [byte]$_ })) 'Binary' }
        'DWord'  { Set-RegValue $e.path $e.name ([int]$e.value) 'DWord' }
        default  { Set-RegValue $e.path $e.name ([string]$e.value) 'String' }
      }
    }
  }
  $wall = @($doc.entries | Where-Object { $_.name -eq 'WallPaper' })[0]
  if ($wall -and $wall.exists -and $wall.value -and (Test-Path -LiteralPath $wall.value)) {
    Invoke-Step 'wallpaper' { [void][UlisingNative]::SystemParametersInfo(0x0014, 0, [string]$wall.value, 0x03) }
  }
  Invoke-Step 'broadcast' {
    [UlisingNative]::Broadcast('ImmersiveColorSet')
    [UlisingNative]::Broadcast('WindowsThemeElement')
    [UlisingNative]::Broadcast('TraySettings')
  }
  if ($Cfg.restartExplorer) { Invoke-Step 'restartExplorer' { Restart-Explorer } }
}

# ---------- Entry point ----------
try {
  $cfg = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
  switch ([string]$cfg.mode) {
    'apply'   { Invoke-Apply $cfg }
    'backup'  { Invoke-Backup $cfg }
    'restore' { Invoke-Restore $cfg }
    default   { throw "Unknown mode: $($cfg.mode)" }
  }
  Write-Final $true ''
}
catch {
  Write-Final $false $_.Exception.Message
}
