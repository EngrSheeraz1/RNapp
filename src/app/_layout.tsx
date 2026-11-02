import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { SessionStorageError } from '@/services/session-storage';

export default function RootLayout() {
  return <AuthProvider><AuthNavigator /></AuthProvider>;
}

function AuthNavigator() {
  const { session, checking, startupError, storageUnavailable, retrySession, signOut, testSecureStorage } = useAuth();
  const [testingStorage, setTestingStorage] = useState(false);
  const [testResult, setTestResult] = useState('');
  const testInFlight = useRef(false);
  async function checkStorage() {
    if (testInFlight.current) return;
    testInFlight.current = true;
    setTestingStorage(true); setTestResult('');
    try {
      await testSecureStorage();
      setTestResult('Secure storage read, write, and delete checks passed. Tap Retry to reload your session.');
    } catch (error) {
      setTestResult(error instanceof SessionStorageError ? error.message : 'The secure storage check could not complete.');
    } finally { setTestingStorage(false); testInFlight.current = false; }
  }
  const ready = !checking && !startupError;
  return <View style={styles.container}>
    <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={ready && !session}>
        <Stack.Screen name="login" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="verify-code" />
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
      <Stack.Protected guard={ready && !!session}><Stack.Screen name="(main)" /></Stack.Protected>
    </Stack>
    {!ready ? <SafeAreaView style={styles.loading}>
      <View style={styles.message}>
        {checking ? <><ActivityIndicator size="large" color="#F97316" /><Text>Checking your session…</Text></> : <>
          <Text accessibilityRole="alert" style={styles.error}>{startupError}</Text>
          <Pressable accessibilityRole="button" disabled={testingStorage} onPress={() => { setTestResult(''); void retrySession(); }} style={styles.button}><Text style={styles.label}>Retry</Text></Pressable>
          {!storageUnavailable ? <Pressable accessibilityRole="button" disabled={testingStorage} onPress={() => void signOut().catch(() => { /* Recovery failure is displayed by the provider. */ })} style={styles.button}><Text style={styles.label}>Clear saved session and go to Login</Text></Pressable> : null}
          {__DEV__ ? <Pressable accessibilityRole="button" disabled={testingStorage} accessibilityState={{ busy: testingStorage, disabled: testingStorage }} onPress={() => void checkStorage()} style={styles.button}><Text style={styles.label}>{testingStorage ? 'Testing secure storage…' : 'Test secure storage'}</Text></Pressable> : null}
          {testResult ? <Text accessibilityLiveRegion="polite" style={styles.result}>{testResult}</Text> : null}
        </>}
      </View>
    </SafeAreaView> : null}
    <StatusBar style="auto" />
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  message: { padding: 24, gap: 20, alignItems: 'center' },
  error: { color: '#B42318', textAlign: 'center', fontSize: 16 },
  button: { backgroundColor: '#F97316', borderRadius: 16, padding: 18 },
  label: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
  result: { color: '#374151', textAlign: 'center', fontSize: 15 },
});
