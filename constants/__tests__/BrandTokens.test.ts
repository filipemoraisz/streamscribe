import { AnimationTiming, BorderRadius, BrandTokens, Shadows, Spacing, Typography } from '../BrandTokens';

describe('BrandTokens', () => {
  describe('Color tokens', () => {
    it('has all required brand colors', () => {
      expect(BrandTokens.bgDarkGray).toBe('#656565');
      expect(BrandTokens.white).toBe('#FEFEFE');
      expect(BrandTokens.inputGray).toBe('#E4E4E4');
      expect(BrandTokens.brandLime).toBe('#B5FD1D');
      expect(BrandTokens.brandBlue).toBe('#1401FE');
      expect(BrandTokens.ctaPink).toBe('#F76DEF');
      expect(BrandTokens.accentPurple).toBe('#7D75FB');
    });

    it('has accessible color variants', () => {
      expect(BrandTokens.brandLimeDark).toBe('#9AC800');
      expect(BrandTokens.ctaPinkDark).toBe('#DD56C9');
      expect(BrandTokens.mutedGray).toBe('#9E9F9D');
    });

    it('has semantic colors', () => {
      expect(BrandTokens.success).toBe('#4CAF50');
      expect(BrandTokens.warning).toBe('#FFC107');
      expect(BrandTokens.error).toBe('#F44336');
    });
  });

  describe('Typography tokens', () => {
    it('has brand typography configuration', () => {
      expect(Typography.brand.fontFamily).toBe('PressStart2P-Regular');
      expect(Typography.brand.fontSize).toBe(24);
      expect(Typography.brand.letterSpacing).toBe(2);
    });

    it('has heading typography configurations', () => {
      expect(Typography.h1.fontFamily).toBe('Poppins-Bold');
      expect(Typography.h1.fontSize).toBe(28);
      expect(Typography.h1.fontWeight).toBe('700');
      expect(Typography.h1.lineHeight).toBe(36);

      expect(Typography.h2.fontFamily).toBe('Poppins-SemiBold');
      expect(Typography.h2.fontSize).toBe(22);
      expect(Typography.h2.fontWeight).toBe('600');
      expect(Typography.h2.lineHeight).toBe(28);
    });

    it('has body typography configurations', () => {
      expect(Typography.body.fontFamily).toBe('Inter-Regular');
      expect(Typography.body.fontSize).toBe(16);
      expect(Typography.body.fontWeight).toBe('400');
      expect(Typography.body.lineHeight).toBe(24);

      expect(Typography.bodySmall.fontFamily).toBe('Inter-Regular');
      expect(Typography.bodySmall.fontSize).toBe(14);
      expect(Typography.bodySmall.fontWeight).toBe('400');
      expect(Typography.bodySmall.lineHeight).toBe(20);
    });

    it('has UI element typography configurations', () => {
      expect(Typography.button.fontFamily).toBe('Inter-SemiBold');
      expect(Typography.button.fontSize).toBe(16);
      expect(Typography.button.fontWeight).toBe('600');
      expect(Typography.button.letterSpacing).toBe(0.5);
      expect(Typography.button.textTransform).toBe('uppercase');

      expect(Typography.inputLabel.fontFamily).toBe('Inter-Regular');
      expect(Typography.inputLabel.fontSize).toBe(14);
      expect(Typography.inputLabel.fontWeight).toBe('400');
      expect(Typography.inputLabel.color).toBe('#9E9F9D');
    });
  });

  describe('Spacing tokens', () => {
    it('follows 8pt grid system', () => {
      expect(Spacing.xs).toBe(4);
      expect(Spacing.sm).toBe(8);
      expect(Spacing.md).toBe(12);
      expect(Spacing.lg).toBe(16);
      expect(Spacing.xl).toBe(24);
      expect(Spacing.xxl).toBe(32);
      expect(Spacing.xxxl).toBe(40);
      expect(Spacing.xxxxl).toBe(48);
    });
  });

  describe('Border radius tokens', () => {
    it('has all required border radius values', () => {
      expect(BorderRadius.xs).toBe(4);
      expect(BorderRadius.sm).toBe(8);
      expect(BorderRadius.md).toBe(12);
      expect(BorderRadius.lg).toBe(16);
      expect(BorderRadius.xl).toBe(24);
      expect(BorderRadius.pill).toBe(999);
    });
  });

  describe('Shadow tokens', () => {
    it('has card shadow configuration', () => {
      expect(Shadows.card.shadowColor).toBe('#000');
      expect(Shadows.card.shadowOffset.width).toBe(0);
      expect(Shadows.card.shadowOffset.height).toBe(2);
      expect(Shadows.card.shadowOpacity).toBe(0.08);
      expect(Shadows.card.shadowRadius).toBe(8);
      expect(Shadows.card.elevation).toBe(4);
    });

    it('has button shadow configuration', () => {
      expect(Shadows.button.shadowColor).toBe(BrandTokens.ctaPink);
      expect(Shadows.button.shadowOffset.width).toBe(0);
      expect(Shadows.button.shadowOffset.height).toBe(6);
      expect(Shadows.button.shadowOpacity).toBe(0.14);
      expect(Shadows.button.shadowRadius).toBe(16);
      expect(Shadows.button.elevation).toBe(8);
    });
  });

  describe('Animation tokens', () => {
    it('has timing configurations', () => {
      expect(AnimationTiming.fast).toBe(150);
      expect(AnimationTiming.normal).toBe(220);
      expect(AnimationTiming.slow).toBe(420);
      expect(AnimationTiming.splash).toBe(420);
    });
  });
});