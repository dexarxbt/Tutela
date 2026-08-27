import { Link, useParams } from 'react-router-dom';
import { Brand, CopyValue, Definition, Icon, StatusBadge } from '../components';
import { findCoverage } from '../data';

function ExactTransactionLink({ href, hash }: { href: string; hash: string }) {
  return (
    <a
      className="receipt-transaction mono"
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`Open ${hash} in explorer`}
    >
      <span>{hash}</span>
      <Icon name="external" size={15} />
    </a>
  );
}

export function ReceiptPage() {
  const { coverageId } = useParams();
  const coverage = findCoverage(coverageId);
  if (!coverage)
    return (
      <div className="receipt-page">
        <header className="receipt-header">
          <Brand />
          <Link to="/app">
            Open app <Icon name="arrow" size={16} />
          </Link>
        </header>
        <main className="receipt-not-found">
          <h1>Receipt not found</h1>
          <p>No published evidence snapshot matches this identifier.</p>
          <Link className="button button--green" to="/">
            Return home
          </Link>
        </main>
      </div>
    );

  const success = coverage.outcome === 'success';
  const allRolesAliased =
    coverage.customer.toLowerCase() === coverage.operator.toLowerCase() &&
    coverage.operator.toLowerCase() === coverage.device.toLowerCase();

  return (
    <div className="receipt-page">
      <header className="receipt-header">
        <Brand />
        <div>
          <span className="receipt-network">
            <i />
            Verified testnet evidence
          </span>
          <Link to="/app">
            Open app <Icon name="arrow" size={16} />
          </Link>
        </div>
      </header>
      <main className="receipt-main">
        <div className="receipt-provenance">
          <Icon name="check" size={17} />
          <div>
            <strong>Repository-verified evidence snapshot</strong>
            <span>
              Source and settlement transactions match the validated manifest. The deployed protocol
              revision is <span className="mono">{coverage.protocolCommit}</span>.
            </span>
          </div>
        </div>
        <section className="receipt-title">
          <div>
            <span className="eyebrow">Public evidence receipt</span>
            <h1 className="hash-heading">{coverage.id}</h1>
            <p>
              {coverage.programName} · {coverage.route}
            </p>
          </div>
          <StatusBadge status={coverage.statusLabel} />
        </section>
        <section className={`receipt-outcome receipt-outcome--${coverage.status}`}>
          <div className="receipt-outcome__seal">
            <Icon name={success ? 'check' : 'activity'} size={36} />
          </div>
          <div>
            <span>Verified outcome</span>
            <h2>{success ? 'Service conditions satisfied' : 'Failure guarantee executed'}</h2>
            <p>
              {success
                ? `${coverage.deliveredUnits} met the committed ${coverage.minimumUnits} minimum.`
                : `${coverage.payout} payout plus the premium refund produced a ${coverage.customerCredit} customer credit.`}
            </p>
          </div>
          <div className="receipt-amount">
            <span>{success ? 'Delivered' : 'Customer credit'}</span>
            <strong>{success ? coverage.deliveredUnits : coverage.customerCredit}</strong>
          </div>
        </section>

        <div className="receipt-grid">
          <section className="receipt-section">
            <div className="receipt-section__heading">
              <span>01</span>
              <h2>Evidence identity</h2>
            </div>
            <dl className="definition-list">
              <Definition label="Coverage ID" value={<CopyValue value={coverage.id} />} mono />
              <Definition
                label="Session ID"
                value={<CopyValue value={coverage.sessionId} />}
                mono
              />
              <Definition
                label="Program ID"
                value={<CopyValue value={coverage.programId} />}
                mono
              />
              <Definition
                label="Deployed protocol commit"
                value={<CopyValue value={coverage.protocolCommit} />}
                mono
              />
              <Definition label="Outcome" value={coverage.outcome} />
            </dl>
          </section>
          <section className="receipt-section">
            <div className="receipt-section__heading">
              <span>02</span>
              <h2>Committed semantics</h2>
            </div>
            <dl className="definition-list">
              <Definition label="Customer" value={coverage.customer} mono />
              <Definition label="Operator" value={coverage.operator} mono />
              <Definition label="Authorized device" value={coverage.device} mono />
              <Definition label="Deadline" value={coverage.deadline} />
              <Definition label="Minimum units" value={coverage.minimumUnits} />
              {coverage.deliveredUnits && (
                <Definition label="Delivered units" value={coverage.deliveredUnits} />
              )}
              <Definition
                label="Terms hash"
                value={<CopyValue value={coverage.termsHash} />}
                mono
              />
            </dl>
          </section>
        </div>

        {allRolesAliased && (
          <section className="receipt-disclosure">
            <Icon name="activity" size={18} />
            <div>
              <strong>Role-alias demo limitation</strong>
              <p>
                Customer, operator, and authorized device use the same testnet address in this
                snapshot. Contract roles remain semantically distinct, but this evidence does not
                demonstrate independent keys or parties.
              </p>
            </div>
          </section>
        )}

        <section className="receipt-section receipt-proof">
          <div className="receipt-section__heading">
            <span>03</span>
            <h2>Explorer-backed proof path</h2>
          </div>
          <div className="receipt-proof__route">
            <div>
              <span>Source</span>
              <Icon name="bolt" />
              <strong>Ethereum Sepolia</strong>
              <small>Chain ID {coverage.source.chainId}</small>
            </div>
            <span className="receipt-proof__connector">
              <i />
              <b>Attested receipt path</b>
              <i />
            </span>
            <div>
              <span>Settlement</span>
              <Icon name="coverage" />
              <strong>Creditcoin CC3</strong>
              <small>Chain ID {coverage.destination.chainId}</small>
            </div>
          </div>
          <dl className="receipt-proof__data">
            <Definition label="Source chain key" value={String(coverage.source.chainKey)} mono />
            <Definition
              label="Source block"
              value={coverage.source.blockNumber.toLocaleString('en-US')}
            />
            <Definition label="Source contract" value={coverage.source.contract} mono />
            <Definition
              label="Source transaction"
              value={
                <ExactTransactionLink
                  href={coverage.source.explorerUrl}
                  hash={coverage.source.transactionHash}
                />
              }
            />
            <Definition
              label="Destination block"
              value={coverage.destination.blockNumber.toLocaleString('en-US')}
            />
            <Definition label="Destination contract" value={coverage.destination.contract} mono />
            <Definition
              label="Destination transaction"
              value={
                <ExactTransactionLink
                  href={coverage.destination.explorerUrl}
                  hash={coverage.destination.transactionHash}
                />
              }
            />
          </dl>
          <p className="receipt-proof__note">
            The manifest does not publish a separate proof ID. The exact source and destination
            transaction records above are the public anchors for this snapshot.
          </p>
        </section>

        <section className="receipt-section receipt-balances">
          <div className="receipt-section__heading">
            <span>04</span>
            <h2>Recorded balance effects</h2>
          </div>
          <dl className="receipt-balance-grid">
            <Definition label="Operator bond before" value={coverage.operatorBondBefore} />
            <Definition label="Operator bond after" value={coverage.operatorBondAfter} />
            <Definition
              label="Customer claimable before"
              value={coverage.customerClaimableBefore}
            />
            <Definition label="Customer claimable after" value={coverage.customerClaimableAfter} />
          </dl>
        </section>

        <section className="receipt-verification">
          <Icon name="check" />
          <div>
            <strong>Truth boundary</strong>
            <p>
              “Verified” means this repository snapshot passed its schema, deployment, semantic,
              balance, and exact explorer-link checks. This static page does not query current chain
              state, establish finality beyond the recorded blocks, or prove physical hardware and
              measurement integrity.
            </p>
          </div>
        </section>
      </main>
      <footer className="receipt-footer">
        <span>Tutela / Verified Evidence</span>
        <p>
          Attestcoin transports source receipt data. Tutela contract semantics determine which event
          can move value; authorized device measurements remain an external trust assumption.
        </p>
      </footer>
    </div>
  );
}
