#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'
$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Resolve-AgentXExtensionRoot {
  $candidatePaths = @(
    $env:AGENTX_EXTENSION_ROOT
    '/Users/sameepkotecha/.vscode/extensions/jnpiyush.agentx-8.4.50'
  ) | Where-Object { $_ -and (Test-Path $_) }

  foreach ($candidate in $candidatePaths) {
    return (Resolve-Path $candidate).Path
  }

  $searchRoots = @(
    (Join-Path $HOME '.vscode\extensions'),
    (Join-Path $HOME '.vscode-insiders\extensions')
  )

  foreach ($searchRoot in $searchRoots) {
    if (-not (Test-Path $searchRoot)) { continue }
    $matches = @(
      Get-ChildItem -Path $searchRoot -Directory -Filter 'jnpiyush.agentx-*' -ErrorAction SilentlyContinue
      | Sort-Object Name -Descending
    )

    foreach ($match in $matches) {
      $runtimeEntry = Join-Path $match.FullName '.github/agentx/.agentx/local-issue-manager.ps1'
      if (Test-Path $runtimeEntry) {
        return $match.FullName
      }
    }
  }

  throw 'AgentX extension runtime not found. Reinstall the AgentX extension or set AGENTX_EXTENSION_ROOT.'
}

$extensionRoot = Resolve-AgentXExtensionRoot
$env:AGENTX_WORKSPACE_ROOT = $workspaceRoot
& (Join-Path $extensionRoot '.github/agentx/.agentx/local-issue-manager.ps1') @args
$succeeded = $?
$exitCode = if (Test-Path variable:LASTEXITCODE) { $LASTEXITCODE } else { 0 }
if ($succeeded) {
  $exitCode = 0
} elseif ($exitCode -eq 0) {
  $exitCode = 1
}
exit $exitCode
