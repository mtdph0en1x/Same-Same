import React, { useState, useRef, useEffect } from 'react';
import AppText from '../components/AppText';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, Platform, useWindowDimensions, ScrollView, Image, Animated, PanResponder, Modal } from 'react-native';
import NeoButton from '../components/NeoButton';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../supabase';
import { theme } from '../styles/theme';
import { useTranslation } from 'react-i18next';
import HowToPlayModal from '../components/HowToPlayModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome5 } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

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
                <AppText style={{ fontFamily: ['ru', 'uk'].includes(l.code) ? theme.fonts.headingBoldFallback : theme.fonts.headingBold, fontWeight: 'bold', fontSize: 18, color: '#000' }}>
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

const GUEST_EMOJIS = ['👽', '👾', '🤖', '👻', '🤡', '🤠', '😎', '🥸', '🥶', '🎃', '🦄', '🦖', '🐙', '🐸', '🐱', '🐶', '🦊', '🐵', '🐼', '🐨', '🐷', '🦁', '🐻', '🐰'];

function emojiModal(visible, setVisible, currentAvatar, setGuestAvatar, t) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => setVisible(false)}>
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <NeoButton style={s.closeBtn} onPress={() => setVisible(false)}>
            <AppText style={s.closeBtnText}>✕</AppText>
          </NeoButton>
          <AppText style={s.modalTitle}>{t('landing.chooseAvatar', 'Choose Avatar')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 10 }}>
            {GUEST_EMOJIS.map((emoji) => (
              <NeoButton 
                key={emoji}
                style={[
                  { width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
                  currentAvatar === emoji ? { backgroundColor: theme.colors.primary } : { backgroundColor: '#f3f4f6' }
                ]} 
                onPress={() => {
                  setGuestAvatar(emoji);
                  setVisible(false);
                }}
              >
                <AppText style={{ fontSize: 32 }}>{emoji}</AppText>
              </NeoButton>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

let hasPlayedPeekAnimation = false;

// Removed old RulesModal

export default function LandingScreen({ setIsGuest, guestName, setGuestName, guestAvatar, setGuestAvatar }) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('guest'); // 'guest' | 'auth'
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [rulesModalVisible, setRulesModalVisible] = useState(false);
  const [emojiModalVisible, setEmojiModalVisible] = useState(false);

  const { width } = useWindowDimensions();
  const isDesktop = width > 800;

  // ── Swipe state ──────────────────────────────────────────────────────────
  const slideX        = useRef(new Animated.Value(0)).current;
  const containerW    = useRef(0);   // measured width of colBody
  const currentOffset = useRef(0);   // offset at start of each pan gesture

  // Navigate to a tab, animating the rail
  const goToTabRef = useRef(null);
  goToTabRef.current = (tab) => {
    const toValue = tab === 'guest' ? 0 : -containerW.current;
    setActiveTab(tab);
    currentOffset.current = toValue;
    Animated.spring(slideX, {
      toValue,
      useNativeDriver: true,
      speed: 22,
      bounciness: 5,
    }).start();
  };
  const goToTab = (tab) => goToTabRef.current(tab);

  // Peek animation on mount — nudges toward auth panel then bounces back
  useEffect(() => {
    if (hasPlayedPeekAnimation) return;
    
    const timer = setTimeout(() => {
      hasPlayedPeekAnimation = true;
      Animated.sequence([
        Animated.spring(slideX, {
          toValue: -240,
          useNativeDriver: true,
          speed: 12,
          bounciness: 0,
        }),
        Animated.spring(slideX, {
          toValue: 0,
          useNativeDriver: true,
          speed: 10,
          bounciness: 12,
        }),
      ]).start();
    }, 900);
    return () => clearTimeout(timer);
  }, [isDesktop, slideX]);

  // Swipe gesture handler
  const panResponder = useRef(
    PanResponder.create({
      // Only claim horizontal swipes
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5,
      onPanResponderGrant: () => {
        // Freeze animation and capture current position
        slideX.stopAnimation();
      },
      onPanResponderMove: (_, { dx }) => {
        const next    = currentOffset.current + dx;
        const maxLeft = -containerW.current;
        // Rubber-band past edges (20% drag resistance)
        let clamped;
        if (next > 0)         clamped = next * 0.2;
        else if (next < maxLeft) clamped = maxLeft + (next - maxLeft) * 0.2;
        else                  clamped = next;
        slideX.setValue(clamped);
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        const threshold   = containerW.current * 0.3;
        const onGuestPage = currentOffset.current >= -containerW.current / 2;
        let nextTab;
        // High-velocity flick takes priority
        if      (vx < -0.6)                       nextTab = 'auth';
        else if (vx >  0.6)                       nextTab = 'guest';
        // Threshold drag
        else if (onGuestPage  && dx < -threshold) nextTab = 'auth';
        else if (!onGuestPage && dx >  threshold) nextTab = 'guest';
        // Otherwise snap back to whichever side we're closer to
        else nextTab = onGuestPage ? 'guest' : 'auth';
        goToTabRef.current(nextTab);
      },
      onPanResponderTerminate: () => {
        const onGuestPage = currentOffset.current >= -containerW.current / 2;
        goToTabRef.current(onGuestPage ? 'guest' : 'auth');
      },
    })
  ).current;


  const [nameError, setNameError] = useState('');

  async function handleGuestLogin() {
    setNameError('');
    const newName = guestName.trim();
    if (!newName) {
      setNameError(t('landing.pleaseEnterGuestName'));
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000'}/check-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newName })
      });
      const data = await res.json();
      if (!res.ok) {
        setNameError(data.error || t('landing.failedToValidateUsername'));
        return;
      }
      setIsGuest(true);
    } catch (err) {
      console.warn('Username check failed:', err);
      setIsGuest(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      const redirectUrl = Platform.OS === 'web' ? window.location.origin + '/' : Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: Platform.OS !== 'web' }
      });
      
      if (error) throw error;
      
      if (Platform.OS !== 'web' && data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (res.type === 'success' && res.url) {
          const parsed = Linking.parse(res.url);
          if (parsed.queryParams && parsed.queryParams.code) {
            await supabase.auth.exchangeCodeForSession(parsed.queryParams.code);
          } else {
            const hash = res.url.split('#')[1];
            if (hash) {
              const hashParams = new URLSearchParams(hash);
              const access_token = hashParams.get('access_token');
              const refresh_token = hashParams.get('refresh_token');
              if (access_token && refresh_token) await supabase.auth.setSession({ access_token, refresh_token });
            }
          }
        }
      }
    } catch (error) {
      Alert.alert(t('landing.googleLoginFailed', 'Google Login Failed'), error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDiscordLogin() {
    setLoading(true);
    try {
      const redirectUrl = Platform.OS === 'web' ? window.location.origin + '/' : Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: Platform.OS !== 'web' }
      });
      
      if (error) throw error;
      
      if (Platform.OS !== 'web' && data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (res.type === 'success' && res.url) {
          const parsed = Linking.parse(res.url);
          if (parsed.queryParams && parsed.queryParams.code) {
            await supabase.auth.exchangeCodeForSession(parsed.queryParams.code);
          } else {
            const hash = res.url.split('#')[1];
            if (hash) {
              const hashParams = new URLSearchParams(hash);
              const access_token = hashParams.get('access_token');
              const refresh_token = hashParams.get('refresh_token');
              if (access_token && refresh_token) await supabase.auth.setSession({ access_token, refresh_token });
            }
          }
        }
      }
    } catch (error) {
      Alert.alert(t('landing.discordLoginFailed', 'Discord Login Failed'), error.message);
    } finally {
      setLoading(false);
    }
  }

  // Calculate dynamic scale factor based on container width (max 450)
  // We use 400 as a baseline reference width for text scaling.
  const containerWidth = Math.min(width - 40, 450);
  const tScale = Math.max(0.7, containerWidth / 400);

  return (
    <SafeAreaView style={[s.safeArea, { flex: 1 }]}>
      <View style={[{ flex: 1 }]}>
        <View style={[s.layout, isDesktop && s.layoutDesktop, { flex: 1 }]}>
          
          {/* COLUMN 1: TABBED ID */}
          <View style={[s.col, s.colMain, isDesktop ? { flex: 4, borderRightWidth: 4, borderColor: '#000' } : { flex: 1 }]}>
            
            {/* TABS — pressing them also animates the rail */}
            <View style={s.tabBar}>
              <NeoButton
                style={[s.tab, activeTab === 'guest' && s.activeTab]}
                onPress={() => goToTab('guest')}
              >
                <AppText style={[s.tabText, activeTab === 'guest' && s.activeTabText]}>{t('landing.visitorPassTab')}</AppText>
              </NeoButton>
              <NeoButton
                style={[s.tab, activeTab === 'auth' && s.activeTab, isDesktop && { borderRightWidth: 0 }]}
                onPress={() => goToTab('auth')}
              >
                <AppText style={[s.tabText, activeTab === 'auth' && s.activeTabText]}>{t('landing.samesameidTab')}</AppText>
              </NeoButton>
              {!isDesktop && (
                <NeoButton 
                  style={[s.tab, { flex: 0, paddingHorizontal: 12, backgroundColor: '#fff', borderRightWidth: 0, borderLeftWidth: 3, borderColor: '#000' }]} 
                  onPress={() => setLangModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <AppText style={[s.tabText, { fontSize: 14, color: '#000' }]}>🌐 {(i18n.language || 'en').substring(0, 2).toUpperCase()}</AppText>
                </NeoButton>
              )}
            </View>

            {/* ── Swipeable content rail ─────────────────────────────── */}
            <View
              style={[s.colBody, { flex: 1, overflow: 'hidden' }]}
              onLayout={e => { containerW.current = e.nativeEvent.layout.width; }}
            >
              <Animated.View
                style={{ flexDirection: 'row', width: '200%', flex: 1, transform: [{ translateX: slideX }] }}
                {...(isDesktop ? {} : panResponder.panHandlers)}
              >

                {/* ── PAGE 1: GUEST ─────────────────────────────────── */}
                <View style={{ width: '50%', flex: 1 }}>
                  <View style={[s.idCardContainer, { flex: 1 }]}>
                    <Image
                      source={require('../../assets/visitor_template.png')}
                      style={{ width: '100%', height: '100%', position: 'absolute' }}
                      resizeMode="cover"
                    />
                    <View style={[s.idCardContent, { flex: 1 }]}>
                      <View style={s.idCardTopSection}>
                        <TouchableOpacity style={s.avatarRing} onPress={() => setEmojiModalVisible(true)} activeOpacity={0.8}>
                          <AppText style={{ fontSize: 40 * tScale }}>{guestAvatar || '👤'}</AppText>
                          <View style={{ position: 'absolute', bottom: -5, right: -5, backgroundColor: '#fff', borderRadius: 10, borderWidth: 2, borderColor: '#000', padding: 2 }}>
                            <AppText style={{ fontSize: 10 }}>✏️</AppText>
                          </View>
                        </TouchableOpacity>
                      </View>
                      <View style={{ width: '100%', alignItems: 'center' }}>
                        <TextInput
                          style={[s.input, { width: '85%', textAlign: 'center' }]}
                          onChangeText={(t) => { setGuestName(t); setNameError(''); }}
                          value={guestName}
                          placeholder={t('landing.enterGuestName')}
                          placeholderTextColor="#a0603a"
                        />
                        {nameError ? <AppText style={{ color: '#EF4444', fontFamily: theme.fonts.bodyBold, fontSize: 12, marginTop: 4, textAlign: 'center' }}>{nameError}</AppText> : null}
                      </View>
                    </View>
                  </View>
                  {/* Guest bottom action */}
                  <View style={{ paddingHorizontal: 24, paddingVertical: 16, alignItems: 'center', gap: 12 }}>
                    <NeoButton
                      style={[s.guestBtn, { width: '100%', marginBottom: 0 }, loading && { opacity: 0.7 }]}
                      onPress={handleGuestLogin}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <AppText style={[s.guestBtnText, { fontSize: 16 * tScale }]}>{t('landing.enterAsGuest')}</AppText>
                      )}
                    </NeoButton>
                    {!isDesktop && (
                      <NeoButton
                        style={[s.guestBtn, { width: '100%', marginBottom: 0, backgroundColor: '#fff' }]}
                        onPress={() => setRulesModalVisible(true)}
                      >
                        <AppText style={[s.guestBtnText, { fontSize: 16 * tScale }]}>{t('landing.howToPlay', 'HOW TO PLAY')}</AppText>
                      </NeoButton>
                    )}
                  </View>
                </View>

                {/* ── PAGE 2: AUTH ──────────────────────────────────── */}
                <View style={{ width: '50%', flex: 1 }}>
                  <View style={[s.idCardContainer, { flex: 1 }]}>
                    <Image
                      source={require('../../assets/id_template.png')}
                      style={{ width: '100%', height: '100%', position: 'absolute' }}
                      resizeMode="cover"
                    />
                    <View style={[s.idCardContent, { flex: 1 }]}>
                      <View style={{ height: 30 }} />
                      <NeoButton
                        style={[s.input, { width: '85%', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }, loading && { opacity: 0.7 }]}
                        onPress={handleGoogleLogin}
                        disabled={loading}
                      >
                        {loading
                          ? <ActivityIndicator color="#000" />
                          : (
                              <>
                                <FontAwesome5 name="google" size={16} color="#000" style={{ marginRight: 8 }} />
                                <AppText style={{ fontFamily: theme.fonts.bodyBold, fontSize: 13, color: '#000' }}>{t('landing.continueWithGoogle', 'CONTINUE WITH GOOGLE')}</AppText>
                              </>
                            )
                        }
                      </NeoButton>
                      
                      <NeoButton
                        style={[s.input, { width: '85%', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', backgroundColor: '#5865F2', marginTop: 15 }, loading && { opacity: 0.7 }]}
                        onPress={handleDiscordLogin}
                        disabled={loading}
                      >
                        {loading
                          ? <ActivityIndicator color="#fff" />
                          : (
                              <>
                                <FontAwesome5 name="discord" size={18} color="#fff" style={{ marginRight: 8 }} />
                                <AppText style={{ fontFamily: theme.fonts.bodyBold, fontSize: 13, color: '#fff' }}>{t('landing.continueWithDiscord', 'CONTINUE WITH DISCORD')}</AppText>
                              </>
                            )
                        }
                      </NeoButton>
                    </View>
                  </View>
                  {/* Auth bottom action */}
                  <View style={{ paddingHorizontal: 24, paddingVertical: 16, alignItems: 'center', gap: 12 }}>
                    <AppText style={{ fontFamily: theme.fonts.bodyBold, fontSize: 11 * tScale, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 10 }}>
                      {t('landing.legalDisclaimer')}
                    </AppText>
                    {!isDesktop && (
                      <NeoButton
                        style={[s.guestBtn, { width: '100%', marginBottom: 0, backgroundColor: '#fff' }]}
                        onPress={() => setRulesModalVisible(true)}
                      >
                        <AppText style={[s.guestBtnText, { fontSize: 16 * tScale }]}>{t('landing.howToPlay', 'HOW TO PLAY')}</AppText>
                      </NeoButton>
                    )}
                  </View>
                </View>

              </Animated.View>
            </View>
          </View>


          {/* COLUMN 2: HOW TO PLAY (Desktop) */}
          {isDesktop && (
            <View style={[s.col, s.colNews, { backgroundColor: 'transparent' }, { flex: 5 }]}>
              <View style={{ position: 'absolute', right: 32, top: 24, zIndex: 10 }}>
                <NeoButton 
                  style={{ backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: '#000' }}
                  onPress={() => setLangModalVisible(true)}
                >
                  <AppText style={{ fontFamily: theme.fonts.headingBold, fontSize: 14, color: '#000' }}>🌐 {(i18n.language || 'en').substring(0, 2).toUpperCase()}</AppText>
                </NeoButton>
              </View>
              <View style={{ flex: 1, padding: 40, justifyContent: 'center', alignItems: 'center' }}>
                <HowToPlayModal inline={true} t={t} />
              </View>
            </View>
          )}

        </View>
      </View>
      {langModal(langModalVisible, setLangModalVisible, i18n, t)}
      {emojiModal(emojiModalVisible, setEmojiModalVisible, guestAvatar, setGuestAvatar, t)}
      <HowToPlayModal visible={rulesModalVisible} setVisible={setRulesModalVisible} t={t} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: {
    backgroundColor: 'transparent',
  },
  layout: {
    flexDirection: 'column',
    backgroundColor: 'transparent',
  },
  layoutDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  col: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  colMain: {
    // Left column takes equal space
  },
  colNews: {
    // Right column takes equal space
  },

  // TABS
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 4,
    borderBottomColor: '#000',
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    borderRightWidth: 4,
    borderRightColor: '#000',
  },
  activeTab: {
    backgroundColor: '#FCD34D', // Matching the ID card yellow
  },
  tabText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 14,
    color: '#6b7280', // grayed out
  },
  activeTabText: {
    color: '#000',
    fontSize: 16,
  },

  colBody: {
    backgroundColor: 'transparent', 
    justifyContent: 'center',
  },
  
  idCardContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
    backgroundColor: 'transparent',
    marginBottom: 0, 
  },
  idCardContent: {
    position: 'absolute',
    top: '38%', left: 0, right: 0, bottom: 0,
    paddingHorizontal: '16%',
    alignItems: 'center',
  },
  idCardTopSection: {
    height: 100, // Reduced height so elements don't spill down
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRing: {
    width: 70, height: 70, // Made smaller
    borderRadius: 35,
    borderWidth: 5,
    borderColor: '#000',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Visitor Styles
  perksBox: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    padding: 12,
    borderRadius: theme.borderRadius.md,
  },
  perksTitle: {
    fontFamily: theme.fonts.headingBold,
    marginBottom: 8,
    textAlign: 'center',
    color: '#111',
  },
  perkText: {
    fontFamily: theme.fonts.bodyBold,
    color: '#374151',
    marginBottom: 4,
  },
  guestBtn: {
    backgroundColor: '#FCD34D',
    padding: 18,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: theme.borderRadius.md,
    marginBottom: '5%',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  guestBtnText: {
    fontFamily: theme.fonts.headingBold,
    color: '#000',
    letterSpacing: 1,
  },

  // Auth Styles
  authToggleHeader: {
    fontFamily: theme.fonts.headingBold,
    textAlign: 'center',
    color: '#111',
  },
  input: {
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#fff',
    padding: 10,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    marginBottom: 10,
    borderRadius: theme.borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    width: '90%',
  },
  dividerLine: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  dividerText: {
    fontFamily: theme.fonts.headingBold,
    paddingHorizontal: 15,
    color: '#555',
  },
  googleBtn: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    padding: 12,
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  googleBtnText: {
    fontFamily: theme.fonts.headingBold,
  },
  toggleText: {
    fontFamily: theme.fonts.bodyBold,
    textAlign: 'center',
    color: '#222',
    textDecorationLine: 'underline',
    marginBottom: '5%',
  },

  // Rules Modal Styles
  rulesTitleMini: {
    fontFamily: theme.fonts.headingBold,
    color: '#fff',
    fontSize: 14,
    letterSpacing: 2,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  ruleSlideMini: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    minHeight: 80,
  },
  ruleEmojiMini: {
    fontSize: 40,
    marginRight: 16,
  },
  ruleTextContainerMini: {
    flex: 1,
  },
  ruleHeadlineMini: {
    fontFamily: theme.fonts.headingBold,
    color: '#fff',
    fontSize: 18,
    marginBottom: 4,
  },
  ruleBodyMini: {
    fontFamily: theme.fonts.body,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 18,
  },
  paginationMini: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  arrowMini: {
    color: '#fff',
    fontSize: 18,
    padding: 10,
    fontFamily: theme.fonts.headingBold,
  },
  dotsContainerMini: {
    flexDirection: 'row',
    gap: 8,
  },
  dotMini: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  activeDotMini: {
    backgroundColor: '#fff',
    width: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
});
