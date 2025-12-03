/**
 * Profile screen colors - matches app-wide Colors constants
 * Uses standard app design system for consistency
 */

import { Colors } from './Colors';

export const ProfileColors = {
  // Use app-wide colors for consistency
  primary: Colors.primary,        // #FF6600
  secondary: Colors.secondary,    // #C4460C
  
  // Backgrounds - match app standard
  background: Colors.background,  // #000000
  surface: Colors.surface,        // #1A1A1A
  card: Colors.card,             // #2A2A2A
  
  // Borders & Dividers - match app standard
  border: Colors.border,          // #333333
  
  // Text - match app standard
  text: Colors.text,              // #FFFFFF
  textSecondary: Colors.textSecondary,  // #CCCCCC
  textMuted: Colors.textMuted,    // #888888
  
  // Status colors - match app standard
  success: Colors.success,        // #4CAF50
  warning: Colors.warning,        // #FFC107
  error: Colors.error,           // #F44336
} as const;
