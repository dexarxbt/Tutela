<p align="center">
  <img src="apps/web/public/tutela-mark.svg" width="76" alt="Tutela protected passage mark" />
</p>

<h1 align="center">Tutela</h1>
<p align="center"><strong>Service proved · Failure paid</strong></p>
<p align="center">A collateralized warranty layer for DePIN services</p>

<p align="center"><code>v0.01 · active development · testnet deployment pending</code></p>

---

Tutela makes a service promise expensive to break.

A DePIN operator places CTC behind explicit service terms before a customer starts a session. If the service is completed, an Attestcoin-verified source event releases the premium to the operator. If the deadline expires without a valid completion, the same proof path moves the reserved payout and premium refund to the customer.

The repository contains the working local protocol foundation, prover, and product interface. It does **not** yet contain a completed live Sepolia → Creditcoin CC3 settlement. Deployment addresses and evidence remain intentionally empty until those transactions happen.

## Build state

| Area                                  | State           | What that means                                                                                                                        |
| ------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Warranty accounting                   | **Implemented** | CTC bond deposits, payout reservation, cancellation, success, failure, and pull withdrawals are locally tested                         |
| Source session authority              | **Implemented** | EIP-712 customer authorization, authorized-device completion, and permissionless failure finalization are locally tested               |
| Attestcoin verification               | **In progress** | Canonical BlockProver integration and strict event decoding are implemented; live testnet proof submission is pending                  |
| Permissionless prover                 | **In progress** | Durable queue, chain-key lookup, proof acquisition, preflight, retry, and submission paths are implemented; network burn-in is pending |
| Web product                           | **In progress** | Landing, operator workspace, coverage views, wallet awareness, and public receipt format are built with representative preview data    |
| Sepolia deployment                    | **Pending**     | Requires a funded deployment wallet                                                                                                    |
| Creditcoin CC3 deployment             | **Pending**     | Requires a funded deployment wallet                                                                                                    |
| Verified success/failure evidence     | **Pending**     | Will only be published from confirmed end-to-end transactions                                                                          |
| Audit and production hardware binding | **Not started** | v0.01 is unaudited testnet software                                                                                                    |

## The warranty loop

```text
1. OPERATOR BONDS CTC
   TutelaVault records immutable terms and available collateral on Creditcoin CC3

2. CUSTOMER RESERVES COVERAGE
   The premium is paid and the exact failure payout becomes unavailable to the operator

3. DEVICE OPENS THE SESSION
   A customer-signed EIP-712 authorization is recorded by ServiceSessionRegistry on Sepolia

4. SOURCE OUTCOME IS PROVED
   Anyone may carry the Sepolia receipt through Attestcoin and submit it to TutelaVault

5A. SERVICE COMPLETED                 5B. DEADLINE EXPIRED
    reserved bond is released             reserved bond is consumed
    premium is credited to operator       payout + premium are credited to customer
```

The prover is not an oracle and has no settlement privilege. It can relay data, retry work, or disappear. It cannot make the vault accept a source event that fails Tutela’s contract-level checks.

## What the vault actually accepts

`TutelaVault.submitProof` does not equate “cryptographically valid” with “economically authorized.” After calling Attestcoin’s canonical `verifyAndEmit`, the vault checks:

- the configured source chain key;
- a successful, zero-value source transaction;
- the approved registry as both transaction target and event emitter;
- exactly one expected session event;
- the coverage, session, and program identifiers;
- customer, operator, and authorized-device identities;
- terms hash, deadline, and minimum service units;
- delivered units for successful completion;
- transaction-derived proof replay state.

Only then can CTC accounting change.

## Truth boundary

Tutela is careful about what cross-chain proof can establish.

**Attestcoin proves:** a specific transaction and receipt were included on the configured source chain.

**Tutela enforces:** which source contract, event, arguments, identities, and terms are allowed to trigger value movement.

**The device still attests:** the physical measurement itself. A blockchain receipt does not independently prove that electricity, bandwidth, storage, or compute was delivered. Production use requires secure device keys and a hardware trust model that is outside v0.01.

## Why EV charging first

A charging session has the shape Tutela needs:

- a known operator and device;
- a customer-authorized start;
- measurable minimum delivery;
- a bounded completion window;
- a clear failure consequence.

The contracts are service-agnostic, but the current product copy and representative dataset stay focused on EV charging instead of pretending to solve every DePIN category at once.

## v0.01 surface

### Sepolia — `ServiceSessionRegistry`

- EIP-712 customer authorization with nonce replay protection
- one source session per reserved coverage
- completion receipts signed by the program’s authorized device
- minimum-unit and deadline enforcement
- permissionless deterministic failure after expiry

### Creditcoin CC3 — `TutelaVault`

- immutable operator warranty programs
- native CTC bond accounting
- collateral reservation before source activation
- canonical BlockProver `verifyAndEmit` integration
- exact source-event semantic validation
- proof and state-transition replay protection
- pull-based operator and customer withdrawals

### Permissionless prover

- current Sepolia chain-key resolution through `ChainInfo`
- event indexing with a durable cursor
- atomic queue persistence
- Attestcoin proof-builder polling
- source receipt and proof metadata prechecks
- BlockProver preflight
- idempotent retry and redacted structured logs

### Web application

- original Tutela identity and protected-passage mark
- responsive landing page and operator workspace
- program, coverage, activity, and receipt routes
- EIP-1193 wallet connection and Creditcoin network awareness
- ABI-backed program creation, gated until deployment addresses exist
- persistent preview disclosure for representative data
- keyboard focus, reduced-motion, empty, and error states

## Local verification

The current local acceptance run passes:

- **23/23 Foundry tests**
- **1,000 fuzz runs** for configured fuzz cases
- **32,768 invariant calls** with zero invariant-handler reverts
- reserved bond never exceeds total bond
- the vault remains solvent for program collateral and queued claims
- **4/4 prover tests**
- strict TypeScript checks and production builds for protocol, prover, and web
- deployment and evidence schema validation in their honest `pending` state

Contract runtime size at v0.01:

| Contract                 | Runtime size | EIP-170 margin |
| ------------------------ | -----------: | -------------: |
| `ServiceSessionRegistry` |  6,026 bytes |   18,550 bytes |
| `TutelaVault`            | 14,448 bytes |   10,128 bytes |

## Run it

Requirements: Node.js 24+, pnpm 11.20.0, and Foundry 1.7.1.

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm dev
```

Then inspect:

- `/` — protocol narrative
- `/app` — operator and coverage workspace
- `/receipt/TUT-7F3A-0192` — representative public receipt format

The web application is a preview until `VITE_SOURCE_REGISTRY_ADDRESS` and `VITE_TUTELA_VAULT_ADDRESS` point to confirmed deployments.

## Testnet completion path

v0.01 becomes an end-to-end testnet release only after these steps are complete:

1. deploy `ServiceSessionRegistry` to Sepolia;
2. deploy `TutelaVault` to Creditcoin CC3 with the canonical BlockProver;
3. publish complete deployment manifests with explorer-backed fields;
4. create and fund an operator warranty program;
5. execute one successful service lifecycle;
6. execute one deterministic failure lifecycle;
7. publish both source and destination transactions as verified evidence;
8. replace preview records in the product with indexed live state;
9. record the demo and submission materials.

`deployments/*.json` and `evidence/*.json` are strict state boundaries. Pending files cannot contain invented addresses or transaction hashes. Changing them to `deployed` or `verified` requires all evidence fields to pass validation.

## Repository layout

```text
apps/web/                 product interface and public receipts
apps/prover/              permissionless source-event proof worker
contracts/src/source/     Sepolia session authority
contracts/src/cc3/        Creditcoin collateral and settlement vault
contracts/test/           unit, fuzz, adversarial, and invariant coverage
packages/protocol/        shared ABIs, chain constants, types, and schemas
deployments/              pending or confirmed deployment records
evidence/                 pending or verified lifecycle evidence
scripts/                  Forge wrapper and evidence validators
```

## Deliberate exclusions

There is no token, DAO, proxy admin, generic cross-chain executor, trusted relayer role, or AI adjudicator. v0.01 is focused on one primitive: a service warranty backed before use and settled from narrowly authorized cross-chain evidence.

See [`SECURITY.md`](SECURITY.md) before running any testnet deployment. Tutela is MIT licensed and currently unaudited.
