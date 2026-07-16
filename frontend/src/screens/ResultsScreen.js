import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, TouchableOpacity, Animated, TextInput, Switch, useWindowDimensions, Image } from 'react-native';
import { theme } from '../styles/theme';
import { socket } from '../socket';

// Built-in stickers/gifs handled globally now

const AnimatedStapledPlayer = ({ player, position }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 100,
      useNativeDriver: true,
    }).start();
    
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[
      styles.playerBadgeStapled, 
      position,
      { transform: [...(position.transform || []), { scale }], opacity }
    ]}>
      <Text style={styles.playerName}>{player.name}</Text>
    </Animated.View>
  );
};

const AnimatedWord = ({ word, isRejected }) => {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const stampScale = useRef(new Animated.Value(3)).current;
  const stampOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      // Stamp slams in 350ms after the word appears
      if (isRejected) {
        Animated.sequence([
          Animated.delay(350),
          Animated.timing(stampScale, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          }),
        ]).start();
        Animated.sequence([
          Animated.delay(350),
          Animated.timing(stampOpacity, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
        ]).start();
      }
    });
  }, [word]);

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.Text
        style={[
          styles.answerText,
          isRejected && styles.textRejected,
          { transform: [{ scale }], opacity },
        ]}
      >
        {word.toUpperCase()}
      </Animated.Text>

      {isRejected && (
        <Animated.Image
          source={require('../../assets/rejected_stamp.png')}
          style={[
            styles.rejectedStamp,
            {
              opacity: stampOpacity,
              transform: [{ rotate: '-25deg' }, { scale: stampScale }],
            },
          ]}
          pointerEvents="none"
          resizeMode="contain"
        />
      )}
    </View>
  );
};

export default function ResultsScreen({ roundResults, roomCode, isHost, playerData }) {
  const { groups, roundType, newScores, scoreUpdates, playerNames = {}, rejectedWords = [] } = roundResults;

  const [step, setStep] = useState(-1);
  const [subStep, setSubStep] = useState(0);
  const [votes, setVotes] = useState(0);
  const [voteThreshold, setVoteThreshold] = useState(1);
  const [hasVoted, setHasVoted] = useState(false);
  
  const { width } = useWindowDimensions();
  const isDesktop = width > 800;

  const reviewGroups = groups;
  const maxSteps = Math.max(1, reviewGroups.length);

  useEffect(() => {
    if (step >= 0 && step < reviewGroups.length) {
      setSubStep(0);
      const group = reviewGroups[step];
      const maxSubSteps = group.playerIds.length;
      
      let currentSubStep = 0;
      const interval = setInterval(() => {
        currentSubStep++;
        if (currentSubStep <= maxSubSteps) {
          setSubStep(currentSubStep);
        } else {
          clearInterval(interval);
        }
      }, 800);
      
      return () => clearInterval(interval);
    }
  }, [step, groups]);

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



  const getPointsDisplay = (group, isRejected) => {
    if (roundType === 'Same Same' || roundType === 'Rush' || roundType === 'Blitz') {
      return group.playerIds.length > 1 ? `+${group.playerIds.length}` : '0';
    }
    if (roundType === 'But Different') {
      if (group.playerIds.length === 1) {
        return isRejected ? '0' : '+3';
      }
      return '0';
    }
    return '';
  };

  const getWordColor = (word, playerId, isMatch) => {
    const isRejected = rejectedWords.some(rw => rw.playerId === playerId && rw.word.toLowerCase() === word.toLowerCase());
    if (isRejected) return styles.pillRejected;

    if (roundType === 'Same Same' || roundType === 'Rush' || roundType === 'Blitz') {
      return isMatch ? styles.pillGood : styles.pillNeutral;
    } else if (roundType === 'But Different') {
      return isMatch ? styles.pillBad : styles.pillGood;
    }
    return styles.pillNeutral;
  };

  const renderCurrentStep = () => {
    if (step === -1) {
      return (
        <View style={styles.centerCard}>
          <Text style={styles.introText}>Time to review!</Text>
          <Text style={styles.introSubText}>Let's see the answers.</Text>
        </View>
      );
    }

    if (step >= maxSteps) {
      // Player Summary & Scoreboard Phase
      const sortedScores = Object.entries(newScores).sort((a, b) => b[1] - a[1]);
      
      // Group words by player for summary
      const playerWords = {};
      Object.keys(playerNames).forEach(pid => playerWords[pid] = []);
      
      groups.forEach(g => {
        if (g.isTopicHeader) return;
        const isMatch = g.playerIds.length > 1;
        g.playerIds.forEach(p => {
          if (playerWords[p.id]) {
            playerWords[p.id].push({ word: g.canonical, isMatch });
          }
        });
      });

      return (
        <ScrollView style={styles.scoreboardScroll}>
          <Text style={styles.sectionLabel}>📋 Player Summary & Scores</Text>
          {sortedScores.map(([pid, score], i) => (
            <View key={pid} style={[styles.scoreRow, i === 0 && styles.scoreRowFirst]}>
              <View style={styles.scoreRowHeader}>
                <Text style={styles.scoreRank}>{i + 1}</Text>
                <Text style={styles.scoreName}>{playerNames[pid]}</Text>
                <View style={styles.pointsUpdateBubble}>
                  <Text style={styles.pointsUpdateText}>
                    {scoreUpdates[pid] > 0 ? '+' : ''}{scoreUpdates[pid] || 0}
                  </Text>
                </View>
                <Text style={styles.scoreValue}>{score} pts</Text>
              </View>
              <View style={styles.playerWordsContainer}>
                {playerWords[pid].map((w, j) => (
                  <View key={j} style={[styles.wordPill, getWordColor(w.word, pid, w.isMatch)]}>
                    <Text style={[styles.wordPillText, getWordColor(w.word, pid, w.isMatch) === styles.pillRejected && styles.textRejected]}>{w.word.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      );
    }

    // Matched Group Review Phase
    const group = reviewGroups[step];
    
    if (group.isTopicHeader) {
      return (
        <View style={[styles.groupCard, styles.topicHeaderCard]}>
          <Text style={styles.topicHeaderTitle}>TOPIC {group.topicIndex + 1}</Text>
          <Text style={styles.topicHeaderText}>{group.title}</Text>
        </View>
      );
    }

    const firstPlayer = group.playerIds[0];
    const otherPlayers = group.playerIds.slice(1);
    
    const isRejected = rejectedWords.some(rw => rw.playerId === firstPlayer.id && rw.word.toLowerCase() === group.canonical.toLowerCase());
    const pts = getPointsDisplay(group, isRejected);
    
    let isSuccess = false;
    if (roundType === 'Same Same' || roundType === 'Rush' || roundType === 'Blitz') {
      isSuccess = group.playerIds.length > 1;
    } else if (roundType === 'But Different') {
      isSuccess = group.playerIds.length === 1 && !isRejected;
    }

    const cardStyle = isSuccess ? styles.groupCardSuccess : styles.groupCardFail;
    const badgeStyle = isSuccess ? styles.pointsBadgeSuccess : styles.pointsBadgeFail;
    
    const STAPLE_POSITIONS = [
      { top: -15, left: -10, transform: [{ rotate: '-12deg' }] },
      { bottom: -15, right: -10, transform: [{ rotate: '15deg' }] },
      { top: -5, right: -15, transform: [{ rotate: '8deg' }] },
      { bottom: -5, left: -15, transform: [{ rotate: '-20deg' }] },
      { top: 30, left: -25, transform: [{ rotate: '-25deg' }] },
      { bottom: 30, right: -25, transform: [{ rotate: '25deg' }] },
    ];

    const isFullyRevealed = subStep >= group.playerIds.length;

    return (
      <View style={[styles.groupCard, cardStyle]}>
        <Text style={styles.revealerText}>
          {subStep === 0 ? `${firstPlayer.name} wrote...` : `${firstPlayer.name} wrote:`}
        </Text>
        
        {subStep === 0 ? (
          <Text style={styles.answerText}>?????</Text>
        ) : (
          <AnimatedWord word={group.canonical} isRejected={isRejected} />
        )}

        {/* Stapled matching players */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {otherPlayers.map((p, j) => (
            subStep > j + 1 && (
              <AnimatedStapledPlayer 
                key={p.id} 
                player={p}
                position={STAPLE_POSITIONS[j % STAPLE_POSITIONS.length]}
              />
            )
          ))}
        </View>

        {/* Points display in the corner (only shows when all players are revealed) */}
        {isFullyRevealed && pts !== '' && (
          <View style={[styles.pointsCornerBadge, badgeStyle]}>
            <Text style={styles.pointsCornerText}>{pts}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isDesktop && styles.containerDesktop]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Round Results</Text>
        </View>
        
        <View style={{ flex: 1, width: '100%', flexDirection: 'column' }}>
          <View style={styles.mainContent}>
            {renderCurrentStep()}
          </View>

          <View style={styles.bottomPanel}>
            {/* Controls */}
            <View style={styles.controlsRow}>
              {step >= maxSteps ? (
                <TouchableOpacity 
                  style={[styles.readyBtn, hasVoted && styles.readyBtnActive]} 
                  onPress={handleVoteNext}
                >
                  <Text style={styles.readyBtnText}>
                    {hasVoted ? `Ready (${votes}/${voteThreshold})` : `Ready for Next Round`}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {isHost && (
                <TouchableOpacity style={styles.forceBtn} onPress={handleForceNext}>
                  <Text style={styles.forceBtnText}>
                    {step >= maxSteps ? 'Force Next Round' : 'Skip to Scoreboard'}
                  </Text>
                </TouchableOpacity>
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
  container: { flex: 1, padding: theme.spacing.md, paddingTop: theme.spacing.xl },
  containerDesktop: {
    paddingHorizontal: 40,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  desktopRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 40,
  },
  desktopColLeft: {
    flex: 2,
  },
  desktopColRight: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md
  },
  title: {
    fontSize: 28, fontFamily: theme.fonts.headingBold, color: theme.colors.primary,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5
  },
  toggleLabel: {
    fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.muted
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerCard: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  introText: {
    fontSize: 32, fontFamily: theme.fonts.headingBold, color: '#FFFFFF', textAlign: 'center'
  },
  introSubText: {
    fontSize: 18, fontFamily: theme.fonts.body, color: '#D1D5DB', marginTop: 10, textAlign: 'center'
  },
  groupCard: {
    width: '100%',
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    borderWidth: 3,
    borderColor: '#000',
    alignItems: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width:4, height:4 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 0,
    transform: [{ rotate: '1deg' }]
  },
  groupCardSuccess: { borderColor: '#10B981' }, // Green
  groupCardFail: { borderColor: '#EF4444' }, // Red
  topicHeaderCard: {
    backgroundColor: theme.colors.primary,
    borderColor: '#000',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  topicHeaderTitle: {
    fontSize: 16, fontFamily: theme.fonts.bodyBold, color: '#FDA4AF', letterSpacing: 2, marginBottom: 10
  },
  topicHeaderText: {
    fontSize: 40, fontFamily: theme.fonts.headingBold, color: '#000', textAlign: 'center'
  },
  revealerText: {
    fontSize: 20, fontFamily: theme.fonts.bodyBold, color: '#000', marginBottom: 10
  },
  answerText: {
    fontSize: 40, fontFamily: theme.fonts.headingBold, color: '#000', marginBottom: 20, textAlign: 'center'
  },
  playersRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 10
  },
  playerBadgeStapled: {
    position: 'absolute',
    backgroundColor: theme.colors.primary, 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 8, 
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000', shadowOffset: { width:2, height:2 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 0,
  },
  playerName: {
    color: '#000', fontFamily: theme.fonts.bodyBold, fontSize: 18
  },
  pointsCornerBadge: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000', shadowOffset: { width:4, height:4 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 0,
    transform: [{ rotate: '15deg' }]
  },
  pointsBadgeSuccess: { backgroundColor: '#10B981' },
  pointsBadgeFail: { backgroundColor: '#EF4444' },
  pointsCornerText: {
    color: '#000', fontSize: 24, fontFamily: theme.fonts.headingBold
  },
  scoreboardScroll: {
    flex: 1, width: '100%'
  },
  sectionLabel: {
    fontFamily: theme.fonts.headingBold, fontSize: 18, color: theme.colors.primary, marginBottom: 15, textAlign: 'center'
  },
  scoreRow: {
    backgroundColor: '#fff', padding: 12, borderRadius: theme.borderRadius.md, marginBottom: 16, borderWidth: 3, borderColor: '#000',
    shadowColor: '#000', shadowOffset: { width:4, height:4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 0
  },
  scoreRowFirst: {
    borderColor: theme.colors.primary, borderWidth: 3
  },
  scoreRowHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10
  },
  scoreRank: { color: '#000', fontSize: 18, fontFamily: theme.fonts.headingBold, width: 24, textAlign: 'center' },
  scoreName: { flex: 1, color: '#000', fontSize: 20, fontFamily: theme.fonts.bodyBold, marginLeft: 8 },
  pointsUpdateBubble: { backgroundColor: theme.colors.secondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginRight: 10, borderWidth: 2, borderColor: '#000' },
  pointsUpdateText: { color: '#000', fontSize: 14, fontFamily: theme.fonts.bodyBold },
  scoreValue: { color: theme.colors.primary, fontSize: 22, fontFamily: theme.fonts.headingBold },
  playerWordsContainer: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 32
  },
  wordPill: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.borderRadius.sm, borderWidth: 2, borderColor: '#000'
  },
  wordPillText: {
    fontSize: 12, fontFamily: theme.fonts.bodyBold, color: '#000'
  },
  pillGood: { backgroundColor: '#10B981', borderColor: '#059669' }, // Green
  pillBad: { backgroundColor: '#EF4444', borderColor: '#B91C1C' }, // Red
  pillNeutral: { backgroundColor: '#9CA3AF', borderColor: '#6B7280' }, // Gray
  pillRejected: { backgroundColor: '#000', borderColor: '#000' },
  textRejected: { textDecorationLine: 'line-through', color: '#EF4444' },

  // ── Rubber-stamp overlay ──────────────────────────────────────────────────────────────
  rejectedStamp: {
    position: 'absolute',
    width: 450,
    height: 220,
    zIndex: 10,
  },
  
  bottomPanel: {
    width: '100%',
    marginTop: 'auto',
    paddingTop: 10,
    position: 'relative',
  },
  controlsRow: {
    flexDirection: 'row', gap: 10
  },
  readyBtn: {
    flex: 1, backgroundColor: theme.colors.secondary, padding: 16, borderRadius: theme.borderRadius.md, alignItems: 'center', borderWidth: 3, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0
  },
  readyBtnActive: {
    backgroundColor: '#10B981' // Green
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
