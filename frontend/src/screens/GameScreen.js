import React, { useState, useEffect, useRef } from 'react';
import AppText from '../components/AppText';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, Animated, Image, useWindowDimensions
} from 'react-native';
import { useTranslation } from 'react-i18next';
import NeoButton from '../components/NeoButton';
import { socket } from '../socket';
import { theme } from '../styles/theme';
import FramedAvatar from '../components/FramedAvatar';
import SoundManager from '../utils/SoundManager';
import { usePostHog } from 'posthog-react-native';

const TEAM_COLORS = { A: '#E11D48', B: '#2563EB' };

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
      <AppText style={styles.chipText}>{word}</AppText>
    </Animated.View>
  );
}

// Pre-round overlay
function PreRoundOverlay({ count, gameData }) {
  const { t } = useTranslation();
  const scaleAnim   = useRef(new Animated.Value(0.4)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scaleAnim.setValue(0.4);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, tension: 120, friction: 6 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [count]);

  const roundName = gameData.roundType === 'But Different' ? t('lobby.butdifferent', 'BUT DIFFERENT') : gameData.roundType === 'Blitz' ? t('lobby.blitz', 'BLITZ') : t('lobby.samesame', 'SAME SAME');
  const roundGoal = gameData.roundType === 'But Different' ? t('game.goalButDifferent') : gameData.roundType === 'Blitz' ? t('game.goalBlitz') : t('game.goalSameSame');

  return (
    <View style={styles.countdownOverlay}>
      <AppText style={{ fontFamily: 'Fredoka_700Bold', fontSize: 24, color: '#FFF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
        {t('game.roundHeader', { current: gameData.roundNumber, total: gameData.totalRounds, type: '' }).split(' · ')[0]}
      </AppText>
      
      <View style={{ backgroundColor: '#FCD34D', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 16 }}>
        <AppText style={{ fontFamily: 'Fredoka_700Bold', fontSize: 20, color: '#991B1B', letterSpacing: 1, textTransform: 'uppercase' }}>
          {roundName}
        </AppText>
      </View>
      
      <AppText style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 18, color: '#E5E7EB', marginBottom: 40, textAlign: 'center', paddingHorizontal: 20 }}>
        {roundGoal}
      </AppText>

      <Animated.Text style={[styles.countdownNumber, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
        {count}
      </Animated.Text>
    </View>
  );
}

export default function GameScreen({ roomCode, gameData, players, teams, isPreRound }) {
  const posthog = usePostHog();
  const { t } = useTranslation();
  const [currentWord, setCurrentWord]       = useState('');
  const [submittedWords, setSubmittedWords] = useState([]);
  const [isDone, setIsDone]                 = useState(false);
  const [timeLeft, setTimeLeft]             = useState(60);
  const [finishedPlayers, setFinishedPlayers] = useState(new Set());

  const wordsPerRound = gameData.wordsPerRound || 5;
  const myTeam = teams ? teams[socket.id] : null;
  const teamLabels = { A: t('lobby.teamA', '🔴 Team A'), B: t('lobby.teamB', '🔵 Team B') };
  const [isWarning, setIsWarning]           = useState(false);
  const [preRoundCount, setPreRoundCount]   = useState(3);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  useEffect(() => {
    if (isPreRound) {
      setPreRoundCount(3);
      const interval = setInterval(() => {
        setPreRoundCount(c => (c > 1 ? c - 1 : 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPreRound]);

  const inputRef = useRef(null);

  useEffect(() => {
    setTimeLeft(gameData.timeLimit !== undefined ? gameData.timeLimit : 60);
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

  useEffect(() => {
    if (timeLeft <= 10 && timeLeft > 0 && !isDone) {
      SoundManager.startLoop('tick');
    } else {
      SoundManager.stopLoop('tick');
    }
  }, [timeLeft, isDone]);

  const handleSubmit = () => {
    const trimmed = currentWord.trim();
    if (!trimmed || isDone) return;

    const next = [...submittedWords, trimmed];
    setSubmittedWords(next);
    setCurrentWord('');
    socket.emit('submit_word', { roomId: roomCode, word: trimmed });

    if (next.length >= wordsPerRound) {
      setIsDone(true);
      posthog.capture('Finished Round Words', { 
        room_code: roomCode, 
        round_number: gameData.roundNumber,
        time_left: timeLeft
      });
    } else {
      // Keep focus on input for fast typing
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const progress = submittedWords.length;
  
  const isBlitz = Array.isArray(gameData.category);
  const currentCategory = isBlitz 
      ? (progress < wordsPerRound ? gameData.category[progress] : t('game.blitzComplete', 'Blitz Complete!')) 
      : gameData.category;

  return (
    <SafeAreaView style={styles.safeArea}>
      {isPreRound && <PreRoundOverlay count={preRoundCount} gameData={gameData} />}
      <ScrollView contentContainerStyle={[styles.container, !isDesktop && styles.containerMobile, isDesktop && styles.containerDesktop]} keyboardShouldPersistTaps="handled">

        <View style={isDesktop ? styles.desktopRow : styles.mobileRow}>
          <View style={isDesktop ? styles.desktopColLeft : styles.mobileCol}>

        {/* Team badge */}
        {myTeam && (
          <View style={[styles.teamBadge, { backgroundColor: TEAM_COLORS[myTeam] }]}>
            <AppText style={styles.teamBadgeText}>{teamLabels[myTeam]}</AppText>
          </View>
        )}

        {/* Players Top Bar */}
        <View style={styles.playersBar}>
          {players?.map(p => {
            const isFinished = finishedPlayers.has(p.id);
            return (
              <View key={p.id} style={[styles.playerAvatarContainer, isFinished && styles.playerFinished]}>
                <FramedAvatar 
                  url={p.avatar} 
                  fallbackName={p.name} 
                  frame={p.frame || 'none'} 
                  size={40} 
                />
                {isFinished && (
                  <View style={styles.checkmarkBadge}>
                    <AppText style={styles.checkmarkText}>✓</AppText>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Header: Round info */}
        <AppText style={styles.headerText}>
          {t('game.roundHeader', { 
            current: gameData.roundNumber, 
            total: gameData.totalRounds, 
            type: t(`lobby.${gameData.roundType.replace(' ', '').toLowerCase()}`, gameData.roundType)
          })}
        </AppText>

        {/* Timer + progress row */}
        <View style={[styles.metaRow, !isDesktop && styles.metaRowMobile]}>
          <View style={[styles.timerCircle, !isDesktop && styles.timerCircleMobile, isWarning && styles.timerCircleWarning]}>
            <AppText style={[styles.timerText, !isDesktop && styles.timerTextMobile, isWarning && styles.timerTextWarning]}>{timeLeft}</AppText>
          </View>
          <View style={styles.progressContainer}>
            <AppText style={styles.progressLabel}>{t('game.words', 'WORDS')}</AppText>
            <AppText style={styles.progressValue}>{progress} / {wordsPerRound}</AppText>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(progress / wordsPerRound) * 100}%` }]} />
            </View>
          </View>
        </View>

        </View>

        <View style={isDesktop ? styles.desktopColRight : styles.mobileCol}>

        {/* Category */}
        <View style={[styles.categoryCard, !isDesktop && styles.categoryCardMobile]}>
          {isBlitz && <AppText style={[styles.blitzHeader, !isDesktop && styles.blitzHeaderMobile]}>{t('game.blitzTopic', { num: progress + 1 })}</AppText>}
          <AppText style={[styles.categoryTitle, !isDesktop && styles.categoryTitleMobile]}>{currentCategory}</AppText>
          <AppText style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 15, color: '#444', marginTop: 12 }}>
            {gameData.roundType === 'But Different' ? t('game.goalButDifferent') : gameData.roundType === 'Blitz' ? t('game.goalBlitz') : t('game.goalSameSame')}
          </AppText>
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
              style={[styles.input, !isDesktop && styles.inputMobile]}
              placeholder={
                gameData.roundType === 'But Different' ? t('game.placeholderButDifferent', { left: wordsPerRound - progress }) :
                gameData.roundType === 'Blitz' ? t('game.placeholderBlitz', { left: wordsPerRound - progress }) :
                t('game.placeholderSameSame', { left: wordsPerRound - progress })
              }
              placeholderTextColor={theme.colors.muted}
              value={currentWord}
              onChangeText={setCurrentWord}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
            />
            <NeoButton style={[styles.button, !isDesktop && styles.buttonMobile]} activeOpacity={0.8} onPress={handleSubmit}>
              <AppText style={[styles.buttonText, !isDesktop && styles.buttonTextMobile]}>{t('game.submit', 'Submit ↵')}</AppText>
            </NeoButton>
          </View>
        ) : (
          <View style={styles.waitingContainer}>
            <AppText style={styles.waitingEmoji}>✅</AppText>
            <AppText style={styles.waitingText}>{t('game.allDone', 'All done!')}</AppText>
            <AppText style={styles.waitingSubtext}>
              {t('game.waitingForOthers', { finished: finishedPlayers.size > 0 ? t('game.finished', { count: finishedPlayers.size }) : '' })}
            </AppText>
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
    alignItems: 'stretch',
    paddingBottom: 40,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  countdownNumber: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 120,
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  containerMobile: {
    padding: theme.spacing.md,
    paddingBottom: 20,
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
    alignItems: 'stretch',
  },
  mobileRow: {
    flexDirection: 'column',
    width: '100%',
    gap: 16,
  },
  mobileCol: {
    width: '100%',
    alignItems: 'stretch',
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
  metaRowMobile: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
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
  timerCircleMobile: {
    width: 60,
    height: 60,
    borderWidth: 3,
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
  timerTextMobile: {
    fontSize: 24,
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
  categoryCardMobile: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
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
  categoryTitleMobile: {
    fontSize: 20,
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
  inputMobile: {
    padding: theme.spacing.md,
    fontSize: 16,
    marginBottom: theme.spacing.md,
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
  buttonMobile: {
    padding: theme.spacing.md,
  },
  buttonTextMobile: {
    fontSize: 18,
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
