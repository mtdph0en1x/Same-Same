import React, { useState } from 'react';
import { StyleSheet, View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { theme } from '../styles/theme';
import { supabase } from '../supabase';

export default function ReportModal({ visible, onClose, initialType = 'bug', reportedPlayer = null, reporterId = null }) {
  const [type, setType] = useState(initialType); // 'bug' or 'player'
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setType(initialType);
      setMessage('');
      setLoading(false);
    }
  }, [visible, initialType]);

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message before submitting.');
      return;
    }

    setLoading(true);
    
    // Format message if reporting player
    const fullMessage = type === 'player' && reportedPlayer 
      ? `REPORTING PLAYER: ${reportedPlayer.name} (${reportedPlayer.id})\n\nReason: ${message}`
      : message;

    try {
      const { error } = await supabase.from('reports').insert([
        {
          reporter_id: reporterId,
          message: fullMessage,
          status: 'pending'
        }
      ]);

      if (error) throw error;

      Alert.alert('Success', 'Thank you! Your report has been submitted.');
      onClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>
            {type === 'player' ? 'Report Player' : 'Report Issue'}
          </Text>
          
          {type === 'player' && reportedPlayer && (
            <Text style={styles.subtitle}>
              Reporting: <Text style={{ fontFamily: 'Nunito_700Bold' }}>{reportedPlayer.name}</Text>
            </Text>
          )}

          <Text style={styles.label}>
            {type === 'player' ? 'Reason for reporting:' : 'Describe the issue or feedback:'}
          </Text>
          
          <TextInput
            style={styles.input}
            multiline
            numberOfLines={4}
            placeholder={type === 'player' ? "Inappropriate username, offensive avatar..." : "The AI rejected my valid word..."}
            placeholderTextColor="#888"
            value={message}
            onChangeText={setMessage}
            editable={!loading}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.submitButton]} 
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.submitText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 450,
    backgroundColor: '#FDFBF7',
    padding: 24,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#000',
  },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 24,
    marginBottom: 12,
    color: '#000',
  },
  subtitle: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 16,
    marginBottom: 16,
    color: '#ef4444',
  },
  label: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    padding: 12,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
  },
  buttonText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#000',
  },
  submitText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    color: '#000',
  },
});
