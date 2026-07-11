import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, Animated, Alert
} from 'react-native';
import { socket } from '../socket';
import { theme } from '../styles/theme';

const MIN_PLAYERS = 2;

// Individual animated player card
function PlayerCard({ player, isHost, isSelf, onKick }) {
  const slideAnim = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.playerCard,
        { transform: [{ translateX: slideAnim }], opacity: opacityAnim },
      ]}
    >
      <View style={[styles.avatar, isSelf && styles.avatarSelf]}>
        <Text style={styles.avatarText}>{player.name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.playerText}>
        {player.name}{isSelf ? ' (You)' : ''}
      </Text>
      {isHost && !isSelf && (
        <TouchableOpacity style={styles.kickButton} onPress={() => onKick(player.id)}>
          <Text style={styles.kickButtonText}>✕</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// Fullscreen countdown overlay
function CountdownOverlay({ count }) {
  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scaleAnim.setValue(0.4);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 6,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [count]);

  return (
    <View style={styles.countdownOverlay}>
      <Animated.Text
        style={[
          styles.countdownNumber,
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        ]}
      >
        {count}
      </Animated.Text>
      <Text style={styles.countdownLabel}>Get ready!</Text>
    </View>
  );
}

export default function LobbyScreen({ roomCode, setRoomCode, isHost, setIsHost, lobbyIntent, playerData, setScreen }) {
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState('Connecting...');
  const [countdown, setCountdown] = useState(null);
  const [hostBanner, setHostBanner] = useState(false);
  const hostBannerTimer = useRef(null);

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

    socket.on('room_error', (data) => {
      Alert.alert('Oops', data.message);
      setScreen('Home');
    });

    socket.on('kicked', (data) => {
      Alert.alert('Removed', data.message);
      setScreen('Home');
    });

    socket.on('host_changed', (data) => {
      if (socket.id === data.newHostId) {
        setIsHost(true);
        setHostBanner(true);
        clearTimeout(hostBannerTimer.current);
        hostBannerTimer.current = setTimeout(() => setHostBanner(false), 3000);
      }
    });

    socket.on('countdown_started', ({ count }) => {
      setCountdown(count);
    });

    socket.on('countdown_tick', ({ count }) => {
      setCountdown(count);
    });

    return () => {
      socket.off('matchmaking_joined');
      socket.off('room_created');
      socket.off('joined_room');
      socket.off('player_joined');
      socket.off('room_error');
      socket.off('kicked');
      socket.off('host_changed');
      socket.off('countdown_started');
      socket.off('countdown_tick');
      clearTimeout(hostBannerTimer.current);
    };
  }, []);

  const handleStartGame = () => {
    socket.emit('start_game', { roomCode });
  };

  const handleKick = (targetId) => {
    socket.emit('kick_player', { roomCode, targetId });
  };

  const handleLeave = () => {
    socket.emit('leave_room', { roomCode });
    socket.disconnect();
    setScreen('Home');
  };

  const canStart = players.length >= MIN_PLAYERS;

  return (
    <SafeAreaView style={styles.safeArea}>
      {countdown !== null && <CountdownOverlay count={countdown} />}

      <View style={styles.container}>

        {/* Header row: Leave button + title */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.leaveButton} onPress={handleLeave}>
            <Text style={styles.leaveButtonText}>← Leave</Text>
          </TouchableOpacity>
        </View>

        {/* Host promotion banner */}
        {hostBanner && (
          <View style={styles.hostBanner}>
            <Text style={styles.hostBannerText}>👑 You are now the host!</Text>
          </View>
        )}

        {/* Room code or title */}
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

        {/* Player list */}
        {players.length > 0 && (
          <View style={styles.playerList}>
            {players.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                isHost={isHost}
                isSelf={p.id === socket.id}
                onKick={handleKick}
              />
            ))}
          </View>
        )}

        {/* START button — host only */}
        {isHost && (
          <View style={styles.startSection}>
            {!canStart && (
              <Text style={styles.startHint}>Need at least {MIN_PLAYERS} players to start</Text>
            )}
            <TouchableOpacity
              style={[styles.button, !canStart && styles.buttonDisabled]}
              activeOpacity={canStart ? 0.8 : 1}
              onPress={canStart ? handleStartGame : undefined}
            >
              <Text style={styles.buttonText}>START GAME</Text>
            </TouchableOpacity>
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
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  leaveButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  leaveButtonText: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.accent,
    fontSize: 16,
  },
  hostBanner: {
    backgroundColor: '#FEF9C3',
    borderWidth: 2,
    borderColor: '#EAB308',
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  hostBannerText: {
    fontFamily: theme.fonts.bodyBold,
    color: '#854D0E',
    fontSize: 16,
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
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
  avatarSelf: {
    backgroundColor: theme.colors.primary,
  },
  avatarText: {
    color: theme.colors.onPrimary,
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
  },
  playerText: {
    flex: 1,
    color: theme.colors.foreground,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 20,
  },
  kickButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  kickButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontFamily: theme.fonts.bodyBold,
  },
  startSection: {
    width: '100%',
    alignItems: 'center',
  },
  startHint: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.muted,
    fontSize: 14,
    marginBottom: theme.spacing.sm,
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
  buttonDisabled: {
    backgroundColor: '#D1D5DB',
    borderBottomColor: '#9CA3AF',
  },
  buttonText: {
    color: theme.colors.onPrimary,
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    letterSpacing: 1,
  },
  // Countdown overlay
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  countdownNumber: {
    fontSize: 160,
    fontFamily: theme.fonts.headingBold,
    color: '#FFFFFF',
    lineHeight: 180,
  },
  countdownLabel: {
    fontSize: 28,
    fontFamily: theme.fonts.bodyBold,
    color: 'rgba(255,255,255,0.7)',
    marginTop: theme.spacing.md,
  },
});
