import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Nunito_300Light, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import HomeScreen from './src/screens/HomeScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import GameScreen from './src/screens/GameScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import { socket } from './src/socket';
import { theme } from './src/styles/theme';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [roomCode, setRoomCode] = useState(null);
  const [playerData, setPlayerData] = useState({});
  const [isHost, setIsHost] = useState(false);
  const [lobbyIntent, setLobbyIntent] = useState(null);
  
  const [gameData, setGameData] = useState(null);
  const [roundResults, setRoundResults] = useState(null);

  let [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_300Light,
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

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

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container} onLayout={onLayoutRootView}>
      <StatusBar style="dark" />
      {currentScreen === 'Home' && (
        <HomeScreen 
          setScreen={setCurrentScreen} 
          setRoomCode={setRoomCode}
          setPlayerData={setPlayerData}
          setIsHost={setIsHost}
          setLobbyIntent={setLobbyIntent}
        />
      )}
      {currentScreen === 'Lobby' && (
        <LobbyScreen 
          roomCode={roomCode}
          setRoomCode={setRoomCode}
          isHost={isHost}
          setIsHost={setIsHost}
          lobbyIntent={lobbyIntent}
          playerData={playerData}
          setScreen={setCurrentScreen}
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
    backgroundColor: theme.colors.background,
  },
});
