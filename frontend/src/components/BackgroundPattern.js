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
    opacity: 0.1,
  }
});
