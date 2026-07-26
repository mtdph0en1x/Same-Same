import React, { useState, useEffect, useRef } from 'react';
import AppText from './AppText';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Animated, ScrollView, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { socket } from '../socket';
import { supabase } from '../supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StickerLockerModal from './StickerLockerModal';
import { theme } from '../styles/theme';

const STICKERS = [
  { id: 'laugh', emoji: '😂' },
  { id: 'angry', emoji: '😡' },
  { id: 'facepalm', emoji: '🤦‍♂️' },
  { id: 'mindblown', emoji: '🤯' },
  { id: 'skull', emoji: '💀' },
  { id: 'crow', url: 'https://placehold.co/120x80.png?text=Meme', width: 120, height: 80 },
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
      {reaction.url ? (
        <Image source={{ uri: reaction.url }} style={{ width: reaction.width || 60, height: reaction.height || 60, resizeMode: 'contain' }} />
      ) : (
        <AppText style={{ fontSize: 60 }}>{reaction.emoji}</AppText>
      )}
      <AppText style={styles.reactionSender}>{reaction.senderName}</AppText>
    </Animated.View>
  );
};

export default function ChatSidebar({ roomCode, playerData, isSidebarOpen, setIsSidebarOpen, isDesktop = true }) {
  const { t } = useTranslation();
  const [reactions, setReactions] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [latestMessage, setLatestMessage] = useState(null);
  const [activeStickers, setActiveStickers] = useState(STICKERS);
  const [savedLoadout, setSavedLoadout] = useState([]);
  const [lockerVisible, setLockerVisible] = useState(false);
  const [isMobileReactionsOpen, setIsMobileReactionsOpen] = useState(false);
  const activeStickersRef = useRef(STICKERS);
  const timeoutRef = useRef(null);

  useEffect(() => {
    async function fetchStickers() {
      try {
        const { data, error } = await supabase
          .from('stickers')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        
        let initialLoadout = [];
        try {
          const stored = await AsyncStorage.getItem('@same_same_sticker_loadout');
          if (stored) {
            initialLoadout = JSON.parse(stored);
          }
        } catch(e) { console.log(e); }

        if (data && data.length > 0) {
          setActiveStickers(data);
          
          if (initialLoadout.length === 0) {
             initialLoadout = data.slice(0, 5).map(s => s.id);
          }
          setSavedLoadout(initialLoadout);
          activeStickersRef.current = data;
        }
      } catch (e) {
        console.log('Failed to fetch dynamic stickers, falling back to default.');
      }
    }
    fetchStickers();
  }, []);

  useEffect(() => {
    if (!roomCode) return;

    const handleReaction = ({ reactionId, senderName, xOffset }) => {
      const sticker = activeStickersRef.current.find(s => s.id === reactionId);
      if (!sticker) return;
      
      setReactions(prev => [...prev, {
        instanceId: Math.random().toString(),
        emoji: sticker.emoji,
        url: sticker.url,
        width: sticker.width,
        height: sticker.height,
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

  const saveLocker = async (newLoadout) => {
    setSavedLoadout(newLoadout);
    try {
      await AsyncStorage.setItem('@same_same_sticker_loadout', JSON.stringify(newLoadout));
    } catch(e) { console.log(e); }
  };

  const hotbarStickers = activeStickers.filter(s => savedLoadout.includes(s.id));

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
            <AppText style={styles.toggleBtnText}>{isSidebarOpen ? '▶' : '◀'}</AppText>
          </TouchableOpacity>

          {isSidebarOpen && (
            <View style={styles.sidebar}>
              <View style={styles.chatHistory}>
                {chatMessages.map((msg, i) => (
                  <AppText key={i} style={styles.chatMessage}>
                    <AppText style={{fontWeight: 'bold'}}>{msg.senderName}: </AppText>
                    {msg.message}
                  </AppText>
                ))}
              </View>

              <View style={styles.sidebarBottom}>
                <View style={styles.reactionBar}>
                  {hotbarStickers.map(s => (
                    <TouchableOpacity key={s.id} onPress={() => sendReaction(s.id)} style={styles.reactionBtn}>
                      {s.url ? (
                        <Image source={{ uri: s.url }} style={{ width: s.width ? (s.width/s.height)*24 : 24, height: 24, resizeMode: 'contain' }} />
                      ) : (
                        <AppText style={{fontSize: 24}}>{s.emoji}</AppText>
                      )}
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={() => setLockerVisible(true)} style={[styles.reactionBtn, {marginLeft: 8, justifyContent: 'center'}]}>
                    <AppText style={{fontSize: 20}}>⚙️</AppText>
                  </TouchableOpacity>
                </View>

                <View style={styles.chatInputRow}>
                  <TextInput 
                    style={styles.chatInput}
                    placeholder={t('chat.chatPlaceholder', 'Chat...')}
                    value={chatInput}
                    onChangeText={setChatInput}
                    onSubmitEditing={sendChat}
                    placeholderTextColor={theme.colors.muted}
                  />
                  <TouchableOpacity style={styles.sendChatBtn} onPress={sendChat}>
                    <AppText style={styles.sendChatBtnText}>{t('chat.send', 'Send')}</AppText>
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
              <AppText style={styles.latestMessageText} numberOfLines={1}>
                <AppText style={{fontWeight: 'bold'}}>{latestMessage.senderName}: </AppText>{latestMessage.message}
              </AppText>
            </View>
          )}

          <TouchableOpacity 
            style={styles.mobileToggleBar} 
            onPress={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <AppText style={{fontFamily: theme.fonts.bodyBold}}>
               {isSidebarOpen ? t('chat.hideChat', '▼ Hide Chat') : t('chat.showChat', '▲ Show Chat')}
            </AppText>
          </TouchableOpacity>

          {isSidebarOpen && (
            <View style={styles.sidebarMobile}>
              <View style={styles.chatHistoryMobile}>
                <ScrollView contentContainerStyle={{ gap: 8, flexGrow: 1, justifyContent: 'flex-end' }} showsVerticalScrollIndicator={false}>
                  {chatMessages.map((msg, i) => (
                    <AppText key={i} style={styles.chatMessage}>
                      <AppText style={{fontWeight: 'bold'}}>{msg.senderName}: </AppText>
                      {msg.message}
                    </AppText>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.sidebarBottomMobile}>

                <View style={styles.chatInputRow}>
                  <TextInput 
                    style={styles.chatInput}
                    placeholder={t('chat.chatPlaceholder', 'Chat...')}
                    value={chatInput}
                    onChangeText={setChatInput}
                    onSubmitEditing={sendChat}
                    placeholderTextColor={theme.colors.muted}
                  />
                  <TouchableOpacity style={styles.sendChatBtn} onPress={sendChat}>
                    <AppText style={styles.sendChatBtnText}>{t('chat.send', 'Send')}</AppText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Floating Mobile Reactions */}
          <View style={styles.mobileReactionsWrapper} pointerEvents="box-none">
            {isMobileReactionsOpen && (
              <View style={styles.mobileReactionsList}>
                <TouchableOpacity onPress={() => { setLockerVisible(true); setIsMobileReactionsOpen(false); }} style={styles.mobileReactionBtn}>
                  <AppText style={{fontSize: 24}}>⚙️</AppText>
                </TouchableOpacity>
                {hotbarStickers.map(s => (
                  <TouchableOpacity key={s.id} onPress={() => sendReaction(s.id)} style={styles.mobileReactionBtn}>
                    {s.url ? (
                      <Image source={{ uri: s.url }} style={{ width: s.width ? (s.width/s.height)*32 : 32, height: 32, resizeMode: 'contain' }} />
                    ) : (
                      <AppText style={{fontSize: 32}}>{s.emoji}</AppText>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity 
              style={styles.mobileReactionsFab} 
              onPress={() => setIsMobileReactionsOpen(!isMobileReactionsOpen)}
            >
              <AppText style={{fontSize: 24, textAlign: 'center'}}>{isMobileReactionsOpen ? '✖️' : '😊'}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      <StickerLockerModal
        visible={lockerVisible}
        setVisible={setLockerVisible}
        allStickers={activeStickers}
        savedLoadout={savedLoadout}
        onSave={saveLocker}
        t={t}
      />
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
  },
  mobileReactionsWrapper: {
    position: 'absolute',
    right: 15,
    bottom: 60,
    alignItems: 'center',
    zIndex: 250,
  },
  mobileReactionsList: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 30,
    padding: 10,
    gap: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
  },
  mobileReactionBtn: {
    padding: 4,
  },
  mobileReactionsFab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  }
});
