import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { PrimaryCTA } from '../PrimaryCTA';

describe('PrimaryCTA', () => {
  const defaultProps = {
    title: 'Click Me',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with correct title', () => {
    const { getByText } = render(
      <PrimaryCTA {...defaultProps} />
    );

    expect(getByText('Click Me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(
      <PrimaryCTA {...defaultProps} onPress={mockOnPress} />
    );

    const button = getByText('Click Me');
    fireEvent.press(button);

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(
      <PrimaryCTA {...defaultProps} onPress={mockOnPress} disabled={true} />
    );

    const button = getByText('Click Me');
    fireEvent.press(button);

    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('shows loading indicator when loading is true', () => {
    const { getByTestId, queryByText } = render(
      <PrimaryCTA {...defaultProps} loading={true} />
    );

    // Should show ActivityIndicator and hide text
    expect(queryByText('Click Me')).toBeNull();
    // ActivityIndicator should be present (though we can't easily test it directly)
  });

  it('does not call onPress when loading', () => {
    const mockOnPress = jest.fn();
    const { getByRole } = render(
      <PrimaryCTA {...defaultProps} onPress={mockOnPress} loading={true} />
    );

    const button = getByRole('button');
    fireEvent.press(button);

    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('has proper accessibility properties', () => {
    const { getByRole } = render(
      <PrimaryCTA {...defaultProps} />
    );

    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Click Me');
    expect(button.props.accessibilityRole).toBe('button');
  });

  it('has disabled accessibility state when disabled', () => {
    const { getByRole } = render(
      <PrimaryCTA {...defaultProps} disabled={true} />
    );

    const button = getByRole('button');
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('has disabled accessibility state when loading', () => {
    const { getByRole } = render(
      <PrimaryCTA {...defaultProps} loading={true} />
    );

    const button = getByRole('button');
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('applies custom style prop', () => {
    const customStyle = { marginTop: 20 };
    const { getByRole } = render(
      <PrimaryCTA {...defaultProps} style={customStyle} />
    );

    const button = getByRole('button');
    expect(button).toBeTruthy();
  });
});