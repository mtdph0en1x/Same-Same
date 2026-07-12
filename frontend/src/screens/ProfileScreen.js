import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, Alert, Image } from 'react-native';
import { supabase } from '../supabase';
import { AuthContext } from '../context/AuthContext';
import { theme } from '../styles/theme';
import Button from '../components/Button';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const TITLES = [
  { level: 1, title: 'Rookie' },
  { level: 5, title: 'Amateur' },
  { level: 10, title: 'Pro' },
  { level: 20, title: 'Master' },
  { level: 50, title: 'Legend' },
];

function getPlayerTitle(level) {
  let highest = TITLES[0].title;
  for (let t of TITLES) {
    if (level >= t.level) highest = t.title;
  }
  return highest;
}

export default function ProfileScreen({ setScreen }) {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, games_played, wins, xp, level, avatar')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setProfile(data);
        setEditName(data?.username || '');
      } catch (err) {
        console.error('Error fetching profile:', err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user]);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setScreen('Home');
    }
  }

  async function handleSaveName() {
    if (!editName.trim()) {
      setIsEditing(false);
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: editName.trim() })
        .eq('id', user.id);
      
      if (error) throw error;
      setProfile({ ...profile, username: editName.trim() });
      setIsEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
    } catch (err) {
      Alert.alert('Error updating name', err.message);
    }
  }

  async function pickImage() {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled) {
        setLoading(true);
        const base64 = result.assets[0].base64;
        const uri = result.assets[0].uri;
        // determine extension roughly
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
        
        // Cache bust by appending timestamp
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
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('Home')}>
            <Text style={styles.backBtnText}>← HOME</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Player Profile</Text>
          <View style={{ width: 80 }} />
        </View>

        <View style={styles.card}>
          <TouchableOpacity onPress={pickImage} style={styles.avatar}>
            {profile?.avatar && profile.avatar.startsWith('http') ? (
              <Image source={{ uri: profile.avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {profile?.username ? profile.username.charAt(0).toUpperCase() : '?'}
              </Text>
            )}
            <View style={styles.editBadge}><Text style={styles.editBadgeText}>✏️</Text></View>
          </TouchableOpacity>
          
          {isEditing ? (
            <View style={styles.editRow}>
              <TextInput 
                style={styles.nameInput} 
                value={editName} 
                onChangeText={setEditName} 
                autoFocus 
                maxLength={20}
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveName}>
                <Text style={styles.saveBtnText}>SAVE</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Text style={styles.username}>{profile?.username || 'Unknown Player'} ✏️</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.playerTitle}>{getPlayerTitle(profile?.level || 1)}</Text>

          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{profile?.games_played || 0}</Text>
            <Text style={styles.statLabel}>GAMES PLAYED</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{profile?.wins || 0}</Text>
            <Text style={styles.statLabel}>VICTORIES</Text>
          </View>
        </View>

        <View style={styles.statBoxFull}>
            <Text style={styles.statValue}>
              {profile?.games_played > 0 
                ? Math.round((profile.wins / profile.games_played) * 100) 
                : 0}%
            </Text>
            <Text style={styles.statLabel}>WIN RATE</Text>
        </View>

        <View style={styles.xpContainer}>
          <View style={styles.xpHeader}>
            <Text style={styles.levelText}>⭐ Level {profile?.level || 1}</Text>
            <Text style={styles.xpText}>
              {profile?.xp || 0} / {Math.floor(500 * Math.pow(1.10, (profile?.level || 1) - 1))} XP
            </Text>
          </View>
          <View style={styles.xpBarTrack}>
            <View 
              style={[
                styles.xpBarFill, 
                { width: `${Math.min(100, Math.max(0, ((profile?.xp || 0) / Math.floor(500 * Math.pow(1.10, (profile?.level || 1) - 1))) * 100))}%` }
              ]} 
            />
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <Button title="LOGOUT" onPress={handleLogout} type="secondary" />
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    padding: theme.spacing.xl,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
  },
  backBtn: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: '#fff',
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  backBtnText: {
    fontFamily: theme.fonts.headingBold,
    color: theme.colors.primary,
    fontSize: 16,
  },
  headerTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 24,
    color: theme.colors.primary,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.border,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 2,
    marginBottom: theme.spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  avatarText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 40,
    color: theme.colors.onSecondary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  username: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 28,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.xs,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  nameInput: {
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    fontFamily: theme.fonts.headingBold,
    fontSize: 24,
    color: theme.colors.foreground,
    minWidth: 150,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    borderBottomWidth: 3,
    borderBottomColor: '#BE123C',
  },
  saveBtnText: {
    fontFamily: theme.fonts.headingBold,
    color: '#fff',
    fontSize: 16,
  },
  email: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    color: theme.colors.muted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  statBoxFull: {
    backgroundColor: '#fff',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  statValue: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 36,
    color: theme.colors.accent,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.muted,
    letterSpacing: 1.5,
  },
  xpContainer: {
    backgroundColor: '#fff',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.md,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: theme.spacing.sm,
  },
  levelText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 22,
    color: '#D97706', // Golden
  },
  xpText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.muted,
  },
  xpBarTrack: {
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B', // Bright golden
    borderRadius: 6,
  },
  playerTitle: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 16,
    color: '#D97706',
    marginBottom: theme.spacing.md,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  editBadgeText: {
    fontSize: 12,
  },
});
