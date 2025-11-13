# Script to launch Android emulator and run the app

Write-Host "Setting up Android SDK paths..." -ForegroundColor Green
$env:ANDROID_HOME = "C:\Users\tani\AppData\Local\Android\Sdk"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:ANDROID_HOME\tools;$env:Path"

Write-Host "Checking for running emulators..." -ForegroundColor Green
$devices = & adb devices

if ($devices -match "emulator") {
    Write-Host "Emulator is already running!" -ForegroundColor Green
} else {
    Write-Host "No emulator detected. Listing available AVDs..." -ForegroundColor Yellow
    $avds = & emulator -list-avds

    if ($avds) {
        Write-Host "Available AVDs:" -ForegroundColor Cyan
        $avds | ForEach-Object { Write-Host "  - $_" -ForegroundColor Cyan }

        Write-Host "`nLaunching first available AVD..." -ForegroundColor Green
        $firstAvd = $avds[0]
        Start-Process -FilePath "emulator" -ArgumentList "-avd", $firstAvd -WindowStyle Normal

        Write-Host "Waiting for emulator to boot..." -ForegroundColor Yellow
        Start-Sleep -Seconds 15

        # Wait for device to be ready
        $timeout = 120
        $elapsed = 0
        while ($elapsed -lt $timeout) {
            $bootComplete = & adb shell getprop sys.boot_completed 2>$null
            if ($bootComplete -eq "1") {
                Write-Host "Emulator is ready!" -ForegroundColor Green
                break
            }
            Start-Sleep -Seconds 5
            $elapsed += 5
            Write-Host "Still booting... ($elapsed seconds)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "`nNo AVDs found. Please create one using Android Studio:" -ForegroundColor Red
        Write-Host "1. Open Android Studio" -ForegroundColor Yellow
        Write-Host "2. Go to Tools > Device Manager (or AVD Manager)" -ForegroundColor Yellow
        Write-Host "3. Click 'Create Virtual Device'" -ForegroundColor Yellow
        Write-Host "4. Select a device and system image, then finish setup" -ForegroundColor Yellow
        Write-Host "`nAfter creating an AVD, run this script again." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "`nInstalling and launching app..." -ForegroundColor Green
npm run android

