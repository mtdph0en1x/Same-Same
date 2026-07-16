import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, Platform, useWindowDimensions, ScrollView, Image } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../supabase';
import { theme } from '../styles/theme';

WebBrowser.maybeCompleteAuthSession();

export default function LandingScreen({ setIsGuest }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [guestName, setGuestName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  
  const { width } = useWindowDimensions();
  const isDesktop = width > 800;

  async function handleAuth() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) Alert.alert('Login Failed', error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) Alert.alert('Signup Failed', error.message);
      else Alert.alert('Success', 'Account created!');
    }
    setLoading(false);
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
    <SafeAreaView style={s.safeArea}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={[s.layout, isDesktop && s.layoutDesktop]}>
          
          {/* COLUMN 1: VISITOR PASS */}
          <View style={[s.col, s.colVisitor]}>
            <View style={[s.colHeader, { backgroundColor: '#FBBF24' }]}>
              <Text style={s.colTitle}>🎟️ VISITOR</Text>
              <Text style={s.colSubtitle}>TEMPORARY ACCESS</Text>
            </View>
            <View style={s.colBody}>
              <View style={s.idCardContainer}>
                <Image source={require('../../assets/visitor_template.jpg')} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="cover" />
                <View style={s.idCardSpacer} />
                <View style={s.idCardContent}>
                  
                  <View style={s.avatarRing}>
                    <Text style={{ fontSize: 60 * tScale }}>👤</Text>
                  </View>

                  <TextInput
                    style={[s.input, { width: '90%', textAlign: 'center', marginTop: 20, marginBottom: 15 }]}
                    onChangeText={setGuestName}
                    value={guestName}
                    placeholder="ENTER GUEST NAME"
                    placeholderTextColor="#a0603a"
                  />
                  
                  <View style={[s.perksBox, { width: '90%' }]}>
                    <Text style={[s.perksTitle, { fontSize: 14 * tScale }]}>GUEST PERKS</Text>
                    {['🎮 Play all modes', '🏠 Host local games', '👥 Play with 8 people'].map(p => (
                      <Text key={p} style={[s.perkText, { fontSize: 12 * tScale }]}>{p}</Text>
                    ))}
                  </View>

                  <View style={{ flex: 1 }} />
                  
                  <TouchableOpacity 
                    style={[s.guestBtn, { width: '100%' }]}
                    onPress={() => setIsGuest(true)}
                  >
                    <Text style={[s.guestBtnText, { fontSize: 16 * tScale }]}>ENTER AS GUEST →</Text>
                  </TouchableOpacity>

                </View>
              </View>
            </View>
          </View>


          {/* COLUMN 2: SAME SAME ID */}
          <View style={[s.col, s.colAuth]}>
            <View style={[s.colHeader, { backgroundColor: theme.colors.primary }]}>
              <Text style={s.colTitle}>🪪 SAMESAME ID</Text>
              <Text style={s.colSubtitle}>OFFICIAL PLAYER BADGE</Text>
            </View>
            <View style={s.colBody}>
              <View style={s.idCardContainer}>
                <Image source={require('../../assets/id_template.jpg')} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="cover" />
                <View style={s.idCardSpacer} />
                <View style={s.idCardContent}>
                  
                  <Text style={[s.authToggleHeader, { fontSize: 16 * tScale }]}>{isLogin ? 'WELCOME BACK' : 'CREATE ACCOUNT'}</Text>
                  
                  <TextInput
                    style={[s.input, { width: '100%' }]}
                    onChangeText={setEmail}
                    value={email}
                    placeholder="EMAIL ADDRESS"
                    placeholderTextColor="#a0603a"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <TextInput
                    style={[s.input, { width: '100%' }]}
                    onChangeText={setPassword}
                    value={password}
                    placeholder="PASSWORD"
                    placeholderTextColor="#a0603a"
                    secureTextEntry
                  />

                  <TouchableOpacity 
                    style={[s.authBtn, { width: '100%' }, loading && { opacity: 0.7 }]} 
                    onPress={handleAuth}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color="#000" /> : <Text style={[s.authBtnText, { fontSize: 16 * tScale }]}>{isLogin ? 'LOGIN' : 'SIGN UP'}</Text>}
                  </TouchableOpacity>

                  <View style={s.dividerRow}>
                    <View style={s.dividerLine} />
                    <Text style={[s.dividerText, { fontSize: 12 * tScale }]}>OR</Text>
                    <View style={s.dividerLine} />
                  </View>

                  <TouchableOpacity 
                    style={[s.googleBtn, { width: '100%' }, loading && { opacity: 0.7 }]} 
                    onPress={handleGoogleLogin}
                    disabled={loading}
                  >
                    <Text style={[s.googleBtnText, { fontSize: 14 * tScale }]}>🌐 CONTINUE WITH GOOGLE</Text>
                  </TouchableOpacity>

                  <View style={{ flex: 1 }} />

                  <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={{ marginTop: 20 }}>
                    <Text style={[s.toggleText, { fontSize: 13 * tScale }]}>
                      {isLogin ? "Need an ID? Sign up →" : 'Have an ID? Log in →'}
                    </Text>
                  </TouchableOpacity>

                </View>
              </View>
            </View>
          </View>


          {/* COLUMN 3: UPDATES */}
          <View style={[s.col, isDesktop && { flex: 2 }, s.colNews, { backgroundColor: '#F3F4F6' }]}>
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

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  layout: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#fff',
  },
  layoutDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  col: {
    flex: 1,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#000',
    backgroundColor: '#fff',
    minHeight: 500,
    overflow: 'hidden',
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
    flex: 1,
    backgroundColor: '#f3f4f6', // subtle gray behind the ID card
  },
  colNewsBody: {
    padding: 24,
    flex: 1,
  },
  
  // Embedded ID Card Styles
  idCardContainer: {
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#FFCA28',
  },
  idCardSpacer: {
    width: '100%',
    paddingTop: '155%', // Matches HomeScreen scaling
  },
  idCardContent: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    paddingTop: '46%', // Shifted down into the white box
    paddingHorizontal: '16%',
    alignItems: 'center',
  },
  avatarRing: {
    width: 120, height: 120,
    borderRadius: 60,
    borderWidth: 5,
    borderColor: '#000',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '10%',
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
    marginTop: '15%',
    marginBottom: '10%',
    color: '#111',
  },
  input: {
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#fff',
    padding: 14,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 16,
    marginBottom: 10,
    borderRadius: theme.borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  authBtn: {
    backgroundColor: '#10B981', // green for action
    borderWidth: 3,
    borderColor: '#000',
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    marginTop: 10,
    marginBottom: 15,
    borderRadius: theme.borderRadius.md,
  },
  authBtnText: {
    fontFamily: theme.fonts.headingBold,
    color: '#fff',
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
    padding: 14,
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
    marginBottom: 6,
    color: '#000',
  },
  newsBody: {
    fontFamily: theme.fonts.body,
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
  },
});
