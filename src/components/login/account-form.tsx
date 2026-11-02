import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { useAuthRequest } from "@/hooks/use-auth-request";
import { validateEmail, validateNewPassword } from "@/utils/auth-validation";
import { FormField, FormMessage } from "./form-field";
import { LoginDecoration } from "./login-decoration";

export function AccountForm({
  mode,
}: {
  mode: "sign-up" | "forgot-password" | "verify-code" | "reset-password";
}) {
  const isSignUp = mode === "sign-up";
  const isForgot = mode === "forgot-password";
  const isVerify = mode === "verify-code";
  const needsPassword = isSignUp || mode === "reset-password";
  const { resetFlow } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const passwordInput = useRef<TextInput>(null);
  const confirmInput = useRef<TextInput>(null);
  const { isLoading, error, clearError, runRequest } = useAuthRequest();

  function getErrors(): Record<string, string | undefined> {
    return {
      email: isSignUp || isForgot ? validateEmail(email) : undefined,
      password: needsPassword ? validateNewPassword(password) : undefined,
      confirmPassword:
        needsPassword && confirmPassword !== password
          ? "Your passwords do not match."
          : undefined,
      code:
        isVerify && !/^\d{6}$/.test(code)
          ? "Enter the six-digit verification code."
          : undefined,
    };
  }
  const errors = hasSubmitted ? getErrors() : {};
  const submitDisabled = isLoading || (!isSignUp && !isForgot && !resetFlow);

  async function handleSubmit() {
    if (isLoading) return;
    setHasSubmitted(true);
    clearError();
    if (Object.values(getErrors()).some(Boolean)) return;

    Keyboard.dismiss();
    const completed = await runRequest((provider) => {
      if (isSignUp) return provider.signUp({ email: email.trim(), password });
      if (isForgot) return provider.requestReset(email.trim());
      if (isVerify) return provider.verifyCode(code);
      return provider.resetPassword(password);
    }, "We could not complete this request. Please try again.");

    if (completed) {
      setPassword("");
      setConfirmPassword("");
      setHasSubmitted(false);
      if (isForgot) router.push("/verify-code");
      else if (isVerify) {
        setCode("");
        router.replace("/reset-password");
      } else
        router.replace({
          pathname: "/login",
          params: { notice: isSignUp ? "registered" : "password-reset" },
        });
    }
  }

  return (
    <View style={styles.container}>
      <LoginDecoration />
      <SafeAreaView style={styles.fill}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Text style={styles.brand}>Hello</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {isSignUp
                ? "Create account"
                : isForgot
                  ? "Forgot password?"
                  : isVerify
                    ? "Verify code"
                    : "Set new password"}
            </Text>
            <Text style={styles.description}>
              {isSignUp
                ? "Enter an email and a password with at least 8 characters."
                : isForgot
                  ? "Enter your account email to request a verification code."
                  : isVerify
                    ? resetFlow?.message ||
                      "Request a verification code to continue."
                    : "Choose a new password with at least 8 characters."}
            </Text>
            {isVerify && resetFlow ? (
              <Text style={styles.description}>
                {resetFlow.email} · Code expires after 10 minutes.
              </Text>
            ) : null}
            <View style={styles.form}>
              {isSignUp || isForgot ? (
                <FormField
                  accessibilityLabel="Email"
                  placeholder="Email"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    clearError();
                  }}
                  error={errors.email}
                  editable={!isLoading}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  importantForAutofill="yes"
                  returnKeyType={isSignUp ? "next" : "done"}
                  submitBehavior={isSignUp ? "submit" : "blurAndSubmit"}
                  onSubmitEditing={() =>
                    isSignUp
                      ? passwordInput.current?.focus()
                      : void handleSubmit()
                  }
                />
              ) : null}
              {isVerify ? (
                <FormField
                  accessibilityLabel="Verification code"
                  placeholder="6-digit code"
                  value={code}
                  onChangeText={(value) => {
                    setCode(value.replace(/\D/g, "").slice(0, 6));
                    clearError();
                  }}
                  error={errors.code}
                  editable={!isLoading && !!resetFlow}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={() => void handleSubmit()}
                />
              ) : null}
              {needsPassword ? (
                <>
                  <FormField
                    ref={passwordInput}
                    accessibilityLabel="Password"
                    placeholder="Password"
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      clearError();
                    }}
                    error={errors.password}
                    editable={!isLoading}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    importantForAutofill="yes"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => confirmInput.current?.focus()}
                  />
                  <FormField
                    ref={confirmInput}
                    accessibilityLabel="Confirm password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChangeText={(value) => {
                      setConfirmPassword(value);
                      clearError();
                    }}
                    error={errors.confirmPassword}
                    editable={!isLoading}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    returnKeyType="done"
                    onSubmitEditing={() => void handleSubmit()}
                  />
                </>
              ) : null}
              {error ? <FormMessage message={error} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: submitDisabled,
                  busy: isLoading,
                }}
                disabled={submitDisabled}
                onPress={() => void handleSubmit()}
                style={({ pressed }) => [
                  styles.button,
                  (pressed || submitDisabled) && styles.pressed,
                ]}
              >
                {isLoading ? <ActivityIndicator color="#FFFFFF" /> : null}
                <Text style={styles.buttonText}>
                  {isLoading
                    ? "Please wait…"
                    : isSignUp
                      ? "Sign Up"
                      : isForgot
                        ? "Request password reset"
                        : isVerify
                          ? "Verify code"
                          : "Update password"}
                </Text>
              </Pressable>
              {isVerify || mode === "reset-password" ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={isLoading}
                  onPress={() => router.replace("/forgot-password")}
                  style={styles.backButton}
                >
                  <Text style={styles.link}>Request a new code</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={isLoading}
              onPress={() => {
                Keyboard.dismiss();
                router.replace("/login");
              }}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.link}>Back to Login</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    padding: 24,
    paddingTop: 32,
  },
  brand: {
    color: "#F97316",
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1.5,
    textAlign: "center",
    marginBottom: 40,
  },
  title: { color: "#111111", fontSize: 32, fontWeight: "700" },
  description: {
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
  },
  form: { marginTop: 24, gap: 16 },
  button: {
    backgroundColor: "#F97316",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1,
  },
  backButton: {
    alignSelf: "center",
    marginTop: 24,
    minHeight: 48,
    padding: 12,
    justifyContent: "center",
  },
  link: { color: "#F97316", fontSize: 16, fontWeight: "600" },
  pressed: { opacity: 0.7 },
});
