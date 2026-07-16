import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, Animated, Image, useWindowDimensions
} from 'react-native';
import { socket } from '../socket';
import { theme } from '../styles/theme';

const TEAM_COLORS = { A: '#E11D48', B: '#2563EB' };
const TEAM_LABELS = { A: '🔴 Team A', B: '🔵 Team B' };

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

export default function GameScreen({ roomCode, gameData, players, teams }) {
  const [currentWord, setCurrentWord]       = useState('');
  const [submittedWords, setSubmittedWords] = useState([]);
  const [isDone, setIsDone]                 = useState(false);
  const [timeLeft, setTimeLeft]             = useState(60);
  const [finishedPlayers, setFinishedPlayers] = useState(new Set());

  const wordsPerRound = gameData.wordsPerRound || 5;
  const myTeam = teams ? teams[socket.id] : null;
  const inputRef = useRef(null);
  const { width } = useWindowDimensions();
  const isDesktop = width > 800;

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
  
  const isBlitz = Array.isArray(gameData.category);
  const currentCategory = isBlitz 
      ? (progress < wordsPerRound ? gameData.category[progress] : 'Blitz Complete!') 
      : gameData.category;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]} keyboardShouldPersistTaps="handled">

        <View style={isDesktop ? styles.desktopRow : {}}>
          <View style={isDesktop ? styles.desktopColLeft : {}}>

        {/* Team badge */}
        {myTeam && (
          <View style={[styles.teamBadge, { backgroundColor: TEAM_COLORS[myTeam] }]}>
            <Text style={styles.teamBadgeText}>{TEAM_LABELS[myTeam]}</Text>
          </View>
        )}

        {/* Players Top Bar */}
        <View style={styles.playersBar}>
          {players?.map(p => {
            const isFinished = finishedPlayers.has(p.id);
            return (
              <View key={p.id} style={[styles.playerAvatarContainer, isFinished && styles.playerFinished]}>
                {p.avatar && p.avatar.startsWith('http') ? (
                  <Image source={{ uri: p.avatar }} style={styles.smallAvatarImage} />
                ) : (
                  <View style={styles.smallAvatarFallback}>
                    <Text style={styles.smallAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                {isFinished && (
                  <View style={styles.checkmarkBadge}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

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

        </View>

        <View style={isDesktop ? styles.desktopColRight : {}}>

        {/* Category */}
        <View style={styles.categoryCard}>
          {isBlitz && <Text style={styles.blitzHeader}>⚡ BLITZ TOPIC {progress + 1} ⚡</Text>}
          <Text style={styles.categoryTitle}>{currentCategory}</Text>
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
        
        </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    padding: theme.spacing.xl,
    backgroundColor: 'transparent',
    alignItems: 'center',
    paddingBottom: 40,
  },
  containerDesktop: {
    paddingHorizontal: 40,
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
    alignItems: 'stretch',
  },
  desktopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 40,
    width: '100%',
  },
  desktopColLeft: {
    flex: 1,
    alignItems: 'center',
  },
  desktopColRight: {
    flex: 2,
    alignItems: 'center',
  },
  teamBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: theme.spacing.sm,
  },
  teamBadgeText: {
    color: '#FFFFFF',
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    letterSpacing: 0.5,
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
    borderWidth: 4,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  timerCircleWarning: {
    borderColor: theme.colors.destructive,
    shadowColor: theme.colors.destructive,
  },
  timerText: {
    fontSize: 36,
    color: '#000',
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
    color: '#000',
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
    borderRadius: theme.borderRadius.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    transform: [{ rotate: '-1deg' }],
  },
  blitzHeader: {
    fontFamily: theme.fonts.bodyBold,
    color: '#FDA4AF',
    fontSize: 14,
    letterSpacing: 2,
    marginBottom: theme.spacing.sm,
  },
  categoryTitle: {
    fontSize: 28,
    color: '#000',
    textAlign: 'center',
    fontFamily: theme.fonts.headingBold,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    marginBottom: theme.spacing.xl,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 16,
    color: '#000',
  },
  inputContainer: {
    width: '100%',
  },
  input: {
    backgroundColor: '#FFFFFF',
    color: '#000',
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    fontSize: 22,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
    fontFamily: theme.fonts.bodyBold,
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  button: {
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  buttonText: {
    color: theme.colors.onPrimary,
    fontSize: 22,
    fontFamily: theme.fonts.headingBold,
    letterSpacing: 1,
  },
  waitingContainer: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.secondary, // Pink
    borderRadius: theme.borderRadius.md,
    width: '100%',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    transform: [{ rotate: '1deg' }],
  },
  waitingEmoji: {
    fontSize: 40,
    marginBottom: theme.spacing.sm,
  },
  waitingText: {
    fontSize: 24,
    color: '#000',
    fontFamily: theme.fonts.headingBold,
    marginBottom: 4,
  },
  waitingSubtext: {
    fontSize: 16,
    color: '#000',
    fontFamily: theme.fonts.bodyBold,
  },
  playersBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    width: '100%',
    marginBottom: theme.spacing.xl,
  },
  playerAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    opacity: 0.5, // Dim until finished
  },
  playerFinished: {
    borderColor: '#10B981',
    opacity: 1, // Full opacity when finished
  },
  smallAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  smallAvatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallAvatarText: {
    fontFamily: theme.fonts.headingBold,
    color: theme.colors.muted,
    fontSize: 16,
  },
  checkmarkBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#10B981',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
