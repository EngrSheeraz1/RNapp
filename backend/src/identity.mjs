import { createHmac } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const google = new OAuth2Client();
const facebookKeys = createRemoteJWKSet(new URL('https://www.facebook.com/.well-known/oauth/openid/jwks/'));

export function createIdentityVerifier(config) {
  return async (provider, { token, nonce, limited }) => {
    if (provider === 'google') {
      const ticket = await google.verifyIdToken({ idToken: token, audience: config.googleClientId });
      const data = ticket.getPayload();
      if (!data?.sub || data.nonce !== nonce) throw new Error('Invalid Google identity.');
      return { id: data.sub, email: data.email_verified ? data.email : null, name: data.name || null };
    }
    if (limited) {
      const { payload } = await jwtVerify(token, facebookKeys, {
        issuer: 'https://www.facebook.com', audience: config.facebookAppId, algorithms: ['RS256'],
      });
      if (!payload.sub || payload.nonce !== nonce) throw new Error('Invalid Facebook identity.');
      return { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : null,
        name: typeof payload.name === 'string' ? payload.name : null };
    }
    // Validate the token's app, owner, expiry and permissions before fetching profile data.
    const base = `https://graph.facebook.com/${config.facebookGraphVersion}`;
    const debugUrl = new URL(`${base}/debug_token`);
    debugUrl.searchParams.set('input_token', token);
    const debugResponse = await fetch(debugUrl, { headers: {
      Authorization: `Bearer ${config.facebookAppId}|${config.facebookAppSecret}`,
    }, signal: AbortSignal.timeout(10000) });
    const { data } = await debugResponse.json();
    const now = Date.now() / 1000;
    if (!debugResponse.ok || !data?.is_valid || String(data.app_id) !== config.facebookAppId || !data.user_id ||
      !data.expires_at || data.expires_at <= now || (data.data_access_expires_at && data.data_access_expires_at <= now)) {
      throw new Error('Invalid Facebook access token.');
    }
    const profileUrl = new URL(`${base}/me`);
    profileUrl.searchParams.set('fields', 'id,name,email');
    profileUrl.searchParams.set('appsecret_proof', createHmac('sha256', config.facebookAppSecret).update(token).digest('hex'));
    const response = await fetch(profileUrl, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
    const profile = await response.json();
    if (!response.ok || profile.id !== data.user_id) throw new Error('Invalid Facebook profile.');
    return { id: profile.id, email: profile.email || null, name: profile.name || null };
  };
}
