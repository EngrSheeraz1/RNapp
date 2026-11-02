import { Redirect, useRootNavigationState } from 'expo-router';
import { useAuth } from '@/context/auth-context';

export default function Index() {
  const { session, checking, startupError } = useAuth();
  const navigation = useRootNavigationState();
  if (!navigation?.key || checking || startupError) return null;
  return <Redirect href={session ? '/home' : '/login'} />;
}
