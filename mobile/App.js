import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useState } from 'react';

// 👇 Replace with your Render URL after deploying
const GAME_URL = 'https://royal-hunt.onrender.com';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0d0d2b" />
      {loading && (
        <View style={styles.loader}>
          <Text style={styles.crown}>👑</Text>
          <Text style={styles.title}>Royal Hunt</Text>
          <ActivityIndicator size="large" color="#f5c842" style={{ marginTop: 20 }} />
          <Text style={styles.hint}>Loading the kingdom...</Text>
        </View>
      )}
      {error ? (
        <View style={styles.loader}>
          <Text style={styles.crown}>⚠️</Text>
          <Text style={styles.title}>No Connection</Text>
          <Text style={styles.hint}>Make sure you're connected to the internet</Text>
        </View>
      ) : (
        <WebView
          source={{ uri: GAME_URL }}
          style={[styles.webview, loading && { opacity: 0 }]}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          onShouldStartLoadWithRequest={() => true}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d2b' },
  webview: { flex: 1 },
  loader: {
    position: 'absolute', inset: 0,
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0d0d2b', zIndex: 10,
  },
  crown: { fontSize: 72 },
  title: {
    fontWeight: '900', fontSize: 32, color: '#f5c842',
    letterSpacing: 4, marginTop: 12,
  },
  hint: { color: 'rgba(255,255,255,0.4)', marginTop: 12, fontSize: 14 },
});
