import React, { useEffect, useRef } from 'react';
import AppText from '../components/AppText';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Animated, Image, SafeAreaView, useWindowDimensions
} from 'react-native';
import { useTranslation } from 'react-i18next';
import NeoButton from '../components/NeoButton';
import { socket } from '../socket';
import { theme } from '../styles/theme';
import FramedAvatar from '../components/FramedAvatar';

const MEDAL = { 0: '🥇', 1: '🥈', 2: '🥉' };
const PODIUM_COLORS = {
  0: { bg: '#FBBF24', border: '#000', height: 110, label: '1st' },
  1: { bg: '#9CA3AF', border: '#000', height: 80,  label: '2nd' },
  2: { bg: '#B45309', border: '#000', height: 60,  label: '3rd' },
};

function PodiumPlayer({ player, rank, avatars, names, frames, delay }) {
  const rise = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const { bg, border, height, label } = PODIUM_COLORS[rank];

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(rise, { toValue: 0, friction: 6, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ])
    ]).start();
  }, []);

  const avatar = avatars[player.id];
  const name   = names[player.id];

  return (
    <Animated.View style={[s.podiumSlot, { transform: [{ translateY: rise }], opacity }]}>
      <View style={s.podiumAvatarWrap}>
        <FramedAvatar 
          url={avatars[player.id]} 
          fallbackName={names[player.id]} 
          frame={frames[player.id] || 'none'} 
          size={56} 
        />
        <AppText style={s.podiumMedal}>{MEDAL[rank]}</AppText>
      </View>
      <AppText style={s.podiumName} numberOfLines={1}>{name}</AppText>
      <AppText style={s.podiumScore}>{player.score} pts</AppText>
      <View style={[s.podiumColumn, { backgroundColor: bg, borderColor: border, height }]}>
        <AppText style={s.podiumLabel}>{label}</AppText>
      </View>
    </Animated.View>
  );
}

export default function GameOverScreen({ gameResults, roomCode, isHost, players = [] }) {
  const { t } = useTranslation();
  const { scores = {}, playerNames = {}, playerAvatars = {}, playerFrames = {}, teams, teamScores, isPublic } = gameResults;

  // Merge local player avatars as fallback
  const avatars = { ...playerAvatars };
  const frames = { ...playerFrames };
  players.forEach(p => { 
    if (p.avatar && !avatars[p.id]) avatars[p.id] = p.avatar; 
    if (p.frame && !frames[p.id]) frames[p.id] = p.frame; 
  });

  // Sort players by score descending
  const sorted = Object.entries(scores)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);

  const podium = sorted.slice(0, 3);
  const rest   = sorted.slice(3);

  const { width } = useWindowDimensions();
  const isDesktop = width > 800;

  // Winning team banner
  let winnerBanner = null;
  if (teams && teamScores) {
    const winner = teamScores.A > teamScores.B ? 'A' : teamScores.B > teamScores.A ? 'B' : null;
    const bg = winner === 'A' ? '#E11D48' : winner === 'B' ? '#2563EB' : '#6B7280';
    const bannerText = winner
      ? t('gameOver.teamWins', { team: t(`lobby.team${winner}`, winner), score1: teamScores[winner], score2: teamScores[winner === 'A' ? 'B' : 'A'] })
      : t('gameOver.itsATie', { score1: teamScores.A, score2: teamScores.B });
    winnerBanner = (
      <View style={[s.teamBanner, { backgroundColor: bg }]}>
        <AppText style={s.teamBannerText}>{bannerText}</AppText>
      </View>
    );
  }

  const myPlayer = players.find(p => p.id === socket.id);
  const handlePlayAgain = () => socket.emit('play_again', { roomCode });
  const handleQuickPlay = () => socket.emit('quick_play', { name: myPlayer?.name || 'Player', avatar: myPlayer?.avatar, level: myPlayer?.level || 1 });
  const handleLeave     = () => socket.emit('leave_room', { roomCode });

  return (
    <SafeAreaView style={s.safeArea}>
      <ScrollView contentContainerStyle={[s.container, isDesktop && s.containerDesktop]}>

        <AppText style={s.title}>{t('gameOver.title', 'Game Over!')}</AppText>

        {winnerBanner}

        {/* Podium — ordered as 2nd, 1st, 3rd for visual height effect */}
        {sorted.length >= 1 && (
          <View style={s.podiumRow}>
            {podium[1] && <PodiumPlayer player={podium[1]} rank={1} avatars={avatars} names={playerNames} frames={frames} delay={300} />}
            {podium[0] && <PodiumPlayer player={podium[0]} rank={0} avatars={avatars} names={playerNames} frames={frames} delay={100} />}
            {podium[2] && <PodiumPlayer player={podium[2]} rank={2} avatars={avatars} names={playerNames} frames={frames} delay={500} />}
          </View>
        )}

        {/* Rest of the players */}
        {rest.length > 0 && (
          <View style={s.restList}>
            {rest.map((player, i) => (
              <View key={player.id} style={s.restRow}>
                <AppText style={s.restRank}>#{i + 4}</AppText>
                <FramedAvatar 
                  url={avatars[player.id]} 
                  fallbackName={playerNames[player.id]} 
                  frame={frames[player.id] || 'none'} 
                  size={32} 
                />
                <AppText style={s.restName}>{playerNames[player.id]}</AppText>
                <AppText style={s.restScore}>{t('common.pts', { count: player.score })}</AppText>
              </View>
            ))}
          </View>
        )}

        {/* Controls */}
        <View style={s.controls}>
          {isPublic ? (
            <NeoButton style={s.btnPrimary} onPress={handlePlayAgain}>
              <AppText style={s.btnPrimaryText}>{t('gameOver.playAgainGroup', '🔄 Play Again with Group')}</AppText>
            </NeoButton>
          ) : isHost ? (
            <NeoButton style={s.btnPrimary} onPress={handlePlayAgain}>
              <AppText style={s.btnPrimaryText}>{t('gameOver.playAgain', '🔄 Play Again')}</AppText>
            </NeoButton>
          ) : (
            <View style={s.waitingRow}>
              <AppText style={s.waitingText}>{t('gameOver.waitingForHost', 'Waiting for host to restart…')}</AppText>
            </View>
          )}

          <NeoButton style={s.btnSecondary} onPress={handleQuickPlay}>
            <AppText style={s.btnSecondaryText}>{t('gameOver.quickPlay', '⚡ Quick Play (New Group)')}</AppText>
          </NeoButton>

          <NeoButton style={s.btnGhost} onPress={handleLeave}>
            <AppText style={s.btnGhostText}>{t('gameOver.leaveRoom', 'Leave Room')}</AppText>
          </NeoButton>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea:         { flex: 1, backgroundColor: 'transparent' },
  container:        { padding: theme.spacing.md, paddingTop: theme.spacing.xl, alignItems: 'center' },
  containerDesktop: { maxWidth: 700, alignSelf: 'center', width: '100%' },
  title: {
    fontSize: 42, fontFamily: theme.fonts.headingBold, color: theme.colors.primary,
    textAlign: 'center', marginBottom: 12,
    textShadowColor: '#000', textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0,
  },
  teamBanner: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: theme.borderRadius.md,
    borderWidth: 3, borderColor: '#000', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
  },
  teamBannerText:      { fontFamily: theme.fonts.headingBold, fontSize: 22, color: '#fff', textAlign: 'center' },
  podiumRow:           { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 24, width: '100%' },
  podiumSlot:          { alignItems: 'center', flex: 1, maxWidth: 160 },
  podiumAvatarWrap:    { position: 'relative', marginBottom: 4 },
  podiumAvatar:        { width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderColor: '#000' },
  podiumAvatarFallback:{ width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderColor: '#000', justifyContent: 'center', alignItems: 'center' },
  podiumAvatarInitial: { fontFamily: theme.fonts.headingBold, fontSize: 24, color: '#000' },
  podiumMedal:         { position: 'absolute', top: -10, right: -10, fontSize: 20 },
  podiumName:          { fontFamily: theme.fonts.bodyBold, fontSize: 13, color: '#fff', textAlign: 'center', maxWidth: 100 },
  podiumScore:         { fontFamily: theme.fonts.headingBold, fontSize: 15, color: theme.colors.primary, marginBottom: 4 },
  podiumColumn:        { width: '100%', borderWidth: 3, borderRadius: theme.borderRadius.md, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 6,
    shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
  podiumLabel:         { fontFamily: theme.fonts.headingBold, fontSize: 18, color: '#000' },
  restList:            { width: '100%', gap: 8, marginBottom: 24 },
  restRow:             { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: '#000', gap: 10 },
  restRank:            { fontFamily: theme.fonts.headingBold, fontSize: 16, color: '#9CA3AF', width: 30 },
  restAvatar:          { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#000' },
  restAvatarFallback:  { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#000', backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' },
  restAvatarInitial:   { fontFamily: theme.fonts.headingBold, color: '#000', fontSize: 14 },
  restName:            { flex: 1, fontFamily: theme.fonts.bodyBold, fontSize: 16, color: '#fff' },
  restScore:           { fontFamily: theme.fonts.headingBold, fontSize: 16, color: theme.colors.primary },
  controls:            { width: '100%', gap: 10, marginTop: 8 },
  btnPrimary:          { backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: theme.borderRadius.md, borderWidth: 3, borderColor: '#000', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
  btnPrimaryText:      { fontFamily: theme.fonts.headingBold, fontSize: 18, color: '#000' },
  btnSecondary:        { backgroundColor: '#fff', paddingVertical: 12, borderRadius: theme.borderRadius.md, borderWidth: 3, borderColor: '#000', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
  btnSecondaryText:    { fontFamily: theme.fonts.headingBold, fontSize: 16, color: '#000' },
  btnGhost:            { paddingVertical: 10, alignItems: 'center' },
  btnGhostText:        { fontFamily: theme.fonts.body, fontSize: 15, color: '#9CA3AF', textDecorationLine: 'underline' },
  waitingRow:          { paddingVertical: 14, alignItems: 'center' },
  waitingText:         { fontFamily: theme.fonts.body, fontSize: 15, color: '#9CA3AF' },
});

