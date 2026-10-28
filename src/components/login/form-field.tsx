import type { Ref } from "react";
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";

type FormFieldProps = TextInputProps & {
  error?: string;
  ref?: Ref<TextInput>;
};

export function FormField({ error, ref, style, ...inputProps }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <TextInput
        placeholderTextColor="#6B7280"
        underlineColorAndroid="transparent"
        {...inputProps}
        ref={ref}
        accessibilityHint={error || inputProps.accessibilityHint}
        style={[styles.input, style, error ? styles.invalid : undefined]}
      />
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
