import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import GameScreen from './src/screens/GameScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import { socket } from './src/socket';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [roomCode, setRoomCode] = useState(null);
  const [playerData, setPlayerData] = useState({});
  const [isHost, setIsHost] = useState(false);
  
  const [gameData, setGameData] = useState(null);
  const [roundResults, setRoundResults] = useState(null);

  useEffect(() => {
    socket.on('game_started', (data) => {
      // Small delay for UI effect
    });

    socket.on('round_started', (data) => {
      setGameData(data);
      setCurrentScreen('Game');
    });

    socket.on('round_ended', (data) => {
      setRoundResults(data);
      setCurrentScreen('Results');
    });

    socket.on('game_over', (data) => {
      // Go back to lobby or show final results
      alert("Game Over! Final scores calculated.");
      setCurrentScreen('Home'); // For now, kick back to home
    });

    return () => {
      socket.off('game_started');
      socket.off('round_started');
      socket.off('round_ended');
      socket.off('game_over');
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {currentScreen === 'Home' && (
        <HomeScreen 
          setScreen={setCurrentScreen} 
          setRoomCode={setRoomCode}
          setPlayerData={setPlayerData}
          setIsHost={setIsHost}
        />
      )}
      {currentScreen === 'Lobby' && (
        <LobbyScreen 
          roomCode={roomCode}
          setRoomCode={setRoomCode}
          isHost={isHost}
        />
      )}
      {currentScreen === 'Game' && (
        <GameScreen 
          roomCode={roomCode} 
          gameData={gameData} 
        />
      )}
      {currentScreen === 'Results' && (
        <ResultsScreen 
          roundResults={roundResults}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E2C',
  },
});
