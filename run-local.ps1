# TipJar Local Setup and Startup PowerShell Script

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "TipJar Local Setup and Startup" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Using Node.js version: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "ERROR: Node.js is not installed or not in your PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "Using npm version: $npmVersion" -ForegroundColor Green
}
catch {
    Write-Host "ERROR: npm is not installed or not in your PATH" -ForegroundColor Red
    Write-Host "Please ensure npm is installed with Node.js" -ForegroundColor Yellow
    exit 1
}

# Install dependencies if node_modules doesn't exist
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Build the project
Write-Host "Building project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed" -ForegroundColor Red
    exit 1
}

# Set environment variables for development
$env:NODE_ENV = "development"
$env:NANONETS_API_KEY = "your-nanonets-api-key"
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
=======
# Optional: set the model ID explicitly to avoid validation errors
# $env:NANONETS_MODEL_ID = "your-nanonets-model-id"
>>>>>>> theirs
=======
# Optional: set the model ID explicitly to avoid validation errors
# $env:NANONETS_MODEL_ID = "your-nanonets-model-id"
>>>>>>> theirs
=======
$env:NANONETS_MODEL_ID = "your-nanonets-model-id" # required: use the model ID from the Nanonets dashboard
>>>>>>> theirs

# Start the server
Write-Host "Starting TipJar application..." -ForegroundColor Green
Write-Host "Application will be available at http://localhost:5000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the application" -ForegroundColor Yellow

# Run the application with npx tsx
npx tsx server/index.ts

Write-Host "Application has stopped" -ForegroundColor Yellow
Read-Host "Press Enter to exit"