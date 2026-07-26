/**
 * Stack wrapper that applies the active canvas background from usePalette.
 */

import React from 'react';
import { Stack } from 'expo-router';
import { usePalette } from '@/providers/AppThemeProvider';

type StackProps = React.ComponentProps<typeof Stack>;

export function ThemedStack({
  screenOptions,
  children,
}: {
  screenOptions?: StackProps['screenOptions'];
  children?: React.ReactNode;
}) {
  const palette = usePalette();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.navy950 },
        ...screenOptions,
      }}
    >
      {children}
    </Stack>
  );
}
