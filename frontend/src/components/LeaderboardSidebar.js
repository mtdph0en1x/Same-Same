import React from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
import { theme } from '../styles/theme';

export default function LeaderboardSidebar({ players, roundResults, currentScreen }) {
  // players is an array of player objects: { id, name, avatar, score, level }
  
  // If we have new scores from ResultsScreen, we can show them, otherwise show base score
  const getPlayerScore = (playerId) => {
    if (roundResults && roundResults.newScores && roundResults.newScores[playerId] !== undefined) {
      return roundResults.newScores[playerId];
    }
    const p = players.find(p => p.id === playerId);
    return p ? (p.score || 0) : 0;
  };

  const sortedPlayers = [...players].sort((a, b) => getPlayerScore(b.id) - getPlayerScore(a.id));

  return (
    <View style={styles.sidebar}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leaderboard</Text>
      </View>
      <View style={styles.list}>
        {sortedPlayers.map((p, index) => (
          <View key={p.id} style={styles.playerCard}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{index + 1}</Text>
            </View>
            <View style={styles.avatar}>
              {p.avatar && p.avatar.startsWith('http') ? (
                <Image source={{ uri: p.avatar }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{p.name?.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.score}>{getPlayerScore(p.id)} pts</Text>
            </View>
          </View>
        ))}
        {players.length === 0 && (
          <Text style={styles.emptyText}>Waiting for players...</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 280,
    height: '100%',
    backgroundColor: '#F3F4F6',
    borderRightWidth: 3,
    borderColor: '#000',
    flexDirection: 'column',
  },
  header: {
    padding: theme.spacing.md,
    borderBottomWidth: 3,
    borderColor: '#000',
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
    color: '#000',
  },
  list: {
    flex: 1,
    padding: theme.spacing.md,
    gap: 12,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: theme.borderRadius.md,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  rankBadge: {
    backgroundColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  rankText: {
    color: '#fff',
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#000',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontFamily: theme.fonts.headingBold,
    color: '#fff',
    fontSize: 16,
  },
  info: {
    flex: 1,
  },
  name: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    color: '#000',
  },
  score: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.muted,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 20,
  }
});
