import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

export default function BackgroundPattern() {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.pattern} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  pattern: {
    flex: 1,
    opacity: 0.1, // Subtle so it doesn't distract from the vibrant cards
    ...(Platform.OS === 'web' && {
      backgroundImage: 'radial-gradient(circle, #FFFFFF 2px, transparent 2px)',
      backgroundSize: '32px 32px',
    }),
  }
});
