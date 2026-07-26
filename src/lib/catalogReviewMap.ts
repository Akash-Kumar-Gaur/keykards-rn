/**
 * Shared category map for catalog review (mirrors worker categoryMap).
 */

import type { BenefitCategory } from '@/types/card';

export function mapBenefitCategory(raw: string): BenefitCategory {
  const key = raw.toLowerCase();
  if (key === 'lounge') return 'lounge';
  if (key === 'dining') return 'dining';
  if (key === 'travel') return 'travel';
  if (key === 'shopping' || key === 'milestone') return 'shopping';
  if (key === 'fuel') return 'fuel';
  if (key === 'entertainment') return 'entertainment';
  return 'other';
}
