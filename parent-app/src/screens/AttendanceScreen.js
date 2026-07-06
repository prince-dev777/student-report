import React, { useMemo } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, ActivityIndicator, Platform, StatusBar
} from 'react-native';
import { ArrowLeft, Calendar, CheckCircle2, XCircle, Clock } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export default function AttendanceScreen({ navigation }) {
  const { attendance, dataLoading, fetchData } = useAuth();

  // Summary Stats
  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;

    attendance.forEach(rec => {
      const status = (rec.status || '').toLowerCase();
      if (status === 'present') present++;
      else if (status === 'absent') absent++;
      else if (status === 'late') late++;
    });

    const total = attendance.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { total, present, absent, late, rate };
  }, [attendance]);

  const renderAttendanceItem = ({ item }) => {
    const status = (item.status || '').toLowerCase();
    
    return (
      <View style={styles.recordItem}>
        <View style={styles.recordHeader}>
          <Text style={styles.recordDate}>{item.date}</Text>
          <View style={[
            styles.statusPill,
            status === 'present' && { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
            status === 'late' && { backgroundColor: 'rgba(245, 158, 11, 0.1)' },
            status === 'absent' && { backgroundColor: 'rgba(239, 68, 68, 0.1)' }
          ]}>
            <Text style={[
              styles.statusText,
              status === 'present' && { color: colors.green },
              status === 'late' && { color: colors.orange },
              status === 'absent' && { color: colors.red }
            ]}>
              {status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.timeSection}>
          <View style={styles.timeCol}>
            <Text style={styles.timeLabel}>CHECK IN</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Clock size={12} color={colors.textTertiary} style={{ marginRight: 4 }} />
              <Text style={styles.timeVal}>{item.entryTime || '--:--'}</Text>
            </View>
          </View>
          
          <View style={styles.timeDivider} />
          
          <View style={styles.timeCol}>
            <Text style={styles.timeLabel}>CHECK OUT</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Clock size={12} color={colors.textTertiary} style={{ marginRight: 4 }} />
              <Text style={styles.timeVal}>{item.exitTime || '--:--'}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance History</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryRateContainer}>
            <Text style={styles.summaryRateVal}>{stats.rate}%</Text>
            <Text style={styles.summaryRateLabel}>Presence Rate</Text>
          </View>
          
          <View style={styles.verticalLine} />
          
          <View style={styles.summaryDetails}>
            <View style={styles.statRow}>
              <View style={[styles.dot, { backgroundColor: colors.green }]} />
              <Text style={styles.statLabel}>Present: {stats.present}</Text>
            </View>
            <View style={styles.statRow}>
              <View style={[styles.dot, { backgroundColor: colors.orange }]} />
              <Text style={styles.statLabel}>Late: {stats.late}</Text>
            </View>
            <View style={styles.statRow}>
              <View style={[styles.dot, { backgroundColor: colors.red }]} />
              <Text style={styles.statLabel}>Absent: {stats.absent}</Text>
            </View>
          </View>
        </View>
      </View>

      <FlatList
        data={attendance}
        renderItem={renderAttendanceItem}
        keyExtractor={(item, index) => item._id || String(index)}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          !dataLoading && (
            <View style={styles.emptyContainer}>
              <Calendar size={36} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No attendance records found</Text>
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
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    margin: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 10,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryRateContainer: {
    alignItems: 'center',
  },
  summaryRateVal: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.green,
  },
  summaryRateLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  verticalLine: {
    width: 1,
    height: 60,
    backgroundColor: colors.border,
  },
  summaryDetails: {
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  listContainer: {
    padding: 20,
    paddingTop: 10,
  },
  recordItem: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordDate: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  timeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  timeCol: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  timeVal: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  timeDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.borderLight,
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
