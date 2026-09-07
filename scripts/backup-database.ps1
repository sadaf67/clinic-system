param(
    [string]$Server = ".",
    [string]$Database = "ClinicDB",
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\backups")
)

$ErrorActionPreference = "Stop"
if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
    throw "sqlcmd is required. Install Microsoft SQL Server command-line tools."
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($resolvedOutput) | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $resolvedOutput "$Database-$timestamp.bak"
$escapedPath = $backupPath.Replace("'", "''")
$escapedDatabase = $Database.Replace("]", "]]" )

sqlcmd -S $Server -E -b -Q "BACKUP DATABASE [$escapedDatabase] TO DISK = N'$escapedPath' WITH COPY_ONLY, CHECKSUM, COMPRESSION, INIT"
sqlcmd -S $Server -E -b -Q "RESTORE VERIFYONLY FROM DISK = N'$escapedPath' WITH CHECKSUM"

$hash = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash
Write-Output "Backup verified: $backupPath"
Write-Output "SHA256: $hash"
