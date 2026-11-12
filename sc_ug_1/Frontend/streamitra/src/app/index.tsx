import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import DashVidCardList from '@components/dashvidcardlist';
import { toVideoList, useVideos } from '@hooks/videos';
import localVideos from '../assets/videocards.json';

// Bundled sample data uses the backend's format, so it goes through the same mapping
const fallbackVideos = toVideoList(localVideos);

export default function Index() {
  // Local Video Boolean
  const useLocalVideos = false; // Set to true to use local videos, false to fetch from API

  if (useLocalVideos) {
    return (
      <View style={styles.container}>
        <DashVidCardList data={fallbackVideos} />
      </View>
    );
  }

  else {
    // Calls GET /api/videos once, when this screen mounts
    const { videos, loading, error, refetch } = useVideos();

    return (
      <View style={styles.container}>
        {loading && videos.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <>
            {error ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>
                  Couldn't load videos from the server, showing sample videos. {error}
                </Text>
                <Button title="Try again" onPress={refetch} />
              </View>
            ) : null}

            {/* Same component as before: it accepts the backend array or the bundled JSON */}
            <View style={styles.list}>
              <DashVidCardList data={error ? fallbackVideos : videos} />
            </View>
          </>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  actions: { padding: 16, gap: 8 },
  banner: { padding: 12, gap: 8, backgroundColor: '#fdecea' },
  bannerText: { color: '#b3261e', fontSize: 13 },
});