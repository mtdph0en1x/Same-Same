import React from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView } from 'react-native';
import { theme } from '../styles/theme';

const TEAM_COLORS  = { A: '#E11D48', B: '#2563EB' };
const TEAM_LABELS  = { A: '🔴 Team A', B: '🔵 Team B' };
const TEAM_SHADOWS = { A: '#BE123C',  B: '#1D4ED8' };

export default function ResultsScreen({ roundResults }) {
  const { groups, newScores, playerNames = {}, teams = null, teamScores = null } = roundResults;

  // Sort individual scores descending
  const sortedScores = Object.entries(newScores).sort((a, b) => b[1] - a[1]);

  // Separate matching groups from unique ones
  const matchedGroups = groups.filter(g => g.playerIds.length > 1);
  const uniqueGroups  = groups.filter(g => g.playerIds.length === 1);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Round Results</Text>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Team Scoreboard (team mode only) ──────────────────────── */}
          {teams && teamScores && (
            <>
              <Text style={styles.sectionLabel}>⚔️ Teams</Text>
              <View style={styles.teamBoard}>
                {['A', 'B'].map(team => (
                  <View
                    key={team}
                    style={[styles.teamCard, { borderColor: TEAM_COLORS[team], shadowColor: TEAM_COLORS[team] }]}
                  >
                    <Text style={[styles.teamCardLabel, { color: TEAM_COLORS[team] }]}>
                      {TEAM_LABELS[team]}
                    </Text>
                    <Text style={[styles.teamCardScore, { color: TEAM_COLORS[team] }]}>
                      {teamScores[team]}
                    </Text>
                    <Text style={styles.teamCardUnit}>pts</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── Matching words ─────────────────────────────────────────── */}
          {matchedGroups.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>🎯 Matches</Text>
              {matchedGroups.map((g, i) => (
                <View key={i} style={styles.groupCard}>
                  <Text style={styles.answerText}>{g.canonical.toUpperCase()}</Text>
                  <View style={styles.playersRow}>
                    {g.playerIds.map((p, j) => (
                      <View
                        key={j}
                        style={[
                          styles.playerBadge,
                          teams && { backgroundColor: TEAM_COLORS[teams[p.id]] || theme.colors.secondary },
                        ]}
                      >
                        <Text style={styles.playerName}>{p.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ── Unique words ───────────────────────────────────────────── */}
          {uniqueGroups.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>💡 Unique answers</Text>
              {uniqueGroups.map((g, i) => (
                <View key={i} style={[styles.groupCard, styles.groupCardUnique]}>
                  <Text style={styles.answerText}>{g.canonical.toUpperCase()}</Text>
                  <View style={styles.playersRow}>
                    {g.playerIds.map((p, j) => (
                      <View
                        key={j}
                        style={[
                          styles.playerBadge,
                          styles.playerBadgeUnique,
                          teams && { backgroundColor: TEAM_COLORS[teams[p.id]] || '#7DD3FC' },
                        ]}
                      >
                        <Text style={styles.playerName}>{p.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ── Individual Scoreboard ──────────────────────────────────── */}
          <Text style={styles.sectionLabel}>🏆 Scoreboard</Text>
          {sortedScores.map(([pid, score], i) => {
            const playerTeam = teams ? teams[pid] : null;
            return (
              <View key={pid} style={[styles.scoreRow, i === 0 && styles.scoreRowFirst]}>
                <Text style={styles.scoreRank}>{i + 1}</Text>
                {playerTeam && (
                  <View style={[styles.teamDot, { backgroundColor: TEAM_COLORS[playerTeam] }]} />
                )}
                <Text style={styles.scoreName}>{playerNames[pid] || `Player ${pid.substring(0, 4)}`}</Text>
                <Text style={styles.scoreValue}>{score} pts</Text>
              </View>
            );
          })}

          <View style={{ height: 32 }} />
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
    marginBottom: theme.spacing.lg,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  scroll: {
    flex: 1,
  },
  sectionLabel: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.muted,
    letterSpacing: 1.5,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  // Team board
  teamBoard: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  teamCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 3,
    padding: theme.spacing.lg,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 2,
  },
  teamCardLabel: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    marginBottom: 4,
  },
  teamCardScore: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 48,
    lineHeight: 56,
  },
  teamCardUnit: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.muted,
  },
  // Word groups
  groupCard: {
    backgroundColor: '#FFFFFF',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 2,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.border,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 2,
    alignItems: 'center',
  },
  groupCardUnique: {
    borderColor: '#E0F2FE',
    backgroundColor: '#F0F9FF',
  },
  answerText: {
    fontSize: 26,
    color: theme.colors.foreground,
    fontFamily: theme.fonts.headingBold,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
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
  playerBadgeUnique: {
    backgroundColor: '#7DD3FC',
  },
  playerName: {
    color: theme.colors.onPrimary,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 15,
  },
  // Individual scoreboard
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 4,
    borderBottomColor: '#1D4ED8',
    gap: theme.spacing.md,
  },
  scoreRowFirst: {
    backgroundColor: theme.colors.primary,
    borderBottomColor: '#BE123C',
  },
  scoreRank: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontFamily: theme.fonts.headingBold,
    width: 24,
    textAlign: 'center',
  },
  teamDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  scoreName: {
    flex: 1,
    color: theme.colors.onPrimary,
    fontSize: 20,
    fontFamily: theme.fonts.bodyBold,
  },
  scoreValue: {
    color: theme.colors.onPrimary,
    fontSize: 22,
    fontFamily: theme.fonts.headingBold,
  },
});

