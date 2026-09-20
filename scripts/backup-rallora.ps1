# Export Rallora production using a local trusted computer (Supabase CLI + Docker Desktop).
# Standard db dumps exclude managed auth/storage schemas. Export those and storage files separately.
$ErrorActionPreference = 'Stop'
$projectRef = 'vfebhddnjhylicapckro'
$destination = Join-Path ([Environment]::GetFolderPath('MyDocuments')) ('Rallora-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -Path $destination -ItemType Directory -ErrorAction Stop | Out-Null
$secret = Read-Host 'Paste the RALLORA database session-pooler URI (not Nebula Pay), with its password' -AsSecureString
try {
  $plain = [System.Net.NetworkCredential]::new('', $secret).Password
  if (-not ($plain -match $projectRef)) { throw 'Database URI does not contain the Rallora project reference. Stopping.' }
  $env:RALLORA_DATABASE_URL = $plain
  $plain = $null
  Write-Host ('Exporting Rallora into ' + $destination)
  & supabase db dump --db-url $env:RALLORA_DATABASE_URL --file (Join-Path $destination 'roles.sql') --role-only
  if ($LASTEXITCODE -ne 0) { throw 'Role dump failed.' }
  & supabase db dump --db-url $env:RALLORA_DATABASE_URL --file (Join-Path $destination 'schema.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Schema dump failed.' }
  & supabase db dump --db-url $env:RALLORA_DATABASE_URL --file (Join-Path $destination 'data.sql') --use-copy --data-only
  if ($LASTEXITCODE -ne 0) { throw 'Data dump failed.' }
  Get-ChildItem $destination | Select-Object Name, Length
  Write-Host 'Verify file sizes; store an encrypted off-site copy; test restoring to a disposable database.'
  Write-Host 'ALSO REQUIRED: backup Supabase Auth data and actual Storage object bytes separately.'
} finally {
  Remove-Item Env:RALLORA_DATABASE_URL -ErrorAction SilentlyContinue
  $secret.Dispose()
}
