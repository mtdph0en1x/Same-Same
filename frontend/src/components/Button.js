import React, { useRef } from 'react';
import { Animated, TouchableWithoutFeedback, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../styles/theme';

export default function Button({ title, onPress, type = 'primary', style }) {
  const translateY = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.spring(translateY, {
      toValue: 6,
      useNativeDriver: true,
      speed: 30,
      bounciness: 12,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 12,
    }).start();
  };

  const handlePress = () => {
    if (onPress) onPress();
  };

  const isPrimary = type === 'primary';
  const buttonStyle = isPrimary ? styles.buttonPrimary : styles.buttonSecondary;

  return (
    <View style={[styles.container, style]}>
      <TouchableWithoutFeedback
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <Animated.View style={[buttonStyle, { transform: [{ translateY }] }]}>
          <Text style={styles.buttonText}>{title}</Text>
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    borderRadius: theme.borderRadius.md,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    marginTop: -6, // To rest above the black container
    marginLeft: -4,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    marginTop: -6,
    marginLeft: -4,
  },
  buttonText: {
    color: '#000',
    fontFamily: theme.fonts.headingBold,
    fontSize: 24,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
