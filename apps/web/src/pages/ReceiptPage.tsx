import { Link, useParams } from 'react-router-dom';
import { Brand, CopyValue, Definition, Icon, StatusBadge } from '../components';
import { findCoverage } from '../data';

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
          <p>No preview receipt matches this identifier.</p>
          <Link className="button button--green" to="/">
            Return home
          </Link>
        </main>
      </div>
    );
  const success = coverage.status === 'service-proved';
  const failed = coverage.status === 'failure-paid';
  const label = success ? 'Service proved' : failed ? 'Failure paid' : 'Protected';
  return (
    <div className="receipt-page">
      <header className="receipt-header">
        <Brand />
        <div>
          <span className="receipt-network">
            <i />
            Protocol preview
          </span>
          <Link to="/app">
            Open app <Icon name="arrow" size={16} />
          </Link>
        </div>
      </header>
      <main className="receipt-main">
        <div className="receipt-warning">
          <strong>Preview receipt</strong>
          <span>
            This demonstrates the public verification format. It is not live testnet evidence.
          </span>
        </div>
        <section className="receipt-title">
          <div>
            <span className="eyebrow">Public service receipt</span>
            <h1>{coverage.id}</h1>
            <p>
              {coverage.programName} · {coverage.location}
            </p>
          </div>
          <StatusBadge status={label} />
        </section>
        <section className={`receipt-outcome receipt-outcome--${coverage.status}`}>
          <div className="receipt-outcome__seal">
            <Icon name={success ? 'check' : failed ? 'activity' : 'coverage'} size={36} />
          </div>
          <div>
            <span>Outcome</span>
            <h2>
              {success
                ? 'Service conditions satisfied'
                : failed
                  ? 'Failure guarantee executed'
                  : 'Coverage is active'}
            </h2>
            <p>
              {success
                ? `${coverage.deliveredUnits} met the committed ${coverage.minimumUnits} minimum.`
                : failed
                  ? `${coverage.payout} payout and ${coverage.premium} premium refund were credited to the customer.`
                  : `${coverage.payout} remains reserved against the operator bond.`}
            </p>
          </div>
          <div className="receipt-amount">
            <span>{success ? 'Delivered' : failed ? 'Customer credit' : 'Protected value'}</span>
            <strong>
              {success
                ? coverage.deliveredUnits
                : failed
                  ? `${Number.parseInt(coverage.payout) + Number.parseInt(coverage.premium)} CTC`
                  : coverage.payout}
            </strong>
          </div>
        </section>
        <div className="receipt-grid">
          <section className="receipt-section">
            <div className="receipt-section__heading">
              <span>01</span>
              <h2>Service commitment</h2>
            </div>
            <dl className="definition-list">
              <Definition label="Program" value={coverage.programName} />
              <Definition label="Minimum service" value={coverage.minimumUnits} />
              <Definition label="Deadline" value={coverage.deadline} />
              <Definition label="Premium" value={coverage.premium} />
              <Definition label="Failure payout" value={coverage.payout} />
              <Definition
                label="Terms hash"
                value={
                  <CopyValue
                    value={coverage.termsHash}
                    display={`${coverage.termsHash.slice(0, 14)}…${coverage.termsHash.slice(-10)}`}
                  />
                }
                mono
              />
            </dl>
          </section>
          <section className="receipt-section">
            <div className="receipt-section__heading">
              <span>02</span>
              <h2>Participants</h2>
            </div>
            <dl className="definition-list">
              <Definition label="Customer" value={coverage.customer} mono />
              <Definition label="Operator" value={coverage.operator} mono />
              <Definition label="Authorized device" value={coverage.device} mono />
              <Definition label="Session ID" value={coverage.sessionId} mono />
            </dl>
          </section>
        </div>
        <section className="receipt-section receipt-proof">
          <div className="receipt-section__heading">
            <span>03</span>
            <h2>Proof path</h2>
          </div>
          <div className="receipt-proof__route">
            <div>
              <span>Source</span>
              <Icon name="bolt" />
              <strong>Ethereum Sepolia</strong>
              <small>ServiceSessionRegistry</small>
            </div>
            <span className="receipt-proof__connector">
              <i />
              <b>Attestcoin receipt</b>
              <i />
            </span>
            <div>
              <span>Settlement</span>
              <Icon name="coverage" />
              <strong>Creditcoin CC3</strong>
              <small>TutelaVault</small>
            </div>
          </div>
          {coverage.proofId ? (
            <dl className="receipt-proof__data">
              <Definition label="Source block" value={coverage.sourceBlock} />
              <Definition
                label="Source transaction"
                value={
                  <CopyValue
                    value={coverage.sourceTransaction!}
                    display={`${coverage.sourceTransaction!.slice(0, 16)}…${coverage.sourceTransaction!.slice(-12)}`}
                  />
                }
                mono
              />
              <Definition
                label="Attestcoin proof ID"
                value={
                  <CopyValue
                    value={coverage.proofId}
                    display={`${coverage.proofId.slice(0, 16)}…${coverage.proofId.slice(-12)}`}
                  />
                }
                mono
              />
            </dl>
          ) : (
            <div className="empty-inline">
              <Icon name="clock" />
              <div>
                <strong>Awaiting source outcome</strong>
                <span>No completion or failure proof has been settled.</span>
              </div>
            </div>
          )}
        </section>
        <section className="receipt-verification">
          <Icon name="check" />
          <div>
            <strong>What this receipt will verify after deployment</strong>
            <p>
              The source chain key, successful transaction receipt, approved registry, exact event
              signature and arguments, session terms, identities, deadline, service units, and
              replay state.
            </p>
          </div>
        </section>
      </main>
      <footer className="receipt-footer">
        <span>Tutela / Protected Passage</span>
        <p>
          Cryptographic evidence is not a claim about hardware integrity. Device measurements remain
          an explicit trust boundary.
        </p>
      </footer>
    </div>
  );
}
