import { ATTESTCOIN, CHAIN_IDS, tutelaVaultAbi } from '@tutela/protocol';
import { BrowserProvider, Contract, id, isAddress, parseEther } from 'ethers';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeading } from '../components';
import {
  deploymentReady,
  sourceRegistryAddress,
  tutelaVaultAddress,
  verifiedProgram,
} from '../data';
import { useWallet } from '../wallet';

type FormState = {
  name: string;
  sourceRegistry: string;
  device: string;
  premium: string;
  payout: string;
  duration: string;
  units: string;
  bond: string;
  terms: string;
};

function ctcInput(value: string) {
  return value.replace(/ CTC$/, '');
}

const initialForm: FormState = {
  name: verifiedProgram.name,
  sourceRegistry: sourceRegistryAddress,
  device: verifiedProgram.device,
  premium: ctcInput(verifiedProgram.premium),
  payout: ctcInput(verifiedProgram.payout),
  duration: '',
  units: verifiedProgram.minimumUnits.split(' ')[0] ?? '',
  bond: ctcInput(verifiedProgram.initialBond),
  terms: '',
};

export function NewProgramPage() {
  const [form, setForm] = useState(initialForm);
  const [txState, setTxState] = useState<'idle' | 'signing' | 'submitted' | 'error'>('idle');
  const [txMessage, setTxMessage] = useState('');
  const { address, chainId, selectedProvider } = useWallet();
  const vaultAddress = tutelaVaultAddress;
  const update =
    (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((value) => ({ ...value, [key]: event.target.value }));
  const validation = useMemo(() => {
    if (!form.name.trim()) return 'Enter a local program label.';
    if (!isAddress(form.sourceRegistry)) return 'Enter a valid Sepolia registry address.';
    if (!isAddress(form.device)) return 'Enter a valid authorized device address.';
    if (
      [form.premium, form.payout, form.duration, form.units, form.bond].some(
        (value) => !value || Number(value) <= 0
      )
    )
      return 'All economic values and the duration must be greater than zero.';
    if (!form.terms.trim()) return 'Enter the exact canonical terms to commit on-chain.';
    return null;
  }, [form]);
  const canSubmit =
    deploymentReady &&
    address &&
    chainId === CHAIN_IDS.cc3Testnet &&
    !validation &&
    txState !== 'signing';

  async function createProgram() {
    if (!canSubmit || !vaultAddress || !selectedProvider) return;
    setTxState('signing');
    setTxMessage('Confirm the program bond in your wallet.');
    try {
      const provider = new BrowserProvider(selectedProvider as never);
      const signer = await provider.getSigner();
      const vault = new Contract(vaultAddress, tutelaVaultAbi, signer);
      const createProgramCall = vault.getFunction('createProgram');
      const transaction = await createProgramCall(
        form.sourceRegistry,
        form.device,
        ATTESTCOIN.expectedSepoliaChainKey,
        parseEther(form.premium),
        parseEther(form.payout),
        BigInt(form.duration),
        BigInt(form.units),
        id(form.terms),
        { value: parseEther(form.bond) }
      );
      setTxState('submitted');
      setTxMessage(
        `Submitted ${transaction.hash}. Waiting for Creditcoin confirmation; this evidence view will not index the write automatically.`
      );
      await transaction.wait();
      setTxMessage(
        `Program confirmed in transaction ${transaction.hash}. Publish and validate a new evidence manifest before it appears in this app.`
      );
    } catch (reason) {
      setTxState('error');
      setTxMessage(reason instanceof Error ? reason.message : 'Program creation failed.');
    }
  }

  return (
    <>
      <div className="breadcrumb">
        <Link to="/app/programs">Programs</Link>
        <span>/</span>
        <span>New program</span>
      </div>
      <PageHeading eyebrow="Operator write flow" title="Create a protection program">
        Submit a real Creditcoin CC3 transaction. Evidence-derived values are prefilled only where
        the published snapshot makes them recoverable.
      </PageHeading>
      <div className="form-layout">
        <form
          className="panel program-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createProgram();
          }}
        >
          <fieldset>
            <legend>Program identity</legend>
            <label>
              <span>Program label · local display only</span>
              <input value={form.name} onChange={update('name')} placeholder="Program label" />
            </label>
            <div className="field-grid">
              <label>
                <span>Sepolia registry address</span>
                <input
                  className="mono"
                  value={form.sourceRegistry}
                  onChange={update('sourceRegistry')}
                  placeholder="0x…"
                />
              </label>
              <label>
                <span>Authorized device address</span>
                <input
                  className="mono"
                  value={form.device}
                  onChange={update('device')}
                  placeholder="0x…"
                />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Warranty economics</legend>
            <div className="field-grid field-grid--three">
              <label>
                <span>Premium · CTC</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.premium}
                  onChange={update('premium')}
                />
              </label>
              <label>
                <span>Failure payout · CTC</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.payout}
                  onChange={update('payout')}
                />
              </label>
              <label>
                <span>Initial bond · CTC</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.bond}
                  onChange={update('bond')}
                />
              </label>
            </div>
            <div className="field-grid">
              <label>
                <span>Session duration · seconds</span>
                <input
                  type="number"
                  min="1"
                  value={form.duration}
                  onChange={update('duration')}
                  placeholder="Required; not recoverable from snapshot"
                />
              </label>
              <label>
                <span>Minimum service units</span>
                <input type="number" min="1" value={form.units} onChange={update('units')} />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Terms commitment</legend>
            <label>
              <span>Canonical terms</span>
              <textarea
                rows={4}
                value={form.terms}
                onChange={update('terms')}
                placeholder="Required; the evidence stores only the existing terms hash"
              />
              <small>
                Committed on-chain as <span className="mono">keccak256(terms)</span>. Store the
                human-readable terms independently.
              </small>
            </label>
          </fieldset>
          <div className="form-submit">
            <div>
              {!deploymentReady ? (
                <>
                  <strong>Deployment required</strong>
                  <span>Configure both contract addresses to enable this on-chain action.</span>
                </>
              ) : !address ? (
                <>
                  <strong>Wallet required</strong>
                  <span>Connect an operator wallet to continue.</span>
                </>
              ) : chainId !== CHAIN_IDS.cc3Testnet ? (
                <>
                  <strong>Creditcoin CC3 required</strong>
                  <span>Switch networks from the header.</span>
                </>
              ) : validation ? (
                <>
                  <strong>Complete required fields</strong>
                  <span>{validation}</span>
                </>
              ) : (
                <>
                  <strong>Ready to create</strong>
                  <span>Your initial bond will be sent with the transaction.</span>
                </>
              )}
            </div>
            <button className="button button--green" type="submit" disabled={!canSubmit}>
              {txState === 'signing' ? 'Confirming…' : 'Create program'}
            </button>
          </div>
          {txMessage && (
            <p className={`transaction-message transaction-message--${txState}`} role="status">
              {txMessage}
            </p>
          )}
        </form>
        <aside className="form-aside">
          <div>
            <span className="eyebrow">Write boundary</span>
            <strong>
              On-chain write ≠<br />
              indexed evidence
            </strong>
            <p>
              The transaction changes the deployed vault. This static app displays only manifests
              that have been separately captured and validated.
            </p>
          </div>
          <ol>
            <li>
              <span>1</span>Review every prefilled testnet value.
            </li>
            <li>
              <span>2</span>Provide duration and canonical terms explicitly.
            </li>
            <li>
              <span>3</span>Publish validated evidence to update the read views.
            </li>
          </ol>
        </aside>
      </div>
    </>
  );
}
