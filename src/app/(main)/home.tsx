import { useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { Card, Screen, styles } from '@/components/screen';
import { FormMessage } from '@/components/login/form-field';
import { useAuth } from '@/context/auth-context';

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <Screen eyebrow="Welcome home" eyebrowColor="#F97316" title={`Hello${session?.user.name ? `, ${session.user.name}` : ''}!`}
    description="You’re signed in. Your session is stored securely on this device.">
    <Card title="Your account">{session?.user.email || 'Signed in with a social account'}</Card>
    {error ? <FormMessage message={error} /> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy}
      style={[styles.button, { backgroundColor: '#F97316' }]}
      onPress={() => {
        if (busy) return;
        setBusy(true);
        void signOut().catch(() => { setError('Could not clear secure storage. Please try again.'); setBusy(false); });
      }}>
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Log out</Text>}
    </Pressable>
  </Screen>;
}
