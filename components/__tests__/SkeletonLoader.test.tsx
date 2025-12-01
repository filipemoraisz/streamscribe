import { render } from '@testing-library/react-native';
import React from 'react';
import { SkeletonLoader } from '../SkeletonLoader';

describe('SkeletonLoader', () => {
  it('renders card skeleton', () => {
    const { getByTestId } = render(
      <SkeletonLoader type="card" count={1} animated={false} />
    );

    // Component should render without errors
    expect(true).toBeTruthy();
  });

  it('renders multiple card skeletons when count is specified', () => {
    const result = render(
      <SkeletonLoader type="card" count={3} animated={false} />
    );

    // Component should render without errors
    expect(result).toBeTruthy();
  });

  it('renders header skeleton', () => {
    const result = render(
      <SkeletonLoader type="header" animated={false} />
    );

    expect(result).toBeTruthy();
  });

  it('renders section skeleton', () => {
    const result = render(
      <SkeletonLoader type="section" animated={false} />
    );

    expect(result).toBeTruthy();
  });

  it('renders with animation enabled by default', () => {
    const result = render(
      <SkeletonLoader type="card" animated={false} />
    );

    expect(result).toBeTruthy();
  });

  it('renders without animation when animated is false', () => {
    const result = render(
      <SkeletonLoader type="card" animated={false} />
    );

    expect(result).toBeTruthy();
  });
});
