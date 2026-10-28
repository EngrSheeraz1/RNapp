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

import { useAuthRequest } from "@/hooks/use-auth-request";
import { validateCredentials, validateEmail, type CredentialErrors } from "@/utils/auth-validation";
import { FormField, FormMessage } from "./form-field";
import { LoginDecoration } from "./login-decoration";

export function AccountForm({ mode }: { mode: "sign-up" | "forgot-password" }) {
  const isSignUp = mode === "sign-up";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [notice, setNotice] = useState("");
  const passwordInput = useRef<TextInput>(null);
  const { isLoading, error, clearError, runRequest } = useAuthRequest();

  function getErrors(): CredentialErrors {
    return isSignUp ? validateCredentials(email, password) : { email: validateEmail(email) };
  }
  const errors = hasSubmitted ? getErrors() : {};

  async function handleSubmit() {
    if (isLoading) return;
    setHasSubmitted(true);
    setNotice("");
    clearError();
    if (Object.values(getErrors()).some(Boolean)) return;

    Keyboard.dismiss();
    const completed = await runRequest(
      (provider) => isSignUp
        ? provider.signUp({ email: email.trim(), password })
        : provider.resetPassword(email.trim()),
      isSignUp
        ? "We couldn't create your account. Please try again."
        : "We couldn't request a password reset. Please try again.",
    );

    // These messages only appear after a real provider accepts a request.
    if (completed) {
      setPassword("");
      setHasSubmitted(false);
      setNotice(isSignUp
        ? "Your sign-up request was accepted. Check your email for any next steps."
        : "If an account exists for this email, check your inbox for reset instructions.");
    }
  }

  return (
    <View style={styles.container}>
      <LoginDecoration />
      <SafeAreaView style={styles.fill}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            <Text style={styles.brand}>Holla</Text>
            <Text accessibilityRole="header" style={styles.title}>{isSignUp ? "Create account" : "Forgot password?"}</Text>
            <Text style={styles.description}>{isSignUp
              ? "Enter an email and password to get started. Account creation needs an authentication provider."
              : "Enter your account email. Password reset needs an authentication provider."}</Text>
            <View style={styles.form}>
              <FormField
                accessibilityLabel="Email"
                placeholder="Email"
                value={email}
                onChangeText={(value) => { setEmail(value); clearError(); setNotice(""); }}
                error={errors.email}
                editable={!isLoading}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                importantForAutofill="yes"
                returnKeyType={isSignUp ? "next" : "done"}
                submitBehavior={isSignUp ? "submit" : "blurAndSubmit"}
                onSubmitEditing={() => isSignUp ? passwordInput.current?.focus() : void handleSubmit()}
              />
              {isSignUp ? <FormField
                ref={passwordInput}
                accessibilityLabel="Password"
                placeholder="Password"
                value={password}
                onChangeText={(value) => { setPassword(value); clearError(); setNotice(""); }}
                error={errors.password}
                editable={!isLoading}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                importantForAutofill="yes"
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
                onSubmitEditing={() => void handleSubmit()}
              /> : null}
              {error ? <FormMessage message={error} /> : null}
              {notice ? <Text accessibilityLiveRegion="polite" style={styles.description}>{notice}</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isLoading, busy: isLoading }}
                disabled={isLoading}
                onPress={() => void handleSubmit()}
                style={({ pressed }) => [styles.button, (pressed || isLoading) && styles.pressed]}
              >
                {isLoading ? <ActivityIndicator color="#FFFFFF" /> : null}
                <Text style={styles.buttonText}>{isLoading ? "Please wait…" : isSignUp ? "Sign Up" : "Request password reset"}</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={isLoading}
              onPress={() => {
                Keyboard.dismiss();
                if (router.canGoBack()) router.back();
                else router.replace("/");
              }}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
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
  content: { flexGrow: 1, width: "100%", maxWidth: 480, alignSelf: "center", padding: 24, paddingTop: 32 },
  brand: { color: "#F97316", fontSize: 48, fontWeight: "800", letterSpacing: -1.5, textAlign: "center", marginBottom: 40 },
  title: { color: "#111111", fontSize: 32, fontWeight: "700" },
  description: { color: "#6B7280", fontSize: 15, lineHeight: 23, marginTop: 12 },
  form: { marginTop: 24, gap: 16 },
  button: { backgroundColor: "#F97316", borderRadius: 16, padding: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  buttonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", textAlign: "center", flexShrink: 1 },
  backButton: { alignSelf: "center", marginTop: 24, minHeight: 48, padding: 12, justifyContent: "center" },
  link: { color: "#F97316", fontSize: 16, fontWeight: "600" },
  pressed: { opacity: 0.7 },
});
