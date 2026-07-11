import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, Animated
} from 'react-native';
import { socket } from '../socket';
import { theme } from '../styles/theme';

function WordChip({ word }) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.chip, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
      <Text style={styles.chipText}>{word}</Text>
    </Animated.View>
  );
}

export default function GameScreen({ roomCode, gameData }) {
  const [currentWord, setCurrentWord]       = useState('');
  const [submittedWords, setSubmittedWords] = useState([]);
  const [isDone, setIsDone]                 = useState(false);
  const [timeLeft, setTimeLeft]             = useState(60);
  const [finishedPlayers, setFinishedPlayers] = useState(new Set());

  const wordsPerRound = gameData.wordsPerRound || 5;
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeLeft(gameData.timeLimit || 60);
    setCurrentWord('');
    setSubmittedWords([]);
    setIsDone(false);
    setFinishedPlayers(new Set());

    const interval = setInterval(() => {
      setTimeLeft(t => (t > 0 ? t - 1 : 0));
    }, 1000);

    socket.on('player_finished', ({ playerId }) => {
      setFinishedPlayers(prev => new Set([...prev, playerId]));
    });

    return () => {
      clearInterval(interval);
      socket.off('player_finished');
    };
  }, [gameData]);

  const handleSubmit = () => {
    const trimmed = currentWord.trim();
    if (!trimmed || isDone) return;

    const next = [...submittedWords, trimmed];
    setSubmittedWords(next);
    setCurrentWord('');
    socket.emit('submit_word', { roomId: roomCode, word: trimmed });

    if (next.length >= wordsPerRound) {
      setIsDone(true);
    } else {
      // Keep focus on input for fast typing
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const isWarning = timeLeft <= 10;
  const progress = submittedWords.length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Header: Round info */}
        <Text style={styles.headerText}>
          Round {gameData.roundNumber}/{gameData.totalRounds} · {gameData.roundType}
        </Text>

        {/* Timer + progress row */}
        <View style={styles.metaRow}>
          <View style={[styles.timerCircle, isWarning && styles.timerCircleWarning]}>
            <Text style={[styles.timerText, isWarning && styles.timerTextWarning]}>{timeLeft}</Text>
          </View>
          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>WORDS</Text>
            <Text style={styles.progressValue}>{progress} / {wordsPerRound}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(progress / wordsPerRound) * 100}%` }]} />
            </View>
          </View>
        </View>

        {/* Category */}
        <View style={styles.categoryCard}>
          <Text style={styles.categoryTitle}>{gameData.category}</Text>
        </View>

        {/* Submitted words */}
        {submittedWords.length > 0 && (
          <View style={styles.chipsContainer}>
            {submittedWords.map((w, i) => (
              <WordChip key={i} word={w} />
            ))}
          </View>
        )}

        {/* Input or done state */}
        {!isDone ? (
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={`Name something... (${wordsPerRound - progress} left)`}
              placeholderTextColor={theme.colors.muted}
              value={currentWord}
              onChangeText={setCurrentWord}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={handleSubmit}>
              <Text style={styles.buttonText}>Submit ↵</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingEmoji}>✅</Text>
            <Text style={styles.waitingText}>All done!</Text>
            <Text style={styles.waitingSubtext}>
              Waiting for others{finishedPlayers.size > 0 ? ` · ${finishedPlayers.size} finished` : ''}...
            </Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    paddingBottom: 40,
  },
  headerText: {
    fontSize: 16,
    color: theme.colors.secondary,
    fontFamily: theme.fonts.headingBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.xl,
    alignSelf: 'flex-start',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  timerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  timerCircleWarning: {
    borderColor: theme.colors.destructive,
    shadowColor: theme.colors.destructive,
  },
  timerText: {
    fontSize: 36,
    color: theme.colors.foreground,
    fontFamily: theme.fonts.headingBold,
  },
  timerTextWarning: {
    color: theme.colors.destructive,
  },
  progressContainer: {
    flex: 1,
  },
  progressLabel: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.muted,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  progressValue: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 28,
    color: theme.colors.foreground,
    marginBottom: 6,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: 4,
  },
  categoryCard: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    borderBottomWidth: 6,
    borderBottomColor: '#BE123C',
  },
  categoryTitle: {
    fontSize: 28,
    color: theme.colors.onPrimary,
    textAlign: 'center',
    fontFamily: theme.fonts.headingBold,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    marginBottom: theme.spacing.xl,
  },
  chip: {
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#6EE7B7',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 16,
    color: '#065F46',
  },
  inputContainer: {
    width: '100%',
  },
  input: {
    backgroundColor: '#FFFFFF',
    color: theme.colors.foreground,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    fontSize: 22,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
    fontFamily: theme.fonts.bodyBold,
    borderWidth: 2,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.border,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 2,
  },
  button: {
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderBottomWidth: 6,
    borderBottomColor: '#1D4ED8',
  },
  buttonText: {
    color: theme.colors.onPrimary,
    fontSize: 22,
    fontFamily: theme.fonts.headingBold,
    letterSpacing: 1,
  },
  waitingContainer: {
    padding: theme.spacing.xl,
    backgroundColor: '#F0FDF4',
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#86EFAC',
  },
  waitingEmoji: {
    fontSize: 40,
    marginBottom: theme.spacing.sm,
  },
  waitingText: {
    fontSize: 24,
    color: '#15803D',
    fontFamily: theme.fonts.headingBold,
    marginBottom: 4,
  },
  waitingSubtext: {
    fontSize: 16,
    color: '#4ADE80',
    fontFamily: theme.fonts.bodyBold,
  },
});
