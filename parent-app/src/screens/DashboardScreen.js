import React, { useMemo } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, ScrollView, 
  TouchableOpacity, Image, Platform, StatusBar
} from 'react-native';
import { 
  User, Calendar, ClipboardList, Bell, TrendingUp, 
  LogOut, ChevronRight, Award, CheckCircle2 
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export default function DashboardScreen({ navigation }) {
  const { 
    student, attendance, results, notifications, 
    dataLoading, fetchData, logout 
  } = useAuth();

  // Derived attendance %
  const attendancePercent = useMemo(() => {
    if (!student || !attendance.length) return 0;
    const studentAtt = attendance.filter(a => 
      a.studentId === student.id || a.studentId === String(student._id)
    );
    if (!studentAtt.length) return 0;
    const present = studentAtt.filter(a => 
      a.status === 'present' || a.status === 'Present' || a.status === 'late' || a.status === 'Late'
    ).length;
    return Math.round((present / studentAtt.length) * 100);
  }, [student, attendance]);

  // Derived avg test score %
  const avgScore = useMemo(() => {
    if (!results.length) return 0;
    const percentages = results.filter(t => t.percentage != null).map(t => t.percentage);
    if (percentages.length === 0) return 0;
    return Math.round((percentages.reduce((s, p) => s + p, 0) / percentages.length) * 10) / 10;
  }, [results]);

  // Today's attendance status
  const todayStatus = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const log = attendance.find(a => a.date === todayStr);
    if (!log) return { status: 'No Record Yet', time: null };
    return { 
      status: log.status.charAt(0).toUpperCase() + log.status.slice(1), 
      time: log.entryTime || log.exitTime || null 
    };
  }, [attendance]);

  const recentNotifications = useMemo(() => {
    return notifications.slice(0, 3);
  }, [notifications]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Parent Portal</Text>
          <Text style={styles.headerSubtitle}>Student Tracking</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.headerBtn, styles.logoutBtn]} onPress={logout}>
            <LogOut size={18} color={colors.red} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
      >
        {/* Student card */}
        {student && (
          <View style={styles.studentCard}>
            <View style={styles.avatarCircle}>
              {student.photo ? (
                <Image source={{ uri: student.photo }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>
                  {student.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </Text>
              )}
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{student.name}</Text>
              <Text style={styles.studentMeta}>
                Roll: {student.rollNo} | Class: {student.class || 'N/A'}
              </Text>
              <Text style={styles.studentBatch}>Batch: {student.batch}</Text>
            </View>
          </View>
        )}

        {/* Today's Status Banner */}
        <View style={styles.statusBanner}>
          <View>
            <Text style={styles.statusLabel}>TODAY'S STATUS</Text>
            <Text style={[
              styles.statusValue,
              todayStatus.status.toLowerCase().includes('present') && { color: colors.green },
              todayStatus.status.toLowerCase().includes('late') && { color: colors.orange },
              todayStatus.status.toLowerCase().includes('absent') && { color: colors.red }
            ]}>
              {todayStatus.status}
            </Text>
          </View>
          {todayStatus.time && (
            <View style={styles.timeBadge}>
              <Text style={styles.timeText}>{todayStatus.time}</Text>
            </View>
          )}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <TouchableOpacity 
            style={styles.statCard}
            onPress={() => navigation.navigate('Attendance')}
          >
            <View style={[styles.statIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Calendar size={20} color={colors.green} />
            </View>
            <Text style={styles.statVal}>{attendancePercent}%</Text>
            <Text style={styles.statLabel}>Attendance</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.statCard}
            onPress={() => navigation.navigate('Results')}
          >
            <View style={[styles.statIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
              <ClipboardList size={20} color={colors.accent} />
            </View>
            <Text style={styles.statVal}>{avgScore}%</Text>
            <Text style={styles.statLabel}>Average Score</Text>
          </TouchableOpacity>
        </View>

        {/* Alerts Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Notifications</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {recentNotifications.length > 0 ? (
          <View style={styles.listCard}>
            {recentNotifications.map((notif, idx) => (
              <View 
                key={notif._id || idx} 
                style={[
                  styles.notifItem,
                  idx < recentNotifications.length - 1 && styles.borderBottom
                ]}
              >
                <View style={[
                  styles.notifIconBg,
                  notif.type === 'ATTENDANCE' && { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
                  notif.type === 'TEST_RESULT' && { backgroundColor: 'rgba(139, 92, 246, 0.1)' }
                ]}>
                  {notif.type === 'ATTENDANCE' ? (
                    <CheckCircle2 size={16} color={colors.green} />
                  ) : (
                    <Award size={16} color={colors.accent} />
                  )}
                </View>
                <View style={styles.notifContent}>
                  <Text style={styles.notifTitle} numberOfLines={1}>{notif.title}</Text>
                  <Text style={styles.notifDesc} numberOfLines={2}>{notif.message}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Bell size={24} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        )}

      </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    backgroundColor: colors.inputBg,
  },
  logoutBtn: {
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  scrollContent: {
    padding: 20,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 18,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  studentMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  studentBatch: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  timeBadge: {
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.blueLight,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statVal: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  seeAll: {
    fontSize: 13,
    color: colors.blueLight,
  },
  listCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  notifIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  notifDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 13,
    marginTop: 8,
  }
});
