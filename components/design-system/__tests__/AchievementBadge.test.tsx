import { render } from '@testing-library/react-native';
import React from 'react';
import { AchievementBadge } from '../AchievementBadge';

describe('AchievementBadge', () => {
  const defaultProps = {
    text: 'Achievement Unlocked',
  };

  it('renders with correct text', () => {
    const { getByText } = render(
      <AchievementBadge {...defaultProps} />
    );

    expect(getByText('Achievement Unlocked')).toBeTruthy();
  });

  it('displays default icon when no icon is provided', () => {
    const { getByText } = render(
      <AchievementBadge {...defaultProps} />
    );

    expect(getByText('⭐')).toBeTruthy();
  });

  it('displays custom icon when provided', () => {
    const { getByText } = render(
      <AchievementBadge {...defaultProps} icon="🏆" />
    );

    expect(getByText('🏆')).toBeTruthy();
  });

  it('applies success variant styling by default', () => {
    const { getByLabelText } = render(
      <AchievementBadge {...defaultProps} />
    );

    const badge = getByLabelText('success badge: Achievement Unlocked');
    expect(badge).toBeTruthy();
  });

  it('applies points variant styling', () => {
    const { getByLabelText } = render(
      <AchievementBadge {...defaultProps} variant="points" />
    );

    const badge = getByLabelText('points badge: Achievement Unlocked');
    expect(badge).toBeTruthy();
  });

  it('applies level variant styling', () => {
    const { getByLabelText } = render(
      <AchievementBadge {...defaultProps} variant="level" />
    );

    const badge = getByLabelText('level badge: Achievement Unlocked');
    expect(badge).toBeTruthy();
  });

  it('has proper accessibility properties', () => {
    const { getByLabelText } = render(
      <AchievementBadge {...defaultProps} />
    );

    const badge = getByLabelText('success badge: Achievement Unlocked');
    expect(badge.props.accessibilityRole).toBe('text');
  });

  it('applies custom style prop', () => {
    const customStyle = { marginTop: 10 };
    const { getByLabelText } = render(
      <AchievementBadge {...defaultProps} style={customStyle} />
    );

    const badge = getByLabelText('success badge: Achievement Unlocked');
    expect(badge).toBeTruthy();
  });

  it('renders without icon when icon is empty string', () => {
    const { queryByText, getByText } = render(
      <AchievementBadge {...defaultProps} icon="" />
    );

    expect(getByText('Achievement Unlocked')).toBeTruthy();
    expect(queryByText('⭐')).toBeNull();
  });
});