import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, Platform, useWindowDimensions, ScrollView, Image } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../supabase';
import { theme } from '../styles/theme';

WebBrowser.maybeCompleteAuthSession();

export default function LandingScreen({ setIsGuest, guestName, setGuestName }) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('guest'); // 'guest' | 'auth'
  
  const { width } = useWindowDimensions();
  const isDesktop = width > 800;


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
      Alert.alert('Google Login Failed', error.message);
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
            
            {/* TABS */}
            <View style={s.tabBar}>
              <TouchableOpacity 
                style={[s.tab, activeTab === 'guest' && s.activeTab]} 
                onPress={() => setActiveTab('guest')}
              >
                <Text style={[s.tabText, activeTab === 'guest' && s.activeTabText]}>🎟️ VISITOR PASS</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[s.tab, activeTab === 'auth' && s.activeTab, { borderRightWidth: 0 }]} 
                onPress={() => setActiveTab('auth')}
              >
                <Text style={[s.tabText, activeTab === 'auth' && s.activeTabText]}>🪪 SAMESAME ID</Text>
              </TouchableOpacity>
            </View>

            <View style={[s.colBody, { flex: 1 }]}>
              <View style={[s.idCardContainer, { flex: 1 }]}>
                <Image 
                  source={activeTab === 'guest' ? require('../../assets/visitor_template.png') : require('../../assets/id_template.png')} 
                  style={{ width: '100%', height: '100%', position: 'absolute' }} 
                  resizeMode="cover" 
                />
                
                <View style={[s.idCardContent, { flex: 1 }]}>
                  {activeTab === 'guest' ? (
                    // --- GUEST VIEW ---
                    <>
                      <View style={s.idCardTopSection}>
                        <View style={s.avatarRing}>
                          <Text style={{ fontSize: 40 * tScale }}>👤</Text>
                        </View>
                      </View>

                      <TextInput
                        style={[s.input, { width: '85%', textAlign: 'center' }]}
                        onChangeText={setGuestName}
                        value={guestName}
                        placeholder="ENTER GUEST NAME"
                        placeholderTextColor="#a0603a"
                      />
                    </>
                  ) : (
                    // --- AUTH VIEW ---
                    <>
                      <View style={s.idCardTopSection} />
                      <TouchableOpacity 
                        style={[s.input, { width: '85%', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, loading && { opacity: 0.7 }]} 
                        onPress={handleGoogleLogin}
                        disabled={loading}
                      >
                        {loading ? <ActivityIndicator color="#000" /> : <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 13, color: '#000' }}>🌐 CONTINUE WITH GOOGLE</Text>}
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {/* BOTTOM ACTIONS */}
              <View style={{ height: 100, paddingHorizontal: 24, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
                {activeTab === 'guest' ? (
                  <TouchableOpacity 
                    style={[s.guestBtn, { width: '100%', marginBottom: 0 }]}
                    onPress={() => setIsGuest(true)}
                  >
                    <Text style={[s.guestBtnText, { fontSize: 16 * tScale }]}>ENTER AS GUEST →</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={{ fontFamily: theme.fonts.bodyBold, fontSize: 11 * tScale, color: '#333', textAlign: 'center', paddingHorizontal: 10 }}>
                    "By linking an account, you legally agree that it's your fault when you lose."
                  </Text>
                )}
              </View>

            </View>
          </View>


          {/* COLUMN 2: UPDATES */}
          {isDesktop && (
            <View style={[s.col, s.colNews, { backgroundColor: '#F3F4F6' }, { flex: 7 }]}>
              <View style={[s.colHeader, { backgroundColor: theme.colors.accent }]}>
                <Text style={s.colTitle}>📻 TRANSMISSIONS</Text>
                <Text style={s.colSubtitle}>SYSTEM UPDATES & RULES</Text>
              </View>
              <View style={s.colNewsBody}>
                
                <View style={s.newsItem}>
                  <Text style={s.newsDate}>v0.9.4 — TODAY</Text>
                  <Text style={s.newsHeadline}>Couch Royale is here!</Text>
                  <Text style={s.newsBody}>Grab up to 8 friends on the same screen and battle it out in our chaotic new local mode.</Text>
                </View>

                <View style={s.newsItem}>
                  <Text style={s.newsDate}>SERVER STATUS</Text>
                  <Text style={s.newsHeadline}>All Systems Operational</Text>
                  <Text style={s.newsBody}>Current matchmaking wait times are under 10 seconds.</Text>
                </View>

                <View style={s.newsItem}>
                  <Text style={s.newsDate}>QUICK RULES</Text>
                  <Text style={s.newsHeadline}>How to play</Text>
                  <Text style={s.newsBody}>1. Answer the prompt.{'\n'}2. Try to match the majority.{'\n'}3. Survive the longest!</Text>
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
