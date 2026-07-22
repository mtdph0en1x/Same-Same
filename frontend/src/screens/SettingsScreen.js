import React, { useEffect, useState, useContext } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, TextInput, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as Haptics from 'expo-haptics';
import { supabase } from '../supabase';
import { AuthContext } from '../context/AuthContext';
import { theme } from '../styles/theme';
import FramedAvatar from '../components/FramedAvatar';

const UNLOCK_THRESHOLDS = [
  { level: 5, frame: 'bronze', label: 'Bronze Frame' },
  { level: 10, frame: 'silver', label: 'Silver Frame' },
  { level: 20, frame: 'gold', label: 'Gold Frame' },
  { level: 35, frame: 'neon', label: 'Neon Frame' },
  { level: 50, frame: 'glitch', label: 'Glitch Frame' }
];

export default function SettingsScreen({ setScreen, setIsGuest }) {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

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
    if (!editName.trim() || editName.trim() === profile.username) {
      setIsEditingName(false);
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: editName.trim() })
        .eq('id', user.id);
      
      if (error) throw error;
      setProfile({ ...profile, username: editName.trim() });
      setIsEditingName(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
    } catch (err) {
      Alert.alert('Error updating name', err.message);
    }
  };

  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled) {
        setIsUploading(true);
        const base64 = result.assets[0].base64;
        const uri = result.assets[0].uri;
        const extMatch = uri.match(/\.([a-zA-Z]+)$/);
        const ext = extMatch ? extMatch[1] : 'jpeg';
        const filePath = `${user.id}/avatar.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, decode(base64), {
            contentType: `image/${ext}`,
            upsert: true
          });
        
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        
        const avatarUrl = publicUrlData.publicUrl + '?t=' + Date.now();

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar: avatarUrl })
          .eq('id', user.id);
        
        if (updateError) throw updateError;

        setProfile({ ...profile, avatar: avatarUrl });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
      }
    } catch (err) {
      Alert.alert('Upload Error', err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsGuest(false);
    setScreen('Landing');
  };

  const setFrame = async (f) => {
    if (!profile) return;
    setProfile({ ...profile, active_frame: f });
    await supabase.from('profiles').update({ active_frame: f }).eq('id', user.id);
  };

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={s.container}>
        <Text style={s.title}>Guest Profile</Text>
        <Text style={s.desc}>Create an account to track stats and unlock frames!</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => setScreen('Home')}>
          <Text style={s.backBtnText}>Back to Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutBtnText}>Sign Out / Change Name</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { level, xp, unlocked_frames, active_frame, username, avatar } = profile;
  
  // Calculate next level XP
  const nextLevelXp = Math.floor(500 * Math.pow(1.10, level - 1));
  const progressPercent = Math.min(100, Math.max(0, (xp / nextLevelXp) * 100));

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.container}>
        
        {/* Header */}
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => setScreen('Home')}>
            <Text style={s.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>Profile Settings</Text>
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
            <Text style={s.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Identity & Level Progress */}
        <View style={s.card}>
          <View style={s.identityRow}>
            <TouchableOpacity onPress={pickImage} style={{ position: 'relative' }}>
              {isUploading ? (
                <View style={{ width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e5e7eb' }}>
                  <ActivityIndicator size="large" color="#000" />
                </View>
              ) : (
                <FramedAvatar url={avatar} fallbackName={username} frame={active_frame || 'none'} size={100} />
              )}
              <View style={{ position: 'absolute', bottom: -5, right: -5, backgroundColor: '#fff', borderRadius: 15, padding: 4, borderWidth: 2, borderColor: '#000' }}>
                <Text style={{ fontSize: 14 }}>✏️</Text>
              </View>
            </TouchableOpacity>
            
            <View style={s.identityInfo}>
              {isEditingName ? (
                <TextInput
                  style={[s.username, { backgroundColor: '#f3f4f6', borderWidth: 2, borderColor: '#000', borderRadius: theme.borderRadius.md, paddingHorizontal: 10, paddingVertical: 4 }]}
                  value={editName}
                  onChangeText={setEditName}
                  autoFocus
                  maxLength={20}
                  onBlur={handleSaveName}
                  onSubmitEditing={handleSaveName}
                />
              ) : (
                <TouchableOpacity onPress={() => setIsEditingName(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={s.username}>{username}</Text>
                  <Text style={{ fontSize: 16, marginLeft: 8 }}>✏️</Text>
                </TouchableOpacity>
              )}
              <Text style={s.levelText}>⭐ Level {level}</Text>
            </View>
          </View>

          <View style={s.xpBarContainer}>
            <View style={[s.xpBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={s.xpText}>{Math.floor(xp)} / {nextLevelXp} XP</Text>
        </View>

        {/* Frame Selection */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Equip Frame</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.frameScroll}>
            {unlocked_frames && unlocked_frames.map(f => (
              <TouchableOpacity key={f} style={s.frameOpt} onPress={() => setFrame(f)}>
                <FramedAvatar fallbackName="?" frame={f} size={64} />
                <Text style={[s.frameOptText, f === active_frame && s.frameOptTextActive]}>
                  {f.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Progression Timeline */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Progression</Text>
          <Text style={s.desc}>Keep playing to earn XP, level up, and unlock new cosmetic frames!</Text>

          <View style={s.timeline}>
            {UNLOCK_THRESHOLDS.map(item => {
              const isUnlocked = level >= item.level;
              return (
                <View key={item.level} style={[s.timelineRow, isUnlocked && s.timelineRowUnlocked]}>
                  <View style={[s.timelineLevel, isUnlocked ? s.timelineLevelUnlocked : null]}>
                    <Text style={[s.timelineLevelText, isUnlocked ? s.timelineLevelTextUnlocked : null]}>
                      Lvl {item.level}
                    </Text>
                  </View>
                  <View style={s.timelineContent}>
                    <Text style={[s.timelineLabel, isUnlocked && s.timelineLabelUnlocked]}>{item.label}</Text>
                    {isUnlocked ? (
                      <Text style={s.timelineStatusUnlocked}>Unlocked!</Text>
                    ) : (
                      <Text style={s.timelineStatusLocked}>🔒 Locked</Text>
                    )}
                  </View>
                  <FramedAvatar fallbackName="?" frame={item.frame} size={40} />
                </View>
              );
            })}
          </View>
        </View>

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
});
