import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';
import { socket } from '../socket';

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

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>Round {gameData.roundNumber} - {gameData.roundType}</Text>
      
      <View style={styles.timerCircle}>
        <Text style={styles.timerText}>{timeLeft}</Text>
      </View>
      
      <Text style={styles.categoryTitle}>{gameData.category}</Text>

      {!submitted ? (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type your answer..."
            value={answer}
            onChangeText={setAnswer}
            onSubmitEditing={handleSubmit}
            autoFocus
          />
          <TouchableOpacity style={styles.button} onPress={handleSubmit}>
            <Text style={styles.buttonText}>Submit</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.waitingText}>Waiting for others...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1E1E2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 24,
    color: '#FF6B6B',
    fontWeight: 'bold',
    position: 'absolute',
    top: 50,
  },
  timerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 5,
    borderColor: '#4ECDC4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  timerText: {
    fontSize: 40,
    color: '#FFF',
    fontWeight: 'bold',
  },
  categoryTitle: {
    fontSize: 32,
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 40,
    fontWeight: '600',
  },
  inputContainer: {
    width: '100%',
  },
  input: {
    backgroundColor: '#2D2D44',
    color: '#FFF',
    padding: 20,
    borderRadius: 15,
    fontSize: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#4ECDC4',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  waitingText: {
    fontSize: 24,
    color: '#666',
    fontStyle: 'italic',
  }
});
