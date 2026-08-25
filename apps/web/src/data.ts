export type DisplayCoverage = {
  id: string;
  sessionId: string;
  programId: string;
  programName: string;
  location: string;
  customer: string;
  operator: string;
  device: string;
  status: 'protected' | 'service-proved' | 'failure-paid';
  premium: string;
  payout: string;
  minimumUnits: string;
  deliveredUnits: string | null;
  deadline: string;
  termsHash: string;
  sourceTransaction: string | null;
  sourceBlock: string | null;
  proofId: string | null;
};

export const deploymentReady = Boolean(
  import.meta.env.VITE_TUTELA_VAULT_ADDRESS && import.meta.env.VITE_SOURCE_REGISTRY_ADDRESS
);

export const previewProgram = {
  id: 'ev-charge-001',
  name: 'Voltway Urban Charge',
  category: 'EV charging',
  operator: '0x7A61…91C2',
  device: '0x2d14…4F09',
  locations: 18,
  totalBond: '125,000 CTC',
  availableBond: '98,000 CTC',
  reservedBond: '27,000 CTC',
  premium: '6 CTC',
  payout: '120 CTC',
  minimumUnits: '18 kWh',
  sessionDuration: '45 minutes',
  termsHash: '0x89b9e2b765c114f3a08d85db1d14c2cc1c3b2a6524e683ae3312d3a98e38cc76',
};

export const coverages: DisplayCoverage[] = [
  {
    id: 'TUT-7F3A-0192',
    sessionId: '0x7f3a…0192',
    programId: previewProgram.id,
    programName: previewProgram.name,
    location: 'Marina Hub · Bay 04',
    customer: '0x8B3e…20A1',
    operator: previewProgram.operator,
    device: previewProgram.device,
    status: 'service-proved',
    premium: '6 CTC',
    payout: '120 CTC',
    minimumUnits: '18 kWh',
    deliveredUnits: '24.6 kWh',
    deadline: 'Sep 06, 2026 · 14:45 UTC',
    termsHash: previewProgram.termsHash,
    sourceTransaction: '0xa214d904a06907dfbcc7e812a43f3e365d5d18bc58d78eecc0a2c28c61714f09',
    sourceBlock: '6,872,944',
    proofId: '0x45dc641876065ea5f9a74cf0ab2876cdb0a5d74d7321226d6283f11b2cb801e3',
  },
  {
    id: 'TUT-41DC-8E07',
    sessionId: '0x41dc…8e07',
    programId: previewProgram.id,
    programName: previewProgram.name,
    location: 'Lekki Point · Bay 11',
    customer: '0x91C4…A80B',
    operator: previewProgram.operator,
    device: '0x9F35…10D7',
    status: 'failure-paid',
    premium: '6 CTC',
    payout: '120 CTC',
    minimumUnits: '18 kWh',
    deliveredUnits: null,
    deadline: 'Sep 05, 2026 · 09:30 UTC',
    termsHash: previewProgram.termsHash,
    sourceTransaction: '0x33eeeb20264e2ff546f44659889ecaa61bc03fc89850312d05653ed36a6ca713',
    sourceBlock: '6,865,181',
    proofId: '0x1626ca7f570ae3d32bd28ed4c5029d9a681047674ce88b66969d142a8fc2c711',
  },
  {
    id: 'TUT-C922-117B',
    sessionId: '0xc922…117b',
    programId: previewProgram.id,
    programName: previewProgram.name,
    location: 'Victoria Island · Bay 02',
    customer: '0x6a81…E55D',
    operator: previewProgram.operator,
    device: '0xA821…B932',
    status: 'protected',
    premium: '6 CTC',
    payout: '120 CTC',
    minimumUnits: '18 kWh',
    deliveredUnits: null,
    deadline: 'Sep 06, 2026 · 17:20 UTC',
    termsHash: previewProgram.termsHash,
    sourceTransaction: null,
    sourceBlock: null,
    proofId: null,
  },
];

export const activity = [
  {
    action: 'Service proved',
    coverage: 'TUT-7F3A-0192',
    detail: '24.6 kWh verified on Sepolia',
    time: '12 min ago',
    tone: 'success',
  },
  {
    action: 'Failure paid',
    coverage: 'TUT-41DC-8E07',
    detail: '126 CTC credited to customer',
    time: '3 hr ago',
    tone: 'paid',
  },
  {
    action: 'Coverage activated',
    coverage: 'TUT-C922-117B',
    detail: '120 CTC bond reserved',
    time: '5 hr ago',
    tone: 'active',
  },
  {
    action: 'Program funded',
    coverage: 'EV-CHARGE-001',
    detail: '25,000 CTC added to bond',
    time: 'Yesterday',
    tone: 'neutral',
  },
] as const;

export function findCoverage(id?: string) {
  return coverages.find((coverage) => coverage.id.toLowerCase() === id?.toLowerCase());
}
