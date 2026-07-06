import React from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, ActivityIndicator, Platform, StatusBar
} from 'react-native';
import { ArrowLeft, ClipboardList, Calendar } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export default function ResultsScreen({ navigation }) {
  const { results, dataLoading, fetchData } = useAuth();

  const getPercentageColor = (pct) => {
    if (pct >= 85) return colors.green;
    if (pct >= 60) return colors.orange;
    return colors.red;
  };

  const getPercentageBg = (pct) => {
    if (pct >= 85) return 'rgba(16, 185, 129, 0.1)';
    if (pct >= 60) return 'rgba(245, 158, 11, 0.1)';
    return 'rgba(239, 68, 68, 0.1)';
  };

  const renderResultItem = ({ item }) => {
    const pct = item.percentage != null ? item.percentage : 0;
    const testName = item.test?.name || 'Weekly Test';
    const subject = item.test?.subject || 'N/A';
    const testDate = item.test?.date || 'N/A';

    return (
      <View style={styles.resultCard}>
        <View style={styles.cardHeader}>
          <View style={styles.headerInfo}>
            <Text style={styles.testTitle}>{testName}</Text>
            <View style={styles.subjectBadge}>
              <Text style={styles.subjectText}>{subject}</Text>
            </View>
          </View>
          
          {item.rank && (
            <View style={styles.rankBadge}>
              <Text style={styles.rankNum}>{item.rank}</Text>
              <Text style={styles.rankTotal}>/{item.totalStudents || '--'}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.marksContainer}>
            <Text style={styles.marksObtained}>{item.marks}</Text>
            <Text style={styles.marksTotal}>/{item.totalMarks}</Text>
          </View>

          <View style={[
            styles.pctBadge,
            { backgroundColor: getPercentageBg(pct) }
          ]}>
            <Text style={[
              styles.pctText,
              { color: getPercentageColor(pct) }
            ]}>
              {pct}%
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerDateCol}>
            <Calendar size={12} color={colors.textTertiary} style={{ marginRight: 4 }} />
            <Text style={styles.footerDateText}>{testDate}</Text>
          </View>
          
          <View style={styles.markingSchemeContainer}>
            <Text style={styles.markingText}>Correct: +{item.test?.marksPerQuestion || 4} | Wrong: -{item.test?.negativeMarks || 1}</Text>
          </View>
        </View>

        {item.omrSheetImage && (
          <TouchableOpacity 
            style={styles.omrBtn} 
            onPress={() => navigation.navigate('OMRView', { imageUrl: item.omrSheetImage })}
          >
            <Text style={styles.omrBtnText}>View Scanned OMR Sheet</Text>
          </TouchableOpacity>
        )}
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
        <Text style={styles.headerTitle}>Test Results</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* List */}
      <FlatList
        data={results}
        renderItem={renderResultItem}
        keyExtractor={(item, index) => item._id || String(index)}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          !dataLoading && (
            <View style={styles.emptyContainer}>
              <ClipboardList size={36} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No test results published yet</Text>
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
  resultCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerInfo: {
    flex: 1,
    paddingRight: 10,
  },
  testTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subjectBadge: {
    backgroundColor: colors.inputBg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  subjectText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.blueLight,
  },
  rankBadge: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNum: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  rankTotal: {
    fontSize: 8,
    color: colors.textTertiary,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  marksContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  marksObtained: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  marksTotal: {
    fontSize: 15,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  pctBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pctText: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  markingText: {
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
  },
  omrBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  omrBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.blueLight,
  }
});
