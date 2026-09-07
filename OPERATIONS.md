# ClinicSystem operations

## Database backup

Run `scripts/backup-database.ps1`. It creates a SQL Server backup with checksum and compression, verifies it with `RESTORE VERIFYONLY`, and prints a SHA-256 hash. Store copies off-machine using encrypted storage and test restore regularly.

## Database restore

Stop the API first. Run `scripts/restore-database.ps1 -BackupPath <file> -ConfirmRestore`. Restore is destructive and intentionally requires the explicit switch.

## External integrations

Telemedicine, Google Calendar synchronization, and the external notification dispatcher are disabled by default. Do not enable them until provider contracts, credentials, privacy terms, and the exact medical data sent to each provider are approved. Calendar `.ics` export remains local and does not transmit patient data.

## Medical files

Files are stored outside the public web root under `App_Data/medical-files`. PDF/JPEG/PNG signatures, size, randomized storage keys, ownership, and SHA-256 are checked. The built-in validation is not a malware engine; connect an approved scanner before accepting files from untrusted public users in production.
