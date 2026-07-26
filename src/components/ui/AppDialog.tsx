/**
 * AppDialog — the app's themed replacement for native Alert.alert().
 *
 * Centred glass panel over a scrim: optional tinted icon badge, title, body
 * copy and pill actions. `AppDialogHost` is mounted once at the app root and
 * renders whatever `dialogStore` has queued, so any module can raise a dialog
 * without threading props or context.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from './AppText';
import { PillButton } from './PillButton';
import { radius, spacing } from '@/theme';
import { usePalette } from '@/providers/AppThemeProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  useDialogStore,
  type DialogAction,
  type DialogTone,
} from '@/stores/dialogStore';

type IconName = keyof typeof Ionicons.glyphMap;

function toneMap(palette: ReturnType<typeof usePalette>): Record<
  DialogTone,
  { bg: string; fg: string }
> {
  return {
    indigo: { bg: palette.indigoSoft, fg: palette.indigo },
    amber: { bg: palette.amberSoft, fg: palette.amber },
    green: { bg: palette.greenSoft, fg: palette.green },
    danger: { bg: palette.dangerSoft, fg: palette.danger },
  };
}

export type AppDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  icon?: string;
  tone?: DialogTone;
  actions?: DialogAction[];
  dismissable?: boolean;
  onDismiss: () => void;
};

export function AppDialog({
  visible,
  title,
  message,
  icon,
  tone = 'indigo',
  actions,
  dismissable = true,
  onDismiss,
}: AppDialogProps) {
  const palette = usePalette();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = reduced
        ? withTiming(1, { duration: 120 })
        : withSpring(1, { damping: 18, stiffness: 240, mass: 0.85 });
    } else if (mounted) {
      progress.value = withTiming(0, { duration: 160 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduced]);

  const requestClose = useCallback(() => {
    if (!dismissable) return;
    onDismiss();
  }, [dismissable, onDismiss]);

  useEffect(() => {
    if (!mounted) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      requestClose();
      return true;
    });
    return () => sub.remove();
  }, [mounted, requestClose]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: reduced ? 1 : 0.94 + progress.value * 0.06 }],
  }));

  if (!mounted) return null;

  const resolved: DialogAction[] =
    actions && actions.length > 0 ? actions : [{ label: 'OK', variant: 'primary' }];
  const toneColors = toneMap(palette)[tone];
  const stacked = resolved.length > 2;

  return (
    <Modal transparent visible animationType="none" onRequestClose={requestClose} statusBarTranslucent>
      <View style={styles.root}>
        <AnimatedPressable
          style={[styles.scrim, { backgroundColor: palette.overlayScrim }, scrimStyle]}
          onPress={requestClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <Animated.View
          style={[
            styles.panel,
            {
              backgroundColor: palette.navy850,
              borderColor: palette.glassBorderStrong,
            },
            panelStyle,
          ]}
          accessibilityViewIsModal
        >
          {icon ? (
            <View style={[styles.iconWrap, { backgroundColor: toneColors.bg }]}>
              <Ionicons name={icon as IconName} size={26} color={toneColors.fg} />
            </View>
          ) : null}

          <AppText variant="title" style={styles.title}>
            {title}
          </AppText>

          {message ? (
            <ScrollView
              style={styles.messageScroll}
              contentContainerStyle={styles.messageContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <AppText variant="small" color={palette.textSecondary} style={styles.message}>
                {message}
              </AppText>
            </ScrollView>
          ) : null}

          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {resolved.map((action, i) => (
              <PillButton
                key={`${action.label}-${i}`}
                label={action.label}
                variant={action.variant ?? (i === resolved.length - 1 ? 'primary' : 'ghost')}
                tone={action.destructive ? 'danger' : 'accent'}
                size="md"
                fullWidth={stacked}
                style={stacked ? undefined : styles.action}
                onPress={() => {
                  void action.onPress?.();
                  if (!action.keepOpen) onDismiss();
                }}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Mount once near the app root. Renders the front of the dialog queue. */
export function AppDialogHost() {
  const queue = useDialogStore((s) => s.queue);
  const dismiss = useDialogStore((s) => s.dismiss);
  const current = queue[0];

  return (
    <AppDialog
      visible={Boolean(current)}
      title={current?.title ?? ''}
      message={current?.message}
      icon={current?.icon}
      tone={current?.tone}
      actions={current?.actions}
      dismissable={current?.dismissable ?? true}
      onDismiss={() => {
        if (current) dismiss(current.id);
      }}
    />
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { textAlign: 'center' },
  messageScroll: { alignSelf: 'stretch', maxHeight: 220 },
  messageContent: { paddingHorizontal: spacing.xs },
  message: { textAlign: 'center', lineHeight: 20 },
  actions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  action: { flex: 1 },
});
