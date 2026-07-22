import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  SafeAreaView, useWindowDimensions
} from 'react-native';
import NeoButton from '../components/NeoButton';
import { ArrowLeft, RefreshCw, Flame, Crown } from 'lucide-react-native';
import { socket } from '../socket';
import { theme } from '../styles/theme';

export default function LobbyBrowserScreen({ setScreen, getDisplayName, profileData, setPlayerData, setRoomCode, setIsHost, setLobbyIntent }) {
  const [lobbies, setLobbies] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { width } = useWindowDimensions();
  const isDesktop = width > 800;

  const fetchLobbies = () => {
    setIsRefreshing(true);
    socket.emit('get_public_lobbies');
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    const handleLobbies = ({ lobbies: data }) => setLobbies(data || []);
    socket.on('public_lobbies', handleLobbies);

    if (socket.connected) {
      fetchLobbies();
    } else {
      socket.once('connect', fetchLobbies);
      socket.connect();
    }

    const interval = setInterval(fetchLobbies, 5000);

    return () => {
      clearInterval(interval);
      socket.off('connect', fetchLobbies);
      socket.off('public_lobbies', handleLobbies);
    };
  }, []);

  const handleJoinLobby = (code) => {
    const displayName = getDisplayName();
    if (!displayName) return; // Add error handling or redirect to home to set name
    const playerData = { name: displayName, avatar: profileData?.avatar, level: profileData?.level || 1 };
    setPlayerData(playerData);
    setRoomCode(code);
    setIsHost(false);
    setLobbyIntent('join_public');
    setScreen('Lobby');
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={[s.container, isDesktop && s.containerDesktop]}>
        
        {/* Header */}
        <View style={s.header}>
          <NeoButton style={s.backBtn} onPress={() => setScreen('Home')}>
            <ArrowLeft size={24} color="#000" strokeWidth={3} />
          </NeoButton>
          <Text style={s.title}>Public Lobbies</Text>
          <NeoButton style={s.refreshBtn} onPress={fetchLobbies} disabled={isRefreshing}>
            <RefreshCw size={24} color="#000" strokeWidth={3} style={isRefreshing ? s.spin : {}} />
          </NeoButton>
        </View>

        <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {lobbies.length === 0 ? (
            <View style={s.noLobbiesBox}>
              <Text style={s.noLobbiesText}>No open lobbies right now.</Text>
              <Text style={s.noLobbiesSubText}>Go back and create one!</Text>
            </View>
          ) : (
            lobbies.map(lobby => {
              const isCustom = !lobby.isPermanent;
              return (
                <NeoButton key={lobby.code} style={[s.lobbyRow, isCustom && s.lobbyRowCustom]} onPress={() => handleJoinLobby(lobby.code)} activeOpacity={0.8}>
                  <View style={{ flex: 1 }}>
                    <View style={s.lobbyRowTop}>
                      <Text style={s.lobbyLabel}>{lobby.label || lobby.code}</Text>
                      {isCustom && <Crown size={16} color="#FBBF24" strokeWidth={3} style={{ marginLeft: 6, marginRight: 6 }} />}
                      <View style={[s.lobbyStatusDot, { backgroundColor: lobby.hasCountdown ? '#FBBF24' : '#10B981' }]} />
                      <Text style={s.lobbyStatus}>{lobby.hasCountdown ? 'Starting…' : 'Waiting'}</Text>
                    </View>
                    <View style={s.lobbyRowBottom}>
                      {isCustom ? (
                        <View style={[s.lobbyTag, { backgroundColor: '#FBBF24', borderColor: '#000' }]}>
                          <Text style={[s.lobbyTagText, { color: '#000' }]}>Custom</Text>
                        </View>
                      ) : (
                        <View style={[s.lobbyTag, { backgroundColor: theme.colors.primary, borderColor: '#000' }]}>
                          <Text style={[s.lobbyTagText, { color: '#000' }]}>Auto</Text>
                        </View>
                      )}
                      <Text style={s.lobbyMeta}>⏱ {lobby.timeLimit}s</Text>
                      {(lobby.roundTypes || []).map(rt => (
                        <View key={rt} style={s.lobbyTag}>
                          <Text style={s.lobbyTagText}>{rt}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={s.lobbyRight}>
                    <Text style={s.lobbyPlayers}>{lobby.playerCount}/{lobby.maxPlayers}</Text>
                    <Text style={s.lobbyJoin}>JOIN →</Text>
                  </View>
                </NeoButton>
              );
            })
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  container: { flex: 1, width: '100%', padding: 20 },
  containerDesktop: { maxWidth: 800, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: theme.borderRadius.md,
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
  },
  backBtn: { padding: 8 },
  title: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 24,
    color: '#000',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  refreshBtn: { padding: 8 },
  spin: { opacity: 0.5 },
  list: { flex: 1 },

  noLobbiesBox: {
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: theme.borderRadius.md,
    borderWidth: 3,
    borderColor: '#000',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  noLobbiesText: { fontFamily: theme.fonts.headingBold, fontSize: 18, color: '#000' },
  noLobbiesSubText: { fontFamily: theme.fonts.body, fontSize: 14, color: '#6B7280', marginTop: 4 },

  lobbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: theme.borderRadius.md,
    borderWidth: 3,
    borderColor: '#000',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  lobbyRowCustom: {
    backgroundColor: '#FFFBEB', // Light yellow for custom lobbies
  },
  lobbyRowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  lobbyLabel: { fontFamily: theme.fonts.headingBold, fontSize: 18, color: '#000' },
  lobbyStatusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 12, marginRight: 6, borderWidth: 1, borderColor: '#000' },
  lobbyStatus: { fontFamily: theme.fonts.bodyBold, fontSize: 13, color: '#4B5563', textTransform: 'uppercase' },
  lobbyRowBottom: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  lobbyMeta: { fontFamily: theme.fonts.bodyBold, fontSize: 14, color: '#000' },
  lobbyTag: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB'
  },
  lobbyTagText: { fontFamily: theme.fonts.bodyBold, fontSize: 11, color: '#374151', textTransform: 'uppercase' },
  lobbyRight: { alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 16, borderLeftWidth: 2, borderLeftColor: '#E5E7EB' },
  lobbyPlayers: { fontFamily: theme.fonts.headingBold, fontSize: 20, color: '#000', marginBottom: 4 },
  lobbyJoin: { fontFamily: theme.fonts.headingBold, fontSize: 16, color: theme.colors.primary },
});
