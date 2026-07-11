import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { socket } from '../socket';
import { theme } from '../styles/theme';

export default function GameScreen({ roomCode, gameData }) {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    // Basic local timer for UI (Server should really manage this accurately but this is fine for now)
    setTimeLeft(gameData.timeLimit || 60);
    setAnswer('');
    setSubmitted(false);

    const interval = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [gameData]);

  const handleSubmit = () => {
    if (!answer.trim()) return;
    setSubmitted(true);
    socket.emit('submit_answer', { roomId: roomCode, answer });
  };

  const isWarning = timeLeft <= 5;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.headerText}>Round {gameData.roundNumber} - {gameData.roundType}</Text>
        
        <View style={[styles.timerCircle, isWarning && styles.timerCircleWarning]}>
          <Text style={[styles.timerText, isWarning && styles.timerTextWarning]}>{timeLeft}</Text>
        </View>
        
        <View style={styles.categoryCard}>
          <Text style={styles.categoryTitle}>{gameData.category}</Text>
        </View>

        {!submitted ? (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Type your answer..."
              placeholderTextColor={theme.colors.muted}
              value={answer}
              onChangeText={setAnswer}
              onSubmitEditing={handleSubmit}
              autoFocus
            />
            <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={handleSubmit}>
              <Text style={styles.buttonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>Waiting for others...</Text>
          </View>
        )}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 20,
    color: theme.colors.secondary,
    fontFamily: theme.fonts.headingBold,
    position: 'absolute',
    top: 50,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
    borderColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xxl,
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
    fontSize: 48,
    color: theme.colors.foreground,
    fontFamily: theme.fonts.headingBold,
  },
  timerTextWarning: {
    color: theme.colors.destructive,
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
    fontSize: 32,
    color: theme.colors.onPrimary,
    textAlign: 'center',
    fontFamily: theme.fonts.headingBold,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  inputContainer: {
    width: '100%',
  },
  input: {
    backgroundColor: '#FFFFFF',
    color: theme.colors.foreground,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    fontSize: 24,
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
    fontSize: 24,
    fontFamily: theme.fonts.headingBold,
    letterSpacing: 1,
  },
  waitingContainer: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.muted,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  waitingText: {
    fontSize: 24,
    color: theme.colors.secondary,
    fontFamily: theme.fonts.bodyBold,
  }
});
