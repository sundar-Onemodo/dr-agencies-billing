import React, { useState, useRef } from 'react';
import { StyleSheet, Text, TextInput, View, TextInputProps, ViewStyle, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface InputFieldProps extends TextInputProps {
  label: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  rightIconName?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  showClearButton?: boolean;
  onClear?: () => void;
  error?: string;
  containerStyle?: ViewStyle;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  iconName,
  rightIconName,
  onRightIconPress,
  showClearButton,
  onClear,
  error,
  containerStyle,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const hasValue = Boolean(props.value && props.value.length > 0);
  const showClear = Boolean(showClearButton && hasValue);

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (props.onChangeText) {
      props.onChangeText('');
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={[styles.label, isFocused && styles.focusedLabel]}>{label}</Text> : null}
      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={[
          styles.inputContainer,
          isFocused && styles.focusedInputContainer,
          error ? styles.errorInputContainer : null,
        ]}
      >
        {iconName && (
          <Ionicons
            name={iconName}
            size={20}
            color={isFocused ? '#D4AF37' : '#A0A0B0'}
            style={styles.icon}
          />
        )}
        <TextInput
          ref={inputRef}
          placeholderTextColor="#606070"
          style={styles.input}
          onFocus={(e) => {
            setIsFocused(true);
            if (onFocus) onFocus(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            if (onBlur) onBlur(e);
          }}
          {...props}
        />
        {showClear ? (
          <Pressable onPress={handleClear} hitSlop={8} style={styles.rightIconPressable}>
            <Ionicons name="close-circle" size={18} color="#A0A0B0" />
          </Pressable>
        ) : rightIconName ? (
          <Pressable onPress={onRightIconPress} hitSlop={8} style={styles.rightIconPressable}>
            <Ionicons
              name={rightIconName}
              size={20}
              color={isFocused ? '#D4AF37' : '#A0A0B0'}
            />
          </Pressable>
        ) : null}
      </Pressable>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    width: '100%',
  },
  label: {
    color: '#A0A0B0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
  },
  focusedLabel: {
    color: '#D4AF37',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c24',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    height: 50,
  },
  focusedInputContainer: {
    borderColor: '#D4AF37',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  errorInputContainer: {
    borderColor: '#FF4B4B',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    height: '100%',
  },
  errorText: {
    color: '#FF4B4B',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 6,
  },
  rightIconPressable: {
    padding: 4,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
