import React, { useState, useRef, useEffect } from 'react';
import AppText from '../components/AppText';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, Platform, useWindowDimensions, ScrollView, Image, Animated, PanResponder } from 'react-native';
import NeoButton from '../components/NeoButton';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../supabase';
import { theme } from '../styles/theme';
import { useTranslation } from 'react-i18next';

WebBrowser.maybeCompleteAuthSession();

export default function LandingScreen({ setIsGuest, guestName, setGuestName }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('guest'); // 'guest' | 'auth'

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
    const timer = setTimeout(() => {
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
  }, []);

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
      // Note: we don't catch unique constraints here because guests aren't in Supabase profiles yet.
      // But if we did, we'd handle it.
      setIsGuest(true);
    } catch (err) {
      console.warn('Username check failed:', err);
      // Let them in if server check fails, or could block them
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
      Alert.alert(t('landing.googleLoginFailed'), error.message);
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
          <View style={[s.col, s.colMain, isDesktop ? { flex: 3, borderRightWidth: 4, borderColor: '#000' } : { flex: 1 }]}>
            
            {/* TABS — pressing them also animates the rail */}
            <View style={s.tabBar}>
              <NeoButton
                style={[s.tab, activeTab === 'guest' && s.activeTab]}
                onPress={() => goToTab('guest')}
              >
                <AppText style={[s.tabText, activeTab === 'guest' && s.activeTabText]}>{t('landing.visitorPassTab')}</AppText>
              </NeoButton>
              <NeoButton
                style={[s.tab, activeTab === 'auth' && s.activeTab, { borderRightWidth: 0 }]}
                onPress={() => goToTab('auth')}
              >
                <AppText style={[s.tabText, activeTab === 'auth' && s.activeTabText]}>{t('landing.samesameidTab')}</AppText>
              </NeoButton>
            </View>

            {/* ── Swipeable content rail ─────────────────────────────── */}
            <View
              style={[s.colBody, { flex: 1, overflow: 'hidden' }]}
              onLayout={e => { containerW.current = e.nativeEvent.layout.width; }}
            >
              <Animated.View
                style={{ flexDirection: 'row', width: '200%', flex: 1, transform: [{ translateX: slideX }] }}
                {...panResponder.panHandlers}
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
                        <View style={s.avatarRing}>
                          <AppText style={{ fontSize: 40 * tScale }}>👤</AppText>
                        </View>
                      </View>
                      <View>
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
                  <View style={{ height: 100, paddingHorizontal: 24, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' }}>
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
                      <View style={s.idCardTopSection} />
                      <NeoButton
                        style={[s.input, { width: '85%', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, loading && { opacity: 0.7 }]}
                        onPress={handleGoogleLogin}
                        disabled={loading}
                      >
                        {loading
                          ? <ActivityIndicator color="#000" />
                          : <AppText style={{ fontFamily: theme.fonts.bodyBold, fontSize: 13, color: '#000' }}>{t('landing.continueWithGoogle')}</AppText>
                        }
                      </NeoButton>
                    </View>
                  </View>
                  {/* Auth bottom action */}
                  <View style={{ height: 100, paddingHorizontal: 24, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' }}>
                    <AppText style={{ fontFamily: theme.fonts.bodyBold, fontSize: 11 * tScale, color: '#333', textAlign: 'center', paddingHorizontal: 10 }}>
                      {t('landing.legalDisclaimer')}
                    </AppText>
                  </View>
                </View>

              </Animated.View>
            </View>
          </View>


          {/* COLUMN 2: UPDATES */}
          {isDesktop && (
            <View style={[s.col, s.colNews, { backgroundColor: '#F3F4F6' }, { flex: 7 }]}>
              <View style={[s.colHeader, { backgroundColor: theme.colors.accent }]}>
                <AppText style={s.colTitle}>{t('landing.transmissions')}</AppText>
                <AppText style={s.colSubtitle}>{t('landing.systemUpdates')}</AppText>
              </View>
              <View style={s.colNewsBody}>
                
                <View style={s.newsItem}>
                  <AppText style={s.newsDate}>{t('landing.news_v094_date')}</AppText>
                  <AppText style={s.newsHeadline}>{t('landing.news_v094_headline')}</AppText>
                  <AppText style={s.newsBody}>{t('landing.news_v094_body')}</AppText>
                </View>

                <View style={s.newsItem}>
                  <AppText style={s.newsDate}>{t('landing.news_server_date')}</AppText>
                  <AppText style={s.newsHeadline}>{t('landing.news_server_headline')}</AppText>
                  <AppText style={s.newsBody}>{t('landing.news_server_body')}</AppText>
                </View>

                <View style={s.newsItem}>
                  <AppText style={s.newsDate}>{t('landing.news_rules_date')}</AppText>
                  <AppText style={s.newsHeadline}>{t('landing.news_rules_headline')}</AppText>
                  <AppText style={s.newsBody}>{t('landing.news_rules_body')}</AppText>
                </View>

              </View>
            </View>
          )}

        </View>
      </View>
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
    backgroundColor: '#FBBF24', // Matching the ID card yellow
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

  colHeader: {
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#000',
  },
  colTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 26,
    color: '#000',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  colSubtitle: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    color: '#111',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  colBody: {
    backgroundColor: 'transparent', 
    justifyContent: 'center',
  },
  colNewsBody: {
    padding: 24,
    flex: 1,
  },
  
  idCardContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
    backgroundColor: 'transparent',
    marginBottom: 20, // Add some bottom spacing for the "By linking an account..." text
  },
  idCardContent: {
    position: 'absolute',
    top: '30%', left: 0, right: 0, bottom: 0,
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
    backgroundColor: '#000',
    padding: 18,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: theme.borderRadius.md,
    marginBottom: '5%',
  },
  guestBtnText: {
    fontFamily: theme.fonts.headingBold,
    color: '#fff',
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

  // News Styles
  newsItem: {
    marginBottom: 30,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    padding: 16,
    borderRadius: theme.borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  newsDate: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 12,
    color: '#10B981',
    marginBottom: 4,
  },
  newsHeadline: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    color: '#000',
    marginBottom: 8,
  },
  newsBody: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});
