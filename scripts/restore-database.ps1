param(
    [Parameter(Mandatory = $true)][string]$BackupPath,
    [string]$Server = ".",
    [string]$Database = "ClinicDB",
    [switch]$ConfirmRestore
)

$ErrorActionPreference = "Stop"
if (-not $ConfirmRestore) { throw "Restore is destructive. Re-run with -ConfirmRestore after verifying the target." }
if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) { throw "sqlcmd is required." }
$resolvedBackup = (Resolve-Path -LiteralPath $BackupPath).Path
$escapedPath = $resolvedBackup.Replace("'", "''")
$escapedDatabase = $Database.Replace("]", "]]" )

sqlcmd -S $Server -E -b -Q "RESTORE VERIFYONLY FROM DISK = N'$escapedPath' WITH CHECKSUM"
sqlcmd -S $Server -E -b -Q "ALTER DATABASE [$escapedDatabase] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [$escapedDatabase] FROM DISK = N'$escapedPath' WITH REPLACE, RECOVERY; ALTER DATABASE [$escapedDatabase] SET MULTI_USER;"
Write-Output "Restore completed for database $Database from $resolvedBackup"
