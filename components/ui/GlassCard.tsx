import React from 'react';
import { StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  goldBorder?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style, goldBorder = false, ...props }) => {
  return (
    <View
      style={[
        styles.card,
        goldBorder ? styles.goldBorder : styles.defaultBorder,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#24242a',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    // Soft ambient shadows
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  defaultBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  goldBorder: {
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
});
