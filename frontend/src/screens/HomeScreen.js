import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, Platform, Modal } from 'react-native';
import { theme } from '../styles/theme';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../supabase';
import Button from '../components/Button';

export default function HomeScreen({ setScreen, setRoomCode, setPlayerData, setIsHost, setLobbyIntent }) {
  const { user } = useContext(AuthContext);
  const isWebProd = Platform.OS === 'web' && !__DEV__;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [profileData, setProfileData] = useState(null);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [mmModalVisible, setMmModalVisible] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('username, avatar').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) setProfileData(data);
        });
    }
  }, [user]);

  const getDisplayName = () => {
    if (name.trim()) return name.trim();
    if (profileData?.username) return profileData.username;
    if (user && user.email) return user.email.split('@')[0];
    return null;
  };

  const handleOpenMmModal = () => {
    const displayName = getDisplayName();
    if (!displayName) return alert('Enter a name!');
    setMmModalVisible(true);
  };

  const handleFindMatch = (mode) => {
    setMmModalVisible(false);
    const displayName = getDisplayName();
    setPlayerData({ name: displayName, avatar: profileData?.avatar || 'alien', mode });
    setLobbyIntent('matchmaking');
    setScreen('Lobby');
  };

  const handleHostCouch = () => {
    const displayName = getDisplayName();
    if (!displayName) return alert('Enter a name!');
    setPlayerData({ name: displayName, avatar: profileData?.avatar || 'alien' });
    setIsHost(true);
    setLobbyIntent('host_couch');
    setScreen('Lobby');
  };

  const handleJoinCouch = () => {
    const displayName = getDisplayName();
    if (!displayName || !code || code.length < 4) return alert('Enter a valid 4-letter code!');
    setJoinModalVisible(false);
    setPlayerData({ name: displayName, avatar: profileData?.avatar || 'alien' });
    setRoomCode(code.toUpperCase());
    setIsHost(false);
    setLobbyIntent('join_couch');
    setScreen('Lobby');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerAuth}>
          {user ? (
            <TouchableOpacity onPress={() => setScreen('Profile')} style={styles.authBtn}>
              <Text style={styles.authBtnText}>👤 Profile</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setScreen('Auth')} style={styles.authBtn}>
              <Text style={styles.authBtnText}>Login / Sign Up</Text>
            </TouchableOpacity>
          )}
        </View>
      <View style={styles.container}>
        <Text style={styles.title}>Same Same?</Text>
        
        <TextInput
          style={styles.input}
          placeholder={profileData?.username || (user ? user.email.split('@')[0] : "Enter your name")}
          placeholderTextColor={theme.colors.muted}
          value={name}
          onChangeText={setName}
        />

        <Button title="Find Online Match" onPress={handleOpenMmModal} type="primary" style={styles.mainBtn} />

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.divider} />
        </View>

        <Button title="Host Couch Game" onPress={handleHostCouch} type="secondary" style={styles.mainBtn} />
        <Button title="Join Couch Game" onPress={() => setJoinModalVisible(true)} type="secondary" style={styles.mainBtn} />

      </View>

      <Modal
        visible={joinModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setJoinModalVisible(false)}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Join Game</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="ENTER 4-LETTER CODE"
              placeholderTextColor={theme.colors.muted}
              value={code}
              onChangeText={setCode}
              maxLength={4}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            
            <Button title="Join Room" onPress={handleJoinCouch} type="primary" />
          </View>
        </View>
      </Modal>

      <Modal
        visible={mmModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setMmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setMmModalVisible(false)}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Select Mode</Text>
            
            <Text style={styles.mmSectionTitle}>Teams</Text>
            <View style={styles.mmRow}>
              <TouchableOpacity style={styles.mmBtn} onPress={() => handleFindMatch('team2v2')}>
                <Text style={styles.mmBtnText}>🤝 2v2</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mmBtn} onPress={() => handleFindMatch('team4v4')}>
                <Text style={styles.mmBtnText}>🛡️ 4v4</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.mmSectionTitle}>Solo</Text>
            <View style={styles.mmRow}>
              <TouchableOpacity style={styles.mmBtn} onPress={() => handleFindMatch('duel')}>
                <Text style={styles.mmBtnText}>⚔️ 1v1</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mmBtn} onPress={() => handleFindMatch('solo4')}>
                <Text style={styles.mmBtnText}>🏃 4p</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.mmRow}>
              <TouchableOpacity style={styles.mmBtn} onPress={() => handleFindMatch('solo6')}>
                <Text style={styles.mmBtnText}>🏃 6p</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mmBtn} onPress={() => handleFindMatch('solo8')}>
                <Text style={styles.mmBtnText}>🏃 8p</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 56,
    fontFamily: theme.fonts.headingBold,
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.xxl,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  input: {
    backgroundColor: '#FFFFFF',
    color: theme.colors.foreground,
    fontFamily: theme.fonts.bodyBold,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    fontSize: 20,
    marginBottom: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.border,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 2,
    textAlign: 'center',
  },
  mainBtn: {
    marginBottom: theme.spacing.lg,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  divider: {
    flex: 1,
    height: 2,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.foreground,
    marginHorizontal: theme.spacing.md,
    fontSize: 16,
  },
  headerAuth: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
  },
  authBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  authBtnText: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.primary,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingBottom: 40,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: theme.colors.border,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: theme.spacing.sm,
  },
  closeBtnText: {
    fontSize: 24,
    color: theme.colors.muted,
    fontFamily: theme.fonts.headingBold,
  },
  modalTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 32,
    color: theme.colors.primary,
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
    color: theme.colors.foreground,
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
    borderBottomWidth: 4,
    borderBottomColor: '#2563EB', // A slightly darker blue could be used here
  },
  mmBtnText: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.onSecondary,
    fontSize: 18,
  }
});
