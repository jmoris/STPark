import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  children: React.ReactNode;
  keyboardVerticalOffset?: number;
}

export const KeyboardAwareScrollView: React.FC<KeyboardAwareScrollViewProps> = ({
  children,
  keyboardVerticalOffset = 0,
  contentContainerStyle,
  style,
  ...props
}) => {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        {...props}
        style={[styles.scrollView, style]}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 20 }, // Solo el espacio necesario para la barra de navegación
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={true}
        bounces={true}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
});



