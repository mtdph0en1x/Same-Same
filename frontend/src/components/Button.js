import React, { useRef } from 'react';
import { Animated, TouchableWithoutFeedback, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../styles/theme';

// Shadow offset — matches the badge's hard drop shadow exactly
const SHADOW_X = 4;
const SHADOW_Y = 4;

export default function Button({ title, onPress, type = 'primary', style, icon }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: SHADOW_X,
        useNativeDriver: true,
        speed: 40,
        bounciness: 0,
      }),
      Animated.spring(translateY, {
        toValue: SHADOW_Y,
        useNativeDriver: true,
        speed: 40,
        bounciness: 0,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        speed: 25,
        bounciness: 4,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 25,
        bounciness: 4,
      }),
    ]).start();
  };

  const handlePress = () => {
    if (onPress) onPress();
  };

  const bg = type === 'primary' ? theme.colors.primary : theme.colors.accent;

  return (
    // Black shadow block — sized by the button sitting on top with a negative offset
    <View style={[styles.shadow, style]}>
      <TouchableWithoutFeedback
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <Animated.View
          style={[
            styles.button,
            { backgroundColor: bg },
            { transform: [{ translateX: translateX.interpolate({ inputRange: [0, SHADOW_X], outputRange: [-SHADOW_X, 0] }) },
                          { translateY: translateY.interpolate({ inputRange: [0, SHADOW_Y], outputRange: [-SHADOW_Y, 0] }) }] },
            icon && { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
          ]}
        >
          {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
          <Text style={styles.buttonText}>{title}</Text>
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  // The black block IS the shadow — button lifts off it
  shadow: {
    backgroundColor: '#000',
    borderRadius: theme.borderRadius.sm, // sharp corners like the badge
  },
  button: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#000',
    // Resting position: lifted off the shadow by the offset amount
    marginTop: -SHADOW_Y,
    marginLeft: -SHADOW_X,
  },
  buttonText: {
    color: '#000',
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
