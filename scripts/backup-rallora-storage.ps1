# Backup the five public sponsor-logo objects currently used by Rallora.
# This is a *Storage object byte* backup, separate from the SQL database export.
# Run on a trusted Windows machine. No database password or API key required.
$ErrorActionPreference = 'Stop'
$projectRef = 'vfebhddnjhylicapckro'
$bucket = 'sponsor-logos'
$base = "https://$projectRef.supabase.co/storage/v1/object/public/$bucket"
$destination = Join-Path ([Environment]::GetFolderPath('MyDocuments')) ('Rallora-storage-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$objects = @(
  @{ Name = 'congleton-eats/78b2558a-98b9-4531-8f74-f723a6533d65.jpg'; ExpectedBytes = 88184 },
  @{ Name = 'congleton-eats/b62da88e-df06-42c1-b11d-3442d278a1e0.png'; ExpectedBytes = 267373 },
  @{ Name = 'congleton-fc/4a173f99-26be-4201-9237-c434de4edea0.jpg'; ExpectedBytes = 227050 },
  @{ Name = 'parx/a7fb3d62-dde7-47f4-9a04-9ce292639865.jpg'; ExpectedBytes = 179402 },
  @{ Name = 'sponsor/095ca1e4-6292-4250-969e-5a211b7b47a3.jpg'; ExpectedBytes = 88184 }
)
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$manifest = @()
foreach ($object in $objects) {
  $relative = $object.Name
  $target = Join-Path $destination ($relative -replace '/', [IO.Path]::DirectorySeparatorChar)
  New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
  $url = $base + '/' + $relative
  Invoke-WebRequest -Uri $url -OutFile $target -ErrorAction Stop
  $file = Get-Item -LiteralPath $target
  if ($file.Length -ne $object.ExpectedBytes) {
    throw "Size mismatch for $relative. Expected $($object.ExpectedBytes), got $($file.Length)."
  }
  $hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
  $manifest += [pscustomobject]@{ Bucket = $bucket; Name = $relative; SizeBytes = $file.Length; SHA256 = $hash }
  Write-Host ("Saved: " + $relative + " (" + $file.Length + " bytes)")
}
$manifest | Export-Csv -NoTypeInformation -Path (Join-Path $destination 'SHA256-manifest.csv')
Write-Host ("Saved " + $manifest.Count + " objects into: " + $destination)
Write-Host "This captures file bytes only. Database metadata is a separate backup."
