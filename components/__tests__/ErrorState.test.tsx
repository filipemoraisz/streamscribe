import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
  it('renders error message correctly', () => {
    const mockRetry = jest.fn();
    const { getByText } = render(
      <ErrorState
        message="Failed to load content"
        onRetry={mockRetry}
      />
    );

    expect(getByText('Failed to load content')).toBeTruthy();
  });

  it('renders retry button', () => {
    const mockRetry = jest.fn();
    const { getByText } = render(
      <ErrorState
        message="Failed to load content"
        onRetry={mockRetry}
      />
    );

    expect(getByText('Retry')).toBeTruthy();
  });

  it('calls onRetry when retry button is pressed', () => {
    const mockRetry = jest.fn();
    const { getByText } = render(
      <ErrorState
        message="Failed to load content"
        onRetry={mockRetry}
      />
    );

    const retryButton = getByText('Retry');
    fireEvent.press(retryButton);
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('disables button when retrying', () => {
    const mockRetry = jest.fn();
    const { getByText, queryByText } = render(
      <ErrorState
        message="Failed to load content"
        onRetry={mockRetry}
        retrying={true}
      />
    );

    // When retrying, the "Retry" text should not be visible (replaced by ActivityIndicator)
    expect(queryByText('Retry')).toBeNull();
  });

  it('shows retry text when not retrying', () => {
    const mockRetry = jest.fn();
    const { getByText } = render(
      <ErrorState
        message="Failed to load content"
        onRetry={mockRetry}
        retrying={false}
      />
    );

    expect(getByText('Retry')).toBeTruthy();
  });
});
