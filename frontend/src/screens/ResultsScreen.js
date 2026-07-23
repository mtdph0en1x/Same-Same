import React, { useState, useEffect, useRef } from 'react';
import AppText from '../components/AppText';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, TouchableOpacity, Animated, useWindowDimensions, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import NeoButton from '../components/NeoButton';
import { theme } from '../styles/theme';
import { socket } from '../socket';
import FramedAvatar from '../components/FramedAvatar';
import SoundManager from '../utils/SoundManager';

const BoardCard = ({ cardInfo, isRevealed, isResolved, roundType, isDesktop }) => {
  const { t } = useTranslation();
  const scale = useRef(new Animated.Value(0.8)).current;
  const flip = useRef(new Animated.Value(0)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;
  const hasAnimated = useRef(false);
  const hasResolved = useRef(false);

  useEffect(() => {
    if (isRevealed && !hasAnimated.current) {
      hasAnimated.current = true;
      SoundManager.playSfx('woosh');
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: false }),
        Animated.spring(flip, { toValue: 180, friction: 8, tension: 40, useNativeDriver: false })
      ]).start();
    }
  }, [isRevealed]);

  useEffect(() => {
    if (isResolved && !hasResolved.current && cardInfo.text) {
        hasResolved.current = true;
        
        // Pop animation
        Animated.sequence([
            Animated.spring(scale, { toValue: 1.1, friction: 4, tension: 80, useNativeDriver: false }),
            Animated.spring(scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: false })
        ]).start();

        // Color transition
        Animated.timing(colorAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false
        }).start();

        if (cardInfo.isRejected) {
            SoundManager.playSfx('rejection');
            SoundManager.playSfx('stamp');
        } else if (cardInfo.matchState === 'fail') {
            SoundManager.playSfx('rejection');
        } else {
            SoundManager.playSfx('correct');
        }
    }
  }, [isResolved, cardInfo.text]);

  const frontOpacity = flip.interpolate({ inputRange: [0, 180], outputRange: [0, 1] });
  const backOpacity = flip.interpolate({ inputRange: [0, 180], outputRange: [1, 0] });
  const rotateX = flip.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '0deg'] });

  let targetBorderColor = '#000';
  let targetBgColor = '#fff';

  if (cardInfo.isRejected) { 
      if (roundType === 'But Different') {
          targetBorderColor = '#EF4444'; targetBgColor = '#FEE2E2'; // Red
      } else {
          targetBorderColor = '#10B981'; targetBgColor = '#D1FAE5'; // Green
      }
  } 
  else if (cardInfo.matchState === 'success') { targetBorderColor = '#10B981'; targetBgColor = '#D1FAE5'; } 
  else if (cardInfo.matchState === 'fail') { targetBorderColor = '#EF4444'; targetBgColor = '#FEE2E2'; } 

  const finalBorder = isResolved 
    ? colorAnim.interpolate({ inputRange: [0, 1], outputRange: ['#9CA3AF', targetBorderColor] })
    : (isRevealed ? '#9CA3AF' : '#000');
    
  const finalBg = isResolved 
    ? colorAnim.interpolate({ inputRange: [0, 1], outputRange: ['#F3F4F6', targetBgColor] })
    : (isRevealed ? '#F3F4F6' : '#fff');

  return (
    <View style={[styles.cardContainer, !isDesktop && styles.cardContainerMobile]}>
      <Animated.View style={[styles.card, { transform: [{ scale }, { rotateX }] }]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.cardFace, { opacity: frontOpacity, borderColor: finalBorder, backgroundColor: finalBg }]}>
            <AppText style={[styles.cardText, cardInfo.isRejected && styles.textRejected, !isDesktop && styles.cardTextMobile]}>
                {cardInfo.text ? cardInfo.text.toUpperCase() : t('results.blank', 'BLANK')}
            </AppText>
            {isResolved && cardInfo.pointsStr && !cardInfo.isRejected ? (
                <View style={[styles.pointsBubble, cardInfo.matchState === 'fail' && styles.pointsBubbleFail]}>
                    <AppText style={styles.pointsBubbleText}>{cardInfo.pointsStr}</AppText>
                </View>
            ) : null}
            {isResolved && cardInfo.isRejected && (
                <Image
                    source={require('../../assets/rejected_stamp.png')}
                    style={styles.rejectedStampSmall}
                    resizeMode="contain"
                />
            )}
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.cardBack, { opacity: backOpacity }]}>
            <View style={styles.cardBackPattern} />
            <AppText style={styles.cardBackText}>?????</AppText>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

export default function ResultsScreen({ roundResults, roomCode, isHost, players = [] }) {
  const { t } = useTranslation();
  const { groups = [], roundType, newScores = {}, scoreUpdates = {}, playerNames = {}, playerAvatars = {}, playerFrames = {}, rejectedWords = [], timeline = [], playerWords = {}, wordsPerRound = 5 } = roundResults;
  
  // Fallback to local players array if backend didn't send playerAvatars in roundResults
  const avatars = { ...playerAvatars };
  const frames = { ...playerFrames };
  players.forEach(p => {
    if (p.avatar && !avatars[p.id]) avatars[p.id] = p.avatar;
    if (p.frame && !frames[p.id]) frames[p.id] = p.frame;
  });

  const [step, setStep] = useState(-1);
  const [votes, setVotes] = useState(0);
  const [voteThreshold, setVoteThreshold] = useState(1);
  const [hasVoted, setHasVoted] = useState(false);
  const [revealedWords, setRevealedWords] = useState(new Set());
  const [resolvedCards, setResolvedCards] = useState(new Set());
  
  const { width } = useWindowDimensions();
  const isDesktop = width > 800;
  const maxSteps = Math.max(1, timeline.length);
  const rushWinnerEvent = timeline.find(ev => ev.type === 'rush_bonus');
  const rushWinnerId = rushWinnerEvent ? rushWinnerEvent.playerId : null;

  const scrollViewRef = useRef(null);
  const playerRefs = useRef({});

  // Pre-calculate card states
  const cardData = {};
  Object.keys(playerNames).forEach(pid => {
    cardData[pid] = [];
    for (let i = 0; i < wordsPerRound; i++) {
        const w = playerWords[pid]?.words?.[i];
        const text = w ? w.text : '';
        
        let matchState = 'none';
        let pointsStr = null;
        let isRejected = false;
        
        if (w) {
            const group = groups.find(g => g.playerIds.some(p => p.id === pid && p.wordIndex === i));
            isRejected = rejectedWords.some(rw => rw.playerId === pid && rw.word.toLowerCase() === text.toLowerCase());
            
            if (group) {
                if (roundType === 'Same Same' || roundType === 'Rush' || roundType === 'Blitz') {
                    if (group.playerIds.length > 1) {
                        matchState = 'success';
                        pointsStr = `+${group.playerIds.length}`;
                    } else {
                        // Not a match in Same Same
                        matchState = 'fail';
                    }
                } else if (roundType === 'But Different') {
                    if (group.playerIds.length === 1) {
                        if (!isRejected) {
                            matchState = 'success';
                            pointsStr = '+3';
                        } else {
                            matchState = 'fail';
                        }
                    } else {
                        matchState = 'fail';
                        pointsStr = '0';
                    }
                }
            }
        }
        
        cardData[pid].push({
            text,
            matchState,
            pointsStr,
            isRejected
        });
    }
  });

  useEffect(() => {
    let timeoutId;
    if (step >= 0 && step < timeline.length) {
      const t = timeline[step];
      
      let delayReveal = 0;
      let pidToScroll = null;
      if (t.type === 'reveal_word') pidToScroll = t.playerId;
      else if (t.group && t.group.playerIds && t.group.playerIds.length > 0) {
         pidToScroll = t.group.playerIds[0].id;
      }

      if (pidToScroll) {
        // small tick to ensure layout is ready
        setTimeout(() => {
          if (scrollViewRef.current && playerRefs.current[pidToScroll] !== undefined) {
            scrollViewRef.current.scrollTo({ y: Math.max(0, playerRefs.current[pidToScroll] - 20), animated: true });
          }
        }, 50);
        delayReveal = 500; // Wait for camera to arrive before popping
      }

      timeoutId = setTimeout(() => {
        const newRevealed = new Set();
        const newResolved = new Set();
        for (let i = 0; i <= step; i++) {
           const ev = timeline[i];
           if (ev.type === 'reveal' && ev.group) {
             ev.group.playerIds.forEach(p => newRevealed.add(`${p.id}-${p.wordIndex}`));
             ev.group.playerIds.forEach(p => newResolved.add(`${p.id}-${p.wordIndex}`));
           } else if (ev.type === 'reveal_word') {
             newRevealed.add(`${ev.playerId}-${ev.wordIndex}`);
           } else if (ev.type === 'resolve_group' && ev.group) {
             ev.group.playerIds.forEach(p => newResolved.add(`${p.id}-${p.wordIndex}`));
           }
        }
        setRevealedWords(newRevealed);
        setResolvedCards(newResolved);
      }, delayReveal);

    } else if (step >= timeline.length) {
      // Scoreboard phase: reveal AND resolve all missing ones (e.g. blanks)
      setRevealedWords(prev => {
         const next = new Set(prev);
         Object.keys(playerNames).forEach(pid => {
             for(let i=0; i < wordsPerRound; i++) next.add(`${pid}-${i}`);
         });
         return next;
      });
      setResolvedCards(prev => {
         const next = new Set(prev);
         Object.keys(playerNames).forEach(pid => {
             for(let i=0; i < wordsPerRound; i++) next.add(`${pid}-${i}`);
         });
         return next;
      });
    }

    return () => clearTimeout(timeoutId);
  }, [step, timeline, isDesktop]);

  useEffect(() => {
    const handleStepAdvanced = ({ step: newStep }) => {
      setStep(newStep);
      setHasVoted(false);
    };

    const handleVotesUpdated = ({ votes, threshold }) => {
      setVotes(votes);
      setVoteThreshold(threshold);
    };

    socket.on('review_step_advanced', handleStepAdvanced);
    socket.on('review_votes_updated', handleVotesUpdated);

    return () => {
      socket.off('review_step_advanced', handleStepAdvanced);
      socket.off('review_votes_updated', handleVotesUpdated);
    };
  }, []);

  const handleVoteNext = () => {
    if (!hasVoted) {
      socket.emit('vote_next_step', { roomId: roomCode });
      setHasVoted(true);
    }
  };

  const handleForceNext = () => {
    socket.emit('force_next_step', { roomId: roomCode });
  };

  const currentTimelineEvent = step >= 0 && step < timeline.length ? timeline[step] : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isDesktop && styles.containerDesktop]}>
        <View style={styles.headerRow}>
          <AppText style={styles.title}>{t('results.title', 'Round Results')}</AppText>
          {currentTimelineEvent?.type === 'rush_bonus' && (
              <View style={[styles.topicBadge, { backgroundColor: '#FCD34D' }]}>
                  <AppText style={styles.topicBadgeText}>⚡ {playerNames[currentTimelineEvent.playerId]} +2 {t('lobby.rush', 'Rush')} Bonus!</AppText>
              </View>
          )}
          {currentTimelineEvent?.type === 'topic' && (
              <View style={styles.topicBadge}>
                  <AppText style={styles.topicBadgeText}>{currentTimelineEvent.title}</AppText>
              </View>
          )}
        </View>
        
        <View style={{ flex: 1, width: '100%', flexDirection: 'column' }}>
          
          <ScrollView 
            ref={scrollViewRef}
            style={styles.boardScroll} 
            contentContainerStyle={styles.boardContent}
            scrollEnabled={step >= maxSteps || step === -1}
          >
            {step === -1 ? (
                <View style={styles.centerCard}>
                  <AppText style={styles.introText}>{t('results.timeToReview', 'Time to review!')}</AppText>
                  <AppText style={styles.introSubText}>{t('results.letsSeAnswers', "Let's see the answers.")}</AppText>
                </View>
            ) : (
                <View style={styles.playersGrid}>
                    {Object.keys(playerNames).map((pid, pIdx) => (
                        <View 
                          key={pid} 
                          style={styles.playerRow}
                          onLayout={(e) => { playerRefs.current[pid] = e.nativeEvent.layout.y; }}
                        >
                            <View style={styles.playerLabelContainer}>
                                <View style={styles.playerIdentityRow}>
                                    <FramedAvatar 
                                        url={avatars[pid]} 
                                        fallbackName={playerNames[pid]} 
                                        frame={frames[pid] || 'none'} 
                                        size={32} 
                                    />
                                    <AppText style={styles.playerLabelName}>{playerNames[pid]}</AppText>
                                    {rushWinnerId === pid && step >= maxSteps && (
                                        <Text style={{ fontSize: 20, marginLeft: 5 }}>⚡</Text>
                                    )}
                                </View>
                                {step >= maxSteps && (
                                    <View style={styles.finalScoreBubble}>
                                        <AppText style={styles.finalScoreText}>{t('common.pts', { count: newScores[pid] })}</AppText>
                                        <AppText style={styles.scoreUpdateText}>
                                            ({scoreUpdates[pid] > 0 ? '+' : ''}{scoreUpdates[pid] || 0})
                                        </AppText>
                                    </View>
                                )}
                            </View>
                            <View style={styles.cardsContainer}>
                                {cardData[pid].map((cardInfo, i) => {
                                    const isRevealed = revealedWords.has(`${pid}-${i}`);
                                    const isResolved = resolvedCards.has(`${pid}-${i}`);
                                    return (
                                        <BoardCard 
                                            key={`${pid}-${i}`} 
                                            cardInfo={cardInfo} 
                                            isRevealed={isRevealed}
                                            isResolved={isResolved} 
                                            roundType={roundType}
                                            isDesktop={isDesktop}
                                        />
                                    );
                                })}
                            </View>
                        </View>
                    ))}
                </View>
            )}
          </ScrollView>

          <View style={styles.bottomPanel}>
            <View style={styles.controlsRow}>
              {step >= maxSteps ? (
                <NeoButton 
                  style={[styles.readyBtn, hasVoted && styles.readyBtnActive]} 
                  onPress={handleVoteNext}
                >
                  <AppText style={styles.readyBtnText}>
                    {hasVoted ? t('results.readyCount', { votes, threshold: voteThreshold }) : t('results.readyForNext', 'Ready for Next Round')}
                  </AppText>
                </NeoButton>
              ) : null}


              {isHost && (
                <NeoButton style={styles.forceBtn} onPress={handleForceNext}>
                  <AppText style={styles.forceBtnText}>
                    {step >= maxSteps ? t('results.forceNextRound', 'Force Next Round') : t('results.skipToScoreboard', 'Skip to Scoreboard')}
                  </AppText>
                </NeoButton>
              )}
            </View>
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  container: { flex: 1, padding: theme.spacing.md, paddingTop: theme.spacing.md },
  containerDesktop: {
    paddingHorizontal: 40,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md
  },
  title: {
    fontSize: 28, fontFamily: theme.fonts.headingBold, color: theme.colors.primary,
  },
  topicBadge: {
    backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 2, borderColor: '#000'
  },
  topicBadgeText: {
    color: '#000', fontFamily: theme.fonts.bodyBold, fontSize: 16
  },
  boardScroll: {
    flex: 1, width: '100%'
  },
  boardContent: {
    paddingBottom: 40,
  },
  centerCard: {
    padding: theme.spacing.xl, alignItems: 'center', marginTop: 100
  },
  introText: {
    fontSize: 32, fontFamily: theme.fonts.headingBold, color: '#FFFFFF', textAlign: 'center'
  },
  introSubText: {
    fontSize: 18, fontFamily: theme.fonts.body, color: '#D1D5DB', marginTop: 10, textAlign: 'center'
  },
  playersGrid: {
    flexDirection: 'column', gap: 16
  },
  playerRow: {
    backgroundColor: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: '#000',
  },
  playerLabelContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8
  },
  playerLabelName: {
    fontSize: 20, fontFamily: theme.fonts.headingBold, color: '#fff'
  },
  playerIdentityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10
  },
  avatarImg: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#CCC', borderWidth: 2, borderColor: '#000'
  },
  avatarPlaceholder: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000'
  },
  avatarText: {
    fontFamily: theme.fonts.headingBold, color: '#000', fontSize: 16
  },
  finalScoreBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FCD34D', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 2, borderColor: '#000'
  },
  finalScoreText: {
    fontSize: 16, fontFamily: theme.fonts.headingBold, color: '#000'
  },
  scoreUpdateText: {
    fontSize: 14, fontFamily: theme.fonts.bodyBold, color: '#000'
  },
  cardsContainer: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12
  },
  cardContainer: {
    width: 110, height: 70, // Base size, can flex
    flexGrow: 1,
    flexBasis: 100,
    maxWidth: 160,
  },
  cardContainerMobile: {
    height: 60,
    flexBasis: 75,
    maxWidth: 120,
    width: 80,
  },
  card: {
    flex: 1, borderRadius: 8, borderWidth: 3, 
    shadowColor: '#000', shadowOffset: { width:3, height:3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 0
  },
  cardFace: {
    justifyContent: 'center', alignItems: 'center', padding: 4
  },
  cardText: {
    fontFamily: theme.fonts.bodyBold, fontSize: 16, color: '#000', textAlign: 'center'
  },
  cardTextMobile: {
    fontSize: 12,
  },
  textRejected: {
    color: '#000'
  },
  cardBack: {
    justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.primary, borderRadius: 5, overflow: 'hidden'
  },
  cardBackPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1, backgroundColor: '#000' // Simple pattern
  },
  cardBackText: {
    fontFamily: theme.fonts.headingBold, fontSize: 24, color: '#000'
  },
  pointsBubble: {
    position: 'absolute', top: -10, right: -10, backgroundColor: '#FCD34D', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 2, borderColor: '#000', transform: [{rotate: '10deg'}]
  },
  pointsBubbleFail: {
    backgroundColor: '#EF4444'
  },
  pointsBubbleText: {
    fontFamily: theme.fonts.bodyBold, fontSize: 14, color: '#000'
  },
  rejectedStampSmall: {
    position: 'absolute', top: -20, right: -25, width: 90, height: 60, transform: [{rotate: '15deg'}]
  },
  bottomPanel: {
    width: '100%', marginTop: 'auto', paddingTop: 10,
  },
  controlsRow: {
    flexDirection: 'row', gap: 10
  },
  readyBtn: {
    flex: 1, backgroundColor: theme.colors.secondary, padding: 16, borderRadius: theme.borderRadius.md, alignItems: 'center', borderWidth: 3, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0
  },
  readyBtnActive: {
    backgroundColor: '#10B981'
  },
  readyBtnText: {
    color: '#000', fontFamily: theme.fonts.headingBold, fontSize: 18
  },
  forceBtn: {
    backgroundColor: '#FCD34D', padding: 16, borderRadius: theme.borderRadius.md, justifyContent: 'center', borderWidth: 3, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0
  },
  forceBtnText: {
    color: '#000', fontFamily: theme.fonts.bodyBold
  }
});
