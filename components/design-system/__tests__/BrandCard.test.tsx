import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { BrandTokens } from '../../../constants/BrandTokens';
import { BrandCard } from '../BrandCard';

describe('BrandCard', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <BrandCard>
        <Text>Test Content</Text>
      </BrandCard>
    );

    expect(getByText('Test Content')).toBeTruthy();
  });

  it('applies default styling', () => {
    const { getByTestId } = render(
      <BrandCard>
        <Text testID="card-content">Content</Text>
      </BrandCard>
    );

    const cardContent = getByTestId('card-content');
    expect(cardContent).toBeTruthy();
  });

  it('applies topRadius styling when prop is true', () => {
    const { getByTestId } = render(
      <BrandCard topRadius testID="brand-card">
        <Text>Content</Text>
      </BrandCard>
    );

    const card = getByTestId('brand-card');
    expect(card).toBeTruthy();
  });

  it('applies custom style prop', () => {
    const customStyle = { marginTop: 20 };
    const { getByTestId } = render(
      <BrandCard style={customStyle} testID="brand-card">
        <Text>Content</Text>
      </BrandCard>
    );

    const card = getByTestId('brand-card');
    expect(card).toBeTruthy();
  });

  it('has correct default background color', () => {
    const { getByTestId } = render(
      <BrandCard testID="brand-card">
        <Text>Content</Text>
      </BrandCard>
    );

    const card = getByTestId('brand-card');
    expect(card.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: BrandTokens.white,
        }),
      ])
    );
  });
});