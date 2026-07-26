/**
 * Listing/comparison pages used by the discovery crawler.
 * These are NOT individual card detail pages — they enumerate products.
 */

export type DiscoveryCardType = 'credit' | 'debit' | 'mixed';

export type DiscoverySource = {
  id: string;
  name: string;
  kind: 'aggregator' | 'bank';
  /** Default type when the listing is single-purpose; LLM may still override. */
  defaultCardType: DiscoveryCardType;
  urls: string[];
  preferPlaywright?: boolean;
  /** Optional bank hint for bank-direct listings. */
  bankHint?: string;
};

export const DISCOVERY_SOURCES: DiscoverySource[] = [
  // —— Aggregators ——
  {
    id: 'paisabazaar-credit',
    name: 'Paisabazaar Credit Cards',
    kind: 'aggregator',
    defaultCardType: 'credit',
    urls: ['https://www.paisabazaar.com/credit-card/'],
    preferPlaywright: true,
  },
  {
    id: 'bankbazaar-credit',
    name: 'BankBazaar Credit Cards',
    kind: 'aggregator',
    defaultCardType: 'credit',
    urls: ['https://www.bankbazaar.com/credit-card.html'],
    preferPlaywright: true,
  },
  {
    id: 'cardinsider-credit',
    name: 'CardInsider Credit Cards',
    kind: 'aggregator',
    defaultCardType: 'credit',
    urls: ['https://www.cardinsider.com/credit-card/'],
    preferPlaywright: true,
  },
  {
    id: 'cardexpert-credit',
    name: 'CardExpert Credit Cards',
    kind: 'aggregator',
    defaultCardType: 'credit',
    urls: [
      'https://cardexpert.in/credit-cards/',
      'https://www.cardexpert.in/credit-cards/',
    ],
    preferPlaywright: true,
  },
  // —— Bank-direct credit listings ——
  {
    id: 'hdfc-credit-list',
    name: 'HDFC Bank Credit Cards',
    kind: 'bank',
    defaultCardType: 'credit',
    bankHint: 'HDFC Bank',
    urls: [
      'https://www.hdfcbank.com/personal/pay/cards/credit-cards',
      'https://www.hdfc.bank.in/credit-cards',
    ],
    preferPlaywright: true,
  },
  {
    id: 'hdfc-debit-list',
    name: 'HDFC Bank Debit Cards',
    kind: 'bank',
    defaultCardType: 'debit',
    bankHint: 'HDFC Bank',
    urls: ['https://www.hdfcbank.com/personal/pay/cards/debit-cards'],
    preferPlaywright: true,
  },
  {
    id: 'sbi-credit-list',
    name: 'SBI Card Credit Cards',
    kind: 'bank',
    defaultCardType: 'credit',
    bankHint: 'SBI Card',
    urls: ['https://www.sbicard.com/en/personal/sbi-credit-card.page'],
    preferPlaywright: true,
  },
  {
    id: 'axis-credit-list',
    name: 'Axis Bank Credit Cards',
    kind: 'bank',
    defaultCardType: 'credit',
    bankHint: 'Axis Bank',
    urls: [
      'https://www.axis.bank.in/cards/credit-card',
      'https://www.axisbank.com/retail/cards/credit-card',
    ],
    preferPlaywright: true,
  },
  {
    id: 'icici-credit-list',
    name: 'ICICI Bank Credit Cards',
    kind: 'bank',
    defaultCardType: 'credit',
    bankHint: 'ICICI Bank',
    urls: [
      'https://www.icicibank.com/personal-banking/cards/credit-card',
    ],
    preferPlaywright: true,
  },
  {
    id: 'kotak-credit-list',
    name: 'Kotak Credit Cards',
    kind: 'bank',
    defaultCardType: 'credit',
    bankHint: 'Kotak Bank',
    urls: [
      'https://www.kotak.com/en/personal-banking/cards/credit-cards.html',
    ],
    preferPlaywright: true,
  },
  {
    id: 'idfc-credit-list',
    name: 'IDFC FIRST Credit Cards',
    kind: 'bank',
    defaultCardType: 'credit',
    bankHint: 'IDFC FIRST Bank',
    urls: ['https://www.idfcfirstbank.com/credit-card'],
    preferPlaywright: true,
  },
  {
    id: 'indusind-credit-list',
    name: 'IndusInd Credit Cards',
    kind: 'bank',
    defaultCardType: 'credit',
    bankHint: 'IndusInd Bank',
    urls: ['https://www.indusind.com/in/en/personal/cards/credit-card.html'],
    preferPlaywright: true,
  },
  {
    id: 'yes-credit-list',
    name: 'YES Bank Credit Cards',
    kind: 'bank',
    defaultCardType: 'credit',
    bankHint: 'Yes Bank',
    urls: [
      'https://www.yesbank.in/personal-banking/yes-individual/loans-and-cards/credit-cards',
    ],
    preferPlaywright: true,
  },
  {
    id: 'rbl-credit-list',
    name: 'RBL Credit Cards',
    kind: 'bank',
    defaultCardType: 'credit',
    bankHint: 'RBL Bank',
    urls: ['https://www.rblbank.com/personal/cards/credit-cards'],
    preferPlaywright: true,
  },
];
