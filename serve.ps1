# Tiny static file server for the home LAN (no admin rights, no Python/Node needed).
# Usage: double-click start.bat, or:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8080]
param([int]$Port = 8767)

$root = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.htm' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'; '.gif' = 'image/gif'
  '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.mp3' = 'audio/mpeg'
}

$listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Any, $Port)
try { $listener.Start() } catch { Write-Host "Port $Port is busy. Try: serve.ps1 -Port 8081" -ForegroundColor Red; exit 1 }

$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -match '^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\.' } |
  Select-Object -ExpandProperty IPAddress
Write-Host ""
Write-Host "  Chick Game is running. Open on iPad (same Wi-Fi):" -ForegroundColor Green
foreach ($ip in $ips) { Write-Host "     http://${ip}:$Port/" -ForegroundColor Cyan }
Write-Host "  On this PC: http://localhost:$Port/"
Write-Host "  Close this window to stop."
Write-Host ""

function Send($stream, [int]$code, [string]$status, [string]$ctype, [byte[]]$body, [bool]$head) {
  $hdr = "HTTP/1.1 $code $status`r`nContent-Type: $ctype`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
  $hb = [Text.Encoding]::ASCII.GetBytes($hdr)
  $stream.Write($hb, 0, $hb.Length)
  if (-not $head -and $body.Length) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 2000; $client.SendTimeout = 5000
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
    $first = $reader.ReadLine()
    if (-not $first) { continue }
    while ($true) { $l = $reader.ReadLine(); if ([string]::IsNullOrEmpty($l)) { break } }

    $parts = $first.Split(' ')
    $method = $parts[0]
    $path = [Uri]::UnescapeDataString(($parts[1] -split '\?')[0]).TrimStart('/')
    if ($path -eq '' -or $path.EndsWith('/')) { $path += 'index.html' }
    $full = [IO.Path]::GetFullPath((Join-Path $root $path))
    $code = 200

    if ($method -ne 'GET' -and $method -ne 'HEAD') {
      $code = 405; Send $stream 405 'Method Not Allowed' 'text/plain' ([Text.Encoding]::ASCII.GetBytes('405')) $false
    } elseif (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $code = 404; Send $stream 404 'Not Found' 'text/plain' ([Text.Encoding]::ASCII.GetBytes('404 Not Found')) ($method -eq 'HEAD')
    } else {
      $ext = [IO.Path]::GetExtension($full).ToLower()
      $ct = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      Send $stream 200 'OK' $ct ([IO.File]::ReadAllBytes($full)) ($method -eq 'HEAD')
    }
    Write-Host ("{0}  {1,-15} {2} /{3}  {4}" -f (Get-Date -Format 'HH:mm:ss'), $client.Client.RemoteEndPoint.Address, $method, $path, $code)
  } catch {
    # client went away or timed out; ignore
  } finally {
    $client.Close()
  }
}
