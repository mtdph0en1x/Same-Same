import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { socket } from '../socket';

export default function LobbyScreen({ roomCode, setRoomCode, isHost }) {
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    socket.on('matchmaking_joined', () => {
      setStatus('Finding a match...');
    });

    socket.on('room_created', (data) => {
      setRoomCode(data.roomCode);
      setStatus('Waiting for players...');
    });

    socket.on('joined_room', (data) => {
      setPlayers(data.players);
      setStatus('Waiting for host to start...');
    });

    socket.on('player_joined', (data) => {
      setPlayers(data.players);
    });

    return () => {
      socket.off('matchmaking_joined');
      socket.off('room_created');
      socket.off('joined_room');
      socket.off('player_joined');
    };
  }, []);

  const handleStartGame = () => {
    socket.emit('start_game', { roomCode });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{roomCode ? `Room: ${roomCode}` : 'Matchmaking'}</Text>
      <Text style={styles.status}>{status}</Text>
      
      {players.length > 0 && (
        <View style={styles.playerList}>
          {players.map((p, i) => (
            <Text key={i} style={styles.playerText}>• {p.name}</Text>
          ))}
        </View>
      )}

      {isHost && players.length > 0 && (
        <TouchableOpacity style={styles.button} onPress={handleStartGame}>
          <Text style={styles.buttonText}>Start Game</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#1E1E2C',
    alignItems: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: 20,
  },
  status: {
    fontSize: 20,
    color: '#4ECDC4',
    marginBottom: 30,
  },
  playerList: {
    width: '100%',
    backgroundColor: '#2D2D44',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
  },
  playerText: {
    color: '#FFF',
    fontSize: 18,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#FF6B6B',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
