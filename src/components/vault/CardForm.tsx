/**
 * CardForm — shared Add / Edit card form.
 * Create mode: catalog typeahead autofills metadata + editable benefit drafts.
 * Encrypts on save in the mutation layer; this form never logs PAN/CVV.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { FloatingLabelField } from '@/components/auth/FloatingLabelField';
import { SensitiveField } from '@/components/vault/SensitiveField';
import { CardNumberField } from '@/components/vault/CardNumberField';
import { CatalogPicker } from '@/components/vault/CatalogPicker';
import { CatalogBenefitsSummary } from '@/components/vault/CatalogBenefitsSummary';
import { ExpiryMonthYearField } from '@/components/vault/ExpiryMonthYearField';
import { AppText } from '@/components/ui/AppText';
import { PillButton } from '@/components/ui/PillButton';
import { Toggle } from '@/components/ui/Toggle';
import { CardFace } from '@/components/vault/CardFace';
import {
  NetworkBadge,
  networkAccessibilityLabel,
} from '@/components/vault/NetworkBadge';
import {
  CARD_THEME_PRESETS,
  DEFAULT_CARD_THEME,
  suggestThemeForBank,
} from '@/lib/cardThemes';
import {
  detectNetwork,
  digitsOnly,
  formatCardNumberGroups,
  isValidLuhn,
} from '@/lib/cardUtils';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useDuplicateCardGuard } from '@/hooks/useDuplicateCardGuard';
import {
  CARD_NETWORKS,
  type BenefitFormInput,
  type CardCatalogEntry,
  type CardColorTheme,
  type CardFormInput,
  type CardNetwork,
  type VaultCard,
  hasStoredCvv,
} from '@/types/card';

interface CardFormProps {
  mode: 'create' | 'edit';
  initial?: VaultCard;
  loading?: boolean;
  onSubmit: (input: CardFormInput) => void;
  onCancel?: () => void;
  /** Auth user — enables live duplicate checks against the vault. */
  userId?: string;
  /** Edit only — never treat this card as a duplicate of itself. */
  excludeCardId?: string | null;
  /**
   * Prefill PAN from scan/NFC — digits only or grouped.
   * Display stays masked (last 4); never briefly flashes full number.
   */
  scannedCardNumber?: string | null;
  scannedExpiryMonth?: number | null;
  scannedExpiryYear?: number | null;
  scannedNetwork?: CardNetwork | null;
  /**
   * Prefill for Name on card (future OCR / NFC). When set, triggers the same
   * highlight treatment as other scanned fields. Camera OCR is not shipped yet.
   */
  scannedCardholderName?: string | null;
  /** Editable default suggestion (e.g. profile display name) for create mode. */
  suggestedCardholderName?: string | null;
  /** e.g. bank masked NFC PAN — shown once above the form. */
  captureNotice?: string | null;
}

const currentYear = new Date().getFullYear();

function seedsToDrafts(entry: CardCatalogEntry): BenefitFormInput[] {
  return entry.defaultBenefits.map((b) => ({
    title: b.title,
    category: b.category,
    description: b.description,
    valueEstimate: b.value_estimate,
  }));
}

export function CardForm({
  mode,
  initial,
  loading,
  onSubmit,
  onCancel,
  userId,
  excludeCardId = null,
  scannedCardNumber,
  scannedExpiryMonth,
  scannedExpiryYear,
  scannedNetwork,
  scannedCardholderName,
  suggestedCardholderName,
  captureNotice,
}: CardFormProps) {
  const palette = usePalette();
  const { warnIfDuplicate } = useDuplicateCardGuard(userId);
  const scrollRef = React.useRef<React.ComponentRef<typeof KeyboardAwareScrollView>>(null);
  const identityOffsetY = React.useRef(0);
  const promptingDuplicate = React.useRef(false);
  /** Edit: only warn after identifying fields diverge from the loaded card. */
  const initialIdentityKey = React.useRef(
    initial
      ? `${initial.lastFour}|${initial.expiryMonth}|${initial.expiryYear}`
      : null,
  );
  const [catalogEntry, setCatalogEntry] = useState<CardCatalogEntry | null>(null);
  // NFC/scan only prefill PAN/expiry/network — keep catalog search available
  // so users can still pick bank/card for benefits. Manual mode is edit-only
  // by default (or when the user taps “Enter manually”).
  const [manualMode, setManualMode] = useState(mode === 'edit');
  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [bankName, setBankName] = useState(initial?.bankName ?? '');
  const [network, setNetwork] = useState<CardNetwork>(
    scannedNetwork ?? initial?.network ?? 'Visa',
  );
  const [cardholderName, setCardholderName] = useState(() => {
    if (mode === 'edit') return initial?.cardholderName ?? '';
    if (scannedCardholderName?.trim()) return scannedCardholderName.trim();
    return suggestedCardholderName?.trim() ?? '';
  });
  const [cardholderHighlight, setCardholderHighlight] = useState(() =>
    scannedCardholderName?.trim() ? 1 : 0,
  );
  const [cardholderTouched, setCardholderTouched] = useState(
    () => Boolean(initial?.cardholderName?.trim() || scannedCardholderName?.trim()),
  );
  const [cardNumber, setCardNumber] = useState(() =>
    scannedCardNumber ? formatCardNumberGroups(digitsOnly(scannedCardNumber)) : '',
  );
  const [panHighlight, setPanHighlight] = useState(() => (scannedCardNumber ? 1 : 0));
  const [expiryMonth, setExpiryMonth] = useState(
    scannedExpiryMonth ?? initial?.expiryMonth ?? 1,
  );
  const [expiryYear, setExpiryYear] = useState(
    scannedExpiryYear ?? initial?.expiryYear ?? currentYear + 3,
  );
  const [storeCvv, setStoreCvv] = useState(initial ? hasStoredCvv(initial) : false);
  const [cvv, setCvv] = useState('');
  const [themeId, setThemeId] = useState<CardColorTheme>(
    initial?.cardColorTheme ?? DEFAULT_CARD_THEME,
  );
  /** Once the user picks a swatch, stop auto-applying bank suggestions. */
  const [themeTouched, setThemeTouched] = useState(mode === 'edit');
  const [suggestedTheme, setSuggestedTheme] = useState<CardColorTheme | null>(
    null,
  );
  const [suggestedBankLabel, setSuggestedBankLabel] = useState<string | null>(
    null,
  );
  const [annualFee, setAnnualFee] = useState(
    initial?.annualFee != null ? String(initial.annualFee) : '',
  );
  const [feeDueDate, setFeeDueDate] = useState(initial?.feeDueDate ?? '');
  const [cardOpenedApprox, setCardOpenedApprox] = useState(
    initial?.cardOpenedApprox ?? '',
  );
  const [draftBenefits, setDraftBenefits] = useState<BenefitFormInput[]>([]);
  const [livePreviewMessage, setLivePreviewMessage] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // Apply scan/NFC prefill without ever defaulting to a revealed PAN.
  // Do not flip manualMode — that would hide catalog search results.
  React.useEffect(() => {
    if (!scannedCardNumber) return;
    const grouped = formatCardNumberGroups(digitsOnly(scannedCardNumber));
    if (!grouped) return;
    setCardNumber(grouped);
    setPanHighlight((n) => n + 1);
    const detected = detectNetwork(grouped);
    if (detected) setNetwork(detected);
    else if (scannedNetwork) setNetwork(scannedNetwork);
  }, [scannedCardNumber, scannedNetwork]);

  React.useEffect(() => {
    if (scannedExpiryMonth != null && scannedExpiryMonth >= 1 && scannedExpiryMonth <= 12) {
      setExpiryMonth(scannedExpiryMonth);
    }
    if (
      scannedExpiryYear != null &&
      scannedExpiryYear >= currentYear - 1 &&
      scannedExpiryYear <= currentYear + 20
    ) {
      setExpiryYear(scannedExpiryYear);
    }
  }, [scannedExpiryMonth, scannedExpiryYear]);

  React.useEffect(() => {
    const name = scannedCardholderName?.trim();
    if (!name) return;
    setCardholderName(name);
    setCardholderTouched(true);
    setCardholderHighlight((n) => n + 1);
  }, [scannedCardholderName]);

  // Late-arriving profile suggestion — only if the user hasn't edited yet.
  React.useEffect(() => {
    if (mode !== 'create' || cardholderTouched) return;
    const suggestion = suggestedCardholderName?.trim();
    if (!suggestion) return;
    setCardholderName(suggestion);
  }, [suggestedCardholderName, mode, cardholderTouched]);

  /**
   * Live duplicate check — fires as soon as last-four + expiry are available,
   * without waiting for nickname / CVV / fee / benefits.
   *
   * Number must be long enough (or Luhn-valid) so we don't re-prompt on every
   * keystroke while the sliding last-four is still changing.
   */
  React.useEffect(() => {
    const digits = digitsOnly(cardNumber);
    const numberReady =
      mode === 'edit'
        ? digits.length === 0 || digits.length >= 15 || isValidLuhn(digits)
        : digits.length >= 15 || isValidLuhn(digits);
    if (!numberReady) return;

    const lastFour =
      digits.length >= 4
        ? digits.slice(-4)
        : mode === 'edit'
          ? (initial?.lastFour ?? '')
          : '';
    if (lastFour.length !== 4) return;

    const identityKey = `${lastFour}|${expiryMonth}|${expiryYear}`;
    // Edit: don't warn until the user actually changes identifying fields.
    if (
      mode === 'edit' &&
      initialIdentityKey.current &&
      identityKey === initialIdentityKey.current
    ) {
      return;
    }

    if (promptingDuplicate.current) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        if (cancelled || promptingDuplicate.current) return;
        promptingDuplicate.current = true;
        try {
          const proceed = await warnIfDuplicate({
            bankName,
            cardNumber: digits.length >= 4 ? digits : '',
            lastFour,
            expiryMonth,
            expiryYear,
            excludeCardId,
            fallbackLastFour: initial?.lastFour ?? null,
            skipIfAlreadyPrompted: true,
          });
          if (cancelled) return;
          if (!proceed) {
            // Cancel → keep values, scroll back to number/expiry.
            (
              scrollRef.current as unknown as {
                scrollTo?: (o: { y: number; animated?: boolean }) => void;
              }
            )?.scrollTo?.({
              y: Math.max(0, identityOffsetY.current - 16),
              animated: true,
            });
          }
        } finally {
          promptingDuplicate.current = false;
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    cardNumber,
    expiryMonth,
    expiryYear,
    bankName,
    mode,
    initial?.lastFour,
    excludeCardId,
    warnIfDuplicate,
  ]);

  const showIdentityFields = mode === 'edit' || manualMode || Boolean(catalogEntry);

  const applyThemeSuggestion = (
    theme: CardColorTheme,
    bankLabel: string | null,
    force: boolean,
  ) => {
    setSuggestedTheme(theme);
    setSuggestedBankLabel(bankLabel);
    if (force || !themeTouched) {
      setThemeId(theme);
    }
  };

  const previewLastFour =
    digitsOnly(cardNumber).length >= 4
      ? digitsOnly(cardNumber).slice(-4)
      : initial?.lastFour ?? '0000';

  const onCardNumberChange = (text: string) => {
    const digits = digitsOnly(text).slice(0, 19);
    setCardNumber(formatCardNumberGroups(digits));
    const detected = detectNetwork(digits);
    if (detected) setNetwork(detected);
  };

  const applyCatalog = (
    entry: CardCatalogEntry,
    meta?: { fromLiveSearch?: boolean; message?: string },
  ) => {
    setCatalogEntry(entry);
    setManualMode(false);
    setNickname(entry.cardName);
    setBankName(entry.bankName);
    setNetwork(entry.network);
    setThemeTouched(false);
    applyThemeSuggestion(
      entry.defaultColorTheme ?? entry.cardColorTheme ?? DEFAULT_CARD_THEME,
      entry.bankName,
      true,
    );
    setAnnualFee(
      entry.defaultAnnualFee != null ? String(entry.defaultAnnualFee) : '',
    );
    setDraftBenefits(seedsToDrafts(entry));
    setLivePreviewMessage(
      meta?.fromLiveSearch
        ? meta.message ??
            `Here’s what we found for ${entry.cardName} — does this look right?`
        : null,
    );
  };

  const clearCatalog = () => {
    setCatalogEntry(null);
    setDraftBenefits([]);
    setLivePreviewMessage(null);
    setSuggestedTheme(null);
    setSuggestedBankLabel(null);
  };

  const onBankNameChange = (text: string) => {
    setBankName(text);
    if (catalogEntry || mode === 'edit') return;
    const matched = suggestThemeForBank(text);
    if (matched) {
      applyThemeSuggestion(matched, text.trim() || null, false);
    } else {
      setSuggestedTheme(null);
      setSuggestedBankLabel(null);
      if (!themeTouched) setThemeId(DEFAULT_CARD_THEME);
    }
  };

  const onThemePick = (id: CardColorTheme) => {
    setThemeTouched(true);
    setThemeId(id);
  };

  const canSave = useMemo(() => {
    if (!nickname.trim() || !bankName.trim()) return false;
    if (mode === 'create') {
      return isValidLuhn(digitsOnly(cardNumber));
    }
    const digits = digitsOnly(cardNumber);
    return digits.length === 0 || isValidLuhn(digits);
  }, [nickname, bankName, cardNumber, mode]);

  const submit = () => {
    setError(null);
    const digits = digitsOnly(cardNumber);
    if (mode === 'create' && !isValidLuhn(digits)) {
      setError('Enter a valid card number.');
      return;
    }
    if (mode === 'edit' && digits.length > 0 && !isValidLuhn(digits)) {
      setError('Enter a valid card number.');
      return;
    }
    onSubmit({
      nickname: nickname.trim(),
      bankName: bankName.trim(),
      network,
      cardholderName: cardholderName.trim(),
      cardNumber: digits,
      expiryMonth,
      expiryYear,
      storeCvv,
      cvv: digitsOnly(cvv),
      cardColorTheme: themeId,
      annualFee: annualFee.trim() ? Number(annualFee) : null,
      feeDueDate: feeDueDate.trim() || null,
      cardOpenedApprox: cardOpenedApprox.trim() || null,
      draftBenefits: mode === 'create' ? draftBenefits : undefined,
    });
  };

  const updateDraft = (index: number, patch: Partial<BenefitFormInput>) => {
    setDraftBenefits((prev) =>
      prev.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    );
  };

  const removeDraft = (index: number) => {
    setDraftBenefits((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <KeyboardAwareScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <CardFace
        nickname={nickname || 'Card nickname'}
        bankName={bankName || 'Bank'}
        network={network}
        lastFour={previewLastFour}
        themeId={themeId}
        expiryMonth={expiryMonth}
        expiryYear={expiryYear}
        cardholderName={cardholderName.trim() || null}
        style={styles.preview}
      />

      {captureNotice ? (
        <View
          style={[
            styles.notice,
            {
              backgroundColor: palette.amberSoft,
              borderColor: palette.glassBorder,
            },
          ]}
        >
          <Ionicons name="information-circle-outline" size={18} color={palette.amber} />
          <AppText variant="small" color={palette.amber} style={styles.noticeText}>
            {captureNotice}
          </AppText>
        </View>
      ) : null}

      {mode === 'create' ? (
        <CatalogPicker
          selected={catalogEntry}
          onSelect={applyCatalog}
          onClear={clearCatalog}
          onManual={() => {
            setManualMode(true);
            setCatalogEntry(null);
            setDraftBenefits([]);
            setLivePreviewMessage(null);
          }}
          manualMode={manualMode}
        />
      ) : null}

      {showIdentityFields ? (
        <>
          <FloatingLabelField
            label="Nickname"
            icon="pricetag-outline"
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="words"
          />
          <FloatingLabelField
            label="Bank name"
            icon="business-outline"
            value={bankName}
            onChangeText={onBankNameChange}
            autoCapitalize="words"
          />
        </>
      ) : null}

      {/* Name on card — always available (optional, independent of the
          catalog-first flow that gates nickname/bank). */}
      <View>
        <FloatingLabelField
          label="Name on card (optional)"
          icon="person-outline"
          value={cardholderName}
          onChangeText={(t) => {
            setCardholderTouched(true);
            setCardholderName(t);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          containerStyle={
            cardholderHighlight > 0
              ? { borderColor: palette.indigo, borderWidth: 1 }
              : undefined
          }
        />
        <AppText variant="caption" color={palette.textTertiary} style={styles.holderHint}>
          {cardholderHighlight > 0
            ? 'Filled from scan — edit if needed'
            : 'Printed name on the card. Leave blank for add-on cards.'}
        </AppText>
      </View>

      <View
        collapsable={false}
        style={styles.identityBlock}
        onLayout={(e) => {
          identityOffsetY.current = e.nativeEvent.layout.y;
        }}
      >
        <CardNumberField
          label={mode === 'edit' ? 'Card number (leave blank to keep)' : 'Card number'}
          value={cardNumber}
          onChangeText={onCardNumberChange}
          maxLength={23}
          highlightToken={panHighlight}
        />

        <View style={styles.networkSection}>
          <AppText variant="caption" color={palette.textTertiary}>
            Network
          </AppText>
          <View style={styles.chips}>
            {CARD_NETWORKS.map((n) => {
              const isSelected = network === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setNetwork(n)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={networkAccessibilityLabel(n)}
                  style={[
                    styles.networkChip,
                    isSelected
                      ? {
                          backgroundColor: palette.indigoSoft,
                          borderColor: palette.indigo,
                        }
                      : {
                          backgroundColor: 'transparent',
                          borderColor: 'transparent',
                        },
                  ]}
                >
                  <NetworkBadge network={n} size="sm" bare />
                </Pressable>
              );
            })}
          </View>
        </View>

        <ExpiryMonthYearField
          month={expiryMonth}
          year={expiryYear}
          yearSpan={10}
          onChange={(m, y) => {
            setExpiryMonth(m);
            setExpiryYear(y);
          }}
        />
      </View>

      <View style={styles.cvvRow}>
        <View style={styles.cvvCopy}>
          <AppText variant="body">Store CVV</AppText>
          <AppText variant="caption" color={palette.textTertiary}>
            Optional. Convenient for quick reveal, but anything stored can be decrypted on
            this device after biometrics.
          </AppText>
        </View>
        <Toggle value={storeCvv} onChange={setStoreCvv} />
      </View>
      {storeCvv ? (
        <SensitiveField
          label={
            mode === 'edit' && hasStoredCvv(initial!) && !cvv
              ? 'New CVV (blank keeps current)'
              : 'CVV'
          }
          icon="lock-closed-outline"
          value={cvv}
          onChangeText={(t) => setCvv(digitsOnly(t).slice(0, 4))}
          maxLength={4}
        />
      ) : null}

      <FloatingLabelField
        label="Annual fee (₹, optional)"
        icon="cash-outline"
        value={annualFee}
        onChangeText={setAnnualFee}
        keyboardType="number-pad"
      />
      <FloatingLabelField
        label="Fee due date"
        icon="calendar-outline"
        value={feeDueDate}
        onChangeText={setFeeDueDate}
        autoCapitalize="none"
        placeholder="2026-12-31"
      />
      <FloatingLabelField
        label="Approx. open date (e.g. Jun 2023)"
        icon="time-outline"
        value={cardOpenedApprox}
        onChangeText={setCardOpenedApprox}
        autoCapitalize="none"
      />
      <AppText variant="caption" color={palette.textTertiary}>
        Used to estimate renewal until an annual-fee debit is confirmed.
      </AppText>

      <AppText variant="caption" color={palette.textTertiary}>
        Color theme
      </AppText>
      {suggestedTheme && themeId === suggestedTheme && suggestedBankLabel ? (
        <AppText variant="small" color={palette.indigo}>
          Suggested for {suggestedBankLabel}
        </AppText>
      ) : null}
      <View style={styles.themes}>
        {CARD_THEME_PRESETS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => onThemePick(t.id)}
            style={[
              styles.themeSwatch,
              { backgroundColor: t.colors[0] },
              themeId === t.id && { borderColor: palette.white },
              suggestedTheme === t.id &&
                themeId !== t.id && {
                  borderColor: palette.indigo,
                  borderStyle: 'dashed',
                },
            ]}
            accessibilityLabel={
              suggestedTheme === t.id
                ? `${t.label} (suggested)`
                : t.label
            }
          />
        ))}
      </View>

      {mode === 'create' && livePreviewMessage && draftBenefits.length > 0 ? (
        <View
          style={[
            styles.notice,
            {
              backgroundColor: palette.indigoSoft,
              borderColor: palette.glassBorder,
            },
          ]}
        >
          <Ionicons name="sparkles-outline" size={18} color={palette.indigo} />
          <AppText variant="small" color={palette.textPrimary} style={styles.noticeText}>
            {livePreviewMessage}
          </AppText>
        </View>
      ) : null}

      {mode === 'create' && draftBenefits.length > 0 ? (
        <CatalogBenefitsSummary
          benefits={draftBenefits}
          bankLabel={bankName || catalogEntry?.bankName || null}
          onChange={updateDraft}
          onRemove={removeDraft}
        />
      ) : null}

      {error ? (
        <AppText variant="small" color={palette.amber}>
          {error}
        </AppText>
      ) : null}

      <PillButton
        label={mode === 'create' ? 'Save card' : 'Save changes'}
        icon="shield-checkmark"
        size="lg"
        onPress={submit}
        loading={loading}
        disabled={!canSave || loading}
        fullWidth
      />
      {onCancel ? (
        <PillButton label="Cancel" variant="ghost" onPress={onCancel} fullWidth />
      ) : null}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
    gap: spacing.md,
  },
  preview: { marginBottom: spacing.sm },
  /** Spaces card number / network / expiry like the rest of the form. */
  identityBlock: { gap: spacing.md },
  /** Matches ExpiryMonthYearField wrap: label → control gap. */
  networkSection: { gap: spacing.sm },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  /**
   * Rectangular tile around the 40×26 network mark — no inner padding so the
   * selection border sits flush on the logo. Corner radius matches the mark
   * (NETWORK_BADGE_SIZE.sm.radius = 6); radius.pill must not be used here.
   */
  networkChip: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    borderRadius: 6,
    borderWidth: 1,
  },
  cvvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  cvvCopy: { flex: 1, gap: 4 },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  themeSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  noticeText: { flex: 1, lineHeight: 18 },
  holderHint: { marginTop: -spacing.xs, marginLeft: spacing.xs },
});
