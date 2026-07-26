/**
 * Auto-retry policy for NFC card reads.
 *
 * Contactless reads fail intermittently on cards that otherwise work, so the
 * adapter retries silently before the UI ever shows a failure. These tests pin
 * which outcomes are retried and how many attempts the user's card actually
 * gets, using a fully mocked nfc-manager (no native module, no device).
 */

const mockTransceive = jest.fn();

const mockNfcManager = {
  isSupported: jest.fn(),
  start: jest.fn(),
  isEnabled: jest.fn(),
  cancelTechnologyRequest: jest.fn(),
  unregisterTagEvent: jest.fn(),
  registerTagEvent: jest.fn(),
  requestTechnology: jest.fn(),
  getTag: jest.fn(),
  setTimeout: jest.fn(),
  goToNfcSetting: jest.fn(),
  isoDepHandler: { transceive: mockTransceive },
};

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'bare', appOwnership: null },
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: mockNfcManager,
  NfcTech: { IsoDep: 'IsoDep', NfcA: 'NfcA' },
}));
jest.mock('@/lib/emv/readEmvCard', () => ({ readEmvCard: jest.fn() }));

// Imports run after the mock definitions above — importing the adapter first
// would evaluate the jest.mock factories before mockNfcManager is initialised.
// eslint-disable-next-line import/first
import { readCardViaNfc } from '@/adapters/nfcCardAdapter';
// eslint-disable-next-line import/first
import { readEmvCard } from '@/lib/emv/readEmvCard';

const mockReadEmvCard = readEmvCard as jest.MockedFunction<typeof readEmvCard>;

const GOOD_READ = {
  pan: { digits: '4111111111111111', quality: 'full' as const },
  expiryMonth: 4,
  expiryYear: 2030,
  schemeHint: 'Visa',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNfcManager.isSupported.mockResolvedValue(true);
  mockNfcManager.start.mockResolvedValue(undefined);
  mockNfcManager.isEnabled.mockResolvedValue(true);
  mockNfcManager.cancelTechnologyRequest.mockResolvedValue(undefined);
  mockNfcManager.unregisterTagEvent.mockResolvedValue(undefined);
  mockNfcManager.registerTagEvent.mockResolvedValue(undefined);
  mockNfcManager.requestTechnology.mockResolvedValue('IsoDep');
  mockNfcManager.getTag.mockResolvedValue({ id: 'ab', techTypes: ['IsoDep'] });
  mockNfcManager.setTimeout.mockResolvedValue(undefined);
});

describe('readCardViaNfc auto-retry', () => {
  it('recovers from a flaky read without surfacing a failure', async () => {
    mockReadEmvCard
      .mockRejectedValueOnce(new Error('Tag was lost'))
      .mockRejectedValueOnce(new Error('Tag was lost'))
      .mockResolvedValueOnce(GOOD_READ);

    const attempts: number[] = [];
    const outcome = await readCardViaNfc({
      onAttempt: (attempt) => attempts.push(attempt),
    });

    expect(outcome.ok).toBe(true);
    expect(mockReadEmvCard).toHaveBeenCalledTimes(3);
    expect(attempts).toEqual([1, 2, 3]);
  });

  it('only reports failure after every attempt is exhausted', async () => {
    mockReadEmvCard.mockRejectedValue(new Error('NO_EMV_DATA'));

    const outcome = await readCardViaNfc();

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.reason).toBe('failed');
    expect(mockReadEmvCard).toHaveBeenCalledTimes(3);
  });

  it('does not retry a cancelled read', async () => {
    mockReadEmvCard.mockRejectedValue(new Error('transaction cancelled'));

    const outcome = await readCardViaNfc();

    expect(outcome.ok === false && outcome.reason).toBe('cancelled');
    expect(mockReadEmvCard).toHaveBeenCalledTimes(1);
  });

  it('stops between attempts once the caller has left', async () => {
    mockReadEmvCard.mockRejectedValue(new Error('Tag was lost'));

    const outcome = await readCardViaNfc({ shouldContinue: () => false });

    expect(outcome.ok === false && outcome.reason).toBe('cancelled');
    expect(mockReadEmvCard).toHaveBeenCalledTimes(1);
  });

  it('reports disabled NFC without attempting a read', async () => {
    mockNfcManager.isEnabled.mockResolvedValue(false);

    const outcome = await readCardViaNfc();

    expect(outcome.ok === false && outcome.reason).toBe('disabled');
    expect(mockReadEmvCard).not.toHaveBeenCalled();
  });
});
