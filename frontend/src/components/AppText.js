import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import i18next from 'i18next';
import { theme } from '../styles/theme';

export default function AppText({ style, ...props }) {
  const isCyrillic = ['ru', 'uk'].includes(i18next.language);

  let customStyle = style;
  if (isCyrillic) {
    const flatStyle = StyleSheet.flatten(style) || {};
    if (flatStyle.fontFamily && flatStyle.fontFamily.includes('Fredoka')) {
      // If it's the heading font (Fredoka), replace it with the heavy body font (Nunito Black)
      customStyle = [
        style, 
        { 
          fontFamily: flatStyle.fontFamily === 'Fredoka_700Bold' || flatStyle.fontFamily === theme.fonts.headingBold
            ? theme.fonts.headingBoldFallback 
            : theme.fonts.headingFallback,
        }
      ];
    }
  }

  return <RNText style={customStyle} {...props} />;
}
