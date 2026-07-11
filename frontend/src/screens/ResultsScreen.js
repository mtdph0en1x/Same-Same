import React from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView } from 'react-native';
import { theme } from '../styles/theme';

export default function ResultsScreen({ roundResults }) {
  const { groups, newScores } = roundResults;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Round Results</Text>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {groups.map((g, i) => (
            <View key={i} style={styles.groupCard}>
              <Text style={styles.answerText}>{g.original.toUpperCase()}</Text>
              <View style={styles.playersRow}>
                {g.players.map((p, j) => (
                  <View key={j} style={styles.playerBadge}>
                    <Text style={styles.playerName}>{p.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <Text style={styles.leaderboardTitle}>Scores</Text>
          {Object.keys(newScores).map((pid, i) => (
            <View key={i} style={styles.scoreRow}>
              <Text style={styles.scoreName}>Player {pid.substring(0,4)}</Text>
              <Text style={styles.scoreValue}>{newScores[pid]}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.xxl,
  },
  title: {
    fontSize: 40,
    fontFamily: theme.fonts.headingBold,
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  scroll: {
    flex: 1,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.border,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 2,
    alignItems: 'center',
  },
  answerText: {
    fontSize: 32,
    color: theme.colors.foreground,
    fontFamily: theme.fonts.headingBold,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  playersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  playerBadge: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.pill,
  },
  playerName: {
    color: theme.colors.onPrimary,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 16,
  },
  leaderboardTitle: {
    fontSize: 32,
    color: theme.colors.primary,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
    fontFamily: theme.fonts.headingBold,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 4,
    borderBottomColor: '#1D4ED8',
  },
  scoreName: {
    color: theme.colors.onPrimary,
    fontSize: 20,
    fontFamily: theme.fonts.bodyBold,
  },
  scoreValue: {
    color: theme.colors.onPrimary,
    fontSize: 24,
    fontFamily: theme.fonts.headingBold,
  }
});
