import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { BrandInput } from '../BrandInput';

describe('BrandInput', () => {
  const defaultProps = {
    placeholder: 'Enter text',
    value: '',
    onChangeText: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with placeholder text', () => {
    const { getByPlaceholderText } = render(
      <BrandInput {...defaultProps} />
    );

    expect(getByPlaceholderText('Enter text')).toBeTruthy();
  });

  it('displays the current value', () => {
    const { getByDisplayValue } = render(
      <BrandInput {...defaultProps} value="test value" />
    );

    expect(getByDisplayValue('test value')).toBeTruthy();
  });

  it('calls onChangeText when text changes', () => {
    const mockOnChangeText = jest.fn();
    const { getByPlaceholderText } = render(
      <BrandInput {...defaultProps} onChangeText={mockOnChangeText} />
    );

    const input = getByPlaceholderText('Enter text');
    fireEvent.changeText(input, 'new text');

    expect(mockOnChangeText).toHaveBeenCalledWith('new text');
  });

  it('displays label when provided', () => {
    const { getByText } = render(
      <BrandInput {...defaultProps} label="Email Address" />
    );

    expect(getByText('Email Address')).toBeTruthy();
  });

  it('displays error message when error prop is provided', () => {
    const { getByText } = render(
      <BrandInput {...defaultProps} error="This field is required" />
    );

    expect(getByText('This field is required')).toBeTruthy();
  });

  it('handles secure text entry', () => {
    const { getByPlaceholderText } = render(
      <BrandInput {...defaultProps} secureTextEntry={true} />
    );

    const input = getByPlaceholderText('Enter text');
    expect(input.props.secureTextEntry).toBe(true);
  });

  it('handles different keyboard types', () => {
    const { getByPlaceholderText } = render(
      <BrandInput {...defaultProps} keyboardType="email-address" />
    );

    const input = getByPlaceholderText('Enter text');
    expect(input.props.keyboardType).toBe('email-address');
  });

  it('has proper accessibility properties', () => {
    const { getByPlaceholderText } = render(
      <BrandInput {...defaultProps} label="Email" />
    );

    const input = getByPlaceholderText('Enter text');
    expect(input.props.accessibilityLabel).toBe('Email');
  });

  it('includes error in accessibility hint when error is present', () => {
    const { getByPlaceholderText } = render(
      <BrandInput {...defaultProps} error="Invalid email" />
    );

    const input = getByPlaceholderText('Enter text');
    expect(input.props.accessibilityHint).toBe('Error: Invalid email');
  });
});