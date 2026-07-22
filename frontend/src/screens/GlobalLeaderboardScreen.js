import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import NeoButton from '../components/NeoButton';
import { supabase } from '../supabase';
import { theme } from '../styles/theme';
import FramedAvatar from '../components/FramedAvatar';

export default function GlobalLeaderboardScreen({ setScreen }) {
  const [loading, setLoading] = useState(true);
  const [topWins, setTopWins] = useState([]);
  const [topXp, setTopXp] = useState([]);

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('username, avatar, active_frame, wins, level').order('wins', { ascending: false }).limit(25),
      supabase.from('profiles').select('username, avatar, active_frame, xp, level').order('xp', { ascending: false }).limit(25)
    ]).then(([winsRes, xpRes]) => {
      if (winsRes.data) setTopWins(winsRes.data);
      if (xpRes.data) setTopXp(xpRes.data);
      setLoading(false);
    });
  }, []);

  const renderList = (data, metric) => (
    <View style={s.listContainer}>
      {data.map((p, i) => (
        <View key={p.username + i} style={s.row}>
          <Text style={s.rank}>#{i + 1}</Text>
          <FramedAvatar url={p.avatar} frame={p.active_frame || 'none'} fallbackName={p.username} size={40} />
          <View style={s.info}>
            <Text style={s.name}>{p.username || 'Unknown'}</Text>
            <Text style={s.level}>Level {p.level || 1}</Text>
          </View>
          <Text style={s.metric}>{metric === 'wins' ? `${p.wins} Wins` : `${Math.floor(p.xp)} XP`}</Text>
        </View>
      ))}
      {data.length === 0 && !loading && (
        <Text style={s.empty}>No players found yet.</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={s.headerRow}>
        <NeoButton style={s.backBtn} onPress={() => setScreen('Home')}>
          <Text style={s.backBtnText}>← Back</Text>
        </NeoButton>
        <Text style={s.title}>Global Leaderboards</Text>
        <View style={{ width: 80 }} />
      </View>
      
      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.container}>
          <View style={s.column}>
            <View style={s.card}>
              <Text style={s.sectionTitle}>🏆 ALL-TIME WINS</Text>
              {renderList(topWins, 'wins')}
            </View>
          </View>
          
          <View style={s.column}>
            <View style={s.card}>
              <Text style={s.sectionTitle}>⭐ TOP XP</Text>
              {renderList(topXp, 'xp')}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { 
    flexDirection: require('react-native').Platform.OS === 'web' && require('react-native').Dimensions.get('window').width > 800 ? 'row' : 'column',
    padding: theme.spacing.xl, 
    gap: 24, 
    paddingBottom: 60 
  },
  column: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.xl, paddingBottom: 0 },
  backBtn: { padding: 10, width: 80, alignItems: 'center' },
  backBtnText: { fontFamily: theme.fonts.headingBold, fontSize: 18, color: '#111' },
  title: { fontSize: 32, fontFamily: theme.fonts.headingBold, color: theme.colors.primary, textShadowColor: '#000', textShadowOffset: {width: 2, height: 2}, textShadowRadius: 0, textAlign: 'center' },
  
  card: { backgroundColor: '#fff', borderRadius: theme.borderRadius.lg, borderWidth: 3, borderColor: '#000', padding: 24, shadowColor: '#000', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0 },
  sectionTitle: { fontSize: 24, fontFamily: theme.fonts.headingBold, color: '#111', marginBottom: 16, textAlign: 'center' },
  
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContainer: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 12, borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: '#E5E7EB', gap: 12 },
  rank: { fontFamily: theme.fonts.headingBold, fontSize: 18, color: '#6B7280', width: 40, textAlign: 'center' },
  info: { flex: 1 },
  name: { fontFamily: theme.fonts.headingBold, fontSize: 16, color: '#111' },
  level: { fontFamily: theme.fonts.bodyBold, fontSize: 12, color: theme.colors.primary },
  metric: { fontFamily: theme.fonts.headingBold, fontSize: 18, color: '#10B981' },
  empty: { textAlign: 'center', fontFamily: theme.fonts.body, color: '#9CA3AF', padding: 20 },
});
