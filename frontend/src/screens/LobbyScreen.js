import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, Animated, Alert, ScrollView, PanResponder
} from 'react-native';
import { socket } from '../socket';
import { theme } from '../styles/theme';

const MIN_PLAYERS      = 2;
const MIN_TEAM_PLAYERS = 4;

const PACK_LABELS = {
  all:         '🌍 All',
  classic:     '⭐ Classic',
  food:        '🍕 Food',
  nature:      '🌿 Nature',
  pop_culture: '🎬 Pop Culture',
  challenge:   '🔥 Challenge',
};

const TEAM_COLORS  = { A: '#E11D48', B: '#2563EB' };
const TEAM_BG      = { A: '#FFF1F2', B: '#EFF6FF' };
const TEAM_BORDER  = { A: '#FECDD3', B: '#BFDBFE' };
const TEAM_LABELS  = { A: '🔴 Team A', B: '🔵 Team B' };

// Segmented control (row of option buttons)
function SegmentedControl({ options, value, onChange, labelMap }) {
  return (
    <View style={styles.segmented}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[styles.segmentBtn, value === opt && styles.segmentBtnActive]}
          onPress={() => onChange(opt)}
          activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, value === opt && styles.segmentTextActive]}>
            {labelMap ? labelMap[opt] ?? opt : opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Toggle chip for round types
function RoundTypeToggle({ type, active, onChange }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={() => onChange(type)}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{type}</Text>
    </TouchableOpacity>
  );
}

// Draggable player card (team mode)
function DraggablePlayerCard({ player, isSelf, myTeam, dragTarget, setDragTarget, onDropToTeam, isHost }) {
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const shadowAnim = useRef(new Animated.Value(0)).current;
  const [dragging, setDragging] = useState(false);

  const lift = () => {
    setDragging(true);
    Animated.parallel([
      Animated.spring(scaleAnim,  { toValue: 1.06, useNativeDriver: true }),
      Animated.timing(shadowAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
    ]).start();
  };

  const drop = () => {
    setDragging(false);
    Animated.parallel([
      Animated.spring(scaleAnim,  { toValue: 1, useNativeDriver: true }),
      Animated.timing(shadowAnim, { toValue: 0, duration: 150, useNativeDriver: false }),
    ]).start();
    if (dragTarget && dragTarget !== myTeam) {
      onDropToTeam(player.id, dragTarget);
    }
    setDragTarget(null);
  };

  const color = TEAM_COLORS[myTeam];

  return (
    <Animated.View
      style={[
        styles.teamPlayerCard,
        { borderColor: color, transform: [{ scale: scaleAnim }] },
        dragging && styles.teamPlayerCardLifted,
      ]}
    >
      <View style={[styles.teamAvatar, { backgroundColor: color }]}>
        <Text style={styles.avatarText}>{player.name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.teamPlayerText} numberOfLines={1}>
        {player.name}{isSelf ? ' (You)' : ''}
      </Text>
      {isHost && !isSelf && (
        <TouchableOpacity
          style={[styles.dragHandle, { backgroundColor: color + '22' }]}
          onLongPress={lift}
          onPressOut={drop}
          delayLongPress={150}
        >
          <Text style={{ color, fontSize: 16 }}>⠿</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// Animated player card (solo mode)
function PlayerCard({ player, isHost, isSelf, onKick }) {
  const slideAnim   = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim,   { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.playerCard, { transform: [{ translateX: slideAnim }], opacity: opacityAnim }]}>
      <View style={[styles.avatar, isSelf && styles.avatarSelf]}>
        <Text style={styles.avatarText}>{player.name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.playerText}>{player.name}{isSelf ? ' (You)' : ''}</Text>
      {isHost && !isSelf && (
        <TouchableOpacity style={styles.kickButton} onPress={() => onKick(player.id)}>
          <Text style={styles.kickButtonText}>✕</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// Countdown overlay
function CountdownOverlay({ count }) {
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

  return (
    <View style={styles.countdownOverlay}>
      <Animated.Text style={[styles.countdownNumber, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
        {count}
      </Animated.Text>
      <Text style={styles.countdownLabel}>Get ready!</Text>
    </View>
  );
}

const DEFAULT_CONFIG = {
  maxRounds:     6,
  timeLimit:     60,
  wordsPerRound: 5,
  roundTypes:    ['Same Same', 'But Different', 'Rush'],
  categoryPack:  'classic',
  teamMode:      false,
};

export default function LobbyScreen({ roomCode, setRoomCode, isHost, setIsHost, lobbyIntent, playerData, setScreen }) {
  const [players, setPlayers]       = useState([]);
  const [status, setStatus]         = useState('Connecting...');
  const [countdown, setCountdown]   = useState(null);
  const [hostBanner, setHostBanner] = useState(false);
  const [config, setConfig]         = useState(DEFAULT_CONFIG);
  const [teams, setTeams]           = useState({});      // { [playerId]: 'A' | 'B' }
  const [dragTarget, setDragTarget] = useState(null);    // 'A' | 'B' | null — column being hovered
  const hostBannerTimer             = useRef(null);

  // Emit config update and update local state
  const handleConfigChange = (patch) => {
    const updated = { ...config, ...patch };
    setConfig(updated);
    socket.emit('update_config', { roomCode, config: updated });
  };

  const toggleRoundType = (type) => {
    const current = config.roundTypes;
    let next;
    if (current.includes(type)) {
      if (current.length === 1) return;
      next = current.filter(t => t !== type);
    } else {
      next = [...current, type];
    }
    handleConfigChange({ roundTypes: next });
  };

  // Move a player to a different team (host only)
  const handleDropToTeam = (playerId, newTeam) => {
    if (!isHost) return;
    const updated = { ...teams, [playerId]: newTeam };
    setTeams(updated);
    socket.emit('update_teams', { roomCode, teams: updated });
  };

  useEffect(() => {
    socket.connect();

    if (lobbyIntent === 'host_couch') {
      socket.emit('create_room', { name: playerData.name });
    } else if (lobbyIntent === 'join_couch') {
      socket.emit('join_room', { roomCode, playerData });
    } else if (lobbyIntent === 'matchmaking') {
      socket.emit('join_matchmaking', { name: playerData.name });
    }

    socket.on('matchmaking_joined', () => setStatus('Finding a match...'));

    socket.on('room_created', (data) => {
      setRoomCode(data.roomCode);
      if (data.players) setPlayers(data.players);
      if (data.config)  setConfig(data.config);
      if (data.teams)   setTeams(data.teams);
      setStatus('Waiting for players...');
    });

    socket.on('joined_room', (data) => {
      setPlayers(data.players);
      if (data.config) setConfig(data.config);
      if (data.teams)  setTeams(data.teams);
      setStatus('Waiting for host to start...');
    });

    socket.on('player_joined', (data) => {
      setPlayers(data.players);
      if (data.teams) setTeams(data.teams);
    });

    socket.on('config_updated', (data) => {
      if (data.config) setConfig(data.config);
    });

    socket.on('teams_updated', (data) => {
      if (data.teams) setTeams(data.teams);
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

    socket.on('countdown_started', ({ count }) => setCountdown(count));
    socket.on('countdown_tick',    ({ count }) => setCountdown(count));

    return () => {
      socket.off('matchmaking_joined');
      socket.off('room_created');
      socket.off('joined_room');
      socket.off('player_joined');
      socket.off('config_updated');
      socket.off('teams_updated');
      socket.off('room_error');
      socket.off('kicked');
      socket.off('host_changed');
      socket.off('countdown_started');
      socket.off('countdown_tick');
      clearTimeout(hostBannerTimer.current);
    };
  }, []);

  const handleStartGame = () => socket.emit('start_game', { roomCode });
  const handleKick      = (targetId) => socket.emit('kick_player', { roomCode, targetId });
  const handleLeave     = () => {
    socket.emit('leave_room', { roomCode });
    socket.disconnect();
    setScreen('Home');
  };

  const minPlayers = config.teamMode ? MIN_TEAM_PLAYERS : MIN_PLAYERS;
  const canStart   = players.length >= minPlayers;

  // Split players by team for the two-column board
  const teamA = players.filter(p => teams[p.id] === 'A');
  const teamB = players.filter(p => teams[p.id] === 'B');

  return (
    <SafeAreaView style={styles.safeArea}>
      {countdown !== null && <CountdownOverlay count={countdown} />}

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
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

        {/* Room code */}
        {roomCode ? (
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>ROOM CODE</Text>
            <Text style={styles.roomCode}>{roomCode}</Text>
          </View>
        ) : (
          <Text style={styles.title}>{isHost ? 'Creating Room...' : 'Matchmaking'}</Text>
        )}

        <Text style={styles.status}>{status}</Text>

        {/* ── Player list ────────────────────────────────────────────── */}
        {players.length > 0 && (
          <View style={styles.card}>
            {config.teamMode ? (
              /* Two-column team board */
              <>
                <Text style={styles.cardLabel}>TEAMS  {players.length}/{8}</Text>
                {isHost && (
                  <Text style={styles.dragHint}>Long-press ⠿ to drag a player to the other team</Text>
                )}
                <View style={styles.teamColumns}>
                  {(['A', 'B']).map(team => {
                    const members = team === 'A' ? teamA : teamB;
                    const isHovered = dragTarget === team;
                    return (
                      <TouchableOpacity
                        key={team}
                        activeOpacity={1}
                        onPress={() => {}} // drop zone — handled by DraggablePlayerCard drop
                        style={[
                          styles.teamColumn,
                          { backgroundColor: TEAM_BG[team], borderColor: isHovered ? TEAM_COLORS[team] : TEAM_BORDER[team] },
                          isHovered && styles.teamColumnHovered,
                        ]}
                        // Expose this column as the drag target when hovered
                        onStartShouldSetResponder={() => { setDragTarget(team); return false; }}
                        onMoveShouldSetResponder={()  => { setDragTarget(team); return false; }}
                      >
                        <Text style={[styles.teamColumnLabel, { color: TEAM_COLORS[team] }]}>
                          {TEAM_LABELS[team]}
                        </Text>
                        {members.map(p => (
                          <DraggablePlayerCard
                            key={p.id}
                            player={p}
                            isSelf={p.id === socket.id}
                            myTeam={team}
                            dragTarget={dragTarget}
                            setDragTarget={setDragTarget}
                            onDropToTeam={handleDropToTeam}
                            isHost={isHost}
                          />
                        ))}
                        {members.length === 0 && (
                          <Text style={styles.emptyTeam}>Drop here</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              /* Flat player list (solo mode) */
              <>
                <Text style={styles.cardLabel}>PLAYERS  {players.length}/{8}</Text>
                {players.map((p) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    isHost={isHost}
                    isSelf={p.id === socket.id}
                    onKick={handleKick}
                  />
                ))}
              </>
            )}
          </View>
        )}

        {/* ── Settings panel ─────────────────────────────────────────── */}
        {roomCode && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>GAME SETTINGS{!isHost ? '  (set by host)' : ''}</Text>

            <Text style={styles.settingLabel}>Words per round</Text>
            {isHost ? (
              <SegmentedControl
                options={[3, 5, 7]}
                value={config.wordsPerRound}
                onChange={(v) => handleConfigChange({ wordsPerRound: v })}
                labelMap={{ 3: '3', 5: '5', 7: '7' }}
              />
            ) : (
              <Text style={styles.readOnlyValue}>{config.wordsPerRound} words per round</Text>
            )}

            <Text style={styles.settingLabel}>Rounds</Text>
            {isHost ? (
              <SegmentedControl
                options={[3, 6, 9]}
                value={config.maxRounds}
                onChange={(v) => handleConfigChange({ maxRounds: v })}
                labelMap={{ 3: '3', 6: '6', 9: '9' }}
              />
            ) : (
              <Text style={styles.readOnlyValue}>{config.maxRounds} rounds</Text>
            )}

            <Text style={styles.settingLabel}>Time per round</Text>
            {isHost ? (
              <SegmentedControl
                options={[30, 60, 90]}
                value={config.timeLimit}
                onChange={(v) => handleConfigChange({ timeLimit: v })}
                labelMap={{ 30: '30s', 60: '60s', 90: '90s' }}
              />
            ) : (
              <Text style={styles.readOnlyValue}>{config.timeLimit}s per round</Text>
            )}

            <Text style={styles.settingLabel}>Round types</Text>
            {isHost ? (
              <View style={styles.chipRow}>
                {['Same Same', 'But Different', 'Rush'].map(type => (
                  <RoundTypeToggle
                    key={type}
                    type={type}
                    active={config.roundTypes.includes(type)}
                    onChange={toggleRoundType}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.readOnlyValue}>{config.roundTypes.join(', ')}</Text>
            )}

            <Text style={styles.settingLabel}>Category pack</Text>
            {isHost ? (
              <SegmentedControl
                options={['classic', 'food', 'nature', 'pop_culture', 'challenge', 'all']}
                value={config.categoryPack}
                onChange={(v) => handleConfigChange({ categoryPack: v })}
                labelMap={PACK_LABELS}
              />
            ) : (
              <Text style={styles.readOnlyValue}>{PACK_LABELS[config.categoryPack] ?? config.categoryPack}</Text>
            )}

            {/* Teams toggle */}
            <Text style={styles.settingLabel}>Team mode</Text>
            {isHost ? (
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, !config.teamMode && styles.toggleBtnActive]}
                  onPress={() => handleConfigChange({ teamMode: false })}
                >
                  <Text style={[styles.toggleText, !config.teamMode && styles.toggleTextActive]}>Off</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, config.teamMode && styles.toggleBtnActiveTeam]}
                  onPress={() => handleConfigChange({ teamMode: true })}
                >
                  <Text style={[styles.toggleText, config.teamMode && styles.toggleTextActive]}>On</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.readOnlyValue}>{config.teamMode ? 'On' : 'Off'}</Text>
            )}
          </View>
        )}

        {/* START button — host only */}
        {isHost && (
          <View style={styles.startSection}>
            {!canStart && (
              <Text style={styles.startHint}>
                {config.teamMode
                  ? `Team mode needs at least ${MIN_TEAM_PLAYERS} players`
                  : `Need at least ${MIN_PLAYERS} players to start`}
              </Text>
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

        <View style={{ height: 32 }} />
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
    marginBottom: theme.spacing.sm,
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
    fontSize: 18,
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.accent,
    marginBottom: theme.spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.border,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 2,
  },
  cardLabel: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.muted,
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: theme.spacing.md,
  },
  // ── Solo player list ───────────────────────────────────────────────────
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
    fontSize: 18,
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
  // ── Team board ─────────────────────────────────────────────────────────
  dragHint: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.muted,
    marginBottom: theme.spacing.md,
    fontStyle: 'italic',
  },
  teamColumns: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  teamColumn: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    padding: theme.spacing.sm,
    minHeight: 80,
  },
  teamColumnHovered: {
    borderStyle: 'dashed',
  },
  teamColumnLabel: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  teamPlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    padding: theme.spacing.sm,
    marginBottom: 6,
  },
  teamPlayerCardLifted: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  teamAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  teamPlayerText: {
    flex: 1,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.foreground,
  },
  dragHandle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTeam: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
    fontStyle: 'italic',
  },
  // ── Settings ────────────────────────────────────────────────────────────
  settingLabel: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.foreground,
    fontSize: 15,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  readOnlyValue: {
    fontFamily: theme.fonts.body,
    color: theme.colors.secondary,
    fontSize: 15,
    marginBottom: theme.spacing.sm,
  },
  // Segmented control
  segmented: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  segmentBtn: {
    flex: 1,
    minWidth: 48,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  segmentText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.foreground,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  // Round type chip toggles
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: '#F9FAFB',
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.foreground,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  // Team mode toggle
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  toggleBtnActiveTeam: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  toggleText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.foreground,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  // START button
  startSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  startHint: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.muted,
    fontSize: 14,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
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
