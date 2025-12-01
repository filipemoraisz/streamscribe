import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and message correctly', () => {
    const { getByText } = render(
      <EmptyState
        type="watchlist"
        title="No Items"
        message="Your watchlist is empty"
        icon="film-outline"
      />
    );

    expect(getByText('No Items')).toBeTruthy();
    expect(getByText('Your watchlist is empty')).toBeTruthy();
  });

  it('renders action button when provided', () => {
    const mockAction = jest.fn();
    const { getByText } = render(
      <EmptyState
        type="watchlist"
        title="No Items"
        message="Your watchlist is empty"
        icon="film-outline"
        actionLabel="Browse Content"
        onAction={mockAction}
      />
    );

    const button = getByText('Browse Content');
    expect(button).toBeTruthy();
  });

  it('calls onAction when button is pressed', () => {
    const mockAction = jest.fn();
    const { getByText } = render(
      <EmptyState
        type="watchlist"
        title="No Items"
        message="Your watchlist is empty"
        icon="film-outline"
        actionLabel="Browse Content"
        onAction={mockAction}
      />
    );

    const button = getByText('Browse Content');
    fireEvent.press(button);
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('does not render button when actionLabel is not provided', () => {
    const { queryByText } = render(
      <EmptyState
        type="watchlist"
        title="No Items"
        message="Your watchlist is empty"
        icon="film-outline"
      />
    );

    expect(queryByText('Browse Content')).toBeNull();
  });
});
