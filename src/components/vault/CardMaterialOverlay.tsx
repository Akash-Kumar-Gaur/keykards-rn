/**
 * Shared premium card-material overlay — payment-card faces only.
 *
 * Soft bevel + diagonal brushed texture. Never use on GlassCard / chrome
 * panels: the diagonal bands read as faint line artifacts on light surfaces.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function CardMaterialOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.14)',
          'rgba(255,255,255,0.045)',
          'rgba(255,255,255,0)',
        ]}
        locations={[0, 0.32, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.softBevel}
      />
      <LinearGradient
        colors={[
          'rgba(255,255,255,0)',
          'rgba(255,255,255,0.035)',
          'rgba(255,255,255,0)',
          'rgba(0,0,0,0.035)',
          'rgba(255,255,255,0)',
        ]}
        locations={[0, 0.24, 0.5, 0.74, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  softBevel: {
    position: 'absolute',
    top: 1,
    left: 12,
    right: 12,
    height: 12,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
});
