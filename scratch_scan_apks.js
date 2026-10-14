const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const apksDir = path.join(__dirname, 'APKS');
const apkFiles = fs.readdirSync(apksDir).filter(f => f.endsWith('.apk'));

console.log('APKs encontrados:', apkFiles);

const psScript = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$apks = Get-ChildItem -Path "${apksDir.replace(/\\/g, '\\\\')}" -Filter "*.apk"
foreach ($apk in $apks) {
    Write-Output "=== ANALISANDO: $($apk.Name) ==="
    $zip = [System.IO.Compression.ZipFile]::OpenRead($apk.FullName)
    foreach ($entry in $zip.Entries) {
        if ($entry.Name.EndsWith(".smali") -or $entry.Name -eq "classes.dex" -or $entry.Name.EndsWith(".json") -or $entry.Name.EndsWith(".xml") -or $entry.Name.EndsWith(".txt") -or $entry.Name.EndsWith(".properties")) {
            $stream = $entry.Open()
            $reader = New-Object System.IO.StreamReader($stream)
            $content = $reader.ReadToEnd()
            $stream.Close()
            $reader.Close()

            $matches = [regex]::Matches($content, 'https?://[a-zA-Z0-9\.\-_]+(:[0-9]+)?(/[a-zA-Z0-9\.\-_]+)*')
            foreach ($m in $matches) {
                $val = $m.Value
                if ($val -match "player_api" -or $val -match "live" -or $val -match "8080" -or $val -match "2095" -or $val -match "8000" -or $val -match "portal" -or $val -match "dns" -or $val -match "top" -or $val -match "stream") {
                    if ($val -notmatch "schemas.android" -or $val -notmatch "google") {
                        Write-Output "[$($apk.Name)] Match: $val"
                    }
                }
            }
        }
    }
    $zip.Dispose()
}
`;

fs.writeFileSync('C:/Users/otimi/.gemini/antigravity-ide/brain/c17c9841-361d-4f2d-a6cf-b2c957ff859b/scratch/scan_apks.ps1', psScript, 'utf8');
console.log('Script PowerShell salvo.');
