import { Platform } from 'react-native';
import { AuthError, authApi, type Session, type SocialProvider } from './auth';

export class SignInCancelled extends Error {}

export async function socialSignIn(provider: SocialProvider): Promise<Session> {
  if (Platform.OS === 'web') throw new AuthError('Google and Facebook sign-in are available in the Android/iOS development build.');
  if (provider === 'google') {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    if (!webClientId || (Platform.OS === 'ios' && !iosClientId)) {
      throw new AuthError('Google sign-in needs OAuth client IDs. Follow the Google setup in docs/authentication.md.');
    }
    try {
      // Load social SDKs on demand so their configuration errors do not block email login.
      const { GoogleOneTapSignIn, isSuccessResponse, isErrorWithCode, statusCodes } = await import('react-native-nitro-google-signin');
      const { nonce } = await authApi.challenge('google');
      GoogleOneTapSignIn.configure({ webClientId, iosClientId, nonce, offlineAccess: false, autoSelectOnSignIn: false });
      try {
        await GoogleOneTapSignIn.checkPlayServices();
        const result = await GoogleOneTapSignIn.presentExplicitSignIn();
        if (result.type === 'cancelled') throw new SignInCancelled();
        if (!isSuccessResponse(result)) throw new AuthError('Google could not sign you in. Please try another account.');
        return await authApi.social('google', result.data.idToken, nonce);
      } catch (error) {
        if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) throw new SignInCancelled();
        throw error;
      }
    } catch (error) {
      if (error instanceof AuthError || error instanceof SignInCancelled) throw error;
      throw new AuthError('Google sign-in could not start. Check Google Play Services, OAuth configuration, and rebuild the development app after installing native modules.');
    }
  }
  if (!process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || !process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN) {
    throw new AuthError('Facebook sign-in needs Meta app configuration. Follow docs/authentication.md, then rebuild the app.');
  }
  try {
    const { LoginManager, AccessToken, AuthenticationToken, Settings } = await import('react-native-fbsdk-next');
    Settings.initializeSDK();
    const { nonce } = await authApi.challenge('facebook');
    LoginManager.logOut();
    const limited = Platform.OS === 'ios';
    const result = await LoginManager.logInWithPermissions(['public_profile', 'email'], limited ? 'limited' : 'enabled', nonce);
    if (result.isCancelled) throw new SignInCancelled();
    const token = limited
      ? (await AuthenticationToken.getAuthenticationTokenIOS())?.authenticationToken
      : (await AccessToken.getCurrentAccessToken())?.accessToken;
    if (!token) throw new AuthError('Facebook did not return a sign-in token. Please allow profile access and try again.');
    return await authApi.social('facebook', token, nonce, limited);
  } catch (error) {
    if (error instanceof AuthError || error instanceof SignInCancelled) throw error;
    throw new AuthError('Facebook sign-in failed. Check Meta app roles, permissions, package name, key hashes, and the development build configuration.');
  }
}

export async function clearSocialSessions() {
  if (Platform.OS === 'web') return;
  const cleanups: Promise<unknown>[] = [];
  if (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
    cleanups.push(import('react-native-nitro-google-signin').then(({ GoogleOneTapSignIn }) => GoogleOneTapSignIn.signOut()));
  }
  if (process.env.EXPO_PUBLIC_FACEBOOK_APP_ID) {
    cleanups.push(import('react-native-fbsdk-next').then(({ LoginManager }) => LoginManager.logOut()));
  }
  await Promise.allSettled(cleanups);
}
