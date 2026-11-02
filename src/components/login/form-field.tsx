import { useState, type Ref } from "react";
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";

type FormFieldProps = TextInputProps & {
  error?: string;
  ref?: Ref<TextInput>;
};

export function FormField({ error, ref, style, ...inputProps }: FormFieldProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = !!inputProps.secureTextEntry;
  return (
    <View style={styles.field}>
      <View>
      <TextInput
        placeholderTextColor="#6B7280"
        underlineColorAndroid="transparent"
        {...inputProps}
        secureTextEntry={isPassword && !visible}
        ref={ref}
        accessibilityHint={error || inputProps.accessibilityHint}
        style={[styles.input, style, isPassword && { paddingRight: 60 }, error ? styles.invalid : undefined]}
      />
      {isPassword ? <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${inputProps.accessibilityLabel?.toLowerCase() || 'password'}`}
        accessibilityState={{ disabled: inputProps.editable === false }}
        disabled={inputProps.editable === false}
        onPress={() => setVisible(value => !value)}
        style={styles.eye}>
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={23} color="#6B7280" />
      </Pressable> : null}
      </View>
      {error ? <FormMessage message={error} /> : null}
    </View>
  );
}

export function FormMessage({ message }: { message: string }) {
  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  eye: { position: 'absolute', right: 4, top: 0, bottom: 0, minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    color: "#111111",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  invalid: { borderColor: "#B42318" },
  error: { color: "#B42318", fontSize: 14, lineHeight: 20 },
});
