/**
 * Source registry — Benefit Radar base + InWallet expansions (fintech / trending).
 * Adjustments noted in README.
 */

export type RefreshPriority = 'standard' | 'high';

export type CatalogSource = {
  id: string;
  name: string;
  issuer: string;
  network: string;
  annualFee?: number;
  type?: string;
  urls: string[];
  fallbackUrls?: string[];
  /** Prefer Playwright when static HTML is thin / JS-rendered. */
  preferPlaywright?: boolean;
  /**
   * Re-scrape cadence hint. `high` = fintech / app-first products whose
   * lounge thresholds & reward rates change often (default: standard).
   */
  refreshPriority?: RefreshPriority;
};

export const SOURCES: CatalogSource[] = [
  // HDFC
  {
    id: 'hdfc-regalia',
    name: 'HDFC Regalia Credit Card',
    issuer: 'HDFC Bank',
    network: 'Visa',
    annualFee: 2500,
    urls: ['https://www.hdfcbank.com/personal/pay/cards/credit-cards/regalia'],
    fallbackUrls: [],
  },
  {
    id: 'hdfc-regalia-gold',
    name: 'HDFC Regalia Gold Credit Card',
    issuer: 'HDFC Bank',
    network: 'Visa',
    annualFee: 2500,
    urls: ['https://www.hdfcbank.com/personal/pay/cards/credit-cards/regalia-gold-credit-card'],
    fallbackUrls: [],
  },
  {
    id: 'hdfc-diners-black',
    name: 'HDFC Diners Black Credit Card',
    issuer: 'HDFC Bank',
    network: 'Diners',
    annualFee: 10000,
    urls: ['https://www.hdfcbank.com/personal/pay/cards/credit-cards/diners-black-credit-card'],
    fallbackUrls: [],
  },
  {
    id: 'hdfc-millennia',
    name: 'HDFC Millennia Credit Card',
    issuer: 'HDFC Bank',
    network: 'Mastercard',
    annualFee: 1000,
    urls: ['https://www.hdfcbank.com/personal/pay/cards/credit-cards/millennia-credit-card'],
    fallbackUrls: [],
  },
  {
    id: 'hdfc-moneyback-plus',
    name: 'HDFC MoneyBack+ Credit Card',
    issuer: 'HDFC Bank',
    network: 'Mastercard',
    annualFee: 500,
    // Official page often hangs; older static page is more scrape-friendly.
    urls: ['https://v.hdfcbank.com/htdocs/common/credit-cards/cc_moneyback.html'],
    fallbackUrls: [
      'https://www.hdfcbank.com/personal/pay/cards/credit-cards/moneyback-plus-credit-card',
    ],
  },
  {
    id: 'hdfc-tata-neu-plus',
    name: 'HDFC Tata Neu Plus Credit Card',
    issuer: 'HDFC Bank',
    network: 'Rupay',
    annualFee: 499,
    urls: ['https://www.hdfcbank.com/personal/pay/cards/credit-cards/tata-neu-plus-hdfc-bank-credit-card'],
    fallbackUrls: [],
    refreshPriority: 'high',
  },
  {
    id: 'hdfc-tata-neu-infinity',
    name: 'Tata Neu Infinity HDFC Bank Credit Card',
    issuer: 'HDFC Bank',
    network: 'Visa',
    annualFee: 1499,
    urls: [
      'https://www.hdfcbank.com/personal/pay/cards/credit-cards/tata-neu-infinity-hdfc-bank-credit-card',
      'https://www.hdfc.bank.in/credit-cards/tata-neu-infinity-hdfc-bank-credit-card',
    ],
    fallbackUrls: ['https://www.tataneu.com/creditcard/'],
    refreshPriority: 'high',
  },
  {
    id: 'hdfc-swiggy-blck',
    name: 'Swiggy BLCK HDFC Bank Credit Card',
    issuer: 'HDFC Bank',
    network: 'Visa',
    annualFee: 1000,
    urls: [
      'https://www.hdfc.bank.in/credit-cards/swiggy-blck-hdfc-bank-credit-card',
      'https://www.hdfcbank.com/personal/pay/cards/credit-cards/swiggy-hdfc-bank-credit-card',
    ],
    fallbackUrls: ['https://www.swiggy.com/swiggy-hdfc-bank-credit-card'],
    refreshPriority: 'high',
  },
  {
    id: 'hdfc-infinia',
    name: 'HDFC Infinia Credit Card',
    issuer: 'HDFC Bank',
    network: 'Visa',
    annualFee: 12500,
    urls: ['https://www.hdfcbank.com/personal/pay/cards/credit-cards/infinia-credit-card'],
    fallbackUrls: [],
  },
  {
    id: 'hdfc-millennia-debit',
    name: 'HDFC Millennia Debit Card',
    issuer: 'HDFC Bank',
    network: 'Mastercard',
    annualFee: 0,
    type: 'debit-card',
    urls: ['https://www.hdfcbank.com/personal/pay/cards/debit-cards/millennia-debit-card'],
    fallbackUrls: [],
  },
  // SBI
  {
    id: 'sbi-elite',
    name: 'SBI Card ELITE',
    issuer: 'SBI Card',
    network: 'Mastercard',
    annualFee: 4999,
    urls: ['https://www.sbicard.com/en/personal/credit-cards/travel/sbi-card-elite.page'],
    fallbackUrls: [],
  },
  {
    id: 'sbi-simply-click',
    name: 'SBI SimplyCLICK Credit Card',
    issuer: 'SBI Card',
    network: 'Visa',
    annualFee: 499,
    urls: ['https://www.sbicard.com/en/personal/credit-cards/rewards/simplyclick-sbi-card.page'],
    fallbackUrls: [],
  },
  {
    id: 'sbi-bpcl',
    name: 'BPCL SBI Credit Card',
    issuer: 'SBI Card',
    network: 'Visa',
    annualFee: 499,
    urls: ['https://www.sbicard.com/en/personal/credit-cards/fuel/bpcl-sbi-card.page'],
    fallbackUrls: [],
  },
  {
    id: 'sbi-cashback',
    name: 'SBI Cashback Credit Card',
    issuer: 'SBI Card',
    network: 'Visa',
    annualFee: 999,
    // Product slug 404s; FAQ + T&C PDF + listing page carry benefits text.
    urls: [
      'https://www.sbicard.com/en/faq/cashback-sbi-card-faq.page',
      'https://www.sbicard.com/en/personal/sbi-credit-card.page',
    ],
    fallbackUrls: [
      'https://www.sbicard.com/sbi-card-en/assets/docs/pdf/cashback-tnc-booklet.pdf',
      'https://www.sbicard.com/sbi-card-en/assets/docs/pdf/cashback-revised.pdf',
    ],
    preferPlaywright: true,
    refreshPriority: 'standard',
  },
  {
    id: 'sbi-gold-debit',
    name: 'SBI Gold Debit Card',
    issuer: 'SBI',
    network: 'Mastercard',
    annualFee: 0,
    type: 'debit-card',
    // Benefit Radar primary URL is SBI Collect (unrelated) — prefer debit-card page.
    urls: ['https://www.sbi.co.in/web/personal-banking/accounts/debit-card'],
    fallbackUrls: ['https://www.onlinesbi.sbi/sbicollect/icollecthome.htm'],
    preferPlaywright: true,
  },
  // Axis
  {
    id: 'axis-magnus',
    name: 'Axis Magnus Credit Card',
    issuer: 'Axis Bank',
    network: 'Visa',
    annualFee: 12500,
    // Canonical product slugs use "axis-bank-…" (old short slugs 404).
    urls: [
      'https://www.axisbank.com/retail/cards/credit-card/axis-bank-magnus-card',
      'https://www.axis.bank.in/cards/credit-card/axis-bank-magnus-credit-card',
    ],
    fallbackUrls: [],
  },
  {
    id: 'axis-ace',
    name: 'Axis Ace Credit Card',
    issuer: 'Axis Bank',
    network: 'Visa',
    annualFee: 499,
    urls: [
      'https://www.axisbank.com/retail/cards/credit-card/axis-bank-ace-credit-card',
      'https://www.axis.bank.in/cards/credit-card/axis-bank-ace-credit-card',
    ],
    fallbackUrls: [],
  },
  {
    id: 'axis-neo',
    name: 'Axis Neo Credit Card',
    issuer: 'Axis Bank',
    network: 'Visa',
    annualFee: 250,
    urls: [
      'https://www.axis.bank.in/cards/credit-card/axis-bank-neo-credit-card',
      'https://www.axisbank.com/retail/cards/credit-card/axis-bank-neo-credit-card',
    ],
    fallbackUrls: [],
    refreshPriority: 'high',
  },
  {
    id: 'axis-flipkart',
    name: 'Axis Flipkart Credit Card',
    issuer: 'Axis Bank',
    network: 'Visa',
    annualFee: 500,
    urls: [
      'https://www.axisbank.com/retail/cards/credit-card/flipkart-axis-bank',
      'https://www.axis.bank.in/cards/credit-card/flipkart-axisbank-credit-card',
    ],
    fallbackUrls: [],
  },
  {
    id: 'axis-vistara-infin',
    name: 'Axis Vistara Infinite Credit Card',
    issuer: 'Axis Bank',
    network: 'Visa',
    annualFee: 10000,
    urls: [
      'https://www.axisbank.com/retail/cards/credit-card/axis-bank-vistara-infinite-credit-card/features-benefits',
      'https://www.axis.bank.in/cards/credit-card/axis-bank-vistara-infinite-credit-card',
    ],
    fallbackUrls: [],
  },
  {
    id: 'axis-vistara',
    name: 'Axis Vistara Credit Card',
    issuer: 'Axis Bank',
    network: 'Visa',
    annualFee: 1500,
    urls: [
      'https://www.axisbank.com/retail/cards/credit-card/axis-bank-vistara-credit-card/features-benefits',
      'https://www.axis.bank.in/cards/credit-card/axis-bank-vistara-credit-card',
    ],
    fallbackUrls: [],
  },
  // ICICI
  {
    id: 'icici-amazon-pay',
    name: 'Amazon Pay ICICI Credit Card',
    issuer: 'ICICI Bank',
    network: 'Visa',
    annualFee: 0,
    urls: ['https://www.icicibank.com/personal-banking/cards/credit-card/amazon-pay-credit-card'],
    fallbackUrls: [],
  },
  {
    id: 'icici-coral',
    name: 'ICICI Coral Credit Card',
    issuer: 'ICICI Bank',
    network: 'Visa',
    annualFee: 500,
    urls: ['https://www.icicibank.com/personal-banking/cards/credit-card/coral-credit-card'],
    fallbackUrls: [],
  },
  {
    id: 'icici-sapphiro',
    name: 'ICICI Sapphiro Credit Card',
    issuer: 'ICICI Bank',
    network: 'Visa',
    annualFee: 3500,
    urls: ['https://www.icicibank.com/personal-banking/cards/credit-card/sapphiro-credit-card'],
    fallbackUrls: ['https://www.icicibank.com/personal-banking/cards/credit-card/sapphiro-credit-card/features'],
  },
  // Kotak
  {
    id: 'kotak-royale',
    name: 'Kotak Royale Signature',
    issuer: 'Kotak Bank',
    network: 'Visa',
    annualFee: 999,
    urls: ['https://www.kotak.com/en/personal-banking/cards/credit-cards/royale-signature-credit-card.html'],
    fallbackUrls: [],
  },
  {
    id: 'kotak-811',
    name: 'Kotak 811 Dream Different Card',
    issuer: 'Kotak Bank',
    network: 'Visa',
    annualFee: 0,
    urls: ['https://www.kotak.com/en/personal-banking/cards/credit-cards/811-dream-different-credit-card.html'],
    fallbackUrls: [],
  },
  // Yes Bank
  {
    id: 'yes-first-preferred',
    name: 'YES First Preferred Credit Card',
    issuer: 'Yes Bank',
    network: 'Mastercard',
    annualFee: 999,
    urls: ['https://www.yesbank.in/personal-banking/yes-individual/loans-and-cards/credit-cards/yes-first-preferred-credit-card'],
    fallbackUrls: ['https://www.yesbank.in/personal-banking/yes-individual/loans-and-cards/credit-cards/yes-first-preferred-credit-card/features-and-benefits'],
  },
  {
    id: 'kiwi-yes',
    name: 'Kiwi YES Bank RuPay Credit Card',
    issuer: 'Yes Bank',
    network: 'Rupay',
    annualFee: 0,
    // Official product site is gokiwi.in (kiwi.money redirects / is unused).
    urls: ['https://gokiwi.in/', 'https://gokiwi.in/rupay-credit-card/'],
    fallbackUrls: ['https://www.yesbank.in/personal-banking/yes-individual/loans-and-cards/credit-cards'],
    preferPlaywright: true,
    refreshPriority: 'high',
  },
  // IndusInd
  {
    id: 'indusind-legend',
    name: 'IndusInd Legend Credit Card',
    issuer: 'IndusInd Bank',
    network: 'Visa',
    annualFee: 9999,
    urls: ['https://www.indusind.com/in/en/personal/cards/credit-cards/legend-credit-card.html'],
    fallbackUrls: ['https://www.indusind.com/in/en/personal/cards/credit-cards/legend-credit-card/features.html'],
  },
  {
    id: 'indusind-tiger',
    name: 'IndusInd Tiger Credit Card',
    issuer: 'IndusInd Bank',
    network: 'Visa',
    annualFee: 0,
    urls: ['https://www.indusind.com/in/en/personal/cards/credit-card/tiger-credit-card.html'],
    fallbackUrls: [
      'https://www.indusind.com/iblogs/credit-card/indusind-bank-tiger-credit-card-features-benefits/',
    ],
    refreshPriority: 'high',
  },
  // Federal Bank / Scapia (fintech co-brand)
  {
    id: 'scapia-federal',
    name: 'Scapia Federal Credit Card',
    issuer: 'Federal Bank',
    network: 'Visa',
    annualFee: 0,
    urls: ['https://www.federal.bank.in/scapia', 'https://scapia.cards/'],
    fallbackUrls: [
      'https://www.scapia.cards/product/blog/the-scapia-federal-credit-card-everything-you-need-to-know',
    ],
    preferPlaywright: true,
    refreshPriority: 'high',
  },
  // RBL
  {
    id: 'rbl-shoprite',
    name: 'RBL Shoprite Credit Card',
    issuer: 'RBL Bank',
    network: 'Mastercard',
    annualFee: 500,
    urls: ['https://www.rblbank.com/personal/cards/credit-cards/shoprite'],
    fallbackUrls: [],
  },
  // Standard Chartered
  {
    id: 'standard-chartered-manhattan',
    name: 'Standard Chartered Manhattan Credit Card',
    issuer: 'Standard Chartered',
    network: 'Mastercard',
    annualFee: 999,
    urls: ['https://www.sc.com/in/credit-cards/standard-chartered-manhattan-credit-card/'],
    fallbackUrls: ['https://www.sc.com/in/credit-cards/manhattan/'],
  },
  // IDFC
  {
    id: 'idfc-wealth',
    name: 'IDFC FIRST Wealth Credit Card',
    issuer: 'IDFC FIRST Bank',
    network: 'Visa',
    annualFee: 0,
    urls: ['https://www.idfcfirstbank.com/credit-card/wealth-credit-card'],
    fallbackUrls: ['https://www.idfcfirstbank.com/credit-card/wealth-credit-card/features'],
  },
  // American Express
  {
    id: 'amex-gold',
    name: 'American Express Gold Charge Card',
    issuer: 'American Express',
    network: 'Amex',
    annualFee: 4500,
    urls: ['https://www.americanexpress.com/in/credit-cards/gold-card/'],
    fallbackUrls: [],
    preferPlaywright: true,
  },
];
