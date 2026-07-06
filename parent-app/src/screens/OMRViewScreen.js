import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, Image, SafeAreaView, 
  TouchableOpacity, ActivityIndicator, Platform, StatusBar 
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { IMAGE_HOST } from '../services/api';

export default function OMRViewScreen({ route, navigation }) {
  const { imageUrl } = route.params;
  const [loading, setLoading] = useState(true);

  // Combine image URL with image host if it's a relative path
  const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${IMAGE_HOST}${imageUrl}`;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scanned OMR Sheet</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Image Container */}
      <View style={styles.imageWrapper}>
        {loading && (
          <ActivityIndicator 
            size="large" 
            color={colors.blueLight} 
            style={styles.loader} 
          />
        )}
        <Image
          source={{ uri: fullUrl }}
          style={styles.omrImage}
          onLoadEnd={() => setLoading(false)}
          onError={() => setLoading(false)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0d24', // deep dark contrast background for viewing OMR sheets
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    padding: 10
  },
  omrImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  loader: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
  }
});
