// Native configuration only. The Facebook App Secret and SMTP/JWT secrets stay on the backend.
module.exports = ({ config }) => {
  const plugins = [...(config.plugins || [])];
  const localHttp = process.env.EXPO_PUBLIC_API_URL?.startsWith('http://') === true;
  plugins.push(['expo-build-properties', { android: { usesCleartextTraffic: localHttp } }]);
  const googleIosId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (googleIosId) {
    const reversedId = googleIosId.split('.').reverse().join('.');
    plugins.push(['react-native-nitro-google-signin', { iosUrlScheme: reversedId }]);
  }
  // Android Google uses an explicit Web client ID; no Firebase config file or Gradle plugin is needed.
  const facebookId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  const facebookClientToken = process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN;
  if (facebookId && facebookClientToken) plugins.push(['react-native-fbsdk-next', {
    appID: facebookId, clientToken: facebookClientToken, displayName: config.name,
    scheme: `fb${facebookId}`, advertiserIDCollectionEnabled: false,
    autoLogAppEventsEnabled: false, isAutoInitEnabled: false, iosUserTrackingPermission: false,
  }]);
  return { ...config, plugins, ios: { ...config.ios,
    bundleIdentifier: config.ios?.bundleIdentifier || config.android.package,
    ...(localHttp ? { infoPlist: { ...config.ios?.infoPlist, NSAppTransportSecurity: { NSAllowsLocalNetworking: true } } } : {}),
  } };
};
