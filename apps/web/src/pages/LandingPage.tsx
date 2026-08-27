import { Link } from 'react-router-dom';
import { Brand, Icon } from '../components';
import {
  coverages,
  failedLifecycle,
  shortHash,
  successfulLifecycle,
  verifiedProgram,
} from '../data';

export function LandingPage() {
  return (
    <div className="landing">
      <header className="site-header">
        <Brand />
        <nav aria-label="Primary navigation">
          <a href="#protocol">Protocol</a>
          <a href="#lifecycle">Lifecycle</a>
          <a href="#integration">Attestcoin</a>
        </nav>
        <Link className="button button--outline" to="/app">
          Open evidence app <Icon name="arrow" size={17} />
        </Link>
      </header>
      <main>
        <section className="hero">
          <div className="hero__signal">
            <span />
            <span>Verified testnet service warranties, settled by proof</span>
          </div>
          <h1>
            Service proved
            <br />
            <em>Failure paid</em>
          </h1>
          <p className="hero__lead">
            Tutela turns verified service outcomes into automatic economic protection—without
            trusting a warranty desk, relayer, or operator.
          </p>
          <div className="hero__actions">
            <Link className="button button--green" to={`/receipt/${successfulLifecycle.id}`}>
              Inspect verified success <Icon name="arrow" size={18} />
            </Link>
            <Link className="text-link" to={`/receipt/${failedLifecycle.id}`}>
              Inspect verified failure <Icon name="arrow" size={16} />
            </Link>
          </div>
          <div
            className="hero-visual"
            aria-label="Verified success evidence moving from a Sepolia transaction to Creditcoin settlement"
          >
            <div className="hero-visual__top">
              <span className="mono">VERIFIED TESTNET EVIDENCE / REPOSITORY SNAPSHOT</span>
              <span className="visual-live">
                <i />
                {coverages.length} SETTLED LIFECYCLES
              </span>
            </div>
            <div className="passage">
              <div className="passage__origin">
                <div className="charger">
                  <Icon name="bolt" size={30} />
                </div>
                <div>
                  <span>Ethereum Sepolia</span>
                  <strong>
                    Block {successfulLifecycle.source.blockNumber.toLocaleString('en-US')}
                  </strong>
                  <small title={successfulLifecycle.source.transactionHash}>
                    Tx {shortHash(successfulLifecycle.source.transactionHash, 10, 8)}
                  </small>
                </div>
              </div>
              <div className="passage__line">
                <span />
                <i />
                <i />
                <i />
              </div>
              <div className="passage__proof">
                <div className="proof-ring">
                  <Icon name="check" size={25} />
                </div>
                <span>Verified success</span>
                <small>{successfulLifecycle.deliveredUnits} delivered</small>
              </div>
              <div className="passage__line passage__line--short">
                <span />
                <i />
                <i />
              </div>
              <div className="passage__settlement">
                <span>Creditcoin CC3</span>
                <strong>
                  Block {successfulLifecycle.destination.blockNumber.toLocaleString('en-US')}
                </strong>
                <small>{successfulLifecycle.premium} claimable delta</small>
              </div>
            </div>
            <div className="hero-visual__bottom">
              <div>
                <span>Success coverage</span>
                <Link
                  className="mono"
                  to={`/receipt/${successfulLifecycle.id}`}
                  title={successfulLifecycle.id}
                >
                  {shortHash(successfulLifecycle.id)}
                </Link>
              </div>
              <div>
                <span>Failure customer credit</span>
                <Link to={`/receipt/${failedLifecycle.id}`} title={failedLifecycle.id}>
                  {failedLifecycle.customerCredit}
                </Link>
              </div>
              <div>
                <span>Recorded operator bond</span>
                <strong>{verifiedProgram.recordedBond}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="statement" id="protocol">
          <span className="section-index">01 / THE PROBLEM</span>
          <div>
            <h2>
              DePIN can prove activity
              <br />
              It still struggles to guarantee outcomes
            </h2>
            <p>
              Customers pay before a charger, hotspot, or compute node delivers. If service fails,
              compensation depends on a platform-controlled process. Tutela replaces that
              discretionary promise with reserved collateral and verifiable rules.
            </p>
          </div>
        </section>

        <section className="contrast-grid">
          <article className="contrast-card contrast-card--muted">
            <span className="card-label">Without Tutela</span>
            <h3>A service promise</h3>
            <ul>
              <li>
                <Icon name="close" />
                Operator controls evidence
              </li>
              <li>
                <Icon name="close" />
                Claims need manual approval
              </li>
              <li>
                <Icon name="close" />
                Compensation is uncertain
              </li>
            </ul>
            <div className="contrast-outcome">“Please contact support.”</div>
          </article>
          <article className="contrast-card contrast-card--green">
            <span className="card-label">With Tutela</span>
            <h3>An economic guarantee</h3>
            <ul>
              <li>
                <Icon name="check" />
                Coverage is collateralized first
              </li>
              <li>
                <Icon name="check" />
                Outcome is proved cross-chain
              </li>
              <li>
                <Icon name="check" />
                Contract credits the correct party
              </li>
            </ul>
            <div className="contrast-outcome">Failure paid by protocol.</div>
          </article>
        </section>

        <section className="lifecycle" id="lifecycle">
          <div className="section-heading">
            <span className="section-index">02 / PROTECTED LIFECYCLE</span>
            <h2>
              One session
              <br />
              Three enforceable states
            </h2>
            <p>
              The operator commits capital before the customer begins. Every later transition is
              constrained by signed intent, source-chain evidence, and immutable settlement rules.
            </p>
          </div>
          <div className="steps">
            <article>
              <span className="step-number">01</span>
              <div className="step-icon">
                <Icon name="coverage" />
              </div>
              <h3>Protect</h3>
              <p>
                A customer signs session terms. Tutela reserves the exact failure payout from the
                operator’s CTC bond.
              </p>
              <div className="step-meta">
                <span>Customer intent</span>
                <strong>EIP-712 authorization</strong>
              </div>
            </article>
            <article>
              <span className="step-number">02</span>
              <div className="step-icon step-icon--blue">
                <Icon name="bolt" />
              </div>
              <h3>Prove</h3>
              <p>
                The authorized device posts the service outcome on Sepolia. Anyone can submit its
                attested receipt.
              </p>
              <div className="step-meta">
                <span>Source evidence</span>
                <strong>Attestcoin proof</strong>
              </div>
            </article>
            <article>
              <span className="step-number">03</span>
              <div className="step-icon step-icon--lime">
                <Icon name="activity" />
              </div>
              <h3>Settle</h3>
              <p>
                Success releases the premium. A deterministic failure credits payout and premium
                refund to the customer.
              </p>
              <div className="step-meta">
                <span>Economic action</span>
                <strong>CTC pull payment</strong>
              </div>
            </article>
          </div>
        </section>

        <section className="architecture" id="integration">
          <div className="architecture__copy">
            <span className="section-index">03 / ATTESTCOIN INTEGRATION</span>
            <h2>
              Proof is transport
              <br />
              Semantics are authority
            </h2>
            <p>
              Attestcoin carries a source transaction into Creditcoin’s execution environment.
              Tutela does not accept “any valid proof.” It verifies the chain, registry, receipt
              status, event, session identities, terms, units, deadline, and replay state before
              moving value.
            </p>
            <Link className="text-link text-link--light" to={`/receipt/${successfulLifecycle.id}`}>
              Inspect verified success <Icon name="arrow" size={17} />
            </Link>
          </div>
          <div className="architecture__diagram">
            <div className="chain-node">
              <span>01 · SOURCE</span>
              <strong>Sepolia registry</strong>
              <small>
                SessionStarted
                <br />
                ServiceCompleted
                <br />
                ServiceFailed
              </small>
            </div>
            <div className="chain-link">
              <span>permissionless prover</span>
              <i />
              <b>attested receipt</b>
            </div>
            <div className="chain-node chain-node--accent">
              <span>02 · SETTLEMENT</span>
              <strong>TutelaVault</strong>
              <small>
                BlockProver.verifyAndEmit
                <br />
                Semantic validation
                <br />
                CTC accounting
              </small>
            </div>
          </div>
        </section>

        <section className="truth-boundary">
          <div>
            <span className="section-index">04 / TRUTH BOUNDARY</span>
            <h2>
              Precise claims
              <br />
              No oracle theatre
            </h2>
          </div>
          <div className="truth-list">
            <article>
              <span>Attestcoin proves</span>
              <strong>
                A specific successful source-chain transaction and its emitted event data.
              </strong>
            </article>
            <article>
              <span>Tutela enforces</span>
              <strong>
                Which event counts, which terms match, and what economic action follows.
              </strong>
            </article>
            <article>
              <span>The device attests</span>
              <strong>
                The physical service measurement. Hardware integrity remains an explicit external
                assumption.
              </strong>
            </article>
          </div>
        </section>

        <section className="final-cta">
          <div className="final-cta__mark">
            <span>[</span>
            <strong>T</strong>
            <span>]</span>
          </div>
          <span className="section-index">PROOF-BACKED PROTECTION</span>
          <h2>
            Build services people
            <br />
            can rely on
          </h2>
          <p>
            Start with EV charging. Extend the same warranty primitive to wireless, compute,
            storage, energy, and every service where failure should have an automatic consequence.
          </p>
          <Link className="button button--lime" to="/app">
            Enter Tutela <Icon name="arrow" />
          </Link>
        </section>
      </main>
      <footer className="site-footer">
        <Brand light />
        <p>Proof-backed protection for DePIN services.</p>
        <div>
          <a href="https://docs.creditcoin.org/creditcoin-usc" target="_blank" rel="noreferrer">
            Attestcoin docs <Icon name="external" size={14} />
          </a>
          <Link to="/app">Verified evidence app</Link>
        </div>
        <small>Built for BUIDL CTC 2026 · Testnet prototype</small>
      </footer>
    </div>
  );
}
