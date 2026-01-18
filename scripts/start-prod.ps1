Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot\..

$env:NODE_ENV = 'production'
$env:HOST = '127.0.0.1'
$env:PORT = '3000'

npm start
