import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export type AlertType = 'success' | 'update' | 'warning' | 'error' | 'delete' | 'info';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertConfig {
  visible: boolean;
  title: string;
  message: string;
  type?: AlertType;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  buttons?: AlertButton[];
  onDismiss?: () => void;
}

interface AlertModalProps {
  config: AlertConfig;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export const AlertModal: React.FC<AlertModalProps> = ({ config, onClose }) => {
  const {
    visible,
    title,
    message,
    type = 'info',
    iconName,
    iconColor,
    buttons = [{ text: 'OK', style: 'default' }],
  } = config;

  if (!visible) return null;

  // Derive default icon and colors based on alert type
  const getTypeDetails = () => {
    switch (type) {
      case 'success':
        return {
          defaultIcon: 'checkmark-circle' as const,
          color: '#34C759',
          bgGlow: 'rgba(52, 199, 89, 0.15)',
          borderColor: 'rgba(52, 199, 89, 0.35)',
        };
      case 'update':
        return {
          defaultIcon: 'sync-circle' as const,
          color: '#D4AF37',
          bgGlow: 'rgba(212, 175, 55, 0.18)',
          borderColor: 'rgba(212, 175, 55, 0.4)',
        };
      case 'warning':
        return {
          defaultIcon: 'alert-circle' as const,
          color: '#FFB800',
          bgGlow: 'rgba(255, 184, 0, 0.15)',
          borderColor: 'rgba(255, 184, 0, 0.35)',
        };
      case 'error':
        return {
          defaultIcon: 'close-circle' as const,
          color: '#FF4B4B',
          bgGlow: 'rgba(255, 75, 75, 0.15)',
          borderColor: 'rgba(255, 75, 75, 0.35)',
        };
      case 'delete':
        return {
          defaultIcon: 'trash' as const,
          color: '#FF4B4B',
          bgGlow: 'rgba(255, 75, 75, 0.15)',
          borderColor: 'rgba(255, 75, 75, 0.35)',
        };
      case 'info':
      default:
        return {
          defaultIcon: 'information-circle' as const,
          color: '#4DA6FF',
          bgGlow: 'rgba(77, 166, 255, 0.15)',
          borderColor: 'rgba(77, 166, 255, 0.35)',
        };
    }
  };

  const details = getTypeDetails();
  const finalIcon = iconName || details.defaultIcon;
  const finalColor = iconColor || details.color;

  const handleButtonPress = (btn: AlertButton) => {
    onClose();
    if (btn.onPress) {
      // Small timeout to allow modal animation to dismiss cleanly
      setTimeout(() => {
        btn.onPress!();
      }, 150);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.dialogCard, { borderColor: details.borderColor }]}>
              {/* Icon Badge */}
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: details.bgGlow,
                    borderColor: details.borderColor,
                  },
                ]}
              >
                <Ionicons name={finalIcon} size={42} color={finalColor} />
              </View>

              {/* Title */}
              <Text style={styles.titleText}>{title}</Text>

              {/* Description / Message */}
              {message ? (
                <Text style={styles.messageText}>{message}</Text>
              ) : null}

              {/* Action Buttons */}
              <View
                style={[
                  styles.buttonRow,
                  buttons.length > 2 && styles.buttonColumn,
                ]}
              >
                {buttons.map((btn, index) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.buttonBase,
                        buttons.length === 1 && styles.singleButton,
                        buttons.length === 2 && styles.dualButton,
                        isCancel && styles.cancelButton,
                        isDestructive && styles.destructiveButton,
                        !isCancel && !isDestructive && styles.defaultButton,
                      ]}
                      onPress={() => handleButtonPress(btn)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.buttonTextBase,
                          isCancel && styles.cancelButtonText,
                          isDestructive && styles.destructiveButtonText,
                          !isCancel && !isDestructive && styles.defaultButtonText,
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    width: Math.min(width - 48, 360),
    backgroundColor: '#1E1E28',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 12,
  },
  iconContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 13,
    color: '#B0B0C2',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  buttonColumn: {
    flexDirection: 'column',
    gap: 8,
  },
  buttonBase: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonTextBase: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  singleButton: {
    flex: 1,
  },
  dualButton: {
    flex: 1,
  },
  defaultButton: {
    backgroundColor: '#D4AF37',
  },
  defaultButtonText: {
    color: '#191820',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  cancelButtonText: {
    color: '#A0A0B0',
    fontSize: 14,
    fontWeight: '700',
  },
  destructiveButton: {
    backgroundColor: '#FF4B4B',
  },
  destructiveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
