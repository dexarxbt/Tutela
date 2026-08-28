import { Link, useParams } from 'react-router-dom';
import { CopyValue, Definition, Icon, PageHeading, StatusBadge } from '../components';
import {
  activity,
  coverages,
  evidenceCounts,
  failedLifecycle,
  findCoverage,
  shortHash,
  verifiedProgram,
} from '../data';

function ExplorerTransaction({
  href,
  hash,
  label,
}: {
  href: string;
  hash: string;
  label?: string;
}) {
  return (
    <a
      className="external-transaction mono"
      href={href}
      target="_blank"
      rel="noreferrer"
      title={hash}
    >
      <span>{label ?? shortHash(hash, 14, 10)}</span>
      <Icon name="external" size={14} />
    </a>
  );
}

function CoverageRow({ coverage }: { coverage: (typeof coverages)[number] }) {
  return (
    <Link className="table-row coverage-row" to={`/app/coverage/${coverage.id}`}>
      <div>
        <strong className="mono" title={coverage.id}>
          {shortHash(coverage.id)}
        </strong>
        <span>{coverage.route}</span>
      </div>
      <div>
        <span className="table-mobile-label">Outcome</span>
        <strong>{coverage.outcome === 'success' ? 'Service delivered' : 'Deadline expired'}</strong>
        <span>{coverage.minimumUnits} minimum</span>
      </div>
      <div>
        <span className="table-mobile-label">Settlement</span>
        <strong>CC3 block {coverage.destination.blockNumber.toLocaleString('en-US')}</strong>
        <span>Sepolia block {coverage.source.blockNumber.toLocaleString('en-US')}</span>
      </div>
      <StatusBadge status={coverage.statusLabel} />
      <Icon name="arrow" size={17} />
    </Link>
  );
}

function CoverageTableHeading() {
  return (
    <div className="table-head coverage-head">
      <span>Coverage</span>
      <span>Outcome</span>
      <span>Settlement</span>
      <span>Status</span>
      <span />
    </div>
  );
}

export function DashboardPage() {
  return (
    <>
      <PageHeading eyebrow="Verified testnet evidence" title="Evidence overview">
        <span>
          Repository-published {evidenceCounts.success} success and {evidenceCounts.failure} failure
          snapshots from Sepolia to Creditcoin CC3.
        </span>
      </PageHeading>
      <section className="metric-grid">
        <article className="metric-card metric-card--primary">
          <span>Published lifecycles</span>
          <strong>{coverages.length}</strong>
          <div>
            <span>
              {evidenceCounts.success} success · {evidenceCounts.failure} failure
            </span>
            <i>Verified</i>
          </div>
        </article>
        <article className="metric-card">
          <span>Recorded operator bond</span>
          <strong>{verifiedProgram.recordedBond}</strong>
          <div>
            <span>After the featured failure settlement</span>
            <i>Snapshot</i>
          </div>
        </article>
        <article className="metric-card">
          <span>Featured failure customer credit</span>
          <strong>{failedLifecycle.customerCredit}</strong>
          <div>
            <span>CC3 block {failedLifecycle.destination.blockNumber.toLocaleString('en-US')}</span>
            <i>Verified</i>
          </div>
        </article>
      </section>
      <section className="dashboard-grid">
        <article className="panel exposure-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Observed balance effects</span>
              <h2>Operator bond snapshots</h2>
            </div>
            <Link to={`/app/programs/${verifiedProgram.id}`}>
              View program <Icon name="arrow" size={16} />
            </Link>
          </div>
          <div className="bond-value">
            <strong>{verifiedProgram.recordedBond}</strong>
            <span>Recorded after the featured verified failure settlement</span>
          </div>
          <div className="bond-legend">
            <div>
              <i className="legend-dot legend-dot--lime" />
              <span>Initial observed bond</span>
              <strong>{verifiedProgram.initialBond}</strong>
            </div>
            <div>
              <i className="legend-dot legend-dot--dark" />
              <span>Featured failure payout deducted</span>
              <strong>{verifiedProgram.payout}</strong>
            </div>
          </div>
          <p className="panel-note">
            These are evidence-manifest snapshots, not a live query of current vault capacity.
          </p>
        </article>
        <article className="panel route-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Evidence route</span>
              <h2>Published settlement path</h2>
            </div>
            <StatusBadge status="Evidence verified" />
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
              <strong>Receipt transport</strong>
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
            Explorer links expose both transactions. The static app does not re-query either chain.
          </p>
        </article>
      </section>
      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Published evidence</span>
            <h2>Verified lifecycles</h2>
          </div>
          <Link to="/app/coverage">
            View all <Icon name="arrow" size={16} />
          </Link>
        </div>
        <CoverageTableHeading />
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
        eyebrow="Evidence-backed program"
        title="Programs"
        action={
          <Link className="button button--green" to="/app/programs/new">
            <Icon name="plus" size={17} />
            New program
          </Link>
        }
      >
        The program referenced by {evidenceCounts.total} published testnet lifecycle receipts.
      </PageHeading>
      <div className="filter-line">
        <span>1 evidenced program · {verifiedProgram.lifecycleCount} verified lifecycles</span>
      </div>
      <Link className="program-card" to={`/app/programs/${verifiedProgram.id}`}>
        <div className="program-card__top">
          <div className="program-symbol">
            <Icon name="bolt" />
          </div>
          <div>
            <StatusBadge status="Evidence snapshot" />
            <h2>{verifiedProgram.name}</h2>
            <p className="mono" title={verifiedProgram.id}>
              {shortHash(verifiedProgram.id, 14, 10)}
            </p>
          </div>
          <Icon name="arrow" />
        </div>
        <div className="program-card__stats">
          <div>
            <span>Initial observed bond</span>
            <strong>{verifiedProgram.initialBond}</strong>
          </div>
          <div>
            <span>Recorded after featured failure</span>
            <strong>{verifiedProgram.recordedBond}</strong>
          </div>
          <div>
            <span>Featured failure payout</span>
            <strong>{verifiedProgram.payout}</strong>
          </div>
          <div>
            <span>Success premium delta</span>
            <strong>{verifiedProgram.premium}</strong>
          </div>
        </div>
        <div className="program-card__footer">
          <span>Source registry</span>
          <CopyValue
            value={verifiedProgram.sourceRegistry}
            display={`${verifiedProgram.sourceRegistry.slice(0, 10)}…${verifiedProgram.sourceRegistry.slice(-8)}`}
          />
        </div>
      </Link>
    </>
  );
}

export function ProgramDetailPage() {
  const { programId } = useParams();
  if (programId?.toLowerCase() !== verifiedProgram.id.toLowerCase()) return <EmptyProgram />;
  return (
    <>
      <div className="breadcrumb">
        <Link to="/app/programs">Programs</Link>
        <span>/</span>
        <span className="mono">{shortHash(verifiedProgram.id)}</span>
      </div>
      <PageHeading
        eyebrow="Evidence-backed program"
        title={verifiedProgram.name}
        action={<StatusBadge status="Evidence snapshot" />}
      >
        A static view of the exact program ID and balance effects in the published evidence.
      </PageHeading>
      <section className="program-hero panel">
        <div className="program-hero__balance">
          <span>Initial observed operator bond</span>
          <strong>{verifiedProgram.initialBond}</strong>
          <small>Recorded in the verified success manifest.</small>
        </div>
        <div className="program-hero__balance program-hero__balance--right">
          <span>Bond after featured verified failure</span>
          <strong>{verifiedProgram.recordedBond}</strong>
          <small>This snapshot is not a live capacity reading.</small>
        </div>
      </section>
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Observed terms</span>
              <h2>Economic parameters</h2>
            </div>
          </div>
          <dl className="definition-list">
            <Definition label="Success premium delta" value={verifiedProgram.premium} />
            <Definition label="Featured failure payout" value={verifiedProgram.payout} />
            <Definition label="Minimum service" value={verifiedProgram.minimumUnits} />
            <Definition
              label="Published lifecycles"
              value={String(verifiedProgram.lifecycleCount)}
            />
            <Definition label="Program ID" value={<CopyValue value={verifiedProgram.id} />} mono />
            <Definition
              label="Terms hash"
              value={<CopyValue value={verifiedProgram.termsHash} />}
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
            <Definition
              label="Attestcoin chain key"
              value={String(verifiedProgram.sourceChainKey)}
              mono
            />
            <Definition
              label="Session registry"
              value={<CopyValue value={verifiedProgram.sourceRegistry} />}
              mono
            />
            <Definition label="Authorized device" value={verifiedProgram.device} mono />
            <Definition label="Operator" value={verifiedProgram.operator} mono />
          </dl>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Published evidence</span>
            <h2>Related lifecycles</h2>
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

export function CoveragePage() {
  return (
    <>
      <PageHeading eyebrow="Explorer-backed snapshots" title="Coverage evidence">
        The {evidenceCounts.total} settled lifecycles published in the repository evidence
        manifests.
      </PageHeading>
      <div className="filter-line">
        <span>{coverages.length} verified lifecycles · no live indexer connected</span>
      </div>
      <section className="panel coverage-table">
        <CoverageTableHeading />
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
  const success = coverage.outcome === 'success';
  return (
    <>
      <div className="breadcrumb">
        <Link to="/app/coverage">Coverage</Link>
        <span>/</span>
        <span className="mono">{shortHash(coverage.id)}</span>
      </div>
      <PageHeading
        eyebrow="Verified coverage evidence"
        title={shortHash(coverage.id, 14, 10)}
        action={<StatusBadge status={coverage.statusLabel} />}
      >
        {coverage.route} · {coverage.programName}
      </PageHeading>
      <section className={`outcome-card outcome-card--${coverage.status}`}>
        <div>
          <span>{success ? 'Verified service outcome' : 'Verified failure settlement'}</span>
          <strong>
            {success
              ? `${coverage.deliveredUnits} delivered`
              : `${coverage.customerCredit} credited`}
          </strong>
          <p>
            {success
              ? 'The published source semantics meet the committed minimum service units.'
              : 'The published balance effects record the payout and premium refund credited after expiry.'}
          </p>
        </div>
        <div className="outcome-seal">
          <Icon name={success ? 'check' : 'activity'} size={34} />
        </div>
      </section>
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Evidence lifecycle</span>
              <h2>Published passage</h2>
            </div>
          </div>
          <div className="timeline">
            <TimelineItem
              title="Source transaction recorded"
              detail={`Sepolia block ${coverage.source.blockNumber.toLocaleString('en-US')} contains the published source transaction.`}
            />
            <TimelineItem
              title="Committed semantics matched"
              detail={`${coverage.minimumUnits} minimum · deadline ${coverage.deadline}.`}
            />
            <TimelineItem
              title={success ? 'Success settled' : 'Failure settled'}
              detail={`Creditcoin CC3 block ${coverage.destination.blockNumber.toLocaleString('en-US')} records the destination transaction.`}
            />
            <TimelineItem
              title="Balance effects captured"
              detail={
                success
                  ? `${coverage.premium} claimable delta recorded; operator bond unchanged.`
                  : `${coverage.customerCredit} customer credit recorded; bond decreased by ${coverage.payout}.`
              }
            />
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Committed semantics</span>
              <h2>Session parameters</h2>
            </div>
          </div>
          <dl className="definition-list">
            <Definition label="Coverage ID" value={<CopyValue value={coverage.id} />} mono />
            <Definition label="Session ID" value={<CopyValue value={coverage.sessionId} />} mono />
            <Definition label="Program ID" value={<CopyValue value={coverage.programId} />} mono />
            <Definition label="Customer" value={coverage.customer} mono />
            <Definition label="Operator" value={coverage.operator} mono />
            <Definition label="Device" value={coverage.device} mono />
            <Definition label="Minimum service" value={coverage.minimumUnits} />
            {coverage.deliveredUnits && (
              <Definition label="Delivered service" value={coverage.deliveredUnits} />
            )}
            <Definition label="Deadline" value={coverage.deadline} />
            <Definition label="Terms hash" value={<CopyValue value={coverage.termsHash} />} mono />
          </dl>
        </section>
      </div>
      <section className="panel proof-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Cross-chain evidence</span>
            <h2>Explorer-backed envelope</h2>
          </div>
          <Link to={`/receipt/${coverage.id}`}>
            Public receipt <Icon name="external" size={15} />
          </Link>
        </div>
        <dl className="proof-grid">
          <Definition label="Source chain" value={`Sepolia · ${coverage.source.chainId}`} />
          <Definition
            label="Source block"
            value={coverage.source.blockNumber.toLocaleString('en-US')}
          />
          <Definition
            label="Source transaction"
            value={
              <ExplorerTransaction
                href={coverage.source.explorerUrl}
                hash={coverage.source.transactionHash}
              />
            }
          />
          <Definition label="Source contract" value={coverage.source.contract} mono />
          <Definition
            label="Destination chain"
            value={`Creditcoin CC3 · ${coverage.destination.chainId}`}
          />
          <Definition
            label="Destination block"
            value={coverage.destination.blockNumber.toLocaleString('en-US')}
          />
          <Definition
            label="Destination transaction"
            value={
              <ExplorerTransaction
                href={coverage.destination.explorerUrl}
                hash={coverage.destination.transactionHash}
              />
            }
          />
          <Definition label="Destination contract" value={coverage.destination.contract} mono />
          <Definition label="Deployed protocol commit" value={coverage.protocolCommit} mono />
          <Definition label="Attestcoin chain key" value={String(coverage.source.chainKey)} mono />
        </dl>
      </section>
    </>
  );
}

function TimelineItem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="timeline-item timeline-item--complete">
      <span className="timeline-marker">
        <Icon name="check" size={14} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function EmptyProgram() {
  return (
    <div className="empty-state">
      <div>
        <Icon name="programs" size={28} />
      </div>
      <h1>Program not found</h1>
      <p>This identifier is not present in the published evidence snapshots.</p>
      <Link className="button button--green" to="/app/programs">
        Return to programs
      </Link>
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
      <p>This identifier is not present in the published evidence snapshots.</p>
      <Link className="button button--green" to="/app/coverage">
        Return to coverage
      </Link>
    </div>
  );
}

export function ActivityPage() {
  return (
    <>
      <PageHeading eyebrow="Published protocol evidence" title="Activity">
        Settlement transitions represented by the repository evidence manifests.
      </PageHeading>
      <section className="panel activity-panel">
        <div className="activity-date">Verified evidence snapshots</div>
        {activity.map((entry) => (
          <div className="activity-row" key={`${entry.action}-${entry.coverage}`}>
            <span className={`activity-icon activity-icon--${entry.tone}`}>
              <Icon name={entry.tone === 'success' ? 'check' : 'activity'} size={17} />
            </span>
            <div>
              <strong>{entry.action}</strong>
              <span>{entry.detail}</span>
            </div>
            <Link className="mono" to={`/app/coverage/${entry.coverage}`} title={entry.coverage}>
              {shortHash(entry.coverage)}
            </Link>
            <a
              className="activity-explorer"
              href={entry.explorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              {entry.time} <Icon name="external" size={13} />
            </a>
          </div>
        ))}
      </section>
    </>
  );
}
