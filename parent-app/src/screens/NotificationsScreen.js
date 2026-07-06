import React from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, ActivityIndicator, Platform, StatusBar
} from 'react-native';
import { ArrowLeft, Bell, CheckCircle2, Award, Clock } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export default function NotificationsScreen({ navigation }) {
  const { notifications, dataLoading, fetchData, markNotificationRead } = useAuth();

  const handlePressNotification = (item) => {
    if (!item.isRead) {
      markNotificationRead(item._id);
    }
  };

  const renderNotificationItem = ({ item }) => {
    const isUnread = !item.isRead;
    const formattedDate = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';
    const formattedTime = item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    return (
      <TouchableOpacity 
        style={[
          styles.notifItem,
          isUnread && styles.notifItemUnread
        ]}
        onPress={() => handlePressNotification(item)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.iconContainer,
          item.type === 'ATTENDANCE' && { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
          item.type === 'TEST_RESULT' && { backgroundColor: 'rgba(139, 92, 246, 0.1)' }
        ]}>
          {item.type === 'ATTENDANCE' ? (
            <CheckCircle2 size={18} color={colors.green} />
          ) : (
            <Award size={18} color={colors.accent} />
          )}
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, isUnread && styles.textBold]}>{item.title}</Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifMessage}>{item.message}</Text>
          <View style={styles.timeContainer}>
            <Clock size={11} color={colors.textTertiary} style={{ marginRight: 4 }} />
            <Text style={styles.timeText}>{formattedDate} {formattedTime}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Notifications</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* List */}
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item, index) => item._id || String(index)}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          !dataLoading && (
            <View style={styles.emptyContainer}>
              <Bell size={36} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No notifications found</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  listContainer: {
    padding: 20,
  },
  notifItem: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  notifItemUnread: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.04)',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  contentContainer: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  textBold: {
    fontWeight: '800',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginLeft: 10,
  },
  notifMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 14,
    marginTop: 8,
  }
});
