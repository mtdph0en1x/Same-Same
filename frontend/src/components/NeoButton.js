import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function NeoButton({ 
  onPress, 
  children, 
  style, 
  disabled = false, 
  scaleTo = 0.9,
  activeOpacity, // Ignore activeOpacity from TouchableOpacity
  ...props
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e) => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 20,
      bounciness: 12,
    }).start();
    if (props.onPressIn) props.onPressIn(e);
  };

  const handlePressOut = (e) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 12,
    }).start();
    if (props.onPressOut) props.onPressOut(e);
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[style, { transform: [{ scale }], opacity: disabled ? 0.5 : 1 }]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
