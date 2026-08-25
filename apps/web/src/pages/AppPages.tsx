import { useMemo, useState } from 'react';
import { Contract, BrowserProvider, id, isAddress, parseEther } from 'ethers';
import { ATTESTCOIN, CHAIN_IDS, tutelaVaultAbi } from '@tutela/protocol';
import { Link, useParams } from 'react-router-dom';
import { CopyValue, Definition, Icon, PageHeading, StatusBadge } from '../components';
import { activity, coverages, deploymentReady, findCoverage, previewProgram } from '../data';
import { useWallet } from '../wallet';

function CoverageRow({ coverage }: { coverage: (typeof coverages)[number] }) {
  const label =
    coverage.status === 'service-proved'
      ? 'Service proved'
      : coverage.status === 'failure-paid'
        ? 'Failure paid'
        : 'Protected';
  return (
    <Link className="table-row coverage-row" to={`/app/coverage/${coverage.id}`}>
      <div>
        <strong>{coverage.id}</strong>
        <span>{coverage.location}</span>
      </div>
      <div>
        <span className="table-mobile-label">Program</span>
        <strong>{coverage.programName}</strong>
        <span>{coverage.minimumUnits} minimum</span>
      </div>
      <div>
        <span className="table-mobile-label">Deadline</span>
        <strong>{coverage.deadline.split(' · ')[0]}</strong>
        <span>{coverage.deadline.split(' · ')[1]}</span>
      </div>
      <StatusBadge status={label} />
      <Icon name="arrow" size={17} />
    </Link>
  );
}

export function DashboardPage() {
  return (
    <>
      <PageHeading eyebrow="Protocol overview" title="Good afternoon">
        <span>A clear view of protected service and operator collateral.</span>
      </PageHeading>
      <section className="metric-grid">
        <article className="metric-card metric-card--primary">
          <span>Active protection</span>
          <strong>
            27,000 <small>CTC</small>
          </strong>
          <div>
            <span>225 sessions reserved</span>
            <i>Preview</i>
          </div>
        </article>
        <article className="metric-card">
          <span>Services proved</span>
          <strong>1,284</strong>
          <div>
            <span>98.7% successful</span>
            <i>Preview</i>
          </div>
        </article>
        <article className="metric-card">
          <span>Failure compensation</span>
          <strong>
            3,720 <small>CTC</small>
          </strong>
          <div>
            <span>31 customers credited</span>
            <i>Preview</i>
          </div>
        </article>
      </section>
      <section className="dashboard-grid">
        <article className="panel exposure-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Bond position</span>
              <h2>Coverage capacity</h2>
            </div>
            <Link to={`/app/programs/${previewProgram.id}`}>
              View program <Icon name="arrow" size={16} />
            </Link>
          </div>
          <div className="bond-value">
            <strong>125,000 CTC</strong>
            <span>Total operator bond</span>
          </div>
          <div className="bond-bar">
            <span style={{ width: '21.6%' }} />
          </div>
          <div className="bond-legend">
            <div>
              <i className="legend-dot legend-dot--dark" />
              <span>Reserved</span>
              <strong>27,000 CTC</strong>
            </div>
            <div>
              <i className="legend-dot legend-dot--lime" />
              <span>Available</span>
              <strong>98,000 CTC</strong>
            </div>
          </div>
        </article>
        <article className="panel route-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Proof route</span>
              <h2>Settlement health</h2>
            </div>
            <StatusBadge status="Ready" />
          </div>
          <div className="mini-route">
            <div>
              <Icon name="bolt" />
              <span>Sepolia</span>
              <strong>Session registry</strong>
            </div>
            <span className="mini-route__line">
              <i />
              <i />
              <i />
            </span>
            <div className="mini-route__middle">
              <Icon name="check" />
              <span>Attestcoin</span>
              <strong>Receipt proof</strong>
            </div>
            <span className="mini-route__line">
              <i />
              <i />
              <i />
            </span>
            <div>
              <Icon name="coverage" />
              <span>Creditcoin</span>
              <strong>Vault settlement</strong>
            </div>
          </div>
          <p className="panel-note">
            The prover is permissionless. Contract semantics—not the worker—authorize settlement.
          </p>
        </article>
      </section>
      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Recent protection</span>
            <h2>Coverage sessions</h2>
          </div>
          <Link to="/app/coverage">
            View all <Icon name="arrow" size={16} />
          </Link>
        </div>
        <div className="table-head coverage-head">
          <span>Coverage</span>
          <span>Program</span>
          <span>Deadline</span>
          <span>Status</span>
          <span />
        </div>
        {coverages.map((coverage) => (
          <CoverageRow key={coverage.id} coverage={coverage} />
        ))}
      </section>
    </>
  );
}

export function ProgramsPage() {
  return (
    <>
      <PageHeading
        eyebrow="Operator programs"
        title="Programs"
        action={
          <Link className="button button--green" to="/app/programs/new">
            <Icon name="plus" size={17} />
            New program
          </Link>
        }
      >
        Bonded warranty terms for service operators.
      </PageHeading>
      <div className="filter-line">
        <span>1 program</span>
        <div>
          <button className="filter-chip filter-chip--active">All</button>
          <button className="filter-chip">Active</button>
          <button className="filter-chip">Paused</button>
        </div>
      </div>
      <Link className="program-card" to={`/app/programs/${previewProgram.id}`}>
        <div className="program-card__top">
          <div className="program-symbol">
            <Icon name="bolt" />
          </div>
          <div>
            <StatusBadge status="Active" />
            <h2>{previewProgram.name}</h2>
            <p>
              {previewProgram.category} · {previewProgram.locations} protected locations
            </p>
          </div>
          <Icon name="arrow" />
        </div>
        <div className="program-card__stats">
          <div>
            <span>Total bond</span>
            <strong>{previewProgram.totalBond}</strong>
          </div>
          <div>
            <span>Reserved</span>
            <strong>{previewProgram.reservedBond}</strong>
          </div>
          <div>
            <span>Failure payout</span>
            <strong>{previewProgram.payout}</strong>
          </div>
          <div>
            <span>Premium</span>
            <strong>{previewProgram.premium}</strong>
          </div>
        </div>
        <div className="program-card__footer">
          <span>Source registry</span>
          <CopyValue
            value="0x0000000000000000000000000000000000000000"
            display="Deployment pending"
          />
        </div>
      </Link>
    </>
  );
}

export function ProgramDetailPage() {
  const { programId } = useParams();
  return (
    <>
      <div className="breadcrumb">
        <Link to="/app/programs">Programs</Link>
        <span>/</span>
        <span>{programId}</span>
      </div>
      <PageHeading
        eyebrow="Operator program"
        title={previewProgram.name}
        action={<StatusBadge status="Active" />}
      >
        EV charging protection backed by a reserved CTC bond.
      </PageHeading>
      <section className="program-hero panel">
        <div className="program-hero__balance">
          <span>Available coverage capacity</span>
          <strong>{previewProgram.availableBond}</strong>
          <small>Supports up to 816 additional failure guarantees.</small>
        </div>
        <div className="capacity-donut" style={{ '--capacity': '78.4%' } as React.CSSProperties}>
          <div>
            <strong>78.4%</strong>
            <span>available</span>
          </div>
        </div>
      </section>
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Warranty terms</span>
              <h2>Economic parameters</h2>
            </div>
          </div>
          <dl className="definition-list">
            <Definition label="Customer premium" value={previewProgram.premium} />
            <Definition label="Failure payout" value={previewProgram.payout} />
            <Definition label="Maximum session" value={previewProgram.sessionDuration} />
            <Definition label="Minimum service" value={previewProgram.minimumUnits} />
            <Definition
              label="Terms hash"
              value={
                <CopyValue
                  value={previewProgram.termsHash}
                  display={`${previewProgram.termsHash.slice(0, 10)}…${previewProgram.termsHash.slice(-8)}`}
                />
              }
              mono
            />
          </dl>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Source authority</span>
              <h2>Service attestation</h2>
            </div>
          </div>
          <dl className="definition-list">
            <Definition label="Source chain" value="Ethereum Sepolia" />
            <Definition label="Attestcoin chain key" value="10" mono />
            <Definition label="Session registry" value="Deployment pending" />
            <Definition label="Authorized device" value={previewProgram.device} mono />
            <Definition label="Operator" value={previewProgram.operator} mono />
          </dl>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Related coverage</span>
            <h2>Recent sessions</h2>
          </div>
          <Link to="/app/coverage">
            View all <Icon name="arrow" size={16} />
          </Link>
        </div>
        {coverages.map((coverage) => (
          <CoverageRow key={coverage.id} coverage={coverage} />
        ))}
      </section>
    </>
  );
}

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
const initialForm: FormState = {
  name: '',
  sourceRegistry: '',
  device: '',
  premium: '6',
  payout: '120',
  duration: '2700',
  units: '18',
  bond: '25000',
  terms: 'EV charging service warranty v1',
};

export function NewProgramPage() {
  const [form, setForm] = useState(initialForm);
  const [txState, setTxState] = useState<'idle' | 'signing' | 'submitted' | 'error'>('idle');
  const [txMessage, setTxMessage] = useState('');
  const { address, chainId } = useWallet();
  const vaultAddress = import.meta.env.VITE_TUTELA_VAULT_ADDRESS as string | undefined;
  const update =
    (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((value) => ({ ...value, [key]: event.target.value }));
  const validation = useMemo(() => {
    if (!form.name.trim()) return 'Enter a program name.';
    if (!isAddress(form.sourceRegistry)) return 'Enter a valid Sepolia registry address.';
    if (!isAddress(form.device)) return 'Enter a valid authorized device address.';
    if (
      [form.premium, form.payout, form.duration, form.units, form.bond].some(
        (value) => !value || Number(value) <= 0
      )
    )
      return 'All economic values must be greater than zero.';
    return null;
  }, [form]);
  const canSubmit =
    deploymentReady &&
    address &&
    chainId === CHAIN_IDS.cc3Testnet &&
    !validation &&
    txState !== 'signing';
  async function createProgram() {
    if (!canSubmit || !vaultAddress || !window.ethereum) return;
    setTxState('signing');
    setTxMessage('Confirm the program bond in your wallet.');
    try {
      const provider = new BrowserProvider(window.ethereum as never);
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
      setTxMessage(`Submitted ${transaction.hash}. Waiting for Creditcoin confirmation.`);
      await transaction.wait();
      setTxMessage(`Program confirmed in transaction ${transaction.hash}.`);
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
      <PageHeading eyebrow="Operator setup" title="Create a protection program">
        Define the service promise and back every failure guarantee with CTC.
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
              <span>Program name</span>
              <input
                value={form.name}
                onChange={update('name')}
                placeholder="e.g. Voltway Urban Charge"
              />
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
                <input type="number" min="0" value={form.premium} onChange={update('premium')} />
              </label>
              <label>
                <span>Failure payout · CTC</span>
                <input type="number" min="0" value={form.payout} onChange={update('payout')} />
              </label>
              <label>
                <span>Initial bond · CTC</span>
                <input type="number" min="0" value={form.bond} onChange={update('bond')} />
              </label>
            </div>
            <div className="field-grid">
              <label>
                <span>Session duration · seconds</span>
                <input type="number" min="1" value={form.duration} onChange={update('duration')} />
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
              <textarea rows={4} value={form.terms} onChange={update('terms')} />
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
              ) : chainId !== 102031 ? (
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
            <span className="eyebrow">Protection equation</span>
            <strong>
              Available bond ≥<br />
              active payouts
            </strong>
            <p>
              The vault rejects new coverage when collateral is insufficient. Premiums never count
              toward available bond.
            </p>
          </div>
          <ol>
            <li>
              <span>1</span>Program terms are immutable.
            </li>
            <li>
              <span>2</span>Bond remains operator-owned but reserved.
            </li>
            <li>
              <span>3</span>Claims use pull payments to prevent reentrancy.
            </li>
          </ol>
        </aside>
      </div>
    </>
  );
}

export function CoveragePage() {
  return (
    <>
      <PageHeading eyebrow="Customer protection" title="Coverage">
        Every reserved promise and its source-to-settlement state.
      </PageHeading>
      <div className="filter-line">
        <span>{coverages.length} preview sessions</span>
        <div>
          <button className="filter-chip filter-chip--active">All</button>
          <button className="filter-chip">Protected</button>
          <button className="filter-chip">Settled</button>
        </div>
      </div>
      <section className="panel coverage-table">
        <div className="table-head coverage-head">
          <span>Coverage</span>
          <span>Program</span>
          <span>Deadline</span>
          <span>Status</span>
          <span />
        </div>
        {coverages.map((coverage) => (
          <CoverageRow key={coverage.id} coverage={coverage} />
        ))}
      </section>
    </>
  );
}

export function CoverageDetailPage() {
  const { coverageId } = useParams();
  const coverage = findCoverage(coverageId);
  if (!coverage) return <EmptyCoverage />;
  const success = coverage.status === 'service-proved';
  const failed = coverage.status === 'failure-paid';
  const label = success ? 'Service proved' : failed ? 'Failure paid' : 'Protected';
  return (
    <>
      <div className="breadcrumb">
        <Link to="/app/coverage">Coverage</Link>
        <span>/</span>
        <span>{coverage.id}</span>
      </div>
      <PageHeading
        eyebrow="Coverage session"
        title={coverage.id}
        action={<StatusBadge status={label} />}
      >
        {coverage.location} · {coverage.programName}
      </PageHeading>
      <section className={`outcome-card outcome-card--${coverage.status}`}>
        <div>
          <span>
            {success
              ? 'Verified service outcome'
              : failed
                ? 'Automatic compensation'
                : 'Economic protection active'}
          </span>
          <strong>
            {success
              ? `${coverage.deliveredUnits} delivered`
              : failed
                ? `${Number.parseInt(coverage.payout) + Number.parseInt(coverage.premium)} CTC credited`
                : `${coverage.payout} reserved`}
          </strong>
          <p>
            {success
              ? 'The authorized device receipt met the minimum service terms.'
              : failed
                ? 'The deadline elapsed without a valid completion receipt.'
                : 'Collateral is locked until service success or deterministic failure.'}
          </p>
        </div>
        <div className="outcome-seal">
          <Icon name={failed ? 'activity' : success ? 'check' : 'coverage'} size={34} />
        </div>
      </section>
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Lifecycle</span>
              <h2>Protected passage</h2>
            </div>
          </div>
          <div className="timeline">
            <TimelineItem
              state="complete"
              title="Coverage reserved"
              detail={`${coverage.payout} removed from available operator bond.`}
            />
            <TimelineItem
              state="complete"
              title="Session activated"
              detail="Customer authorization and source event matched."
            />
            <TimelineItem
              state={coverage.status === 'protected' ? 'current' : 'complete'}
              title={success ? 'Service proved' : failed ? 'Failure finalized' : 'Awaiting outcome'}
              detail={
                success
                  ? `${coverage.deliveredUnits} verified against ${coverage.minimumUnits} minimum.`
                  : failed
                    ? 'Permissionless finalization proved the expired session.'
                    : `Deadline: ${coverage.deadline}.`
              }
            />
            <TimelineItem
              state={coverage.status === 'protected' ? 'waiting' : 'complete'}
              title="Economic settlement"
              detail={
                success
                  ? `${coverage.premium} released to operator.`
                  : failed
                    ? `${coverage.payout} + ${coverage.premium} credited to customer.`
                    : 'Pending a valid source outcome.'
              }
            />
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Committed terms</span>
              <h2>Session parameters</h2>
            </div>
          </div>
          <dl className="definition-list">
            <Definition label="Customer" value={coverage.customer} mono />
            <Definition label="Operator" value={coverage.operator} mono />
            <Definition label="Device" value={coverage.device} mono />
            <Definition label="Minimum service" value={coverage.minimumUnits} />
            <Definition label="Deadline" value={coverage.deadline} />
            <Definition
              label="Terms"
              value={
                <CopyValue
                  value={coverage.termsHash}
                  display={`${coverage.termsHash.slice(0, 10)}…${coverage.termsHash.slice(-8)}`}
                />
              }
              mono
            />
          </dl>
        </section>
      </div>
      <section className="panel proof-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Cross-chain evidence</span>
            <h2>Proof envelope</h2>
          </div>
          <Link to={`/receipt/${coverage.id}`}>
            Public receipt <Icon name="external" size={15} />
          </Link>
        </div>
        {coverage.proofId ? (
          <div className="proof-grid">
            <Definition label="Source chain" value="Ethereum Sepolia" />
            <Definition label="Source block" value={coverage.sourceBlock} />
            <Definition
              label="Source transaction"
              value={
                <CopyValue
                  value={coverage.sourceTransaction!}
                  display={`${coverage.sourceTransaction!.slice(0, 12)}…${coverage.sourceTransaction!.slice(-10)}`}
                />
              }
              mono
            />
            <Definition
              label="Attestcoin proof ID"
              value={
                <CopyValue
                  value={coverage.proofId}
                  display={`${coverage.proofId.slice(0, 12)}…${coverage.proofId.slice(-10)}`}
                />
              }
              mono
            />
          </div>
        ) : (
          <div className="empty-inline">
            <Icon name="clock" />
            <div>
              <strong>Proof not available yet</strong>
              <span>This active session has not reached its outcome.</span>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function TimelineItem({
  state,
  title,
  detail,
}: {
  state: 'complete' | 'current' | 'waiting';
  title: string;
  detail: string;
}) {
  return (
    <div className={`timeline-item timeline-item--${state}`}>
      <span className="timeline-marker">
        {state === 'complete' ? <Icon name="check" size={14} /> : ''}
      </span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}
function EmptyCoverage() {
  return (
    <div className="empty-state">
      <div>
        <Icon name="coverage" size={28} />
      </div>
      <h1>Coverage not found</h1>
      <p>This identifier is not present in the local preview dataset.</p>
      <Link className="button button--green" to="/app/coverage">
        Return to coverage
      </Link>
    </div>
  );
}

export function ActivityPage() {
  return (
    <>
      <PageHeading eyebrow="Protocol events" title="Activity">
        A human-readable ledger of economic state transitions.
      </PageHeading>
      <section className="panel activity-panel">
        <div className="activity-date">Today</div>
        {activity.map((entry) => (
          <div className="activity-row" key={`${entry.action}-${entry.coverage}`}>
            <span className={`activity-icon activity-icon--${entry.tone}`}>
              <Icon
                name={
                  entry.tone === 'success'
                    ? 'check'
                    : entry.tone === 'paid'
                      ? 'activity'
                      : entry.tone === 'active'
                        ? 'coverage'
                        : 'plus'
                }
                size={17}
              />
            </span>
            <div>
              <strong>{entry.action}</strong>
              <span>{entry.detail}</span>
            </div>
            <Link
              to={
                entry.coverage.startsWith('TUT-')
                  ? `/app/coverage/${entry.coverage}`
                  : `/app/programs/${previewProgram.id}`
              }
            >
              {entry.coverage}
            </Link>
            <time>{entry.time}</time>
          </div>
        ))}
      </section>
    </>
  );
}
