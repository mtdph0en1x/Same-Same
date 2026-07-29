import React, { useEffect, useState, useRef } from 'react';
import AppText from '../components/AppText';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  SafeAreaView, Animated, Alert, ScrollView, PanResponder, Image, useWindowDimensions
} from 'react-native';
import { useTranslation } from 'react-i18next';
import NeoButton from '../components/NeoButton';
import { socket } from '../socket';
import { theme } from '../styles/theme';
import FramedAvatar from '../components/FramedAvatar';
import { usePostHog } from 'posthog-react-native';
import SoundManager from '../utils/SoundManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';

const MIN_PLAYERS      = 2;
const MIN_TEAM_PLAYERS = 4;

const TEAM_COLORS  = { A: '#E11D48', B: '#2563EB' };
const TEAM_BG      = { A: '#FFF1F2', B: '#EFF6FF' };
const TEAM_BORDER  = { A: '#FECDD3', B: '#BFDBFE' };


// Segmented control (row of option buttons)
function SegmentedControl({ options, value, onChange, labelMap }) {
  return (
    <View style={styles.segmented}>
      {options.map(opt => (
        <NeoButton
          key={opt}
          style={[styles.segmentBtn, value === opt && styles.segmentBtnActive]}
          onPress={() => onChange(opt)}
          activeOpacity={0.7}
        >
          <AppText style={[styles.segmentText, value === opt && styles.segmentTextActive]}>
            {labelMap ? labelMap[opt] ?? opt : opt}
          </AppText>
        </NeoButton>
      ))}
    </View>
  );
}

// Toggle chip for round types
function RoundTypeToggle({ type, value, active, onChange }) {
  return (
    <NeoButton
      style={[styles.chip, active && styles.chipActive]}
      onPress={() => onChange(value || type)}
      activeOpacity={0.7}
    >
      <AppText style={[styles.chipText, active && styles.chipTextActive]}>{type}</AppText>
    </NeoButton>
  );
}

// Draggable player card (team mode)
function DraggablePlayerCard({ player, isSelf, myTeam, onDropToTeam, isHost }) {
  const { t } = useTranslation();
  const pan = useRef(new Animated.ValueXY()).current;
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const shadowAnim = useRef(new Animated.Value(0)).current;
  const [dragging, setDragging] = useState(false);

  // Force reset position when the team changes (so it doesn't stay translated if React reuses the element)
  useEffect(() => {
    pan.setValue({ x: 0, y: 0 });
    scaleAnim.setValue(1);
    shadowAnim.setValue(0);
    setDragging(false);
  }, [myTeam]);

  const handleRelease = (e, gestureState) => {
    setDragging(false);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      Animated.timing(shadowAnim, { toValue: 0, duration: 150, useNativeDriver: false }),
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false })
    ]).start();

    if (myTeam === 'A' && gestureState.dx > 60) {
      onDropToTeam(player.id, 'B');
    } else if (myTeam === 'B' && gestureState.dx < -60) {
      onDropToTeam(player.id, 'A');
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isHost, // Only host can drag
      onMoveShouldSetPanResponder: () => isHost,
      onPanResponderGrant: () => {
        setDragging(true);
        Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 1.06, useNativeDriver: true }),
          Animated.timing(shadowAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
        ]).start();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: handleRelease,
      onPanResponderTerminate: handleRelease, // Catch browser native drag interruptions
    })
  ).current;

  const color = TEAM_COLORS[myTeam];

  return (
    <Animated.View
      {...(isHost ? panResponder.panHandlers : {})}
      style={[
        styles.teamPlayerCard,
        { 
          borderColor: color, 
          transform: [
            { scale: scaleAnim },
            { translateX: pan.x },
            { translateY: pan.y }
          ],
          zIndex: dragging ? 10 : 1,
          userSelect: 'none', // Prevent text selection on web while dragging
          touchAction: 'none' // Prevent browser scrolling
        },
        dragging && styles.teamPlayerCardLifted,
      ]}
    >
      <FramedAvatar 
        url={player.avatar} 
        fallbackName={player.name} 
        frame={player.frame || 'none'} 
        size={40} 
        style={{ marginRight: 10 }}
      />
      <AppText style={styles.teamPlayerText} numberOfLines={1}>
        ⭐{player.level || 1} {player.name}{isSelf ? ` ${t('common.you', '(You)')}` : ''}
      </AppText>
      {isHost && (
        <View style={[styles.dragHandle, { backgroundColor: color + '22' }]}>
          <AppText style={{ color, fontSize: 16 }}>⠿</AppText>
        </View>
      )}
    </Animated.View>
  );
}

// Animated player card (solo mode)
function PlayerCard({ player, isHost, isSelf, onKick, isHostless }) {
  const { t } = useTranslation();
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
      <FramedAvatar 
        url={player.avatar} 
        fallbackName={player.name} 
        frame={player.frame || 'none'} 
        size={44} 
        style={{ marginRight: 12, ...(isSelf ? { borderColor: theme.colors.primary, borderWidth: 2 } : {}) }}
      />
      <AppText style={styles.playerText}>⭐{player.level || 1} {player.name}{isSelf ? ` ${t('common.you', '(You)')}` : ''}</AppText>
      {isHost && !isSelf && !isHostless && (
        <NeoButton style={styles.kickButton} onPress={() => onKick(player.id)}>
          <AppText style={styles.kickButtonText}>✕</AppText>
        </NeoButton>
      )}
    </Animated.View>
  );
}

// Countdown overlay
function CountdownOverlay({ count, modifiers = [] }) {
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

  return (
    <View style={styles.countdownOverlay}>
      <Animated.Text style={[styles.countdownNumber, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
        {count}
      </Animated.Text>
      <AppText style={styles.countdownLabel}>{t('lobby.getReady', 'Get ready!')}</AppText>
      {modifiers.length > 0 && (
        <Animated.View style={{ opacity: opacityAnim, marginTop: 20, gap: 10 }}>
          {modifiers.includes('Rush') && (
            <AppText style={{ fontFamily: 'Fredoka_700Bold', fontSize: 20, color: '#FCD34D', textAlign: 'center' }}>
              {t('lobby.rushActive')}
            </AppText>
          )}
          {modifiers.includes('Hardcore') && (
            <AppText style={{ fontFamily: 'Fredoka_700Bold', fontSize: 20, color: '#F87171', textAlign: 'center' }}>
              {t('lobby.hardcoreActive')}
            </AppText>
          )}
          {modifiers.includes('Zen') && (
            <AppText style={{ fontFamily: 'Fredoka_700Bold', fontSize: 20, color: '#34D399', textAlign: 'center' }}>
              {t('lobby.zenActive')}
            </AppText>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const DEFAULT_CONFIG = {
  maxRounds:     6,
  timeLimit:     60,
  wordsPerRound: 5,
  roundTypes:    ['Same Same', 'But Different', 'Blitz'],
  categoryPack:  'classic',
  teamMode:      false,
  modifiers:     [],
};

export default function LobbyScreen({ roomCode, setRoomCode, isHost, setIsHost, lobbyIntent, playerData, setScreen }) {
  const posthog = usePostHog();
  const { t, i18n } = useTranslation();
  const [players, setPlayers]       = useState([]);
  const [status, setStatus]         = useState(t('lobby.connecting', 'Connecting...'));
  const [countdown, setCountdown]   = useState(null);
  const [hostBanner, setHostBanner] = useState(false);
  const [config, setConfig]         = useState(DEFAULT_CONFIG);
  const [teams, setTeams]           = useState({});      // { [playerId]: 'A' | 'B' }
  const [availablePacks, setAvailablePacks] = useState(['classic', 'all']);

  const [isPublic, setIsPublic]     = useState(false);
  const [isHostless, setIsHostless] = useState(false);
  const [votes, setVotes]           = useState({}); // { [packId]: count }
  const [errorMsg, setErrorMsg]     = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const hostBannerTimer             = useRef(null);
  const { width } = useWindowDimensions();
  const isDesktop = width > 800;

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

  const toggleModifier = (mod) => {
    const current = config.modifiers || [];
    let next;
    if (current.includes(mod)) {
      next = current.filter(m => m !== mod);
    } else {
      next = [...current, mod];
    }
    handleConfigChange({ modifiers: next });
  };

  // Move a player to a different team (host only)
  const handleDropToTeam = (playerId, newTeam) => {
    if (!isHost) return;
    const updated = { ...teams, [playerId]: newTeam };
    setTeams(updated);
    socket.emit('update_teams', { roomCode, teams: updated });
  };

  const handleVote = (packId) => {
    socket.emit('submit_vote', { roomCode, packId });
  };

  const handleCopyLink = async () => {
    const url = `https://www.same-same.fun/?room=${roomCode}`;
    await Clipboard.setStringAsync(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  useEffect(() => {
    socket.connect();

    socket.emit('get_available_packs', { lang: playerData?.lang || i18n.language || 'en' });
    socket.on('available_packs', (data) => {
      if (data.packs && data.packs.length > 0) {
        setAvailablePacks(data.packs);
      }
    });

    if (lobbyIntent === 'host_game') {
      socket.emit('create_room', playerData);
    } else if (lobbyIntent === 'join_couch' || lobbyIntent === 'join_public') {
      socket.emit('join_room', { roomCode, playerData });
    } else if (lobbyIntent === 'quick_play') {
      socket.emit('quick_play', playerData);
    } else if (lobbyIntent === 'rejoin') {
      AsyncStorage.getItem('sessionId').then(sid => {
        socket.emit('rejoin_room', { roomCode, sessionId: sid || socket.id });
      });
    }



    socket.on('room_created', (data) => {
      setRoomCode(data.roomCode);
      if (data.players) setPlayers(data.players);
      if (data.config)  setConfig(data.config);
      if (data.teams)   setTeams(data.teams);
      setIsPublic(!!data.isPublic);
      setIsHostless(!!data.isHostless);
      setStatus(t('lobby.waitingForPlayers', 'Waiting for players...'));
    });

    socket.on('joined_room', (data) => {
      setRoomCode(data.roomCode);
      setPlayers(data.players);
      if (data.config) setConfig(data.config);
      if (data.teams)  setTeams(data.teams);
      setIsPublic(!!data.isPublic);
      setIsHostless(!!data.isHostless);
      setStatus(data.isPublic && data.isHostless ? t('lobby.matchStartingSoon', 'Match starting soon...') : t('lobby.waitingForHost', 'Waiting for host to start...'));
    });

    socket.on('player_joined', (data) => {
      setPlayers(data.players);
      if (data.teams) setTeams(data.teams);
    });

    socket.on('config_updated', (data) => {
      if (data.config) {
        setConfig(data.config);
        setIsPublic(!!data.config.isPublic);
      }
    });

    socket.on('teams_updated', (data) => {
      if (data.teams) setTeams(data.teams);
    });

    socket.on('votes_updated', (data) => {
      if (data.votes) setVotes(data.votes);
    });

    socket.on('room_error', (data) => {
      setErrorMsg(data.message);
    });

    socket.on('kicked', (data) => {
      Alert.alert(t('lobby.removedTitle', 'Removed'), data.message);
      setScreen('Home');
    });

    socket.on('host_changed', (data) => {
      if (socket.id === data.newHostId || playerData?.sessionId === data.newHostId) {
        setIsHost(true);
        setHostBanner(true);
        clearTimeout(hostBannerTimer.current);
        hostBannerTimer.current = setTimeout(() => setHostBanner(false), 3000);
      }
    });

    socket.on('countdown_started', ({ count }) => {
      setCountdown(count);
      SoundManager.startLoop('tick');
    });
    socket.on('countdown_tick', ({ count }) => {
      setCountdown(count);
    });

    return () => {
      socket.off('room_created');
      socket.off('joined_room');
      socket.off('player_joined');
      socket.off('config_updated');
      socket.off('teams_updated');
      socket.off('votes_updated');
      socket.off('room_error');
      socket.off('kicked');
      socket.off('host_changed');
      socket.off('countdown_started');
      socket.off('countdown_tick');
      socket.off('available_packs');
      clearTimeout(hostBannerTimer.current);
      SoundManager.stopLoop('tick');
    };
  }, []);

  const handleStartGame = () => {
    posthog.capture('Started Game', { 
      room_code: roomCode, 
      is_public: isPublic,
      time_limit: config.timeLimit,
      round_count: config.totalRounds,
      game_modes: config.roundTypes
    });
    socket.emit('start_game', { roomCode });
  };
  const handleKick      = (targetId) => socket.emit('kick_player', { roomCode, targetId });
  const handleLeave = () => {
    socket.emit('leave_room', { roomCode });
    setRoomCode(null);
    setScreen('Home');
  };

  const minPlayers = config.teamMode ? MIN_TEAM_PLAYERS : MIN_PLAYERS;
  const canStart   = players.length >= minPlayers;

  // Split players by team for the two-column board
  const teamA = players.filter(p => teams[p.id] === 'A');
  const teamB = players.filter(p => teams[p.id] === 'B');

  const packLabels = {
    all:         t('packs.all', '🌍 All'),
    classic:     t('packs.classic', '⭐ Classic'),
    food:        t('packs.food', '🍕 Food'),
    nature:      t('packs.nature', '🌿 Nature'),
    pop_culture: t('packs.pop_culture', '🎬 Pop Culture'),
    challenge:   t('packs.challenge', '🔥 Challenge'),
  };
  
  const getPackLabel = (packId) => {
    return packLabels[packId] || t(`packs.${packId}`, packId.charAt(0).toUpperCase() + packId.slice(1).replace(/_/g, ' '));
  };

  const dynamicPackLabels = availablePacks.reduce((acc, packId) => {
    acc[packId] = getPackLabel(packId);
    return acc;
  }, {});

  const teamLabels = { A: t('lobby.teamA', '🔴 Team A'), B: t('lobby.teamB', '🔵 Team B') };

  // Error UI Branch
  if (errorMsg) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.matchmakingContainer}>
          <AppText style={[styles.title, { color: theme.colors.accent }]}>{t('lobby.oops', 'Oops!')}</AppText>
          <AppText style={styles.searchingStatus}>{errorMsg}</AppText>
          <NeoButton style={styles.cancelMatchBtn} onPress={() => setScreen('Home')}>
            <AppText style={styles.cancelMatchBtnText}>{t('lobby.backToHome', 'Back to Home')}</AppText>
          </NeoButton>
        </View>
      </SafeAreaView>
    );
  }



  // Couch Lobby UI
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Full-screen countdown for private or hosted public rooms */}
      {countdown !== null && (!isPublic || !isHostless) && <CountdownOverlay count={countdown} modifiers={config.modifiers || []} />}

      <ScrollView 
        contentContainerStyle={[styles.container, !isDesktop && { padding: 16 }, isDesktop && styles.containerDesktop]} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Unified Header */}
        <View style={[
          { width: '100%', marginBottom: isDesktop ? 16 : 24 },
          isDesktop ? { flexDirection: 'row', alignItems: 'center' } : { flexDirection: 'column', alignItems: 'center', gap: 16 }
        ]}>
          <View style={!isDesktop ? { width: '100%', flexDirection: 'row', justifyContent: 'flex-start' } : {}}>
            <NeoButton style={styles.leaveButton} onPress={handleLeave}>
              <AppText style={styles.leaveButtonText}>{t('lobby.leave', '← Leave')}</AppText>
            </NeoButton>
          </View>
          
          {/* ONLY ON MOBILE: Show Room Code/Title below the leave button */}
          {!isDesktop && (
            <View style={{ alignItems: 'center' }}>
              {roomCode ? (
                <View style={[styles.codeContainer, { alignItems: 'center' }]}>
                  <AppText style={styles.codeLabel}>{t('lobby.roomCode', 'ROOM CODE')}</AppText>
                  <AppText style={[styles.roomCode, { fontSize: 48, letterSpacing: 4 }]}>{roomCode}</AppText>
                  <TouchableOpacity 
                    style={{ marginTop: 8, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: linkCopied ? '#10B981' : '#fff', borderWidth: 2, borderColor: '#000', borderRadius: 8, flexDirection: 'row', alignItems: 'center' }} 
                    onPress={handleCopyLink}
                  >
                    <AppText style={{ fontFamily: theme.fonts.headingBold, fontSize: 14, color: linkCopied ? '#fff' : '#000' }}>
                      {linkCopied ? '✅ Copied!' : '🔗 Copy Invite Link'}
                    </AppText>
                  </TouchableOpacity>
                </View>
              ) : (
                <AppText style={[styles.title, { fontSize: 28, marginBottom: 12 }]}>{isHost ? t('lobby.creatingRoom', 'Creating Room...') : t('lobby.matchmakingTitle', 'Matchmaking')}</AppText>
              )}
              <AppText style={styles.status}>{status}</AppText>
            </View>
          )}
        </View>

        <View style={isDesktop ? styles.desktopRow : {}}>
          <View style={isDesktop ? styles.desktopColLeft : {}}>

        {/* Host promotion banner */}
        {hostBanner && (
          <View style={styles.hostBanner}>
            <AppText style={styles.hostBannerText}>{t('lobby.youAreNowHost', '👑 You are now the host!')}</AppText>
          </View>
        )}

        {/* ONLY ON DESKTOP: Show Room Code/Title in the left column */}
        {isDesktop && (
          <View style={{ alignItems: 'flex-start' }}>
            {roomCode ? (
              <View style={[styles.codeContainer, { alignItems: 'flex-start' }]}>
                <AppText style={styles.codeLabel}>{t('lobby.roomCode', 'ROOM CODE')}</AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <AppText style={styles.roomCode}>{roomCode}</AppText>
                  <TouchableOpacity 
                    style={{ paddingVertical: 8, paddingHorizontal: 16, backgroundColor: linkCopied ? '#10B981' : '#fff', borderWidth: 2, borderColor: '#000', borderRadius: 8, flexDirection: 'row', alignItems: 'center' }} 
                    onPress={handleCopyLink}
                  >
                    <AppText style={{ fontFamily: theme.fonts.headingBold, fontSize: 16, color: linkCopied ? '#fff' : '#000' }}>
                      {linkCopied ? '✅ Copied!' : '🔗 Copy Invite Link'}
                    </AppText>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <AppText style={styles.title}>{isHost ? t('lobby.creatingRoom', 'Creating Room...') : t('lobby.matchmakingTitle', 'Matchmaking')}</AppText>
            )}
            <AppText style={[styles.status, { textAlign: 'left' }]}>{status}</AppText>
          </View>
        )}

        {/* ── Player list ────────────────────────────────────────────── */}
        {players.length > 0 && (
          <View style={[styles.card, !isDesktop && { padding: 16 }]}>
            {config.teamMode ? (
              /* Two-column team board */
              <>
                <AppText style={styles.cardLabel}>{t('lobby.teams', { count: players.length, max: 8 })}</AppText>
                {isHost && (
                  <AppText style={styles.dragHint}>{t('lobby.dragHint', 'Drag the ⠿ handle horizontally to swap teams')}</AppText>
                )}
                <View style={styles.teamColumns}>
                  {(['A', 'B']).map(team => {
                    const members = team === 'A' ? teamA : teamB;
                    return (
                      <View
                        key={team}
                        style={[
                          styles.teamColumn,
                          { backgroundColor: TEAM_BG[team], borderColor: TEAM_BORDER[team] },
                        ]}
                      >
                        <AppText style={[styles.teamColumnLabel, { color: TEAM_COLORS[team] }]}>
                          {teamLabels[team]}
                        </AppText>
                        {members.map(p => (
                          <DraggablePlayerCard
                            key={p.id}
                            player={p}
                            isSelf={p.id === socket.id || p.id === playerData?.sessionId}
                            myTeam={team}
                            onDropToTeam={handleDropToTeam}
                            isHost={isHost}
                          />
                        ))}
                        {members.length === 0 && (
                          <AppText style={styles.emptyTeam}>{t('lobby.dropHere', 'Drop here')}</AppText>
                        )}
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              /* Flat player list (solo mode) */
              <>
                <AppText style={styles.cardLabel}>{t('lobby.players', { count: players.length, max: 8 })}</AppText>
                {players.map((p) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    isHost={isHost}
                    isSelf={p.id === socket.id || p.id === playerData?.sessionId}
                    onKick={handleKick}
                    isHostless={isHostless}
                  />
                ))}
              </>
              )}
            </View>
          )}

          </View>

          <View style={isDesktop ? styles.desktopColRight : {}}>
          {/* ── Settings panel ─────────────────────────────────────────── */}
          {roomCode && (!isPublic || !isHostless) && (
          <View style={[styles.card, !isDesktop && { padding: 16 }]}>
            <AppText style={[styles.cardLabel, !isDesktop && { marginBottom: 12 }]}>{!isHost ? t('lobby.gameSettingsReadOnly', 'GAME SETTINGS  (set by host)') : t('lobby.gameSettings', 'GAME SETTINGS')}</AppText>

            {/* Room Privacy toggle */}
            <AppText style={styles.settingLabel}>{t('lobby.roomPrivacy', 'Room Privacy')}</AppText>
            {isHost ? (
              <View style={styles.toggleRow}>
                <NeoButton
                  style={[styles.toggleBtn, !config.isPublic && styles.toggleBtnActive]}
                  onPress={() => handleConfigChange({ isPublic: false })}
                >
                  <AppText style={[styles.toggleText, !config.isPublic && styles.toggleTextActive]}>{t('lobby.private', 'Private')}</AppText>
                </NeoButton>
                <NeoButton
                  style={[styles.toggleBtn, config.isPublic && styles.toggleBtnActiveTeam]}
                  onPress={() => handleConfigChange({ isPublic: true })}
                >
                  <AppText style={[styles.toggleText, config.isPublic && styles.toggleTextActive]}>{t('lobby.public', 'Public')}</AppText>
                </NeoButton>
              </View>
            ) : (
              <AppText style={styles.readOnlyValue}>{config.isPublic ? t('lobby.publicVisible', 'Public (Visible in Browser)') : t('lobby.privateCodeOnly', 'Private (Code Only)')}</AppText>
            )}

            {config.isPublic && (
              <>
                <AppText style={styles.settingLabel}>{t('lobby.roomName', 'Room Name')}</AppText>
                {isHost ? (
                  <TextInput
                    style={styles.textInput}
                    value={config.roomName}
                    onChangeText={(v) => handleConfigChange({ roomName: v })}
                    placeholder={t('lobby.enterRoomName', 'Enter room name')}
                    placeholderTextColor="#9CA3AF"
                    maxLength={20}
                  />
                ) : (
                  <AppText style={styles.readOnlyValue}>{config.roomName || t('lobby.unnamedRoom', 'Unnamed Room')}</AppText>
                )}
              </>
            )}

            <AppText style={styles.settingLabel}>{t('lobby.wordsPerRound', 'Words per round')}</AppText>
            {isHost ? (
              <SegmentedControl
                options={[3, 5, 7]}
                value={config.wordsPerRound}
                onChange={(v) => handleConfigChange({ wordsPerRound: v })}
                labelMap={{ 3: '3', 5: '5', 7: '7' }}
              />
            ) : (
              <AppText style={styles.readOnlyValue}>{t('lobby.wordsPerRoundValue', { count: config.wordsPerRound })}</AppText>
            )}

            <AppText style={styles.settingLabel}>{t('lobby.rounds', 'Rounds')}</AppText>
            {isHost ? (
              <SegmentedControl
                options={[3, 6, 9]}
                value={config.maxRounds}
                onChange={(v) => handleConfigChange({ maxRounds: v })}
                labelMap={{ 3: '3', 6: '6', 9: '9' }}
              />
            ) : (
              <AppText style={styles.readOnlyValue}>{t('lobby.roundsValue', { count: config.maxRounds })}</AppText>
            )}

            <AppText style={styles.settingLabel}>{t('lobby.timePerRound', 'Time per round')}</AppText>
            {isHost ? (
              <SegmentedControl
                options={[30, 60, 90]}
                value={config.timeLimit}
                onChange={(v) => handleConfigChange({ timeLimit: v })}
                labelMap={{ 30: '30s', 60: '60s', 90: '90s' }}
              />
            ) : (
              <AppText style={styles.readOnlyValue}>{t('lobby.timePerRoundValue', { count: config.timeLimit })}</AppText>
            )}

            <AppText style={styles.settingLabel}>{t('lobby.roundTypes', 'Round types')}</AppText>
            {isHost ? (
              <View style={styles.chipRow}>
                {['Same Same', 'But Different', 'Blitz'].map(type => (
                  <RoundTypeToggle
                    key={type}
                    value={type}
                    type={t(`lobby.${type.replace(' ', '').toLowerCase()}`, type)}
                    active={config.roundTypes.includes(type)}
                    onChange={toggleRoundType}
                  />
                ))}
              </View>
            ) : (
              <AppText style={styles.readOnlyValue}>{config.roundTypes.map(type => t(`lobby.${type.replace(' ', '').toLowerCase()}`, type)).join(', ')}</AppText>
            )}

            <AppText style={styles.settingLabel}>{t('lobby.gameModifiers', 'Game modifiers')}</AppText>
            {isHost ? (
              <View>
                <View style={styles.chipRow}>
                  {['Rush', 'Hardcore', 'Zen'].map(mod => (
                    <RoundTypeToggle
                      key={mod}
                      value={mod}
                      type={t(`lobby.${mod.toLowerCase()}`, mod)}
                      active={(config.modifiers || []).includes(mod)}
                      onChange={toggleModifier}
                    />
                  ))}
                </View>
                <View style={{ marginTop: (config.modifiers || []).length > 0 ? 10 : 0, gap: 4 }}>
                  {(config.modifiers || []).map(mod => (
                    <AppText key={mod} style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: mod === 'Hardcore' ? '#991B1B' : mod === 'Zen' ? '#065F46' : '#9A3412' }}>
                      {t(`lobby.${mod.toLowerCase()}Description`)}
                    </AppText>
                  ))}
                </View>
              </View>
            ) : (
              <View>
                <AppText style={styles.readOnlyValue}>{(config.modifiers || []).length > 0 ? config.modifiers.map(mod => t(`lobby.${mod.toLowerCase()}`, mod)).join(', ') : t('lobby.modifiersNone', 'None')}</AppText>
                <View style={{ marginTop: (config.modifiers || []).length > 0 ? 6 : 0, gap: 4 }}>
                  {(config.modifiers || []).map(mod => (
                    <AppText key={mod} style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: mod === 'Hardcore' ? '#991B1B' : mod === 'Zen' ? '#065F46' : '#9A3412' }}>
                      {t(`lobby.${mod.toLowerCase()}Description`)}
                    </AppText>
                  ))}
                </View>
              </View>
            )}

            <AppText style={styles.settingLabel}>{t('lobby.categoryPack', 'Category pack')}</AppText>
            {isHost ? (
              <SegmentedControl
                options={availablePacks}
                value={config.categoryPack}
                onChange={(v) => handleConfigChange({ categoryPack: v })}
                labelMap={dynamicPackLabels}
              />
            ) : (
              <AppText style={styles.readOnlyValue}>{getPackLabel(config.categoryPack)}</AppText>
            )}

            {/* Teams toggle */}
            <AppText style={styles.settingLabel}>{t('lobby.teamMode', 'Team mode')}</AppText>
            {isHost ? (
              <View style={styles.toggleRow}>
                <NeoButton
                  style={[styles.toggleBtn, !config.teamMode && styles.toggleBtnActive]}
                  onPress={() => handleConfigChange({ teamMode: false })}
                >
                  <AppText style={[styles.toggleText, !config.teamMode && styles.toggleTextActive]}>{t('lobby.off', 'Off')}</AppText>
                </NeoButton>
                <NeoButton
                  style={[styles.toggleBtn, config.teamMode && styles.toggleBtnActiveTeam]}
                  onPress={() => handleConfigChange({ teamMode: true })}
                >
                  <AppText style={[styles.toggleText, config.teamMode && styles.toggleTextActive]}>{t('lobby.on', 'On')}</AppText>
                </NeoButton>
              </View>
            ) : (
              <AppText style={styles.readOnlyValue}>{config.teamMode ? t('lobby.on', 'On') : t('lobby.off', 'Off')}</AppText>
            )}
          </View>
        )}

        {/* ── Public Voting Panel ────────────────────────────────────── */}
        {roomCode && isPublic && isHostless && (
          <View style={[styles.card, { borderColor: theme.colors.primary }, !isDesktop && { padding: 16 }]}>
            <AppText style={[styles.cardLabel, { color: '#000', textAlign: 'center', fontSize: 16 }, !isDesktop && { marginBottom: 12 }]}>
              {t('lobby.voteForPack', { countdown: countdown !== null ? `(${countdown}s)` : '' })}
            </AppText>
            <View style={styles.voteList}>
              {availablePacks.map(packId => (
                <NeoButton
                  key={packId}
                  style={styles.voteBtn}
                  onPress={() => handleVote(packId)}
                  activeOpacity={0.7}
                >
                  <AppText style={styles.voteBtnText}>{getPackLabel(packId)}</AppText>
                  <View style={[styles.voteCountBadge, votes[packId] > 0 && styles.voteCountBadgeActive]}>
                    <AppText style={[styles.voteCountText, votes[packId] > 0 && styles.voteCountTextActive]}>
                      {votes[packId] || 0}
                    </AppText>
                  </View>
                </NeoButton>
              ))}
            </View>
          </View>
        )}

        {/* START button — host only */}
        {isHost && !isHostless && (
          <View style={styles.startSection}>
            {!canStart && (
              <AppText style={styles.startHint}>
                {config.teamMode
                  ? t('lobby.needTeamPlayers', { min: MIN_TEAM_PLAYERS })
                  : t('lobby.needPlayers', { min: MIN_PLAYERS })}
              </AppText>
            )}
            <NeoButton
              style={[styles.button, (!canStart || countdown !== null) && styles.buttonDisabled]}
              activeOpacity={canStart && countdown === null ? 0.8 : 1}
              onPress={canStart && countdown === null ? handleStartGame : undefined}
            >
              <AppText style={styles.buttonText}>{countdown !== null ? t('lobby.starting', 'STARTING...') : t('lobby.startGame', 'START GAME')}</AppText>
            </NeoButton>
          </View>
        )}

        <View style={{ height: 32 }} />
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
    paddingBottom: 100,
  },
  containerDesktop: {
    paddingHorizontal: 40,
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },
  desktopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 40,
  },
  desktopColLeft: {
    flex: 1,
  },
  desktopColRight: {
    flex: 1,
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
  // ── Matchmaking UI ───────────────────────────────────────────────────────
  matchmakingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: 'transparent',
  },
  searchingStatus: {
    fontSize: 24,
    fontFamily: theme.fonts.headingBold,
    color: theme.colors.accent,
    marginBottom: theme.spacing.xxl,
  },
  cancelMatchBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.muted,
  },
  cancelMatchBtnText: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.muted,
    fontSize: 16,
  },
  matchFoundCard: {
    backgroundColor: theme.colors.primary, // Yellow
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
    width: '100%',
    transform: [{ rotate: '-1deg' }],
  },
  matchFoundTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 32,
    color: '#000',
    marginBottom: theme.spacing.sm,
  },

  matchFoundSubtitle: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 18,
    color: '#000',
    marginBottom: theme.spacing.xl,
  },
  matchActionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
  },
  matchBtn: {
    flex: 1,
    paddingVertical: 16,
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
  matchBtnDecline: {
    backgroundColor: '#FFFFFF',
  },
  matchBtnAccept: {
    backgroundColor: theme.colors.accent, // Cyan
  },
  matchBtnText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    color: '#000',
  },
  // ── Couch UI ─────────────────────────────────────────────────────────────
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
    color: '#000',
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
    color: '#000',
    marginBottom: theme.spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: theme.colors.primary, // Vibrant Yellow
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    transform: [{ rotate: '-1deg' }],
  },
  cardLabel: {
    fontFamily: theme.fonts.bodyBold,
    color: '#000',
    fontSize: 14,
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
    overflow: 'hidden',
  },
  avatarSelf: {
    backgroundColor: theme.colors.primary,
  },
  avatarText: {
    color: theme.colors.onPrimary,
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  playerText: {
    flex: 1,
    color: '#000',
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
    backgroundColor: theme.colors.accent, // Cyan
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: '#000',
    padding: theme.spacing.sm,
    marginBottom: 6,
    transform: [{ rotate: '1deg' }],
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
    color: '#000',
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
  textInput: {
    backgroundColor: '#FFF',
    color: '#000',
    fontFamily: theme.fonts.bodyBold,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    fontSize: 16,
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    marginBottom: theme.spacing.sm,
  },
  settingLabel: {
    fontFamily: theme.fonts.bodyBold,
    color: '#000',
    fontSize: 16,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  readOnlyValue: {
    fontFamily: theme.fonts.bodyBold,
    color: '#000',
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
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  segmentText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    color: '#000',
  },
  segmentTextActive: {
    color: '#000',
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
    borderRadius: theme.borderRadius.md,
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#FFF',
  },
  chipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  chipText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    color: '#000',
  },
  chipTextActive: {
    color: '#000',
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
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  toggleBtnActiveTeam: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  toggleText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    color: '#000',
  },
  toggleTextActive: {
    color: '#000',
  },
  // START button
  startSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  startHint: {
    fontFamily: theme.fonts.body,
    color: theme.colors.muted,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  // ── Voting UI ────────────────────────────────────────────────────────────
  voteList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  voteBtn: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 3,
    borderColor: '#000',
  },
  voteBtnText: {
    fontFamily: theme.fonts.bodyBold,
    color: '#000',
    fontSize: 14,
  },
  voteCountBadge: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  voteCountBadgeActive: {
    backgroundColor: theme.colors.primary,
    borderColor: '#000',
  },
  voteCountText: {
    fontFamily: theme.fonts.bodyBold,
    color: '#000',
    fontSize: 12,
  },
  voteCountTextActive: {
    color: '#000',
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    width: '100%',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
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
