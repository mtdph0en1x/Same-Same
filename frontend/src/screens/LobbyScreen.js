import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView } from 'react-native';
import { socket } from '../socket';
import { theme } from '../styles/theme';

export default function LobbyScreen({ roomCode, setRoomCode, isHost, lobbyIntent, playerData }) {
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    socket.connect();

    if (lobbyIntent === 'host_couch') {
      socket.emit('create_room', { name: playerData.name });
    } else if (lobbyIntent === 'join_couch') {
      socket.emit('join_room', { roomCode, playerData });
    } else if (lobbyIntent === 'matchmaking') {
      socket.emit('join_matchmaking', { name: playerData.name });
    }

    socket.on('matchmaking_joined', () => {
      setStatus('Finding a match...');
    });

    socket.on('room_created', (data) => {
      setRoomCode(data.roomCode);
      if (data.players) setPlayers(data.players);
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {roomCode ? (
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>ROOM CODE</Text>
            <Text style={styles.roomCode}>{roomCode}</Text>
          </View>
        ) : isHost ? (
          <Text style={styles.title}>Creating Room...</Text>
        ) : (
          <Text style={styles.title}>Matchmaking</Text>
        )}
        
        <Text style={styles.status}>{status}</Text>
        
        {players.length > 0 && (
          <View style={styles.playerList}>
            {players.map((p, i) => (
              <View key={i} style={styles.playerCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.playerText}>{p.name}</Text>
              </View>
            ))}
          </View>
        )}

        {isHost && players.length > 0 && (
          <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={handleStartGame}>
            <Text style={styles.buttonText}>START GAME</Text>
          </TouchableOpacity>
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
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  codeLabel: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.foreground,
    fontSize: 16,
    letterSpacing: 2,
    marginBottom: theme.spacing.xs,
  },
  roomCode: {
    fontSize: 64,
    fontFamily: theme.fonts.headingBold,
    color: theme.colors.primary,
    letterSpacing: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  title: {
    fontSize: 40,
    fontFamily: theme.fonts.headingBold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.lg,
  },
  status: {
    fontSize: 20,
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.accent,
    marginBottom: theme.spacing.xl,
  },
  playerList: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.xl,
    borderWidth: 2,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.border,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 2,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.muted,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  avatarText: {
    color: theme.colors.onPrimary,
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
  },
  playerText: {
    color: theme.colors.foreground,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 20,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    alignItems: 'center',
    borderBottomWidth: 6,
    borderBottomColor: '#BE123C',
  },
  buttonText: {
    color: theme.colors.onPrimary,
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    letterSpacing: 1,
  }
});
