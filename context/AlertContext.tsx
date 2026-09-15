import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertModal, AlertConfig, AlertType, AlertButton } from '@/components/ui/AlertModal';
import Ionicons from '@expo/vector-icons/Ionicons';

export interface AlertOptions {
  title: string;
  message?: string;
  type?: AlertType;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  buttons?: AlertButton[];
  onDismiss?: () => void;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  showSuccess: (title: string, message?: string, onConfirm?: () => void, iconName?: keyof typeof Ionicons.glyphMap) => void;
  showUpdate: (title: string, message?: string, onConfirm?: () => void, iconName?: keyof typeof Ionicons.glyphMap) => void;
  showWarning: (title: string, message?: string, onConfirm?: () => void) => void;
  showError: (title: string, message?: string, onConfirm?: () => void) => void;
  showDelete: (title: string, message?: string, onConfirm?: () => void, onCancel?: () => void) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string,
    isDestructive?: boolean
  ) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const hideAlert = useCallback(() => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  const showAlert = useCallback((options: AlertOptions) => {
    setAlertConfig({
      visible: true,
      title: options.title,
      message: options.message || '',
      type: options.type || 'info',
      iconName: options.iconName,
      iconColor: options.iconColor,
      buttons: options.buttons || [{ text: 'OK', style: 'default', onPress: hideAlert }],
      onDismiss: options.onDismiss,
    });
  }, [hideAlert]);

  const showSuccess = useCallback((
    title: string,
    message: string = '',
    onConfirm?: () => void,
    iconName?: keyof typeof Ionicons.glyphMap
  ) => {
    showAlert({
      title,
      message,
      type: 'success',
      iconName: iconName || 'checkmark-circle',
      buttons: [{ text: 'OK', style: 'default', onPress: onConfirm }],
    });
  }, [showAlert]);

  const showUpdate = useCallback((
    title: string,
    message: string = '',
    onConfirm?: () => void,
    iconName?: keyof typeof Ionicons.glyphMap
  ) => {
    showAlert({
      title,
      message,
      type: 'update',
      iconName: iconName || 'sync-circle',
      buttons: [{ text: 'OK', style: 'default', onPress: onConfirm }],
    });
  }, [showAlert]);

  const showWarning = useCallback((
    title: string,
    message: string = '',
    onConfirm?: () => void
  ) => {
    showAlert({
      title,
      message,
      type: 'warning',
      iconName: 'alert-circle',
      buttons: [{ text: 'Got it', style: 'default', onPress: onConfirm }],
    });
  }, [showAlert]);

  const showError = useCallback((
    title: string,
    message: string = '',
    onConfirm?: () => void
  ) => {
    showAlert({
      title,
      message,
      type: 'error',
      iconName: 'close-circle',
      buttons: [{ text: 'Dismiss', style: 'default', onPress: onConfirm }],
    });
  }, [showAlert]);

  const showDelete = useCallback((
    title: string,
    message: string = '',
    onConfirm?: () => void,
    onCancel?: () => void
  ) => {
    showAlert({
      title,
      message,
      type: 'delete',
      iconName: 'trash',
      buttons: [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Delete', style: 'destructive', onPress: onConfirm },
      ],
    });
  }, [showAlert]);

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel',
    isDestructive: boolean = false
  ) => {
    showAlert({
      title,
      message,
      type: isDestructive ? 'delete' : 'info',
      buttons: [
        { text: cancelText, style: 'cancel', onPress: onCancel },
        {
          text: confirmText,
          style: isDestructive ? 'destructive' : 'default',
          onPress: onConfirm,
        },
      ],
    });
  }, [showAlert]);

  return (
    <AlertContext.Provider
      value={{
        showAlert,
        showSuccess,
        showUpdate,
        showWarning,
        showError,
        showDelete,
        showConfirm,
        hideAlert,
      }}
    >
      {children}
      <AlertModal config={alertConfig} onClose={hideAlert} />
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};
