import React from 'react';
import AppText from './AppText';
import { StyleSheet, View, Text } from 'react-native';

const shapes = [
  { type: 'text', content: '?', color: '#EF4444', size: 180, top: '10%', left: '5%', rotation: '-15deg' },
  { type: 'text', content: '!', color: '#3B82F6', size: 220, bottom: '15%', right: '8%', rotation: '25deg' },
  { type: 'text', content: '⭐', color: '#FCD34D', size: 120, top: '20%', right: '15%', rotation: '45deg' },
  { type: 'text', content: '❓', color: '#10B981', size: 150, bottom: '25%', left: '12%', rotation: '-30deg' },
  { type: 'box', color: '#FCD34D', size: 100, top: '40%', left: '2%', rotation: '10deg' },
  { type: 'circle', color: '#8B5CF6', size: 140, top: '60%', right: '2%', rotation: '0deg' },
  { type: 'box', color: '#F472B6', size: 80, bottom: '5%', left: '40%', rotation: '-20deg' },
];

export default function MessyDeskBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {shapes.map((shape, index) => {
        const style = {
          position: 'absolute',
          top: shape.top,
          bottom: shape.bottom,
          left: shape.left,
          right: shape.right,
          transform: [{ rotate: shape.rotation }],
          opacity: 0.15, // Keep it subtle so it doesn't distract from the game
          zIndex: -1,
        };

        if (shape.type === 'text') {
          return (
            <AppText key={index} style={[style, { fontSize: shape.size, fontWeight: '900', color: shape.color }]}>
              {shape.content}
            </AppText>
          );
        }

        if (shape.type === 'box') {
          return (
            <View key={index} style={[style, {
              width: shape.size,
              height: shape.size,
              backgroundColor: shape.color,
              borderWidth: 6,
              borderColor: '#000',
            }]} />
          );
        }

        if (shape.type === 'circle') {
          return (
            <View key={index} style={[style, {
              width: shape.size,
              height: shape.size,
              borderRadius: shape.size / 2,
              backgroundColor: shape.color,
              borderWidth: 6,
              borderColor: '#000',
            }]} />
          );
        }

        return null;
      })}
    </View>
  );
}
