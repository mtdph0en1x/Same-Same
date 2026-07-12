import React, { useRef } from 'react';
import { Animated, TouchableWithoutFeedback, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../styles/theme';

export default function Button({ title, onPress, type = 'primary', style }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  };

  const handlePress = () => {
    if (onPress) onPress();
  };

  const isPrimary = type === 'primary';
  const buttonStyle = isPrimary ? styles.buttonPrimary : styles.buttonSecondary;

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
    >
      <Animated.View style={[buttonStyle, style, { transform: [{ scale }] }]}>
        <Text style={styles.buttonText}>{title}</Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderBottomWidth: 6,
    borderBottomColor: '#BE123C', // Darker shade of primary
  },
  buttonSecondary: {
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderBottomWidth: 6,
    borderBottomColor: '#1D4ED8', // Darker shade of accent
  },
  buttonText: {
    color: theme.colors.onPrimary,
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    letterSpacing: 1,
  },
});
