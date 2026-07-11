import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';
import { socket } from '../socket';

export default function HomeScreen({ setScreen, setRoomCode, setPlayerData, setIsHost }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const handleFindMatch = () => {
    if (!name) return alert('Enter a name!');
    setPlayerData({ name });
    socket.connect();
    socket.emit('join_matchmaking', { name });
    setScreen('Lobby');
  };

  const handleHostCouch = () => {
    if (!name) return alert('Enter a name!');
    setPlayerData({ name });
    setIsHost(true);
    socket.connect();
    socket.emit('create_room', { name });
    setScreen('Lobby');
  };

  const handleJoinCouch = () => {
    if (!name || !code) return alert('Enter a name and code!');
    setPlayerData({ name });
    setRoomCode(code.toUpperCase());
    setIsHost(false);
    socket.connect();
    socket.emit('join_room', { roomCode: code.toUpperCase(), playerData: { name } });
    setScreen('Lobby');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Same Same?</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        value={name}
        onChangeText={setName}
      />

      <TouchableOpacity style={styles.buttonPrimary} onPress={handleFindMatch}>
        <Text style={styles.buttonText}>Find Online Match</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.buttonSecondary} onPress={handleHostCouch}>
        <Text style={styles.buttonText}>Host Couch Game</Text>
      </TouchableOpacity>

      <View style={styles.joinRow}>
        <TextInput
          style={[styles.input, styles.codeInput]}
          placeholder="CODE"
          value={code}
          onChangeText={setCode}
          maxLength={4}
          autoCapitalize="characters"
        />
        <TouchableOpacity style={styles.buttonSecondary} onPress={handleJoinCouch}>
          <Text style={styles.buttonText}>Join</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#1E1E2C',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    backgroundColor: '#2D2D44',
    color: '#FFF',
    padding: 15,
    borderRadius: 10,
    fontSize: 18,
    marginBottom: 20,
  },
  buttonPrimary: {
    backgroundColor: '#4ECDC4',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#FF6B6B',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#444',
    marginVertical: 30,
  },
  joinRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  codeInput: {
    flex: 1,
    marginBottom: 0,
    textAlign: 'center',
  }
});
