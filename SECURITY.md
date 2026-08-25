# Security

Tutela is a testnet prototype. It has not received an independent audit and must not custody production value.

## Security model

The protocol minimizes discretionary authority:

- contracts are non-upgradeable and expose no arbitrary execution;
- proof submission is permissionless—the prover has no settlement privilege;
- the vault accepts only the configured source chain, registry, and exact event semantics;
- program collateral is reserved before a source session can activate;
- completion requires an EIP-712 signature from the program's authorized device;
- failure is finalized only after the committed deadline;
- source transactions and proof envelopes are replay-protected;
- value exits through checks-effects-interactions pull withdrawals.

## Trust boundaries

Attestcoin proves inclusion and receipt data for a source-chain transaction. It does not independently prove that electricity, bandwidth, compute, or another physical service was delivered. Tutela treats the authorized device key and its measurement integrity as an external assumption. Operators must secure device keys and bind them to trustworthy hardware before production use.

Public RPC endpoints, the proof builder, indexer availability, and the permissionless prover affect liveness, not settlement authorization. A malicious worker may delay or submit invalid data, but cannot cause a valid vault transition without a proof and exact semantic match.

## Known testnet limitations

- No independent audit or formal verification.
- No production hardware attestation or key-rotation scheme.
- No source-chain reorganization delay beyond the proof system's guarantees.
- No emergency pause; this avoids admin custody but makes deployed mistakes irreversible.
- CTC accounting assumes native-currency behavior on Creditcoin CC3.

## Reporting a vulnerability

Open a private GitHub security advisory for the repository. Include affected code, impact, reproduction steps, and a minimal proof of concept. Do not include private keys, funded mnemonics, or exploit public testnet contracts before maintainers can respond.
