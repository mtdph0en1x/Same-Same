import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { socket } from '../socket';
import { theme } from '../styles/theme';

export default function HomeScreen({ setScreen, setRoomCode, setPlayerData, setIsHost, setLobbyIntent }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const handleFindMatch = () => {
    if (!name) return alert('Enter a name!');
    setPlayerData({ name });
    setLobbyIntent('matchmaking');
    setScreen('Lobby');
  };

  const handleHostCouch = () => {
    if (!name) return alert('Enter a name!');
    setPlayerData({ name });
    setIsHost(true);
    setLobbyIntent('host_couch');
    setScreen('Lobby');
  };

  const handleJoinCouch = () => {
    if (!name || !code) return alert('Enter a name and code!');
    setPlayerData({ name });
    setRoomCode(code.toUpperCase());
    setIsHost(false);
    setLobbyIntent('join_couch');
    setScreen('Lobby');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Same Same?</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          placeholderTextColor={theme.colors.muted}
          value={name}
          onChangeText={setName}
        />

        <TouchableOpacity style={styles.buttonPrimary} activeOpacity={0.8} onPress={handleFindMatch}>
          <Text style={styles.buttonText}>Find Online Match</Text>
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity style={styles.buttonSecondary} activeOpacity={0.8} onPress={handleHostCouch}>
          <Text style={styles.buttonText}>Host Couch Game</Text>
        </TouchableOpacity>

        <View style={styles.joinRow}>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="CODE"
            placeholderTextColor={theme.colors.muted}
            value={code}
            onChangeText={setCode}
            maxLength={4}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={[styles.buttonSecondary, styles.joinButton]} activeOpacity={0.8} onPress={handleJoinCouch}>
            <Text style={styles.buttonText}>Join</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderBottomWidth: 6,
    borderBottomColor: '#BE123C', // Darker shade of primary for tactile 3D effect
  },
  buttonSecondary: {
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderBottomWidth: 6,
    borderBottomColor: '#1D4ED8', // Darker shade of accent
  },
  joinButton: {
    flex: 1,
  },
  buttonText: {
    color: theme.colors.onPrimary,
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    letterSpacing: 1,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.xl,
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
  joinRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  codeInput: {
    flex: 1,
    marginBottom: 0,
    textAlign: 'center',
    textTransform: 'uppercase',
  }
});
