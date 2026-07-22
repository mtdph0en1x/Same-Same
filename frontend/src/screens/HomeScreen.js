import AppText from '../components/AppText';
import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  Platform, Modal, useWindowDimensions, ScrollView,
  ActivityIndicator, Alert, Animated, Easing, Pressable, Image, ImageBackground
} from 'react-native';
import NeoButton from '../components/NeoButton';
import { 
  Swords, Users, Shield, User, PartyPopper, Zap, 
  Gamepad2, Trophy, BarChart2, Flame, Home, Globe, Crown 
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as Haptics from 'expo-haptics';
import { theme } from '../styles/theme';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../supabase';
import { socket } from '../socket';
import { useTranslation } from 'react-i18next';
import Button from '../components/Button';
import FramedAvatar from '../components/FramedAvatar';

WebBrowser.maybeCompleteAuthSession();



// ─────────────────────────────────────────────────────────────────────────────
// AnimatedModeCard — physical playing card that scales on press
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedModeCard({ m, onPress, rotation }) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handleHoverIn = () => {
    Animated.spring(scale, { toValue: 1.05, useNativeDriver: true, speed: 20 }).start();
  };
  const handleHoverOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
  };
  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40 }).start();
  };
  const handlePressOut = () => {
    // If still hovered, go back to 1.05, otherwise 1. But for simplicity, just go to 1.05.
    Animated.spring(scale, { toValue: 1.05, useNativeDriver: true, speed: 40 }).start();
  };

  return (
    <Animated.View style={[s.modeCard, { transform: [{ rotate: rotation }, { scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        style={({ hovered }) => [
          { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', padding: 10 },
          hovered && { backgroundColor: 'rgba(0,0,0,0.02)' }
        ]}
      >
        <View style={s.modeCardIcon}>{m.icon}</View>
        <AppText style={s.modeCardLabel}>{m.label}</AppText>
        <AppText style={s.modeCardDesc}>{m.desc}</AppText>
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared modal renderers
// ─────────────────────────────────────────────────────────────────────────────
function joinModal(visible, setVisible, code, setCode, onJoin, t) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <NeoButton style={s.closeBtn} onPress={() => setVisible(false)}>
            <AppText style={s.closeBtnText}>✕</AppText>
          </NeoButton>
          <AppText style={s.modalTitle}>{t('home.joinGameModal')}</AppText>
          <TextInput
            style={[s.panelInput, s.codeInput]}
            placeholder={t('home.enter4LetterCode')}
            placeholderTextColor="#9ca3af"
            value={code}
            onChangeText={setCode}
            maxLength={4}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Button title={t('home.joinRoom')} onPress={onJoin} type="primary" />
        </View>
      </View>
    </Modal>
  );
}

function mmModal(visible, setVisible, onFindMatch, t) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => setVisible(false)}>
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <NeoButton style={s.closeBtn} onPress={() => setVisible(false)}>
            <AppText style={s.closeBtnText}>✕</AppText>
          </NeoButton>
          <AppText style={s.modalTitle}>{t('home.selectMode')}</AppText>
          <AppText style={s.mmSectionTitle}>{t('home.teams')}</AppText>
          <View style={s.mmRow}>
            <NeoButton style={s.mmBtn} onPress={() => onFindMatch('team2v2')}>
              <AppText style={s.mmBtnText}>🤝 2v2</AppText>
            </NeoButton>
            <NeoButton style={s.mmBtn} onPress={() => onFindMatch('team4v4')}>
              <AppText style={s.mmBtnText}>🛡️ 4v4</AppText>
            </NeoButton>
          </View>
          <AppText style={s.mmSectionTitle}>{t('home.solo')}</AppText>
          <View style={s.mmRow}>
            <NeoButton style={s.mmBtn} onPress={() => onFindMatch('duel')}>
              <AppText style={s.mmBtnText}>⚔️ 1v1</AppText>
            </NeoButton>
            <NeoButton style={s.mmBtn} onPress={() => onFindMatch('solo4')}>
              <AppText style={s.mmBtnText}>🏃 4p</AppText>
            </NeoButton>
          </View>
          <View style={s.mmRow}>
            <NeoButton style={s.mmBtn} onPress={() => onFindMatch('solo6')}>
              <AppText style={s.mmBtnText}>🏃 6p</AppText>
            </NeoButton>
            <NeoButton style={s.mmBtn} onPress={() => onFindMatch('solo8')}>
              <AppText style={s.mmBtnText}>🏃 8p</AppText>
            </NeoButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function langModal(visible, setVisible, i18n, t) {
  const languages = [
    { code: 'en', label: 'English', emoji: '🇬🇧' },
    { code: 'es', label: 'Español', emoji: '🇪🇸' },
    { code: 'ru', label: 'Русский', emoji: '🇷🇺' },
    { code: 'uk', label: 'Українська', emoji: '🇺🇦' }
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => setVisible(false)}>
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <NeoButton style={s.closeBtn} onPress={() => setVisible(false)}>
            <AppText style={s.closeBtnText}>✕</AppText>
          </NeoButton>
          <AppText style={s.modalTitle}>{t('settings.language', 'Select Language')}</AppText>
          <View style={{ gap: 12, marginTop: 10 }}>
            {languages.map((l) => (
              <NeoButton 
                key={l.code}
                style={[
                  { padding: 16, borderRadius: theme.borderRadius.md, borderWidth: 3, borderColor: '#000', alignItems: 'center' },
                  i18n.language.startsWith(l.code) ? { backgroundColor: theme.colors.primary } : { backgroundColor: '#f3f4f6' }
                ]} 
                onPress={() => {
                  i18n.changeLanguage(l.code);
                  setVisible(false);
                }}
              >
                <AppText style={{ fontFamily: theme.fonts.headingBold, fontSize: 18, color: '#000' }}>
                  {l.emoji} {l.label}
                </AppText>
              </NeoButton>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main HomeScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function HomeScreen({ setScreen, setRoomCode, setPlayerData, setIsHost, setLobbyIntent, setIsGuest, guestName }) {
  const { t, i18n } = useTranslation();
  const { user } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [profileData, setProfileData] = useState(null);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [mmModalVisible, setMmModalVisible] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [activeTab, setActiveTab] = useState('play');

  const { width } = useWindowDimensions();
  const isDesktop = width > 800;
  
  // Calculate a dynamic scale factor for the ID card based on panel width
  const panelWidth = isDesktop ? width * 0.3 : width;
  const tScale = Math.min(Math.max(panelWidth / 700, 0.65), 1.4);

  // Animations
  const [animVal] = useState(new Animated.Value(0));

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('username, avatar, games_played, wins, level, xp, active_frame, unlocked_frames').eq('id', user.id).single()
        .then(({ data }) => { 
          if (data) {
            setProfileData(data);
          }
        });
    }
    
    // Always run the entrance animation for both auth and guest
    Animated.spring(animVal, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [user]);



  const getDisplayName = () => {
    if (name.trim()) return name.trim();
    if (profileData?.username) return profileData.username;
    if (user?.email) return user.email.split('@')[0];
    if (guestName?.trim()) return guestName.trim();
    return 'GUEST';
  };

  const handleOpenMmModal = () => {
    if (!getDisplayName()) return Alert.alert(t('home.nameRequired'), t('home.enterNameToContinue'));
    setMmModalVisible(true);
  };

  const handleFindMatch = (mode) => {
    setMmModalVisible(false);
    const displayName = getDisplayName();
    setPlayerData({ name: displayName, avatar: profileData?.avatar || 'alien', frame: profileData?.active_frame || 'none', mode });
    setLobbyIntent('matchmaking');
    setScreen('Lobby');
  };

  const handleQuickPlay = () => {
    const displayName = getDisplayName();
    if (!displayName) return Alert.alert(t('home.nameRequired'), t('home.enterNameFirst'));
    const playerData = { name: displayName, avatar: profileData?.avatar, level: profileData?.level || 1, frame: profileData?.active_frame || 'none' };
    setPlayerData(playerData);
    setIsHost(false);
    setLobbyIntent('quick_play');
    setScreen('Lobby');
  };

  const handleHostGame = () => {
    const displayName = getDisplayName();
    if (!displayName) return Alert.alert(t('home.nameRequired'), t('home.enterNameToContinue'));
    setPlayerData({ name: displayName, avatar: profileData?.avatar || 'alien', frame: profileData?.active_frame || 'none' });
    setIsHost(true);
    setLobbyIntent('host_game');
    setScreen('Lobby');
  };

  const handleJoinCouch = () => {
    const displayName = getDisplayName();
    if (!displayName || !code || code.length < 4)
      return Alert.alert(t('home.oops'), t('home.enterValidCode'));
    setJoinModalVisible(false);
    setPlayerData({ name: displayName, avatar: profileData?.avatar || 'alien', frame: profileData?.active_frame || 'none' });
    setRoomCode(code.toUpperCase());
    setIsHost(false);
    setLobbyIntent('join_couch');
    setScreen('Lobby');
  };

  // Online modes list — used in the play panel
  const ONLINE_MODES = [
    { mode: 'duel',    label: '1v1', icon: <Swords size={32} color="#D946EF" strokeWidth={2.5} />, desc: 'Duel'        },
    { mode: 'team2v2', label: '2v2', icon: <Users size={32} color="#10B981" strokeWidth={2.5} />, desc: 'Teams'       },
    { mode: 'team4v4', label: '4v4', icon: <Shield size={32} color="#FBBF24" strokeWidth={2.5} />, desc: 'Battle'      },
    { mode: 'solo4',   label: '4p',  icon: <User size={32} color="#10B981" strokeWidth={2.5} />, desc: 'Free-for-all' },
    { mode: 'solo6',   label: '6p',  icon: <PartyPopper size={32} color="#F59E0B" strokeWidth={2.5} />, desc: 'Party'       },
    { mode: 'solo8',   label: '8p',  icon: <Zap size={32} color="#EF4444" strokeWidth={2.5} />, desc: 'Chaos'       },
  ];

  // ── Unified View ────────────────────────────────────────────────────────
  return (
    <View style={[s.screenRoot, { flex: 1 }]}>
      {/* Mobile Tab Bar */}
      {!isDesktop && (
        <View style={s.tabBar}>
          <NeoButton 
            style={[s.tabBtn, activeTab === 'profile' && s.tabBtnProfileActive]} 
            onPress={() => setActiveTab('profile')}
            activeOpacity={0.8}
          >
            <AppText style={[s.tabText, activeTab === 'profile' && s.tabTextActive]}>{t('home.tabProfile')}</AppText>
          </NeoButton>
          <View style={s.tabDivider} />
          <NeoButton 
            style={[s.tabBtn, activeTab === 'play' && s.tabBtnPlayActive]} 
            onPress={() => setActiveTab('play')}
            activeOpacity={0.8}
          >
            <AppText style={[s.tabText, activeTab === 'play' && s.tabTextActive]}>{t('home.tabPlay')}</AppText>
          </NeoButton>
          <View style={s.tabDivider} />
          <NeoButton 
            style={[s.tabBtn, { maxWidth: 80, backgroundColor: '#fff' }]} 
            onPress={() => setLangModalVisible(true)}
            activeOpacity={0.8}
          >
            <AppText style={[s.tabText, { fontSize: 16, color: '#000' }]}>🌐 {(i18n.language || 'en').substring(0, 2).toUpperCase()}</AppText>
          </NeoButton>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={[s.dualWindow, isDesktop && s.dualWindowDesktop, { flex: 1 }]}>

          {/* ── LEFT PANEL — Profile (ID Card) ── */}
          {(isDesktop || activeTab === 'profile') && (
            <Animated.View 
              style={[
                s.panel, 
                s.panelLeft, 
                isDesktop && s.panelLeftDesktop,
                { 
                  opacity: animVal,
                  transform: [
                    { translateY: animVal.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }
                  ]
                }
              ]}
            >
            <View style={[s.panelHeader, user ? s.panelHeaderLeft : { backgroundColor: '#FBBF24' }]}>
              <AppText style={s.panelHeaderText}>{user ? t('home.samesameid') : t('home.visitorPass')}</AppText>
              <AppText style={s.panelSubText}>{user ? t('home.officialPlayerBadge') : t('home.temporaryAccess')}</AppText>
            </View>

            <View style={[s.panelBody, s.panelBodyLeft]}>
              {/* ID Card Wrapper */}
              <View style={s.idCardContainer}>
                <Image 
                  source={user ? require('../../assets/id_template.png') : require('../../assets/visitor_template.png')} 
                  style={{ width: '100%', height: '100%', position: 'absolute' }}
                  resizeMode="cover"
                />
                <View style={s.idCardContent}>
                  <View style={{ 
                    flexDirection: !isDesktop ? 'row-reverse' : 'column', 
                    width: '100%', 
                    alignItems: 'center', 
                    justifyContent: !isDesktop ? 'space-between' : 'flex-start', 
                    marginTop: !isDesktop ? 10 : 0 
                  }}>
                    
                    {/* AVATAR & NAME (Right on Mobile, Top on Desktop) */}
                    <View style={{ alignItems: 'center', width: !isDesktop ? 110 : '100%' }}>
                      <View style={{ marginBottom: !isDesktop ? 4 : 10 }}>
                        <FramedAvatar 
                          url={user ? profileData?.avatar : undefined} 
                          fallbackName={getDisplayName()} 
                          frame={profileData?.active_frame || 'none'} 
                          size={80 * tScale} 
                        />
                      </View>

                      {user ? (
                        <AppText style={[s.authUsername, { fontSize: (!isDesktop ? 16 : 22) * tScale, marginTop: 0, marginBottom: !isDesktop ? 0 : 8 }]}>
                          {profileData?.username || user.user_metadata?.custom_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0]}
                        </AppText>
                      ) : (
                        <AppText style={[s.authUsername, { fontSize: (!isDesktop ? 16 : 22) * tScale, marginTop: !isDesktop ? 4 : 10, marginBottom: !isDesktop ? 0 : 8 }]}>
                          {guestName || 'GUEST'}
                        </AppText>
                      )}
                    </View>

                    {/* STATS (Left on Mobile, Bottom on Desktop) */}
                    <View style={{ 
                        flex: !isDesktop ? 1 : undefined, 
                        width: !isDesktop ? undefined : '100%',
                        paddingRight: !isDesktop ? 10 : 0, 
                        paddingLeft: !isDesktop ? 15 : 0,
                        marginTop: !isDesktop ? 0 : 5
                    }}>
                      {user ? (
                        <View style={[s.statsList, { marginTop: 0, paddingHorizontal: 0 }]}>
                          {[
                            { label: t('home.gamesPlayed'), value: profileData?.games_played || 0 },
                            { label: t('home.matchWins'), value: profileData?.wins || 0 },
                            { label: t('home.winRate'), value: (profileData?.games_played > 0 ? Math.round((profileData.wins / profileData.games_played) * 100) : 0) + '%' },
                            { label: t('home.levelStat'), value: profileData?.level || 1 },
                          ].map((stat) => (
                            <View key={stat.label} style={s.statListItem}>
                              <AppText style={[s.statListLabel, { fontSize: (!isDesktop ? 10 : 11) * tScale }]}>{stat.label}</AppText>
                              <View style={s.statListDots} />
                              <AppText style={[s.statListValue, { fontSize: (!isDesktop ? 14 : 15) * tScale }]}>{stat.value}</AppText>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={[s.statsList, { marginTop: 0, paddingHorizontal: 0 }]}>
                           <AppText style={[s.statListLabel, { fontSize: (!isDesktop ? 10 : 11) * tScale, color: '#9ca3af' }]}>{t('home.noStatsForGuests')}</AppText>
                        </View>
                      )}
                    </View>

                  </View>
                </View>
              </View>
              <View style={s.profileActionsContainer}>
                <View style={s.profileActions}>
                  <NeoButton
                    style={[s.signOutBtn, { backgroundColor: theme.colors.primary, flexDirection: 'row', justifyContent: 'center', gap: 10 }]}
                    onPress={() => setScreen('Settings')}
                  >
                    <AppText style={{ fontSize: 20 }}>⚙️</AppText>
                    <AppText style={[s.signOutBtnText, { color: '#000' }]}>{user ? t('home.profileSettings') : t('home.guestSettings')}</AppText>
                  </NeoButton>
                </View>
              </View>
            </View>
          </Animated.View>
          )}

          {/* ── DIVIDER ── */}
          {isDesktop && (
            <View style={[s.panelDivider, isDesktop && s.panelDividerDesktop]}>
              <View style={[s.panelDividerLine, isDesktop && s.panelDividerLineV]} />
              <View style={s.panelDividerBadge}>
                <AppText style={s.panelDividerBadgeText}>VS</AppText>
              </View>
              <View style={[s.panelDividerLine, isDesktop && s.panelDividerLineV]} />
            </View>
          )}

          {/* ── RIGHT PANEL — Play ── */}
          {(isDesktop || activeTab === 'play') && (
            <Animated.View 
              style={[
                s.panel, 
                s.panelRight,
                isDesktop && s.panelRightDesktop,
                { 
                  opacity: animVal,
                  transform: [
                    { translateY: animVal.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }
                  ]
                }
              ]}
            >
            <View style={[s.panelHeader, s.panelHeaderRight, { justifyContent: 'center', position: 'relative' }]}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <AppText style={s.panelHeaderText}>{t('home.play')}</AppText>
                </View>
                <AppText style={s.panelSubText}>{t('home.chooseHowToPlay')}</AppText>
              </View>
              {isDesktop && (
                <View style={{ position: 'absolute', right: 32 }}>
                  <NeoButton 
                    style={{ backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: '#000' }}
                    onPress={() => setLangModalVisible(true)}
                  >
                    <AppText style={{ fontFamily: theme.fonts.headingBold, fontSize: 14, color: '#000' }}>🌐 {(i18n.language || 'en').substring(0, 2).toUpperCase()}</AppText>
                  </NeoButton>
                </View>
              )}
            </View>

            <View style={[s.panelBody, { gap: 16 }]}>
              
              <Button
                title={t('home.hostGame')}
                subtext={t('home.hostGameSub')}
                onPress={handleHostGame}
                type="secondary"
              />

              <Button
                title={t('home.quickPlay')}
                subtext={t('home.quickPlaySub')}
                onPress={handleQuickPlay}
                type="primary"
              />

              <Button
                title={t('home.browseLobbies')}
                subtext={t('home.browseLobbiesSub')}
                onPress={() => setScreen('LobbyBrowser')}
                type="tertiary"
              />

              <Button
                title={t('home.leaderboards')}
                subtext={t('home.leaderboardsSub')}
                onPress={() => setScreen('GlobalLeaderboard')}
                type="tertiary"
              />

              <View style={[s.dividerRow, { marginTop: 24, marginBottom: 10 }]}>
                <View style={s.divider} />
                <AppText style={s.dividerText}>{t('home.orJoinViaCode')}</AppText>
                <View style={s.divider} />
              </View>

              {isDesktop ? (
                <View style={s.joinRow}>
                  <TextInput
                    style={s.joinCodeInput}
                    placeholder="XXXX"
                    placeholderTextColor="#9ca3af"
                    value={code}
                    onChangeText={setCode}
                    maxLength={4}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <Button
                    title={t('home.joinArrow')}
                    onPress={handleJoinCouch}
                    type="primary"
                    style={s.joinBtn}
                  />
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  <TextInput
                    style={[s.joinCodeInput, { 
                      backgroundColor: '#fff', 
                      borderWidth: 3, 
                      borderColor: '#000', 
                      borderRadius: 12,
                      padding: 12,
                      shadowColor: '#000',
                      shadowOffset: { width: 3, height: 3 },
                      shadowOpacity: 1,
                      shadowRadius: 0,
                    }]}
                    placeholder="XXXX"
                    placeholderTextColor="#9ca3af"
                    value={code}
                    onChangeText={setCode}
                    maxLength={4}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <Button
                    title={t('home.joinGame')}
                    onPress={handleJoinCouch}
                    type="primary"
                  />
                </View>
              )}

            </View>
          </Animated.View>
          )}

      </View>
      </ScrollView>
      {joinModal(joinModalVisible, setJoinModalVisible, code, setCode, handleJoinCouch, t)}
      {mmModal(mmModalVisible, setMmModalVisible, handleFindMatch, t)}
      {langModal(langModalVisible, setLangModalVisible, i18n, t)}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // screenRoot fills the appWindow frame from App.js
  screenRoot: { backgroundColor: 'transparent' },

  // ── Dual-panel layout (fills parent, no border — App.js owns the frame) ───
  dualWindow: {
    flexDirection: 'column',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  dualWindowDesktop: { flexDirection: 'row', flex: 1 },

  // ── Panels ─────────────────────────────────────────────────────────────────
  panel: { overflow: 'hidden' },
  panelLeft:  { backgroundColor: 'transparent', flex: 1 }, 
  panelRight: { backgroundColor: 'transparent', flex: 1 }, 
  panelLeftDesktop: { flex: 3 }, // 30% width
  panelRightDesktop: { flex: 7 }, // 70% width

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#000', // Black background for the divider lines
    borderBottomWidth: 3,
    borderBottomColor: '#000',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  tabDivider: {
    width: 3,
    backgroundColor: '#000',
  },
  tabBtnProfileActive: {
    backgroundColor: theme.colors.primary,
  },
  tabBtnPlayActive: {
    backgroundColor: theme.colors.accent,
  },
  tabText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: 'rgba(0,0,0,0.4)',
    letterSpacing: 2,
  },
  tabTextActive: {
    color: '#000',
  },

  panelHeader: {
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#000',
  },
  panelHeaderLeft:  { backgroundColor: theme.colors.primary }, // Vibrant Yellow
  panelHeaderRight: { backgroundColor: theme.colors.accent }, // Electric Cyan
  panelHeaderText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 26,
    color: '#000',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  panelSubText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    color: '#111',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  panelBody: { padding: 32 },
  panelBodyLeft: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 32, flex: 1 },
  
  profileActionsContainer: {
    paddingHorizontal: 32,
    marginTop: 'auto',
  },

  panelAvatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.secondary,
    borderWidth: 3,
    borderColor: '#000',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  panelAvatarEmoji: { fontSize: 36 },

  panelInput: {
    backgroundColor: '#fff',
    color: '#111',
    fontFamily: theme.fonts.bodyBold,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    fontSize: 18,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    textAlign: 'center',
  },
  panelBtn: { marginBottom: 14 },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  divider: { flex: 1, height: 2, backgroundColor: '#e5e7eb' },
  dividerText: {
    fontFamily: theme.fonts.bodyBold,
    color: '#9ca3af',
    marginHorizontal: 10,
    fontSize: 12,
    letterSpacing: 1,
  },

  // Perks filler sections
  perksBox: {
    marginTop: 20,
    padding: 16,
    borderWidth: 2,
    borderRadius: theme.borderRadius.md,
  },
  perksBoxLeft: {
    borderColor: '#F59E0B',
    backgroundColor: '#fffde7',
  },
  perksBoxRight: {
    borderColor: '#C026D3',
    backgroundColor: '#fdf4ff',
  },
  perksTitle: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    color: '#92400e',
    marginBottom: 8,
  },
  perkItem: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    marginBottom: 5,
    lineHeight: 20,
  },
  perkItemLeft: { color: '#78350f' },
  perkItemRight: { color: '#6b21a8' },

  // ── Panel divider ───────────────────────────────────────────────────────────
  panelDivider: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  panelDividerDesktop: {
    flexDirection: 'column',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  panelDividerLine:  { height: 2, flex: 1, backgroundColor: '#e5e7eb' },
  panelDividerLineV: { height: undefined, width: 2, flex: 1 },
  panelDividerBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    marginHorizontal: 8,
    borderWidth: 3,
    borderColor: '#000',
  },
  panelDividerBadgeText: {
    fontFamily: theme.fonts.headingBold,
    color: '#fff',
    fontSize: 11,
  },

  // ── Activity bar ───────────────────────────────────────────────────────────
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
    fontFamily: theme.fonts.headingBold,
    fontSize: 12,
    color: theme.colors.primary,
    letterSpacing: 1,
    flexShrink: 0,
  },
  activityItems: {
    flexDirection: 'row',
    gap: 24,
    flex: 1,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activityRank: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  activityAvatar: { fontSize: 15 },
  activityName: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    color: '#fff',
  },
  activityPts: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.primary,
  },
  activitySpacer: { flex: 1 },
  activitySeeAll: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },

  // ── Page Footer ─────────────────────────────────────────────────────────────
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
  footerCopy: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
  footerLinks: {
    flexDirection: 'row',
    gap: 20,
  },
  footerLink: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  footerStatus: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },

  // ── Authenticated-view specific ────────────────────────────────────────────
  authWelcome: {
    fontFamily: theme.fonts.body,
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
  authUsername: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 22,
    color: '#000',
    marginTop: 2,
    marginBottom: 8,
    textAlign: 'center',
  },

  // Stats List
  statsList: {
    width: '100%',
    marginTop: 5,
    paddingHorizontal: 10,
  },
  statListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statListLabel: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    color: '#000',
    letterSpacing: 1,
  },
  statListDots: {
    flex: 1,
    height: 1,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0,0,0,0.3)',
    borderStyle: 'dotted',
    marginHorizontal: 8,
    marginTop: 6,
  },
  statListValue: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: '#000',
  },

  // ── ID Card Specifics ────────────────────────────────────────────────────────
  idCardContainer: {
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 0, 
    overflow: 'visible',
    backgroundColor: 'transparent', 
    flex: 1,
  },
  idCardContent: {
    position: 'absolute',
    top: '34%',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: '16%',
    alignItems: 'center',
  },
  xpContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  xpBarBg: {
    width: '100%',
    height: 16,
    backgroundColor: '#e5e7eb',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRightWidth: 2,
    borderColor: '#000',
  },
  xpText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    color: '#374151',
    marginTop: 6,
    letterSpacing: 1,
  },
  quickPlayBtn: {
    backgroundColor: '#FCD34D',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  quickPlayBtnText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
    color: '#000',
    letterSpacing: 1,
  },
  quickPlaySubText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    color: 'rgba(0,0,0,0.6)',
    marginTop: 2,
  },



  profileActions: {
    alignItems: 'center',
    width: '100%',
    marginTop: 10, // Moved up to be closer to ID Card
  },
  signOutBtn: {
    backgroundColor: '#EF4444', // Red for sign out
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: theme.borderRadius.md,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  signOutBtnText: {
    fontFamily: theme.fonts.headingBold,
    color: '#FFF',
    fontSize: 18,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Mode cards (3-column grid in two rows)
  playSectionTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: '#111',
    letterSpacing: 3,
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  modeCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  modeCardIcon:  { fontSize: 24, marginBottom: 4 },
  modeCardLabel: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    color: '#111',
  },
  modeCardDesc: {
    fontFamily: theme.fonts.body,
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
    textAlign: 'center',
  },

  // Inline join-code row
  joinRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  joinCodeInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
    color: '#111',
    textAlign: 'center',
    letterSpacing: 6,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  joinBtn: { flex: 0, minWidth: 90 },

  // ── Modals ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: theme.spacing.xl,
    borderTopLeftRadius: theme.borderRadius.md,
    borderTopRightRadius: theme.borderRadius.md,
    paddingBottom: 40,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: '#000',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.destructive,
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: theme.borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  closeBtnText: {
    fontSize: 20,
    color: '#000',
    fontFamily: theme.fonts.headingBold,
  },
  modalTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 32,
    color: '#000',
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  codeInput: {
    fontSize: 28,
    letterSpacing: 8,
    paddingVertical: theme.spacing.xl,
  },
  mmSectionTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
    color: '#374151',
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  mmRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  mmBtn: {
    flex: 1,
    backgroundColor: theme.colors.secondary,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  mmBtnText: {
    fontFamily: theme.fonts.headingBold,
    color: '#000',
    fontSize: 18,
    textTransform: 'uppercase',
  },

  // Lobby browser
  noLobbiesBox: {
    paddingVertical: 20, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
  },
  noLobbiesText: { fontFamily: theme.fonts.bodyBold, fontSize: 15, color: '#9CA3AF' },
  noLobbiesSubText: { fontFamily: theme.fonts.body, fontSize: 13, color: '#6B7280', marginTop: 4 },
  lobbyRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: '#000', marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0,
  },
  lobbyRowTop:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  lobbyRowBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  lobbyLabel:     { fontFamily: theme.fonts.headingBold, fontSize: 15, color: '#fff' },
  lobbyStatusDot: { width: 8, height: 8, borderRadius: 4 },
  lobbyStatus:    { fontFamily: theme.fonts.body, fontSize: 12, color: '#D1D5DB' },
  lobbyMeta:      { fontFamily: theme.fonts.body, fontSize: 11, color: '#9CA3AF' },
  lobbyTag: {
    backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  lobbyTagText:   { fontFamily: theme.fonts.body, fontSize: 10, color: '#D1D5DB' },
  lobbyRight:     { alignItems: 'flex-end', gap: 4, marginLeft: 10 },
  lobbyPlayers:   { fontFamily: theme.fonts.bodyBold, fontSize: 13, color: '#9CA3AF' },
  lobbyJoin:      { fontFamily: theme.fonts.headingBold, fontSize: 14, color: '#FBBF24' },
});


