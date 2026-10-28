import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import { FormField, FormMessage } from "@/components/login/form-field";
import { LoginDecoration } from "@/components/login/login-decoration";
import { SocialLoginButton } from "@/components/login/social-login-button";
import { useAuthRequest } from "@/hooks/use-auth-request";
import { validateCredentials } from "@/utils/auth-validation";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const { isLoading, error, clearError, runRequest } = useAuthRequest();
  const errors = hasSubmitted ? validateCredentials(email, password) : {};

  async function handleLogin() {
    if (isLoading) return;
    setHasSubmitted(true);
    clearError();
    const nextErrors = validateCredentials(email, password);
    if (nextErrors.email) {
      emailInput.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordInput.current?.focus();
      return;
    }

    Keyboard.dismiss();
    await runRequest(
      (provider) => provider.signIn({ email: email.trim(), password }),
      "Unable to log in. Please check your details and try again.",
    );
  }

  return (
    <View style={styles.container}>
      <LoginDecoration />
      {/* The tab navigator handles the bottom safe area. */}
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.brandContainer}>
              <Text accessibilityLabel="Hello" style={styles.brand}>
                Hello
              </Text>
            </View>
            <Text accessibilityRole="header" style={styles.welcome}>
              Welcome!
            </Text>
            <View style={styles.form}>
              <FormField
                ref={emailInput}
                error={errors.email}
                editable={!isLoading}
                accessibilityLabel="Email"
                placeholder="Email"
                placeholderTextColor="#6B7280"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  clearError();
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                importantForAutofill="yes"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordInput.current?.focus()}
                underlineColorAndroid="transparent"
              />
              <FormField
                ref={passwordInput}
                error={errors.password}
                editable={!isLoading}
                accessibilityLabel="Password"
                placeholder="Password"
                placeholderTextColor="#6B7280"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  clearError();
                }}
                secureTextEntry
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                importantForAutofill="yes"
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
                onSubmitEditing={() => void handleLogin()}
                underlineColorAndroid="transparent"
              />
              {error ? <FormMessage message={error} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isLoading, busy: isLoading }}
                disabled={isLoading}
                onPress={() => void handleLogin()}
                style={({ pressed }) => [
                  styles.loginButton,
                  (pressed || isLoading) && styles.pressed,
                ]}
              >
                {isLoading ? <ActivityIndicator color="#FFFFFF" /> : null}
                <Text style={styles.loginButtonText}>
                  {isLoading ? "Logging in…" : "Login"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isLoading}
                onPress={() => {
                  Keyboard.dismiss();
                  router.navigate("/forgot-password");
                }}
                style={({ pressed }) => [
                  styles.textButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.linkText}>Forgot password?</Text>
              </Pressable>
            </View>
            <View style={styles.socialSection}>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Or continue with</Text>
                <View style={styles.dividerLine} />
              </View>
              <View style={styles.socialButtons}>
                <SocialLoginButton
                  provider="Google"
                  disabled={isLoading}
                  onPress={() =>
                    Alert.alert(
                      "Google sign-in unavailable",
                      "Google sign-in is not configured. No sign-in request was sent.",
                    )
                  }
                />
                <SocialLoginButton
                  provider="Facebook"
                  disabled={isLoading}
                  onPress={() =>
                    Alert.alert(
                      "Facebook sign-in unavailable",
                      "Facebook sign-in is not configured. No sign-in request was sent.",
                    )
                  }
                />
              </View>
              <Text style={styles.socialNotice}>
                Google and Facebook sign-in are not configured.
              </Text>
            </View>
            <View style={styles.signupContainer}>
              <Text style={styles.signupPrompt}>
                Don&apos;t have an account?
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={isLoading}
                onPress={() => {
                  Keyboard.dismiss();
                  router.navigate("/sign-up");
                }}
                style={({ pressed }) => [
                  styles.textButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.linkText}>Sign Up</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    flexDirection: "column",
    alignItems: "stretch",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  brand: {
    color: "#F97316",
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1.5,
    textAlign: "center",
  },
  welcome: {
    color: "#111111",
    fontSize: 32,
    fontWeight: "700",
    textAlign: "left",
  },
  form: {
    marginTop: 24,
    gap: 16,
  },
  loginButton: {
    backgroundColor: "#F97316",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  textButton: {
    alignSelf: "center",
    minHeight: 48,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  linkText: {
    color: "#F97316",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  signupContainer: {
    marginTop: "auto",
    paddingTop: 32,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  signupPrompt: {
    color: "#6B7280",
    fontSize: 16,
    textAlign: "center",
  },
  socialSection: {
    marginTop: 24,
    gap: 20,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#D1D5DB",
  },
  dividerText: {
    flexShrink: 1,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
  socialButtons: {
    flexDirection: "row",
    gap: 12,
  },
  socialNotice: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
