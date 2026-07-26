import React, { useEffect, useState, useContext } from 'react';
import AppText from '../components/AppText';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, TextInput, Alert, Modal, useWindowDimensions, Platform, Linking } from 'react-native';
import NeoButton from '../components/NeoButton';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as Haptics from 'expo-haptics';
import { supabase } from '../supabase';
import { AuthContext } from '../context/AuthContext';
import { theme } from '../styles/theme';
import FramedAvatar from '../components/FramedAvatar';
import { useTranslation } from 'react-i18next';

const UNLOCK_THRESHOLDS = [
  { level: 5, frame: 'bronze', labelKey: 'bronze' },
  { level: 10, frame: 'silver', labelKey: 'silver' },
  { level: 20, frame: 'gold', labelKey: 'gold' },
  { level: 35, frame: 'neon', labelKey: 'neon' },
  { level: 50, frame: 'glitch', labelKey: 'glitch' }
];

export default function SettingsScreen({ setScreen, setIsGuest }) {
  const { width } = useWindowDimensions();
  const isSmall = width < 400;
  const isDesktop = width > 800;


  const { t, i18n } = useTranslation();
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [nameError, setNameError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState('');
  const [creditsVisible, setCreditsVisible] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    if (!user) return setLoading(false);
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) {
      setProfile(data);
      setEditName(data.username || '');
    }
    setLoading(false);
  };

  const handleSaveName = async () => {
    setNameError('');
    const newName = editName.trim();
    if (!newName || newName === profile.username) {
      setIsEditingName(false);
      return;
    }
    
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000'}/check-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newName })
      });
      const data = await res.json();
      if (!res.ok) {
        setNameError(data.error || t('settings.failedToValidateUsername', 'Failed to validate username'));
        return;
      }
    } catch (err) {
      console.warn('Username check failed:', err);
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: newName })
        .eq('id', user.id);
      
      if (error) {
        if (error.code === '23505') throw new Error(t('settings.usernameAlreadyTaken', 'Username is already taken.'));
        throw new Error(error.message || t('settings.failedToUpdateUsername', 'Failed to update username'));
      }
      setProfile({ ...profile, username: newName });
      setIsEditingName(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
    } catch (err) {
      setNameError(err.message);
    }
  };

  const setFrame = async (frameName) => {
    if (frameName === profile.active_frame) return;

    // Optimistic UI update
    setProfile({ ...profile, active_frame: frameName });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ active_frame: frameName })
        .eq('id', user.id);
      
      if (error) {
        throw new Error(error.message);
      }
    } catch (err) {
      console.error('Failed to equip frame:', err);
      // Revert on error
      setProfile({ ...profile, active_frame: profile.active_frame });
      Alert.alert(t('settings.equipError', 'Failed to equip frame'), err.message);
    }
  };

  const pickImage = async () => {
    // 1. Check if they are locked out before even opening the picker
    if (profile?.last_avatar_change) {
      const lastChange = new Date(profile.last_avatar_change);
      const daysSince = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        const daysLeft = Math.ceil(7 - daysSince);
        setAvatarMessage(t('settings.avatarLockedDesc', `Locked! Try again in ${daysLeft} days.`));
        return;
      }
    }

    // Clear any previous message and just open the picker directly (they are warned by the static UI text)
    setAvatarMessage('');
    openImagePicker();
  };

  const openImagePicker = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploading(true);
        const base64 = result.assets[0].base64;
        const uri = result.assets[0].uri;
        
        const extMatch = uri.match(/\.([a-zA-Z0-9]+)$/);
        const ext = extMatch ? extMatch[1] : 'jpeg';

        // Get the Supabase session token to prove identity
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const res = await fetch(`${process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000'}/upload-avatar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: session.access_token,
            base64Image: base64,
            ext: ext
          })
        });

        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to upload image.');
        }

        // Optimistically update the UI AND locally save the new timestamp so the frontend locks them out immediately
        setProfile({ 
          ...profile, 
          avatar: data.avatarUrl,
          last_avatar_change: new Date().toISOString()
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
      }
    } catch (err) {
      Alert.alert(t('settings.uploadError', 'Upload Error'), err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsGuest(false);
    setScreen('Landing');
  };



  const AboutCard = (
    <View style={[s.card, isSmall && { padding: 16 }]}>
      <AppText style={[s.sectionTitle, isSmall && { textAlign: 'center' }]}>
        {t('settings.aboutLegal', 'About & Legal')}
      </AppText>

      <TouchableOpacity
        style={s.aboutRow}
        onPress={() => Linking.openURL('https://www.same-same.fun/privacy')}
        activeOpacity={0.7}
      >
        <AppText style={s.aboutRowIcon}>🔒</AppText>
        <AppText style={s.aboutRowLabel}>{t('settings.privacyPolicy', 'Privacy Policy')}</AppText>
        <AppText style={s.aboutRowChevron}>›</AppText>
      </TouchableOpacity>

      <View style={s.aboutDivider} />

      <TouchableOpacity
        style={s.aboutRow}
        onPress={() => Linking.openURL('mailto:samesamefun@gmail.com')}
        activeOpacity={0.7}
      >
        <AppText style={s.aboutRowIcon}>✉️</AppText>
        <AppText style={s.aboutRowLabel}>{t('settings.contactUs', 'Contact Us')}</AppText>
        <AppText style={s.aboutRowChevron}>›</AppText>
      </TouchableOpacity>

      <View style={s.aboutDivider} />

      <TouchableOpacity
        style={s.aboutRow}
        onPress={() => setCreditsVisible(true)}
        activeOpacity={0.7}
      >
        <AppText style={s.aboutRowIcon}>🎵</AppText>
        <AppText style={s.aboutRowLabel}>{t('settings.audioCredits', 'Audio Credits')}</AppText>
        <AppText style={s.aboutRowChevron}>›</AppText>
      </TouchableOpacity>

      <AppText style={s.aboutVersion}>Same Same? v1.0</AppText>
    </View>
  );

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <Modal visible={creditsVisible} animationType="slide" transparent onRequestClose={() => setCreditsVisible(false)}>
          <View style={s.creditsOverlay}>
            <View style={s.creditsModal}>
              <AppText style={s.creditsTitle}>🎵 Audio Credits</AppText>
              <ScrollView style={{ maxHeight: 260 }}>
                {[
                  { name: 'Ticking Clock', creator: 'schmutz', license: 'CC0', url: 'https://freesound.org/s/366679/' },
                  { name: 'Rejection Buzzer', creator: 'Jacco18', license: 'CC0', url: 'https://freesound.org/s/419023/' },
                  { name: 'Stamp Thump', creator: 'mpuffenbarger', license: 'CC0', url: 'https://freesound.org/s/683031/' },
                  { name: 'Fanfare', creator: 'plasterbrain', license: 'CC0', url: 'https://freesound.org/s/397353/' },
                  { name: 'Card Woosh', creator: 'florianreichelt', license: 'CC0', url: 'https://freesound.org/s/683101/' },
                  { name: 'Match Correct', creator: 'Gronkjaer', license: 'CC0', url: 'https://freesound.org/s/654321/' },
                  { name: 'Score Tally', creator: 'xtrgamr', license: 'CC-BY 4.0', url: 'https://freesound.org/s/253546/' },
                ].map((sound, i) => (
                  <TouchableOpacity key={i} onPress={() => Linking.openURL(sound.url)} style={s.creditRow}>
                    <AppText style={s.creditName}>• {sound.name}</AppText>
                    <AppText style={s.creditDetail}>{sound.creator} · {sound.license}</AppText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={s.creditsClose} onPress={() => setCreditsVisible(false)}>
                <AppText style={s.creditsCloseText}>Close</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <ScrollView contentContainerStyle={[s.container, { padding: isSmall ? theme.spacing.md : theme.spacing.xl }]}>
          <NeoButton style={s.backBtn} onPress={() => setScreen('Home')}>
            <AppText style={s.backBtnText}>{t('settings.backToHome', '← Back')}</AppText>
          </NeoButton>
          <AppText style={s.title}>{t('settings.guestTitle', 'Guest Profile')}</AppText>
          <AppText style={s.desc}>{t('settings.guestDesc', 'Create an account to track stats and unlock frames!')}</AppText>
          <NeoButton style={s.logoutBtn} onPress={handleLogout}>
            <AppText style={s.logoutBtnText}>{t('settings.signOutChangeName', 'Sign Out / Change Name')}</AppText>
          </NeoButton>
          {!isDesktop && AboutCard}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const { level, xp, unlocked_frames, active_frame, username, avatar } = profile;
  
  // Calculate next level XP
  const nextLevelXp = Math.floor(500 * Math.pow(1.10, level - 1));
  const progressPercent = Math.min(100, Math.max(0, (xp / nextLevelXp) * 100));

  const containerPadding = isSmall ? theme.spacing.md : theme.spacing.xl;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Modal visible={creditsVisible} animationType="slide" transparent onRequestClose={() => setCreditsVisible(false)}>
        <View style={s.creditsOverlay}>
          <View style={s.creditsModal}>
            <AppText style={s.creditsTitle}>🎵 Audio Credits</AppText>
            <ScrollView style={{ maxHeight: 260 }}>
              {[
                { name: 'Ticking Clock', creator: 'schmutz', license: 'CC0', url: 'https://freesound.org/s/366679/' },
                { name: 'Rejection Buzzer', creator: 'Jacco18', license: 'CC0', url: 'https://freesound.org/s/419023/' },
                { name: 'Stamp Thump', creator: 'mpuffenbarger', license: 'CC0', url: 'https://freesound.org/s/683031/' },
                { name: 'Fanfare', creator: 'plasterbrain', license: 'CC0', url: 'https://freesound.org/s/397353/' },
                { name: 'Card Woosh', creator: 'florianreichelt', license: 'CC0', url: 'https://freesound.org/s/683101/' },
                { name: 'Match Correct', creator: 'Gronkjaer', license: 'CC0', url: 'https://freesound.org/s/654321/' },
                { name: 'Score Tally', creator: 'xtrgamr', license: 'CC-BY 4.0', url: 'https://freesound.org/s/253546/' },
              ].map((sound, i) => (
                <TouchableOpacity key={i} onPress={() => Linking.openURL(sound.url)} style={s.creditRow}>
                  <AppText style={s.creditName}>• {sound.name}</AppText>
                  <AppText style={s.creditDetail}>{sound.creator} · {sound.license}</AppText>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.creditsClose} onPress={() => setCreditsVisible(false)}>
              <AppText style={s.creditsCloseText}>Close</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <ScrollView contentContainerStyle={[s.container, { padding: containerPadding }]}>
        
        {/* Header */}
        <View style={[s.headerRow, isSmall && { flexDirection: 'column', gap: 16 }]}>
          <View style={isSmall ? { flexDirection: 'row', justifyContent: 'space-between', width: '100%' } : { flexDirection: 'row', alignItems: 'center' }}>
            <NeoButton style={s.backBtn} onPress={() => setScreen('Home')}>
              <AppText style={s.backBtnText}>{t('common.back', '← Back')}</AppText>
            </NeoButton>
            {isSmall && (
              <NeoButton style={s.logoutBtn} onPress={handleLogout}>
                <AppText style={s.logoutBtnText}>{t('common.logout', 'Logout')}</AppText>
              </NeoButton>
            )}
          </View>
          <AppText style={[s.title, isSmall && { fontSize: 28, textAlign: 'center' }]}>{t('settings.title', 'Profile Settings')}</AppText>
          {!isSmall && (
            <NeoButton style={s.logoutBtn} onPress={handleLogout}>
              <AppText style={s.logoutBtnText}>{t('common.logout', 'Logout')}</AppText>
            </NeoButton>
          )}
        </View>

        {/* Identity & Level Progress */}
        <View style={[s.card, isSmall && { padding: 16 }]}>
          <View style={[s.identityRow, isSmall && { flexDirection: 'column', alignItems: 'center' }]}>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <NeoButton onPress={pickImage} style={{ position: 'relative' }}>
                {isUploading ? (
                  <View style={{ width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e5e7eb' }}>
                    <ActivityIndicator size="large" color="#000" />
                  </View>
                ) : (
                  <FramedAvatar url={avatar} fallbackName={username} frame={active_frame || 'none'} size={100} />
                )}
                <View style={{ position: 'absolute', bottom: -5, right: -5, backgroundColor: '#fff', borderRadius: 15, padding: 4, borderWidth: 2, borderColor: '#000' }}>
                  <AppText style={{ fontSize: 14 }}>✏️</AppText>
                </View>
              </NeoButton>
              <AppText style={{ fontSize: 10, color: avatarMessage ? '#EF4444' : '#6B7280', fontFamily: theme.fonts.bodyBold, textAlign: 'center', maxWidth: 100 }}>
                {avatarMessage || t('settings.avatar7Days', 'Once every 7 days')}
              </AppText>
            </View>
            
            <View style={[s.identityInfo, isSmall && { alignItems: 'center' }]}>
              {isEditingName ? (
                <View style={[isSmall && { alignItems: 'center' }]}>
                  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, isSmall && { flexWrap: 'wrap', justifyContent: 'center' }]}>
                    <TextInput
                      style={[s.username, { flex: 1, minWidth: 120, backgroundColor: '#f3f4f6', borderWidth: 2, borderColor: '#000', borderRadius: theme.borderRadius.md, paddingHorizontal: 10, paddingVertical: 4 }]}
                      value={editName}
                      onChangeText={(t) => { setEditName(t); setNameError(''); }}
                      autoFocus
                      maxLength={20}
                      onSubmitEditing={handleSaveName}
                    />
                    <NeoButton onPress={handleSaveName} style={{ backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 8, borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: '#000' }}>
                      <AppText style={{ fontSize: 16, color: '#fff', fontFamily: theme.fonts.headingBold }}>{t('common.save', 'SAVE')}</AppText>
                    </NeoButton>
                    <NeoButton onPress={() => { setIsEditingName(false); setEditName(profile.username); setNameError(''); }} style={{ backgroundColor: '#EF4444', paddingHorizontal: 16, paddingVertical: 8, borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: '#000' }}>
                      <AppText style={{ fontSize: 16, color: '#fff', fontFamily: theme.fonts.headingBold }}>X</AppText>
                    </NeoButton>
                  </View>
                  {nameError ? <AppText style={{ color: '#EF4444', fontFamily: theme.fonts.bodyBold, fontSize: 12, marginTop: 4 }}>{nameError}</AppText> : null}
                </View>
              ) : (
                <NeoButton onPress={() => setIsEditingName(true)} style={[{ flexDirection: 'row', alignItems: 'center' }, isSmall && { justifyContent: 'center', flexWrap: 'wrap' }]}>
                  <AppText style={[s.username, isSmall && { textAlign: 'center' }]}>{username}</AppText>
                  <AppText style={{ fontSize: 16, marginLeft: 8 }}>✏️</AppText>
                </NeoButton>
              )}
              <AppText style={s.levelText}>⭐ {t('common.level', { level })}</AppText>
            </View>
          </View>

          <View style={s.xpBarContainer}>
            <View style={[s.xpBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <AppText style={s.xpText}>{t('settings.xpProgress', { current: Math.floor(xp), next: nextLevelXp })}</AppText>
        </View>

        {/* Frame Selection (Temporarily Disabled)
        <View style={[s.card, isSmall && { padding: 16 }]}>
          <AppText style={[s.sectionTitle, isSmall && { textAlign: 'center' }]}>{t('settings.equipFrame', 'Equip Frame')}</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.frameScroll}>
            {unlocked_frames && unlocked_frames.map(f => (
              <NeoButton key={f} style={s.frameOpt} onPress={() => setFrame(f)}>
                <FramedAvatar fallbackName="?" frame={f} size={64} />
                <AppText style={[s.frameOptText, f === active_frame && s.frameOptTextActive]}>
                  {f.toUpperCase()}
                </AppText>
              </NeoButton>
            ))}
          </ScrollView>
        </View>
        */}

        {/* Progression Timeline (Temporarily Disabled)
        <View style={[s.card, isSmall && { padding: 16 }]}>
          <AppText style={[s.sectionTitle, isSmall && { textAlign: 'center' }]}>{t('settings.progression', 'Progression')}</AppText>
          <AppText style={[s.desc, isSmall && { textAlign: 'center' }]}>{t('settings.progressionDesc', 'Keep playing to earn XP, level up, and unlock new cosmetic frames!')}</AppText>

          <View style={s.timeline}>
            {UNLOCK_THRESHOLDS.map(item => {
              const isUnlocked = level >= item.level;
              return (
                <View key={item.level} style={[s.timelineRow, isUnlocked && s.timelineRowUnlocked, isSmall && { flexDirection: 'column', alignItems: 'center', textAlign: 'center' }]}>
                  <View style={[s.timelineLevel, isUnlocked ? s.timelineLevelUnlocked : null]}>
                    <AppText style={[s.timelineLevelText, isUnlocked ? s.timelineLevelTextUnlocked : null]}>
                      {t('common.levelShort', { level: item.level })}
                    </AppText>
                  </View>
                  <View style={[s.timelineContent, isSmall && { alignItems: 'center' }]}>
                    <AppText style={[s.timelineLabel, isUnlocked && s.timelineLabelUnlocked, isSmall && { textAlign: 'center' }]}>{t(`settings.${item.labelKey}`)}</AppText>
                    {isUnlocked ? (
                      <AppText style={s.timelineStatusUnlocked}>{t('settings.unlocked', 'Unlocked!')}</AppText>
                    ) : (
                      <AppText style={s.timelineStatusLocked}>{t('settings.locked', '🔒 Locked')}</AppText>
                    )}
                  </View>
                  <FramedAvatar fallbackName="?" frame={item.frame} size={isSmall ? 64 : 40} />
                </View>
              );
            })}
          </View>
        </View>
        */}

        {/* About & Legal — mobile only (desktop has footer links) */}
        {!isDesktop && AboutCard}


      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { padding: theme.spacing.xl, maxWidth: 800, width: '100%', alignSelf: 'center', gap: 24, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { padding: 10 },
  backBtnText: { fontFamily: theme.fonts.headingBold, fontSize: 18, color: '#111' },
  title: { fontSize: 32, fontFamily: theme.fonts.headingBold, color: theme.colors.primary, textShadowColor: '#000', textShadowOffset: {width: 2, height: 2}, textShadowRadius: 0 },
  logoutBtn: { backgroundColor: '#EF4444', paddingHorizontal: 16, paddingVertical: 8, borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
  logoutBtnText: { fontFamily: theme.fonts.headingBold, fontSize: 16, color: '#fff' },
  
  card: { backgroundColor: '#fff', borderRadius: theme.borderRadius.lg, borderWidth: 3, borderColor: '#000', padding: 24, shadowColor: '#000', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 20 },
  identityInfo: { flex: 1 },
  username: { fontSize: 28, fontFamily: theme.fonts.headingBold, color: '#111' },
  levelText: { fontSize: 20, fontFamily: theme.fonts.bodyBold, color: theme.colors.primary, marginTop: 4 },
  
  xpBarContainer: { height: 16, backgroundColor: '#E5E7EB', borderRadius: 8, borderWidth: 2, borderColor: '#000', overflow: 'hidden' },
  xpBarFill: { height: '100%', backgroundColor: theme.colors.primary },
  xpText: { textAlign: 'right', marginTop: 6, fontFamily: theme.fonts.bodyBold, fontSize: 14, color: '#6B7280' },

  sectionTitle: { fontSize: 24, fontFamily: theme.fonts.headingBold, color: '#111', marginBottom: 16 },
  desc: { fontFamily: theme.fonts.body, fontSize: 16, color: '#4B5563', marginBottom: 20 },
  
  frameScroll: { gap: 20, paddingBottom: 10 },
  frameOpt: { alignItems: 'center', opacity: 0.9 },
  frameOptText: { marginTop: 8, fontFamily: theme.fonts.bodyBold, fontSize: 14, color: '#6B7280' },
  frameOptTextActive: { color: theme.colors.primary, fontSize: 16 },

  timeline: { gap: 16 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 16, borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: '#D1D5DB', gap: 16 },
  timelineRowUnlocked: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }, // Warm yellow tint for unlocked
  timelineLevel: { backgroundColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 2, borderColor: '#9CA3AF' },
  timelineLevelUnlocked: { backgroundColor: '#10B981', borderColor: '#047857' },
  timelineLevelText: { fontFamily: theme.fonts.headingBold, color: '#4B5563', fontSize: 16 },
  timelineLevelTextUnlocked: { color: '#fff' },
  
  timelineContent: { flex: 1 },
  timelineLabel: { fontFamily: theme.fonts.headingBold, fontSize: 18, color: '#4B5563' },
  timelineLabelUnlocked: { color: '#111' },
  timelineStatusUnlocked: { fontFamily: theme.fonts.bodyBold, color: '#10B981', marginTop: 4 },
  timelineStatusLocked: { fontFamily: theme.fonts.bodyBold, color: '#9CA3AF', marginTop: 4 },

  aboutRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  aboutRowIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  aboutRowLabel: { flex: 1, fontFamily: theme.fonts.bodyBold, fontSize: 16, color: '#111' },
  aboutRowChevron: { fontFamily: theme.fonts.body, fontSize: 22, color: '#9CA3AF' },
  aboutDivider: { height: 1, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  aboutVersion: { marginTop: 16, textAlign: 'center', fontFamily: theme.fonts.body, fontSize: 13, color: '#9CA3AF' },

  creditsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  creditsModal: { backgroundColor: '#FDFBF7', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 3, borderColor: '#000', borderBottomWidth: 0, padding: 24, paddingBottom: 40 },
  creditsTitle: { fontFamily: theme.fonts.headingBold, fontSize: 22, color: '#111', marginBottom: 16 },
  creditRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  creditName: { fontFamily: theme.fonts.bodyBold, fontSize: 15, color: '#111' },
  creditDetail: { fontFamily: theme.fonts.body, fontSize: 13, color: '#6B7280', marginTop: 2 },
  creditsClose: { marginTop: 20, backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 2, borderColor: '#000', paddingVertical: 14, alignItems: 'center' },
  creditsCloseText: { fontFamily: theme.fonts.headingBold, fontSize: 16, color: '#fff' },
});
