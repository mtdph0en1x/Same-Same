export const theme = {
  colors: {
    primary: '#FBBF24', // Vibrant Mustard Yellow
    onPrimary: '#111827',
    secondary: '#7E22CE', // Darker Purple
    accent: '#10B981', // Mint Green
    background: '#1F2937', // Dark Gray / Slate background
    foreground: '#F9FAFB', // White text
    muted: '#374151',
    border: '#000000', // Hard black borders
    destructive: '#EF4444',
    ring: '#FBBF24',
  },
  fonts: {
    heading: 'Fredoka_600SemiBold',
    headingBold: 'Fredoka_700Bold',
    body: 'Nunito_400Regular',
    bodyBold: 'Nunito_600SemiBold',
    headingFallback: 'Nunito_800ExtraBold',
    headingBoldFallback: 'Nunito_900Black',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 0,
    md: 4,
    lg: 8,
    pill: 9999,
  },
  shadows: {
    neobrutal: {
      shadowColor: '#000',
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 0,
    },
    neobrutalActive: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 0,
    }
  },
};
