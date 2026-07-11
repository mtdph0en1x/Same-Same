import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';

export default function ResultsScreen({ roundResults }) {
  const { groups, newScores } = roundResults;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Round Results</Text>

      <ScrollView style={styles.scroll}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1E1E2C',
    paddingTop: 50,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 30,
  },
  scroll: {
    flex: 1,
  },
  groupCard: {
    backgroundColor: '#2D2D44',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
  },
  answerText: {
    fontSize: 24,
    color: '#FFF',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  playersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  playerBadge: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 20,
  },
  playerName: {
    color: '#1E1E2C',
    fontWeight: 'bold',
  },
  leaderboardTitle: {
    fontSize: 28,
    color: '#FFF',
    marginTop: 20,
    marginBottom: 15,
    textAlign: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#3E3E5C',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  scoreName: {
    color: '#FFF',
    fontSize: 18,
  },
  scoreValue: {
    color: '#4ECDC4',
    fontSize: 20,
    fontWeight: 'bold',
  }
});
