[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('success', 'failure')]
    [string]$Outcome,

    [string]$Account = 'tutela-deployer',
    [string]$Wallet = '0x6a7Ea62C513c68c64e17f3EaBcA7f6fe19DA6dBe',
    [string]$ProgramId = '0x88c009c1caeaa9b2889593791115138e662f8d6e3e6dea58ff03491037187f07',
    [string]$Vault = '0x6ecA894E12cE5d498e9b55fD4cFc246995494577',
    [string]$Registry = '0x6ecA894E12cE5d498e9b55fD4cFc246995494577',
    [string]$TermsHash = '0x7b0869d92a12518da72259d898c526d065bade5f093f9f62907df2fea71f0e2c',
    [string]$Cc3Rpc = 'https://rpc.cc3-testnet.creditcoin.network',
    [string]$SepoliaRpc = 'https://ethereum-sepolia-rpc.publicnode.com',
    [switch]$ConfirmReservation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$castPath = Join-Path $PSScriptRoot '..\.tools\foundry\cast.exe'
$cast = (Resolve-Path $castPath).Path
$premium = [System.Numerics.BigInteger]::Parse('1000000000000000')
$failurePayout = [System.Numerics.BigInteger]::Parse('10000000000000000')
$sessionDuration = [System.Numerics.BigInteger]::Parse('900')
$minimumUnits = [System.Numerics.BigInteger]::One
$sepoliaGasUnits = [System.Numerics.BigInteger]::Parse('800000')
$cc3GasUnits = [System.Numerics.BigInteger]::Parse('6000000')
$gasSafetyMultiplier = [System.Numerics.BigInteger]::Parse('2')
$expectedSepoliaChainId = [uint64]11155111
$expectedCc3ChainId = [uint64]102031
$expectedSourceChainKey = [System.Numerics.BigInteger]::One

function Invoke-Cast {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $output = & $cast @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "cast $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
    return ($output -join "`n").Trim()
}

function Invoke-CastJson {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $output = Invoke-Cast -Arguments $Arguments
    return $output | ConvertFrom-Json
}

function Invoke-Rpc {
    param(
        [Parameter(Mandatory = $true)][string]$Rpc,
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [object[]]$Parameters,
        [switch]$AllowNullResult
    )

    $body = @{
        jsonrpc = '2.0'
        method = $Method
        params = $Parameters
        id = 1
    } | ConvertTo-Json -Compress -Depth 20
    $response = Invoke-RestMethod -Method Post -Uri $Rpc -ContentType 'application/json' -Body $body -TimeoutSec 20
    $errorProperty = $response.PSObject.Properties['error']
    if ($null -ne $errorProperty -and $null -ne $errorProperty.Value) {
        throw "$Method failed: $($errorProperty.Value | ConvertTo-Json -Compress)"
    }
    if ($null -eq $response.result -and -not $AllowNullResult) {
        throw "$Method returned no result"
    }
    return $response.result
}

function Wait-RpcReceipt {
    param(
        [Parameter(Mandatory = $true)][string]$Rpc,
        [Parameter(Mandatory = $true)][string]$TransactionHash
    )

    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        $receipt = Invoke-Rpc -Rpc $Rpc -Method 'eth_getTransactionReceipt' -Parameters @($TransactionHash) -AllowNullResult
        if ($null -ne $receipt) {
            return $receipt
        }
        Start-Sleep -Seconds 2
    }
    throw "Timed out waiting for transaction $TransactionHash"
}

function Convert-HexToUInt64 {
    param([Parameter(Mandatory = $true)][string]$Value)

    if ($Value.StartsWith('0x')) {
        return [Convert]::ToUInt64($Value.Substring(2), 16)
    }
    return [Convert]::ToUInt64($Value)
}

function Convert-HexWordToBigInteger {
    param([Parameter(Mandatory = $true)][string]$Value)

    $hex = if ($Value.StartsWith('0x')) { $Value.Substring(2) } else { $Value }
    if ($hex -notmatch '^[0-9a-fA-F]+$') {
        throw "Invalid hexadecimal ABI word: $Value"
    }
    return [System.Numerics.BigInteger]::Parse(
        "0$hex",
        [System.Globalization.NumberStyles]::AllowHexSpecifier
    )
}

function Get-AbiWords {
    param([Parameter(Mandatory = $true)][string]$Data)

    if (-not $Data.StartsWith('0x')) {
        throw 'ABI data must start with 0x'
    }
    $body = $Data.Substring(2)
    if ($body.Length -eq 0 -or $body.Length % 64 -ne 0 -or $body -notmatch '^[0-9a-fA-F]+$') {
        throw 'ABI data has an invalid word length or encoding'
    }
    $result = for ($index = 0; $index -lt ($body.Length / 64); $index++) {
        $body.Substring($index * 64, 64)
    }
    return @($result)
}

function Convert-WordToAddress {
    param([Parameter(Mandatory = $true)][string]$Word)

    return "0x$($Word.Substring(24))"
}

function Assert-HexEqual {
    param(
        [Parameter(Mandatory = $true)][string]$Actual,
        [Parameter(Mandatory = $true)][string]$Expected,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if ($Actual.ToLowerInvariant() -ne $Expected.ToLowerInvariant()) {
        throw "$Label mismatch: expected $Expected, received $Actual"
    }
}

function Get-BlockTimestamp {
    param(
        [Parameter(Mandatory = $true)][string]$Rpc,
        [Parameter(Mandatory = $true)][string]$Block
    )

    $blockData = Invoke-Rpc -Rpc $Rpc -Method 'eth_getBlockByNumber' -Parameters @($Block, $false)
    return Convert-HexToUInt64 -Value ([string]$blockData.timestamp)
}

function Assert-SuccessfulReceipt {
    param(
        [Parameter(Mandatory = $true)]$Receipt,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if ((Convert-HexToUInt64 -Value ([string]$Receipt.status)) -ne 1) {
        throw "$Label reverted"
    }
}

function Find-EventLog {
    param(
        [Parameter(Mandatory = $true)]$Receipt,
        [Parameter(Mandatory = $true)][string]$Contract,
        [Parameter(Mandatory = $true)][string]$Topic
    )

    $matches = @($Receipt.logs) | Where-Object {
        ([string]$_.address).ToLowerInvariant() -eq $Contract.ToLowerInvariant() -and
        ([string]$_.topics[0]).ToLowerInvariant() -eq $Topic.ToLowerInvariant()
    }
    if ($matches.Count -ne 1) {
        throw "Expected exactly one event $Topic from $Contract; found $($matches.Count)"
    }
    return $matches[0]
}

function Sign-Digest {
    param([Parameter(Mandatory = $true)][string]$Digest)

    Write-Host 'Enter the Foundry keystore password to sign the EIP-712 digest.' -ForegroundColor Cyan
    return Invoke-Cast -Arguments @('wallet', 'sign', '--account', $Account, '--no-hash', $Digest)
}

function Save-LifecycleState {
    param(
        [Parameter(Mandatory = $true)][System.Collections.IDictionary]$State,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $directory = Split-Path -Parent $Path
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $State['updatedAt'] = (Get-Date).ToUniversalTime().ToString('o')
    $State | ConvertTo-Json -Depth 10 | Set-Content -Path $Path -Encoding utf8
}

function Write-RecoveryCommand {
    param(
        [Parameter(Mandatory = $true)][string]$CoverageId,
        [string]$SessionId,
        [string]$Deadline,
        [string]$ServiceReceipt,
        [string]$DeviceSignature,
        [bool]$SourceOutcomeSubmitted,
        [string]$StatePath
    )

    if ($StatePath) {
        Write-Warning "Public recovery state was saved to $StatePath"
    }
    try {
        $coverageCall = "0x7d32605b$($CoverageId.Substring(2))"
        $coverageResult = [string](Invoke-Rpc -Rpc $Cc3Rpc -Method 'eth_call' -Parameters @(
            @{ to = $Vault; data = $coverageCall },
            'latest'
        ))
        $coverage = Get-AbiWords -Data $coverageResult
        $coverageStatus = [int](Convert-HexWordToBigInteger -Value $coverage[13])
    }
    catch {
        Write-Warning "Unable to read current CC3 coverage state: $($_.Exception.Message)"
        $coverageStatus = -1
    }

    if ($coverageStatus -eq 1) {
        Write-Host 'Coverage is Reserved. Return the premium and unlock collateral with:' -ForegroundColor Yellow
        Write-Host "& '$cast' send --rpc-url '$Cc3Rpc' --chain 102031 --from '$Wallet' --account '$Account' --legacy --gas-limit 200000 '$Vault' 'cancelCoverage(bytes32)' '$CoverageId'" -ForegroundColor Yellow
        return
    }
    if ($coverageStatus -eq 2) {
        Write-Warning 'Coverage is Active and cannot be cancelled. Complete the source outcome, then resume the prover.'
        if (-not $SourceOutcomeSubmitted -and $ServiceReceipt -and $DeviceSignature) {
            Write-Host 'Resume the signed success settlement with:' -ForegroundColor Yellow
            Write-Host "& '$cast' send --rpc-url '$SepoliaRpc' --chain 11155111 --from '$Wallet' --account '$Account' --gas-limit 350000 '$Registry' 'settleSession((bytes32,bytes32,uint128,uint64,uint256),bytes)' '$ServiceReceipt' '$DeviceSignature'" -ForegroundColor Yellow
        }
        elseif (-not $SourceOutcomeSubmitted -and $SessionId) {
            Write-Host "After Sepolia timestamp $Deadline, finalize expiry with:" -ForegroundColor Yellow
            Write-Host "& '$cast' send --rpc-url '$SepoliaRpc' --chain 11155111 --from '$Wallet' --account '$Account' --gas-limit 200000 '$Registry' 'finalizeFailed(bytes32)' '$SessionId'" -ForegroundColor Yellow
        }
        Write-Host "Then resume proof submission: pnpm --filter @tutela/prover start -- --once" -ForegroundColor Yellow
        return
    }
    if ($coverageStatus -eq 3 -or $coverageStatus -eq 4) {
        Write-Host 'Coverage is already terminal on CC3; no cancellation or recovery transaction is needed.' -ForegroundColor Green
        return
    }
    Write-Warning "Inspect coverage $CoverageId and the saved state before sending another transaction."
}

foreach ($value in @($Wallet, $Vault, $Registry)) {
    if ($value -notmatch '^0x[0-9a-fA-F]{40}$') {
        throw "Invalid address: $value"
    }
}
foreach ($value in @($ProgramId, $TermsHash)) {
    if ($value -notmatch '^0x[0-9a-fA-F]{64}$') {
        throw "Invalid bytes32 value: $value"
    }
}

Write-Host 'Running read-only chain, contract, and program preflight checks.' -ForegroundColor Cyan
$sepoliaChainId = Convert-HexToUInt64 -Value ([string](Invoke-Rpc -Rpc $SepoliaRpc -Method 'eth_chainId' -Parameters @()))
$cc3ChainId = Convert-HexToUInt64 -Value ([string](Invoke-Rpc -Rpc $Cc3Rpc -Method 'eth_chainId' -Parameters @()))
if ($sepoliaChainId -ne $expectedSepoliaChainId) {
    throw "Sepolia RPC returned chain ID $sepoliaChainId"
}
if ($cc3ChainId -ne $expectedCc3ChainId) {
    throw "CC3 RPC returned chain ID $cc3ChainId"
}

$registryCode = [string](Invoke-Rpc -Rpc $SepoliaRpc -Method 'eth_getCode' -Parameters @($Registry, 'latest'))
$vaultCode = [string](Invoke-Rpc -Rpc $Cc3Rpc -Method 'eth_getCode' -Parameters @($Vault, 'latest'))
if ($registryCode -eq '0x') { throw 'No registry code exists at the configured Sepolia address' }
if ($vaultCode -eq '0x') { throw 'No vault code exists at the configured CC3 address' }

$sepoliaBalance = Convert-HexWordToBigInteger -Value ([string](Invoke-Rpc -Rpc $SepoliaRpc -Method 'eth_getBalance' -Parameters @($Wallet, 'latest')))
$cc3Balance = Convert-HexWordToBigInteger -Value ([string](Invoke-Rpc -Rpc $Cc3Rpc -Method 'eth_getBalance' -Parameters @($Wallet, 'latest')))
$sepoliaGasPrice = Convert-HexWordToBigInteger -Value ([string](Invoke-Rpc -Rpc $SepoliaRpc -Method 'eth_gasPrice' -Parameters @()))
$cc3GasPrice = Convert-HexWordToBigInteger -Value ([string](Invoke-Rpc -Rpc $Cc3Rpc -Method 'eth_gasPrice' -Parameters @()))
$requiredSepoliaBalance = $sepoliaGasPrice * $sepoliaGasUnits * $gasSafetyMultiplier
$requiredCc3Balance = $premium + ($cc3GasPrice * $cc3GasUnits * $gasSafetyMultiplier)
if ($sepoliaBalance -lt $requiredSepoliaBalance) {
    throw "Wallet needs at least $requiredSepoliaBalance wei on Sepolia for the planned source path"
}
if ($cc3Balance -lt $requiredCc3Balance) {
    throw "Wallet needs at least $requiredCc3Balance wei on CC3 for reservation and proof gas"
}

$programCall = "0xb1ffb3d4$($ProgramId.Substring(2))"
$programResult = [string](Invoke-Rpc -Rpc $Cc3Rpc -Method 'eth_call' -Parameters @(
    @{ to = $Vault; data = $programCall },
    'latest'
))
$program = Get-AbiWords -Data $programResult
if ($program.Count -ne 12) { throw "getProgram returned $($program.Count) words instead of 12" }
Assert-HexEqual -Actual (Convert-WordToAddress -Word $program[0]) -Expected $Wallet -Label 'Program operator'
Assert-HexEqual -Actual (Convert-WordToAddress -Word $program[1]) -Expected $Wallet -Label 'Program device'
Assert-HexEqual -Actual (Convert-WordToAddress -Word $program[2]) -Expected $Registry -Label 'Program source registry'
if ((Convert-HexWordToBigInteger -Value $program[3]) -ne $expectedSourceChainKey) { throw 'Program source chain key mismatch' }
if ((Convert-HexWordToBigInteger -Value $program[6]) -ne $premium) { throw 'Program premium mismatch' }
if ((Convert-HexWordToBigInteger -Value $program[7]) -ne $failurePayout) { throw 'Program failure payout mismatch' }
if ((Convert-HexWordToBigInteger -Value $program[8]) -ne $sessionDuration) { throw 'Program session duration mismatch' }
if ((Convert-HexWordToBigInteger -Value $program[9]) -ne $minimumUnits) { throw 'Program minimum units mismatch' }
Assert-HexEqual -Actual "0x$($program[10])" -Expected $TermsHash -Label 'Program terms hash'
if ((Convert-HexWordToBigInteger -Value $program[11]) -ne [System.Numerics.BigInteger]::One) { throw 'Program is not active' }
$totalBond = Convert-HexWordToBigInteger -Value $program[4]
$reservedBond = Convert-HexWordToBigInteger -Value $program[5]
if (($totalBond - $reservedBond) -lt $failurePayout) { throw 'Program has insufficient available bond for one reservation' }

if (-not $ConfirmReservation) {
    throw 'Preflight passed. Re-run with -ConfirmReservation to authorize the 0.001 CTC reservation.'
}

Write-Host "Preflight passed. Reserving $Outcome coverage on CC3 (premium: 0.001 CTC)." -ForegroundColor Cyan
$reserveTransaction = Invoke-Cast -Arguments @(
    'send', '--async',
    '--rpc-url', $Cc3Rpc,
    '--chain', '102031',
    '--from', $Wallet,
    '--account', $Account,
    '--legacy',
    '--gas-limit', '450000',
    '--value', $premium.ToString(),
    $Vault,
    'reserveCoverage(bytes32)',
    $ProgramId
)
$reserveReceipt = Wait-RpcReceipt -Rpc $Cc3Rpc -TransactionHash $reserveTransaction
Assert-SuccessfulReceipt -Receipt $reserveReceipt -Label 'Coverage reservation'
$coverageId = $null
$sessionId = $null
$deadline = $null
$serviceReceipt = $null
$deviceSignature = $null
$sourceOutcomeSubmitted = $false
$recoveryPath = $null
$lifecycleState = $null

try {
    $coverageTopic = Invoke-Cast -Arguments @(
        'keccak',
        'CoverageReserved(bytes32,bytes32,address,uint64,uint128,uint128)'
    )
    $coverageLog = Find-EventLog -Receipt $reserveReceipt -Contract $Vault -Topic $coverageTopic
    $coverageId = [string]$coverageLog.topics[1]
    Assert-HexEqual -Actual ([string]$coverageLog.topics[2]) -Expected $ProgramId -Label 'Reserved program ID'
    $coverageData = Get-AbiWords -Data ([string]$coverageLog.data)
    if ($coverageData.Count -ne 3) { throw 'CoverageReserved data is malformed' }
    $deadline = Convert-HexWordToBigInteger -Value $coverageData[0]
    if ((Convert-HexWordToBigInteger -Value $coverageData[1]) -ne $premium) { throw 'Reserved premium mismatch' }
    if ((Convert-HexWordToBigInteger -Value $coverageData[2]) -ne $failurePayout) { throw 'Reserved payout mismatch' }

    $recoveryPath = Join-Path $PSScriptRoot "..\.data\live-lifecycle-$coverageId.json"
    $lifecycleState = [ordered]@{
        outcome = $Outcome
        state = 'Reserved'
        programId = $ProgramId
        coverageId = $coverageId
        deadline = $deadline.ToString()
        wallet = $Wallet
        vault = $Vault
        registry = $Registry
        reserveTransaction = [string]$reserveReceipt.transactionHash
        reserveBlock = Convert-HexToUInt64 -Value ([string]$reserveReceipt.blockNumber)
    }
    Save-LifecycleState -State $lifecycleState -Path $recoveryPath

    $nonceOutput = Invoke-Cast -Arguments @(
        'call', $Registry,
        'authorizationNonces(address)(uint256)', $Wallet,
        '--rpc-url', $SepoliaRpc
    )
    $authorizationNonce = ($nonceOutput -split '\s+')[0]
    $sessionTerms = "($coverageId,$ProgramId,$Wallet,$Wallet,$Wallet,$deadline,$minimumUnits,$TermsHash,$authorizationNonce)"

    $authorizationDigest = Invoke-Cast -Arguments @(
        'call', $Registry,
        'sessionAuthorizationDigest((bytes32,bytes32,address,address,address,uint64,uint128,bytes32,uint256))(bytes32)',
        $sessionTerms,
        '--rpc-url', $SepoliaRpc
    )
    $customerSignature = Sign-Digest -Digest $authorizationDigest

    Write-Host 'Opening the authorized session on Sepolia.' -ForegroundColor Cyan
    $openReceipt = Invoke-CastJson -Arguments @(
        'send', '--json',
        '--rpc-url', $SepoliaRpc,
        '--chain', '11155111',
        '--from', $Wallet,
        '--account', $Account,
        '--gas-limit', '400000',
        $Registry,
        'openSession((bytes32,bytes32,address,address,address,uint64,uint128,bytes32,uint256),bytes)',
        $sessionTerms,
        $customerSignature
    )
    Assert-SuccessfulReceipt -Receipt $openReceipt -Label 'Session opening'

    $openedTopic = Invoke-Cast -Arguments @(
        'keccak',
        'SessionOpened(bytes32,bytes32,bytes32,address,address,address,uint64,uint128,bytes32)'
    )
    $openedLog = Find-EventLog -Receipt $openReceipt -Contract $Registry -Topic $openedTopic
    $sessionId = [string]$openedLog.topics[1]
    Assert-HexEqual -Actual ([string]$openedLog.topics[2]) -Expected $coverageId -Label 'Opened coverage ID'
    Assert-HexEqual -Actual ([string]$openedLog.topics[3]) -Expected $ProgramId -Label 'Opened program ID'
    $completedAt = Get-BlockTimestamp -Rpc $SepoliaRpc -Block ([string]$openReceipt.blockNumber)
    $lifecycleState['state'] = 'SourceOpened'
    $lifecycleState['sessionId'] = $sessionId
    $lifecycleState['openTransaction'] = [string]$openReceipt.transactionHash
    $lifecycleState['openBlock'] = Convert-HexToUInt64 -Value ([string]$openReceipt.blockNumber)
    Save-LifecycleState -State $lifecycleState -Path $recoveryPath

    $summary = [ordered]@{
        outcome = $Outcome
        programId = $ProgramId
        coverageId = $coverageId
        sessionId = $sessionId
        deadline = [uint64]$deadline
        reserveTransaction = [string]$reserveReceipt.transactionHash
        reserveBlock = Convert-HexToUInt64 -Value ([string]$reserveReceipt.blockNumber)
        openTransaction = [string]$openReceipt.transactionHash
        openBlock = Convert-HexToUInt64 -Value ([string]$openReceipt.blockNumber)
    }

    if ($Outcome -eq 'success') {
        $serviceReceipt = "($sessionId,$coverageId,$minimumUnits,$completedAt,0)"
        $receiptDigest = Invoke-Cast -Arguments @(
            'call', $Registry,
            'serviceReceiptDigest((bytes32,bytes32,uint128,uint64,uint256))(bytes32)',
            $serviceReceipt,
            '--rpc-url', $SepoliaRpc
        )
        $deviceSignature = Sign-Digest -Digest $receiptDigest
        $lifecycleState['state'] = 'SuccessSigned'
        $lifecycleState['serviceReceipt'] = $serviceReceipt
        $lifecycleState['deviceSignature'] = $deviceSignature
        Save-LifecycleState -State $lifecycleState -Path $recoveryPath

        Write-Host 'Settling the successful session on Sepolia.' -ForegroundColor Cyan
        $settleReceipt = Invoke-CastJson -Arguments @(
            'send', '--json',
            '--rpc-url', $SepoliaRpc,
            '--chain', '11155111',
            '--from', $Wallet,
            '--account', $Account,
            '--gas-limit', '350000',
            $Registry,
            'settleSession((bytes32,bytes32,uint128,uint64,uint256),bytes)',
            $serviceReceipt,
            $deviceSignature
        )
        Assert-SuccessfulReceipt -Receipt $settleReceipt -Label 'Session settlement'
        $summary.deliveredUnits = 1
        $summary.completedAt = $completedAt
        $summary.outcomeTransaction = [string]$settleReceipt.transactionHash
        $summary.outcomeBlock = Convert-HexToUInt64 -Value ([string]$settleReceipt.blockNumber)
    }
    else {
        Write-Host "Waiting until the Sepolia block timestamp exceeds deadline $deadline." -ForegroundColor Yellow
        do {
            $sourceTimestamp = Get-BlockTimestamp -Rpc $SepoliaRpc -Block 'latest'
            if ($sourceTimestamp -le $deadline) {
                $remaining = [uint64]($deadline - $sourceTimestamp + 1)
                Write-Host "Approximately $remaining seconds remain."
                Start-Sleep -Seconds ([Math]::Min(15, $remaining))
            }
        } while ($sourceTimestamp -le $deadline)

        Write-Host 'Finalizing the expired session on Sepolia.' -ForegroundColor Cyan
        $failureReceipt = Invoke-CastJson -Arguments @(
            'send', '--json',
            '--rpc-url', $SepoliaRpc,
            '--chain', '11155111',
            '--from', $Wallet,
            '--account', $Account,
            '--gas-limit', '200000',
            $Registry,
            'finalizeFailed(bytes32)',
            $sessionId
        )
        Assert-SuccessfulReceipt -Receipt $failureReceipt -Label 'Failure finalization'
        $summary.outcomeTransaction = [string]$failureReceipt.transactionHash
        $summary.outcomeBlock = Convert-HexToUInt64 -Value ([string]$failureReceipt.blockNumber)
    }

    $sourceOutcomeSubmitted = $true
    $lifecycleState['state'] = 'SourceOutcomeSubmitted'
    $lifecycleState['outcomeTransaction'] = [string]$summary.outcomeTransaction
    $lifecycleState['outcomeBlock'] = [uint64]$summary.outcomeBlock
    Save-LifecycleState -State $lifecycleState -Path $recoveryPath

    Write-Host 'Source lifecycle complete. Save this public summary:' -ForegroundColor Green
    $summary | ConvertTo-Json
}
catch {
    Write-Warning "Post-reservation lifecycle failed: $($_.Exception.Message)"
    if ($null -ne $coverageId) {
        Write-RecoveryCommand `
            -CoverageId $coverageId `
            -SessionId ([string]$sessionId) `
            -Deadline ([string]$deadline) `
            -ServiceReceipt ([string]$serviceReceipt) `
            -DeviceSignature ([string]$deviceSignature) `
            -SourceOutcomeSubmitted $sourceOutcomeSubmitted `
            -StatePath ([string]$recoveryPath)
    }
    else {
        Write-Warning "Inspect reservation transaction $reserveTransaction before retrying."
    }
    throw
}
