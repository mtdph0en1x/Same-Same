import React, { useState, useEffect, useCallback, useContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, useWindowDimensions, ScrollView } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Nunito_300Light, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import HomeScreen from './src/screens/HomeScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import GameScreen from './src/screens/GameScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import LandingScreen from './src/screens/LandingScreen';
import ChatSidebar from './src/components/ChatSidebar';
import LeaderboardSidebar from './src/components/LeaderboardSidebar';
import BackgroundPattern from './src/components/BackgroundPattern';
import MessyDeskBackground from './src/components/MessyDeskBackground';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { socket } from './src/socket';
import { theme } from './src/styles/theme';

SplashScreen.preventAutoHideAsync();

// ── Mock data for chrome ────────────────────────────────────────────────────
const NEWS_ITEMS = [
  '🎉 Couch Royale — new mode coming soon!',
  '🏆 Weekend Tournament: Saturday 8 PM UTC',
  '🐛 Fixed: lobby disconnect issues in 4v4',
  '🎨 5 new avatars now unlocked for all players',
  '🔥 New record: 5,218 concurrent players!',
];
const TOP_PLAYERS = [
  { rank: 1, name: 'AlienKing',   pts: '2,450', avatar: '👽' },
  { rank: 2, name: 'RocketRacer', pts: '2,100', avatar: '🚀' },
  { rank: 3, name: 'PixelPanda',  pts: '1,890', avatar: '🐼' },
  { rank: 4, name: 'MaestroFox',  pts: '1,750', avatar: '🦊' },
];

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useContext(AuthContext);
  const [isGuest, setIsGuest] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [currentScreen, setCurrentScreen] = useState('Landing');
  const [roomCode, setRoomCode] = useState(null);
  const [playerData, setPlayerData] = useState({});
  const [isHost, setIsHost] = useState(false);
  const [lobbyIntent, setLobbyIntent] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [gameData, setGameData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState(null);
  const [roundResults, setRoundResults] = useState(null);

  const { width } = useWindowDimensions();
  const isDesktop = width > 800;

  let [fontsLoaded] = useFonts({
    Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold,
    Nunito_300Light, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold,
  });

  useEffect(() => {
    socket.on('game_started', (data) => {
      setPlayers(data.players || []);
      setTeams(data.teams || null);
    });
    socket.on('room_update', (data) => {
      setPlayers(data.players || []);
    });
    socket.on('round_started', (data) => {
      setGameData(data);
      setCurrentScreen('Game');
    });
    socket.on('round_ended', (data) => {
      setRoundResults(data);
      setCurrentScreen('Results');
    });
    socket.on('game_over', () => {
      setCurrentScreen('Home');
    });
    return () => {
      socket.off('game_started');
      socket.off('room_update');
      socket.off('round_started');
      socket.off('round_ended');
      socket.off('game_over');
    };
  }, []);

  // Handle routing based on auth state
  useEffect(() => {
    if (loading) return;
    if (!user && !isGuest && currentScreen !== 'Landing') {
      setCurrentScreen('Landing');
    } else if ((user || isGuest) && currentScreen === 'Landing') {
      setCurrentScreen('Home');
    }
  }, [user, isGuest, currentScreen, loading]);

  // Clear previous game state when entering a new lobby
  useEffect(() => {
    if (currentScreen === 'Lobby') {
      setRoundResults(null);
      setGameData(null);
    }
  }, [currentScreen]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  // ── Persistent chrome: Page Header ────────────────────────────────────────
  const PageHeader = (
    <View style={chrome.pageHeader}>
      <View style={chrome.phLeft}>
        <Text style={chrome.phLogo}>Same Same?</Text>
        <Text style={chrome.phTagline}>The Bluffing Party Game</Text>
      </View>

      {isDesktop && (
        <View style={chrome.phCenter}>
          <View style={chrome.onlinePill}>
            <View style={chrome.onlineDot} />
            <Text style={chrome.onlineText}>3,241 online</Text>
          </View>
          <Text style={chrome.phSep}>·</Text>
          <Text style={chrome.phStat}>287 active games</Text>
        </View>
      )}

      <Text style={chrome.phVersion}>v0.9 β</Text>
    </View>
  );

  // ── Persistent chrome: News Bar ───────────────────────────────────────────
  const NewsBar = (
    <View style={chrome.newsBar}>
      <View style={chrome.newsBadge}>
        <Text style={chrome.newsBadgeText}>📢</Text>
      </View>
      <Text style={chrome.newsText} numberOfLines={1}>
        {NEWS_ITEMS.join('   ·   ')}
      </Text>
    </View>
  );

  // ── Persistent chrome: Activity Bar ──────────────────────────────────────
  const ActivityBar = isDesktop ? (
    <View style={chrome.activityBar}>
      <Text style={chrome.activityLabel}>🏆 TODAY'S TOP</Text>
      <View style={chrome.activityItems}>
        {TOP_PLAYERS.map(p => (
          <View key={p.rank} style={chrome.activityItem}>
            <Text style={chrome.activityRank}>#{p.rank}</Text>
            <Text style={chrome.activityAvatar}>{p.avatar}</Text>
            <Text style={chrome.activityName}>{p.name}</Text>
            <Text style={chrome.activityPts}>{p.pts} pts</Text>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <Text style={chrome.activitySeeAll}>See all →</Text>
    </View>
  ) : null;

  // ── Persistent chrome: Page Footer ────────────────────────────────────────
  const PageFooter = (
    <View style={chrome.pageFooter}>
      <Text style={chrome.footerCopy}>© 2026 Same Same</Text>
      {isDesktop && (
        <View style={chrome.footerLinks}>
          {['Terms', 'Privacy', 'Contact', 'GitHub'].map(link => (
            <TouchableOpacity key={link}>
              <Text style={chrome.footerLink}>{link}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={chrome.footerStatus}>🟢 EU-West · 12 ms</Text>
    </View>
  );

  return (
      <View style={styles.root} onLayout={onLayoutRootView}>
        <StatusBar style="light" />
        <BackgroundPattern />

        {/* ── Persistent top chrome ── */}
        {PageHeader}
        {NewsBar}

        {/* ── Window area — all screens render here ── */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.windowArea}>
          <View style={[
            styles.appWindow, 
            !isDesktop && { width: '90%', alignSelf: 'center', marginBottom: 20 },
            { flexDirection: isDesktop ? 'row' : 'column' }
          ]}>
            {/* Subtle inner pattern */}
            <View style={styles.appWindowPattern} pointerEvents="none" />
            <MessyDeskBackground />

            {['Lobby', 'Game', 'Results'].includes(currentScreen) && (
              <LeaderboardSidebar 
                players={players} 
                roundResults={roundResults} 
                currentScreen={currentScreen} 
                isDesktop={isDesktop}
              />
            )}
            
            <View style={[{ position: 'relative', overflow: 'hidden', flex: 1 }]}>
              {currentScreen === 'Home' && (
                <HomeScreen
                  setScreen={setCurrentScreen}
                  setRoomCode={setRoomCode}
                  setPlayerData={setPlayerData}
                  setIsHost={setIsHost}
                  setLobbyIntent={setLobbyIntent}
                  setIsGuest={setIsGuest}
                  guestName={guestName}
                />
              )}
              {currentScreen === 'Landing' && (
                <LandingScreen setIsGuest={setIsGuest} guestName={guestName} setGuestName={setGuestName} />
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
                  players={players}
                  teams={teams}
                />
              )}
              {currentScreen === 'Results' && (
                <ResultsScreen
                  roundResults={roundResults}
                  roomCode={roomCode}
                  isHost={isHost}
                  playerData={playerData}
                  players={players}
                />
              )}
            </View>
            
            {['Lobby', 'Game', 'Results'].includes(currentScreen) && (
              <ChatSidebar 
                roomCode={roomCode} 
                playerData={playerData} 
                isSidebarOpen={isSidebarOpen} 
                setIsSidebarOpen={setIsSidebarOpen} 
                isDesktop={isDesktop}
              />
            )}
          </View>
        </ScrollView>

        {/* ── Persistent bottom chrome ── */}
        {ActivityBar}
        {PageFooter}
      </View>
  );
}

// ── App shell styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  windowArea: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  appWindow: {
    flex: 1,
    width: '80%',
    maxWidth: 2400,
    backgroundColor: '#FDFBF7',
    position: 'relative',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: theme.borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 10, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 0,
    overflow: 'hidden',
  },
  appWindowPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
    zIndex: 0,
    ...(require('react-native').Platform.OS === 'web' && {
      backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
      backgroundSize: '24px 24px',
    }),
  },
});

// ── Chrome styles ─────────────────────────────────────────────────────────────
const chrome = StyleSheet.create({
  // Page Header
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  phLeft: {},
  phLogo: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 26,
    color: theme.colors.primary,
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
    transform: [{ rotate: '-2deg' }],
  },
  phTagline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 1,
  },
  phCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  onlineText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#fff',
  },
  phSep: { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
  phStat: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
  phVersion: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  // News Bar
  newsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    gap: 10,
  },
  newsBadge: {
    backgroundColor: theme.colors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  newsBadgeText: { fontSize: 13 },
  newsText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    flex: 1,
  },

  // Activity Bar
  activityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 9,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 16,
  },
  activityLabel: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 12,
    color: theme.colors.primary,
    letterSpacing: 1,
    flexShrink: 0,
  },
  activityItems: { flexDirection: 'row', gap: 24, flex: 1 },
  activityItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  activityRank: { fontFamily: 'Nunito_600SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  activityAvatar: { fontSize: 15 },
  activityName: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#fff' },
  activityPts: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.colors.primary },
  activitySeeAll: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)' },

  // Page Footer
  pageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  footerCopy: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  footerLinks: { flexDirection: 'row', gap: 20 },
  footerLink: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  footerStatus: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.35)' },
});
