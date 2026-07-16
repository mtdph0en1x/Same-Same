import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { socket } from '../socket';
import { theme } from '../styles/theme';

const STICKERS = [
  { id: 'laugh', emoji: '😂' },
  { id: 'angry', emoji: '😡' },
  { id: 'facepalm', emoji: '🤦‍♂️' },
  { id: 'mindblown', emoji: '🤯' },
  { id: 'skull', emoji: '💀' },
];

const FloatingReaction = ({ reaction, onComplete }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -500, duration: 2000, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 2000, useNativeDriver: true })
    ]).start(() => onComplete(reaction.instanceId));
  }, []);

  return (
    <Animated.View style={[
      styles.floatingReaction,
      {
        left: reaction.xOffset * 80 + 10 + '%',
        transform: [{ translateY }],
        opacity
      }
    ]}>
      <Text style={{ fontSize: 60 }}>{reaction.emoji}</Text>
      <Text style={styles.reactionSender}>{reaction.senderName}</Text>
    </Animated.View>
  );
};

export default function ChatSidebar({ roomCode, playerData, isSidebarOpen, setIsSidebarOpen, isDesktop = true }) {
  const [reactions, setReactions] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [latestMessage, setLatestMessage] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!roomCode) return;

    const handleReaction = ({ reactionId, senderName, xOffset }) => {
      const sticker = STICKERS.find(s => s.id === reactionId);
      if (!sticker) return;
      
      setReactions(prev => [...prev, {
        instanceId: Math.random().toString(),
        emoji: sticker.emoji,
        senderName,
        xOffset
      }]);
    };

    const handleChat = ({ message, senderName, timestamp }) => {
      setChatMessages(prev => [...prev, { message, senderName, timestamp }].slice(-20)); // Keep last 20 messages
      setLatestMessage({ message, senderName });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setLatestMessage(null), 4000);
    };

    socket.on('reaction_received', handleReaction);
    socket.on('chat_received', handleChat);

    return () => {
      socket.off('reaction_received', handleReaction);
      socket.off('chat_received', handleChat);
    };
  }, [roomCode]);

  const sendReaction = (reactionId) => {
    socket.emit('send_reaction', { roomId: roomCode, reactionId, senderName: playerData.name });
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    socket.emit('send_chat', { roomId: roomCode, message: chatInput.trim(), senderName: playerData.name });
    setChatInput('');
  };

  const removeReaction = (instanceId) => {
    setReactions(prev => prev.filter(r => r.instanceId !== instanceId));
  };

  return (
    <>
      {/* Floating Reactions Layer (covers the whole appWindow) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {reactions.map(r => (
          <FloatingReaction key={r.instanceId} reaction={r} onComplete={removeReaction} />
        ))}
      </View>

      {isDesktop ? (
        <>
          <TouchableOpacity 
            style={[styles.toggleBtn, isSidebarOpen ? styles.toggleBtnOpen : styles.toggleBtnClosed]}
            onPress={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Text style={styles.toggleBtnText}>{isSidebarOpen ? '▶' : '◀'}</Text>
          </TouchableOpacity>

          {isSidebarOpen && (
            <View style={styles.sidebar}>
              <View style={styles.chatHistory}>
                {chatMessages.map((msg, i) => (
                  <Text key={i} style={styles.chatMessage}>
                    <Text style={{fontWeight: 'bold'}}>{msg.senderName}: </Text>
                    {msg.message}
                  </Text>
                ))}
              </View>

              <View style={styles.sidebarBottom}>
                <View style={styles.reactionBar}>
                  {STICKERS.map(s => (
                    <TouchableOpacity key={s.id} onPress={() => sendReaction(s.id)} style={styles.reactionBtn}>
                      <Text style={{fontSize: 24}}>{s.emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.chatInputRow}>
                  <TextInput 
                    style={styles.chatInput}
                    placeholder="Chat..."
                    value={chatInput}
                    onChangeText={setChatInput}
                    onSubmitEditing={sendChat}
                    placeholderTextColor={theme.colors.muted}
                  />
                  <TouchableOpacity style={styles.sendChatBtn} onPress={sendChat}>
                    <Text style={styles.sendChatBtnText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </>
      ) : (
        <View style={styles.sidebarMobileContainer}>
          {!isSidebarOpen && latestMessage && (
            <View style={styles.latestMessagePreview}>
              <Text style={styles.latestMessageText} numberOfLines={1}>
                <Text style={{fontWeight: 'bold'}}>{latestMessage.senderName}: </Text>{latestMessage.message}
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={styles.mobileToggleBar} 
            onPress={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Text style={{fontFamily: theme.fonts.bodyBold}}>
               {isSidebarOpen ? '▼ Hide Chat & Emojis' : '▲ Show Chat & Emojis'}
            </Text>
          </TouchableOpacity>

          {isSidebarOpen && (
            <View style={styles.sidebarMobile}>
              <View style={styles.chatHistoryMobile}>
                <ScrollView contentContainerStyle={{ gap: 8, flexGrow: 1, justifyContent: 'flex-end' }} showsVerticalScrollIndicator={false}>
                  {chatMessages.map((msg, i) => (
                    <Text key={i} style={styles.chatMessage}>
                      <Text style={{fontWeight: 'bold'}}>{msg.senderName}: </Text>
                      {msg.message}
                    </Text>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.sidebarBottomMobile}>
                <View style={styles.reactionBar}>
                  {STICKERS.map(s => (
                    <TouchableOpacity key={s.id} onPress={() => sendReaction(s.id)} style={styles.reactionBtn}>
                      <Text style={{fontSize: 24}}>{s.emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.chatInputRow}>
                  <TextInput 
                    style={styles.chatInput}
                    placeholder="Chat..."
                    value={chatInput}
                    onChangeText={setChatInput}
                    onSubmitEditing={sendChat}
                    placeholderTextColor={theme.colors.muted}
                  />
                  <TouchableOpacity style={styles.sendChatBtn} onPress={sendChat}>
                    <Text style={styles.sendChatBtnText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  floatingReaction: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100
  },
  reactionSender: {
    fontSize: 12, backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', paddingHorizontal: 6, borderRadius: 10,
    overflow: 'hidden', marginTop: 4, fontWeight: 'bold'
  },
  sidebar: {
    width: 320,
    height: '100%',
    backgroundColor: '#FDFBF7',
    borderLeftWidth: 3,
    borderColor: '#000',
    flexDirection: 'column',
  },
  chatHistory: {
    flex: 1,
    padding: theme.spacing.md,
    justifyContent: 'flex-end',
    gap: 8,
  },
  chatMessage: {
    fontSize: 14, fontFamily: theme.fonts.body, color: '#333',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  sidebarBottom: {
    padding: theme.spacing.md,
    borderTopWidth: 3,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  reactionBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 8, borderRadius: 30, marginBottom: 10,
    borderWidth: 2, borderColor: 'transparent',
  },
  reactionBtn: {
    padding: 4
  },
  chatInputRow: {
    flexDirection: 'row', gap: 8
  },
  chatInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: theme.borderRadius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: theme.fonts.body, borderWidth: 2, borderColor: '#000', color: '#000'
  },
  sendChatBtn: {
    backgroundColor: theme.colors.accent, paddingHorizontal: 16, justifyContent: 'center', borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: '#000',
    shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0
  },
  sendChatBtnText: { color: '#000', fontFamily: theme.fonts.bodyBold },
  toggleBtn: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -25 }],
    width: 30,
    height: 50,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  toggleBtnOpen: {
    right: 320,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  toggleBtnClosed: {
    right: 0,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  toggleBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sidebarMobileContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderTopWidth: 3,
    borderColor: '#000',
    position: 'relative',
  },
  mobileToggleBar: {
    width: '100%',
    padding: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderColor: '#000',
  },
  latestMessagePreview: {
    position: 'absolute',
    top: -50,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    zIndex: 200,
  },
  latestMessageText: {
    color: '#fff',
    fontFamily: theme.fonts.body,
    fontSize: 14,
  },
  sidebarMobile: {
    height: 300,
    backgroundColor: '#FDFBF7',
  },
  chatHistoryMobile: {
    flex: 1,
    padding: 10,
    justifyContent: 'flex-end',
  },
  sidebarBottomMobile: {
    padding: 10,
    borderTopWidth: 3,
    borderColor: '#000',
    backgroundColor: '#fff',
  }
});
