import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Pressable, StyleSheet, Text } from "react-native";

type SocialLoginButtonProps = {
  provider: "Google" | "Facebook";
  onPress: () => void;
  disabled?: boolean;
};

export function SocialLoginButton({ provider, onPress, disabled = false }: SocialLoginButtonProps) {
  const isGoogle = provider === "Google";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Continue with ${provider}`}
      accessibilityHint="Sign-in is not configured yet."
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.pressed]}
    >
      <FontAwesome
        name={isGoogle ? "google" : "facebook"}
        size={20}
        color={isGoogle ? "#4285F4" : "#1877F2"}
        accessible={false}
      />
      <Text style={styles.label}>{provider}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E2E2",
    borderWidth: 1,
    borderRadius: 16,
  },
  label: {
    flexShrink: 1,
    color: "#262626",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  pressed: { opacity: 0.65 },
});
