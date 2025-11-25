/**
 * Brand Design System Tokens
 * 
 * This file contains the exact color specifications, typography system,
 * and spacing tokens for the AR Store Gamification app.
 */

// Brand color tokens (exact specification)
export const BrandTokens = {
  // Core brand colors
  bgDarkGray: '#656565',
  white: '#FEFEFE',
  inputGray: '#E4E4E4',
  brandLime: '#B5FD1D',
  brandBlue: '#1401FE',
  ctaPink: '#F76DEF',
  accentPurple: '#7D75FB',
  
  // Accessible variants (WCAG 2.1 AA compliant)
  brandLimeDark: '#9AC800',
  ctaPinkDark: '#DD56C9',
  mutedGray: '#9E9F9D',
  
  // Semantic colors
  success: '#4CAF50',
  warning: '#FFC107',
  error: '#F44336',
} as const;

// Typography system
export const Typography = {
  // Logo/Brand: Pixel style (Press Start 2P or custom bitmap)
  brand: {
    fontFamily: 'PressStart2P-Regular',
    fontSize: 24,
    letterSpacing: 2,
  },
  
  // Headings: Geometric sans (Poppins)
  h1: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
  },
  h2: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  
  // Body text (Inter)
  body: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  
  // UI elements
  button: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  inputLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    fontWeight: '400' as const,
    color: '#9E9F9D',
  },
} as const;

// Spacing system (8pt grid)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  xxxxl: 48,
} as const;

// Border radius tokens
export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

// Shadow tokens
export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  button: {
    shadowColor: BrandTokens.ctaPink,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

// Animation timing tokens
export const AnimationTiming = {
  fast: 150,
  normal: 220,
  slow: 420,
  splash: 420,
} as const;

// Animation easing curves
export const AnimationEasing = {
  easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;