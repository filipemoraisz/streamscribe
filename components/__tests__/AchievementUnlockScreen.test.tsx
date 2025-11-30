import React from 'react';
import { render } from '@testing-library/react-native';
import { AchievementUnlockScreen } from '../AchievementUnlockScreen';
import { Achievement } from '../../types';

describe('AchievementUnlockScreen', () => {
  const mockAchievement: Achievement = {
    id: '1',
    achievement_key: 'first_steps',
    name: 'First Steps',
    description: 'Watch your first episode',
    category: 'viewing',
    tier: 'bronze',
    icon_name: 'trophy-outline',
    icon_library: 'Ionicons',
    unlock_criteria: { type: 'episode_count', value: 1 },
    points: 10,
    sort_order: 1,
  };

  const mockOnClose = jest.fn();

  it('renders correctly when visible', () => {
    const { getByText } = render(
      <AchievementUnlockScreen
        achievement={mockAchievement}
        visible={true}
        onClose={mockOnClose}
      />
    );

    // Check if achievement description is present
    expect(getByText('Watch your first episode')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    const { queryByText } = render(
      <AchievementUnlockScreen
        achievement={mockAchievement}
        visible={false}
        onClose={mockOnClose}
      />
    );

    // Modal should not be visible
    expect(queryByText('Watch your first episode')).toBeNull();
  });

  it('displays correct tier badge', () => {
    const { getByText } = render(
      <AchievementUnlockScreen
        achievement={mockAchievement}
        visible={true}
        onClose={mockOnClose}
      />
    );

    expect(getByText('Bronze')).toBeTruthy();
  });

  it('displays share button', () => {
    const { getByText } = render(
      <AchievementUnlockScreen
        achievement={mockAchievement}
        visible={true}
        onClose={mockOnClose}
      />
    );

    expect(getByText('Share')).toBeTruthy();
  });

  it('displays continue prompt', () => {
    const { getByText } = render(
      <AchievementUnlockScreen
        achievement={mockAchievement}
        visible={true}
        onClose={mockOnClose}
      />
    );

    expect(getByText('Tap to continue')).toBeTruthy();
  });
});
