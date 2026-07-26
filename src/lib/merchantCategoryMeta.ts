/**
 * Map merchant / txn type → category icon (reuses Track benefit category set).
 */

import { categoryMeta } from '@/components/card/benefitCategoryMeta';
import type { TransactionType } from '@/types/track';

export function merchantCategoryMeta(
  merchantRaw: string,
  transactionType?: TransactionType,
  storedCategory?: string | null,
) {
  if (transactionType === 'points_credit') {
    return { ...categoryMeta('other'), icon: 'sparkles-outline' as const, label: 'Points' };
  }
  if (transactionType === 'annual_fee_debit') {
    return { ...categoryMeta('other'), icon: 'card-outline' as const, label: 'Fee' };
  }

  if (storedCategory) {
    return categoryMeta(storedCategory);
  }

  const m = merchantRaw.toLowerCase();
  if (
    /swiggy|zomato|restaurant|cafe|dining|eats|starbucks|dominos|pizza|mcdonald/.test(
      m,
    )
  ) {
    return categoryMeta('dining');
  }
  if (
    /amazon|flipkart|myntra|ajio|shopping|store|bigbasket|blinkit|zepto|nykaa/.test(m)
  ) {
    return categoryMeta('shopping');
  }
  if (
    /uber|ola|indigo|air|flight|makemytrip|goibibo|travel|hotel|irctc|rapido/.test(m)
  ) {
    return categoryMeta('travel');
  }
  if (/petrol|fuel|hpcl|iocl|bpcl|shell|indian oil/.test(m)) {
    return categoryMeta('fuel');
  }
  if (/netflix|spotify|bookmyshow|pvr|cinema|hotstar|youtube/.test(m)) {
    return categoryMeta('entertainment');
  }
  if (/lounge|airport/.test(m)) {
    return categoryMeta('lounge');
  }
  return categoryMeta('other');
}
