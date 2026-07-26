import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView, Image } from 'react-native';
import AppText from './AppText';
import NeoButton from './NeoButton';
import { theme } from '../styles/theme';

export default function StickerLockerModal({ visible, setVisible, allStickers, savedLoadout, onSave, t }) {
  const [selectedIds, setSelectedIds] = useState([]);

  // Reset local selection to the saved loadout whenever the modal opens
  useEffect(() => {
    if (visible) {
      setSelectedIds([...savedLoadout]);
    }
  }, [visible, savedLoadout]);

  const toggleSticker = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(sid => sid !== id);
      }
      if (prev.length >= 5) {
        return prev; // Max 5 stickers allowed
      }
      return [...prev, id];
    });
  };

  const handleSave = () => {
    onSave(selectedIds);
    setVisible(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <View style={s.header}>
            <AppText style={s.modalTitle}>{t ? t('chat.customizeReactions', 'Customize Reactions') : 'Customize Reactions'}</AppText>
            <AppText style={s.modalSubtitle}>{selectedIds.length}/5 {t ? t('chat.selected', 'Selected') : 'Selected'}</AppText>
          </View>
          
          <ScrollView contentContainerStyle={s.scrollContainer} showsVerticalScrollIndicator={false}>
            {allStickers.filter(s => s.url).length > 0 && (
              <>
                <AppText style={s.sectionHeader}>Stickers</AppText>
                <View style={s.gridContainer}>
                  {allStickers.filter(s => s.url).map(sticker => {
                    const isSelected = selectedIds.includes(sticker.id);
                    return (
                      <TouchableOpacity 
                        key={sticker.id} 
                        style={[s.stickerBox, isSelected && s.stickerBoxSelected]}
                        onPress={() => toggleSticker(sticker.id)}
                        activeOpacity={0.7}
                      >
                        <Image source={{ uri: sticker.url }} style={{ width: 40, height: 40, resizeMode: 'contain' }} />
                        {isSelected && (
                          <View style={s.checkmarkBadge}>
                            <AppText style={{color: '#fff', fontSize: 10, fontWeight: 'bold'}}>✓</AppText>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {allStickers.filter(s => !s.url).length > 0 && (
              <>
                <AppText style={s.sectionHeader}>Emojis</AppText>
                <View style={s.gridContainer}>
                  {allStickers.filter(s => !s.url).map(sticker => {
                    const isSelected = selectedIds.includes(sticker.id);
                    return (
                      <TouchableOpacity 
                        key={sticker.id} 
                        style={[s.stickerBox, isSelected && s.stickerBoxSelected]}
                        onPress={() => toggleSticker(sticker.id)}
                        activeOpacity={0.7}
                      >
                        <AppText style={{fontSize: 32}}>{sticker.emoji}</AppText>
                        {isSelected && (
                          <View style={s.checkmarkBadge}>
                            <AppText style={{color: '#fff', fontSize: 10, fontWeight: 'bold'}}>✓</AppText>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          <View style={s.footer}>
            <NeoButton onPress={() => setVisible(false)} style={s.cancelBtn} color="gray">
              <AppText style={s.btnText}>{t ? t('common.cancel', 'Cancel') : 'Cancel'}</AppText>
            </NeoButton>
            <NeoButton onPress={handleSave} style={s.saveBtn} color="primary">
              <AppText style={s.btnText}>{t ? t('common.save', 'Save') : 'Save'}</AppText>
            </NeoButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#FDFBF7',
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 4,
    borderColor: '#000',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    flexDirection: 'column'
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: theme.fonts.heading,
    textTransform: 'uppercase',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    fontFamily: theme.fonts.bodyBold,
    marginTop: 4,
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  sectionHeader: {
    fontFamily: theme.fonts.heading,
    fontSize: 18,
    color: '#000',
    marginTop: 10,
    marginBottom: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  stickerBox: {
    width: 70,
    height: 70,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  stickerBoxSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F3E8FF',
    borderWidth: 3,
  },
  checkmarkBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: theme.colors.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 20,
    borderTopWidth: 2,
    borderColor: '#eee',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
  },
  btnText: {
    fontSize: 16,
    fontFamily: theme.fonts.bodyBold,
    color: '#000',
  }
});
