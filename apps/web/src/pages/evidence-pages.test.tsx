import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { failedLifecycle, successfulLifecycle, verifiedProgram } from '../data';
import { LandingPage } from './LandingPage';
import { ProgramsPage } from './AppPages';
import { ReceiptPage } from './ReceiptPage';

function renderPage(element: React.ReactNode, path = '/') {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);
}

function renderReceipt(coverageId: string) {
  return renderPage(
    <Routes>
      <Route path="/receipt/:coverageId" element={<ReceiptPage />} />
    </Routes>,
    `/receipt/${coverageId}`
  );
}

describe('verified evidence pages', () => {
  it('renders the landing page with exact success and failure receipt links', () => {
    const html = renderPage(<LandingPage />);

    expect(html).toContain(`/receipt/${successfulLifecycle.id}`);
    expect(html).toContain(`/receipt/${failedLifecycle.id}`);
    expect(html).toContain(successfulLifecycle.premium);
    expect(html).toContain(failedLifecycle.customerCredit);
    expect(html).toContain('VERIFIED TESTNET EVIDENCE / REPOSITORY SNAPSHOT');
    expect(html).not.toContain('125,000 CTC');
    expect(html).not.toContain('TUT-C922-117B');
    expect(html).not.toContain('PROTOCOL PREVIEW');
  });

  it('renders the program card from manifest evidence rather than write configuration', () => {
    const html = renderPage(<ProgramsPage />, '/app/programs');

    expect(html).toContain(verifiedProgram.id);
    expect(html).toContain(verifiedProgram.sourceRegistry);
    expect(html).toContain(verifiedProgram.recordedBond);
  });

  it.each([
    ['success', successfulLifecycle],
    ['failure', failedLifecycle],
  ] as const)('renders the exact %s explorer-backed receipt', (_outcome, coverage) => {
    const html = renderReceipt(coverage.id);

    expect(html).toContain(coverage.id);
    expect(html).toContain(coverage.sessionId);
    expect(html).toContain(coverage.programId);
    expect(html).toContain(coverage.protocolCommit);
    expect(html).toContain(coverage.source.transactionHash);
    expect(html).toContain(coverage.destination.transactionHash);
    expect(html).toContain(`href="${coverage.source.explorerUrl}"`);
    expect(html).toContain(`href="${coverage.destination.explorerUrl}"`);
    expect(html).toContain(coverage.operatorBondBefore);
    expect(html).toContain(coverage.operatorBondAfter);
    expect(html).toContain('Role-alias demo limitation');
    expect(html).toContain('This static page does not query current chain state');
    expect(html).not.toContain('Preview receipt');
    expect(html).not.toContain('Attestcoin proof ID');
  });

  it('renders an honest not-found receipt state', () => {
    const html = renderReceipt('0xdead');

    expect(html).toContain('Receipt not found');
    expect(html).toContain('No published evidence snapshot matches this identifier.');
  });
});
