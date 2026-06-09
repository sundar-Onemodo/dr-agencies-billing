import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface GoldButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'filled' | 'outlined' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  iconName?: keyof typeof Ionicons.glyphMap;
}

export const GoldButton: React.FC<GoldButtonProps> = ({
  onPress,
  title,
  variant = 'filled',
  loading = false,
  disabled = false,
  style,
  textStyle,
  iconName,
}) => {
  const isDanger = variant === 'danger';
  const isOutlined = variant === 'outlined';

  const getButtonStyle = () => {
    if (disabled) return styles.disabledButton;
    if (isDanger) return styles.dangerButton;
    if (isOutlined) return styles.outlinedButton;
    return styles.filledButton;
  };

  const getTextStyle = () => {
    if (disabled) return styles.disabledText;
    if (isDanger) return styles.dangerText;
    if (isOutlined) return styles.outlinedText;
    return styles.filledText;
  };

  const getIconColor = () => {
    if (disabled) return '#6e6e7c';
    if (isDanger) return '#FFFFFF';
    if (isOutlined) return '#D4AF37';
    return '#191820';
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, getButtonStyle(), style]}
    >
      {loading ? (
        <ActivityIndicator color={isOutlined ? '#D4AF37' : '#191820'} size="small" />
      ) : (
        <>
          {iconName && (
            <Ionicons
              name={iconName}
              size={18}
              color={getIconColor()}
              style={styles.icon}
            />
          )}
          <Text style={[styles.text, getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginVertical: 8,
  },
  filledButton: {
    backgroundColor: '#D4AF37',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  outlinedButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
  },
  dangerButton: {
    backgroundColor: '#FF4B4B',
    shadowColor: '#FF4B4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#303038',
    borderColor: '#3a3a42',
    borderWidth: 1,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  filledText: {
    color: '#191820',
  },
  outlinedText: {
    color: '#D4AF37',
  },
  dangerText: {
    color: '#FFFFFF',
  },
  disabledText: {
    color: '#6e6e7c',
  },
  icon: {
    marginRight: 8,
  },
});

