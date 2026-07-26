import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing, useWindowDimensions } from 'react-native';
import AppText from './AppText';
import NeoButton from './NeoButton';
import { theme } from '../styles/theme';

const SLIDES = [
  { id: 'intro', title: 'THE GOAL' },
  { id: 'join', title: 'VOICE & JOIN' },
  { id: 'submit', title: 'SUBMITTING WORDS' },
  { id: 'samesame', title: 'SAME SAME MODE' },
  { id: 'different', title: 'BUT DIFFERENT MODE' },
  { id: 'judge', title: 'THE AI JUDGE' },
  { id: 'blitz', title: 'BLITZ MODE' },
];

export default function HowToPlayModal({ visible, setVisible, t, inline }) {
  const [slide, setSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const { width } = useWindowDimensions();
  const isDesktop = width > 800;

  useEffect(() => {
    if (!inline && !visible) {
      setSlide(0);
      setIsAutoPlaying(true);
    }
  }, [visible, inline]);

  useEffect(() => {
    if (!visible && !inline) return;
    if (!isAutoPlaying) return;
    
    const timer = setInterval(() => {
      setSlide((prev) => (prev + 1) % SLIDES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [visible, inline, slide, isAutoPlaying]);

  const nextSlide = () => {
    setIsAutoPlaying(false);
    setSlide((prev) => (prev + 1) % SLIDES.length);
  };
  
  const prevSlide = () => {
    setIsAutoPlaying(false);
    setSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  };

  const renderSlideContent = () => {
    switch (SLIDES[slide].id) {
      case 'intro': return <IntroAnimation t={t} />;
      case 'join': return <JoinAnimation t={t} />;
      case 'submit': return <SubmitAnimation t={t} />;
      case 'samesame': return <SameSameAnimation t={t} />;
      case 'different': return <DifferentAnimation t={t} />;
      case 'judge': return <JudgeAnimation t={t} />;
      case 'blitz': return <BlitzAnimation t={t} />;
      default: return null;
    }
  };

  const content = (
    <View style={[s.modalContent, inline ? { minHeight: 400, flex: 1, padding: 20 } : { maxWidth: isDesktop ? 600 : '100%' }]}>
      {!inline && (
        <NeoButton style={s.closeBtn} onPress={() => setVisible(false)}>
          <AppText style={s.closeBtnText}>✕</AppText>
        </NeoButton>
      )}
      
      <AppText style={s.modalTitle}>{SLIDES[slide].title}</AppText>
      
      <View style={s.animationContainer}>
        {renderSlideContent()}
      </View>

      <View style={s.pagination}>
        <TouchableOpacity onPress={prevSlide} style={s.navBtn}>
          <Text style={s.arrow}>◀</Text>
        </TouchableOpacity>
        
        <View style={s.dotsContainer}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === slide && s.activeDot]} />
          ))}
        </View>

        <TouchableOpacity onPress={nextSlide} style={s.navBtn}>
          <Text style={s.arrow}>▶</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (inline) {
    return <View style={{ flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center', justifyContent: 'center' }}>{content}</View>;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
      <View style={[s.modalOverlay, { padding: isDesktop ? 40 : 20 }]}>
        {content}
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────

function IntroAnimation({ t }) {
  const scale = useRef(new Animated.Value(0)).current;
  const leftX = useRef(new Animated.Value(-150)).current;
  const rightX = useRef(new Animated.Value(150)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.back(1.5) }),
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(leftX, { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.back(1.5)) }),
          Animated.timing(rightX, { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.back(1.5)) })
        ]),
        Animated.delay(1500),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(leftX, { toValue: -150, duration: 300, useNativeDriver: true }),
          Animated.timing(rightX, { toValue: 150, duration: 300, useNativeDriver: true })
        ]),
        Animated.delay(300)
      ])
    ).start();
  }, []);

  return (
    <View style={s.slideWrapper}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', padding: 20 }}>
        
        {/* Topic Card */}
        <Animated.View style={[s.topicCard, { transform: [{ rotate: '-2deg' }, { scale }] }]}>
          <AppText style={s.topicText}>"Something yellow"</AppText>
        </Animated.View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, width: '100%', marginTop: 20 }}>
          {/* Player 1 Card */}
          <Animated.View style={[s.playerCard, { transform: [{ translateX: leftX }], backgroundColor: theme.colors.primary }]}>
             <AppText style={s.cardBackText}>?????</AppText>
          </Animated.View>

          {/* Player 2 Card */}
          <Animated.View style={[s.playerCard, { transform: [{ translateX: rightX }], backgroundColor: theme.colors.primary }]}>
             <AppText style={s.cardBackText}>?????</AppText>
          </Animated.View>
        </View>

      </View>
      <View style={{ height: 80, justifyContent: 'center' }}>
        <AppText style={s.slideTitle}>{t('rules.introTitle', 'What is this game?')}</AppText>
        <AppText style={s.slideDesc}>{t('rules.introDesc', 'A game of word association and deduction. Can you read your friends\' minds?')}</AppText>
      </View>
    </View>
  );
}

function JoinAnimation({ t }) {
  const codeScale = useRef(new Animated.Value(1)).current;
  const p1Y = useRef(new Animated.Value(50)).current;
  const p2Y = useRef(new Animated.Value(50)).current;
  const p1Op = useRef(new Animated.Value(0)).current;
  const p2Op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse code continuously
    Animated.loop(
      Animated.sequence([
        Animated.timing(codeScale, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(codeScale, { toValue: 1, duration: 500, useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(p1Y, { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.back(2)) }),
          Animated.timing(p1Op, { toValue: 1, duration: 300, useNativeDriver: true })
        ]),
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(p2Y, { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.back(2)) }),
          Animated.timing(p2Op, { toValue: 1, duration: 300, useNativeDriver: true })
        ]),
        Animated.delay(1500),
        Animated.parallel([
          Animated.timing(p1Op, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(p2Op, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(p1Y, { toValue: 50, duration: 300, useNativeDriver: true }),
          Animated.timing(p2Y, { toValue: 50, duration: 300, useNativeDriver: true })
        ]),
        Animated.delay(500)
      ])
    ).start();
  }, []);

  return (
    <View style={s.slideWrapper}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', padding: 20 }}>
        
        <Animated.View style={[s.roomCodeBox, { transform: [{ scale: codeScale }] }]}>
          <AppText style={s.roomCodeText}>CODE: ABCD</AppText>
        </Animated.View>

        <View style={{ flexDirection: 'row', gap: 20, marginTop: 40 }}>
          <Animated.View style={[s.avatarCircle, { opacity: p1Op, transform: [{ translateY: p1Y }] }]}>
            <AppText style={s.avatarEmoji}>👽</AppText>
          </Animated.View>
          <Animated.View style={[s.avatarCircle, { opacity: p2Op, transform: [{ translateY: p2Y }] }]}>
            <AppText style={s.avatarEmoji}>🤖</AppText>
          </Animated.View>
        </View>

      </View>
      <View style={{ height: 80, justifyContent: 'center' }}>
        <AppText style={s.slideTitle}>{t('rules.joinTitle', 'Get on Voice Chat')}</AppText>
        <AppText style={s.slideDesc}>{t('rules.joinDesc', 'Call your friends and share the room code to play together.')}</AppText>
      </View>
    </View>
  );
}

function SubmitAnimation({ t }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        // Typing simulation
        Animated.timing(widthAnim, { toValue: 100, duration: 1000, useNativeDriver: false, easing: Easing.linear }),
        Animated.delay(200),
        // Button press
        Animated.sequence([
          Animated.timing(btnScale, { toValue: 0.9, duration: 100, useNativeDriver: true }),
          Animated.timing(btnScale, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]),
        Animated.delay(1000),
        // Reset
        Animated.timing(widthAnim, { toValue: 0, duration: 0, useNativeDriver: false }),
        Animated.delay(500)
      ])
    ).start();
  }, []);

  return (
    <View style={s.slideWrapper}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', padding: 20 }}>
        
        <View style={s.topicCard}>
          <AppText style={s.topicText}>"A red fruit"</AppText>
        </View>

        <View style={s.inputMock}>
          <Animated.View style={{ width: widthAnim, overflow: 'hidden', flexDirection: 'row' }}>
            <AppText style={[s.inputTextMock, { width: 200 }]} numberOfLines={1}>APPLE</AppText>
          </Animated.View>
        </View>

        <Animated.View style={[s.submitBtnMock, { transform: [{ scale: btnScale }] }]}>
          <AppText style={s.submitBtnTextMock}>SUBMIT</AppText>
        </Animated.View>

      </View>
      <View style={{ height: 80, justifyContent: 'center' }}>
        <AppText style={s.slideTitle}>{t('rules.submitTitle', 'Submitting Words')}</AppText>
        <AppText style={s.slideDesc}>{t('rules.submitDesc', 'See the topic, type your answer quickly, and submit before time runs out.')}</AppText>
      </View>
    </View>
  );
}

function SameSameAnimation({ t }) {
  const flip = useRef(new Animated.Value(0)).current;
  const scoreScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        // Flip cards
        Animated.timing(flip, { toValue: 1, duration: 400, useNativeDriver: false, easing: Easing.linear }),
        // Score pop
        Animated.timing(scoreScale, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.back(2) }),
        Animated.delay(1500),
        // Reset
        Animated.parallel([
          Animated.timing(flip, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(scoreScale, { toValue: 0, duration: 300, useNativeDriver: true })
        ]),
        Animated.delay(500)
      ])
    ).start();
  }, []);

  const scaleX = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 1] });
  const cardBg = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [theme.colors.primary, theme.colors.primary, '#D1FAE5', '#D1FAE5'] });
  const cardBorder = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: ['#000', '#000', '#10B981', '#10B981'] });
  const textOp1 = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const textOp2 = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] });

  return (
    <View style={s.slideWrapper}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', padding: 20 }}>
        
        <View style={{ flexDirection: 'row', gap: 20 }}>
          <Animated.View style={[s.playerCard, { transform: [{ scaleX }], backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Animated.View style={{ opacity: textOp1, position: 'absolute' }}>
              <AppText style={s.cardBackText}>?????</AppText>
            </Animated.View>
            <Animated.View style={{ opacity: textOp2, position: 'absolute' }}>
              <AppText style={s.playerCardText}>BANANA</AppText>
            </Animated.View>
            <Animated.View style={[s.pointsBubble, { transform: [{ scale: scoreScale }, { rotate: '10deg' }] }]}>
              <AppText style={s.pointsBubbleText}>+2</AppText>
            </Animated.View>
          </Animated.View>
          
          <Animated.View style={[s.playerCard, { transform: [{ scaleX }], backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Animated.View style={{ opacity: textOp1, position: 'absolute' }}>
              <AppText style={s.cardBackText}>?????</AppText>
            </Animated.View>
            <Animated.View style={{ opacity: textOp2, position: 'absolute' }}>
              <AppText style={s.playerCardText}>BANANA</AppText>
            </Animated.View>
            <Animated.View style={[s.pointsBubble, { transform: [{ scale: scoreScale }, { rotate: '10deg' }] }]}>
              <AppText style={s.pointsBubbleText}>+2</AppText>
            </Animated.View>
          </Animated.View>
        </View>

      </View>
      <View style={{ height: 80, justifyContent: 'center' }}>
        <AppText style={s.slideTitle}>{t('rules.samesameTitle', 'Same Same Mode')}</AppText>
        <AppText style={s.slideDesc}>{t('rules.samesameDesc', 'Think alike! Match answers with others to score points.')}</AppText>
      </View>
    </View>
  );
}

function DifferentAnimation({ t }) {
  const flip = useRef(new Animated.Value(0)).current;
  const scoreScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(flip, { toValue: 1, duration: 400, useNativeDriver: false, easing: Easing.linear }),
        Animated.timing(scoreScale, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.back(2) }),
        Animated.delay(1500),
        Animated.parallel([
          Animated.timing(flip, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(scoreScale, { toValue: 0, duration: 300, useNativeDriver: true })
        ]),
        Animated.delay(500)
      ])
    ).start();
  }, []);

  const scaleX = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 1] });
  const badBg = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [theme.colors.primary, theme.colors.primary, '#FEE2E2', '#FEE2E2'] });
  const badBorder = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: ['#000', '#000', '#EF4444', '#EF4444'] });
  const goodBg = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [theme.colors.primary, theme.colors.primary, '#D1FAE5', '#D1FAE5'] });
  const goodBorder = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: ['#000', '#000', '#10B981', '#10B981'] });
  const textOp1 = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const textOp2 = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] });

  return (
    <View style={s.slideWrapper}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', padding: 20 }}>
        
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Animated.View style={[s.playerCard, s.playerCardSmall, { transform: [{ scaleX }], backgroundColor: badBg, borderColor: badBorder }]}>
            <Animated.View style={{ opacity: textOp1, position: 'absolute' }}>
              <AppText style={s.cardBackTextSmall}>?????</AppText>
            </Animated.View>
            <Animated.View style={{ opacity: textOp2, position: 'absolute' }}>
              <AppText style={s.playerCardTextSmall}>APPLE</AppText>
            </Animated.View>
            <Animated.View style={[s.pointsBubble, s.pointsBubbleFail, { transform: [{ scale: scoreScale }, { rotate: '10deg' }] }]}>
              <AppText style={s.pointsBubbleText}>0</AppText>
            </Animated.View>
          </Animated.View>
          
          <Animated.View style={[s.playerCard, s.playerCardSmall, { transform: [{ scaleX }], backgroundColor: badBg, borderColor: badBorder }]}>
            <Animated.View style={{ opacity: textOp1, position: 'absolute' }}>
              <AppText style={s.cardBackTextSmall}>?????</AppText>
            </Animated.View>
            <Animated.View style={{ opacity: textOp2, position: 'absolute' }}>
              <AppText style={s.playerCardTextSmall}>APPLE</AppText>
            </Animated.View>
            <Animated.View style={[s.pointsBubble, s.pointsBubbleFail, { transform: [{ scale: scoreScale }, { rotate: '10deg' }] }]}>
              <AppText style={s.pointsBubbleText}>0</AppText>
            </Animated.View>
          </Animated.View>
          
          <Animated.View style={[s.playerCard, s.playerCardSmall, { transform: [{ scaleX }], backgroundColor: goodBg, borderColor: goodBorder }]}>
            <Animated.View style={{ opacity: textOp1, position: 'absolute' }}>
              <AppText style={s.cardBackTextSmall}>?????</AppText>
            </Animated.View>
            <Animated.View style={{ opacity: textOp2, position: 'absolute' }}>
              <AppText style={s.playerCardTextSmall}>LEMON</AppText>
            </Animated.View>
            <Animated.View style={[s.pointsBubble, { transform: [{ scale: scoreScale }, { rotate: '10deg' }] }]}>
              <AppText style={s.pointsBubbleText}>+3</AppText>
            </Animated.View>
          </Animated.View>
        </View>

      </View>
      <View style={{ height: 80, justifyContent: 'center' }}>
        <AppText style={s.slideTitle}>{t('rules.differentTitle', 'But Different Mode')}</AppText>
        <AppText style={s.slideDesc}>{t('rules.differentDesc', 'Be unique! Give an answer nobody else thinks of.')}</AppText>
      </View>
    </View>
  );
}

function JudgeAnimation({ t }) {
  const flip = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(flip, { toValue: 1, duration: 400, useNativeDriver: false, easing: Easing.linear }),
        Animated.delay(2000),
        Animated.timing(flip, { toValue: 0, duration: 300, useNativeDriver: false }),
        Animated.delay(500)
      ])
    ).start();
  }, []);

  const scaleX = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 1] });
  const badBg = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [theme.colors.primary, theme.colors.primary, '#FEE2E2', '#FEE2E2'] });
  const badBorder = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: ['#000', '#000', '#EF4444', '#EF4444'] });
  const goodBg = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [theme.colors.primary, theme.colors.primary, '#D1FAE5', '#D1FAE5'] });
  const goodBorder = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: ['#000', '#000', '#10B981', '#10B981'] });
  const textOp1 = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const textOp2 = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] });

  return (
    <View style={s.slideWrapper}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', padding: 20 }}>
        
        <View style={[s.topicCard, { marginBottom: 20 }]}>
          <AppText style={s.topicText}>"A Fruit"</AppText>
        </View>

        <View style={{ flexDirection: 'row', gap: 20 }}>
          <Animated.View style={[s.playerCard, { transform: [{ scaleX }], backgroundColor: badBg, borderColor: badBorder }]}>
            <Animated.View style={{ opacity: textOp1, position: 'absolute' }}>
              <AppText style={s.cardBackText}>?????</AppText>
            </Animated.View>
            <Animated.View style={{ opacity: textOp2, position: 'absolute' }}>
              <AppText style={s.playerCardText}>CHAIR</AppText>
            </Animated.View>
            <Animated.Image
              source={require('../../assets/rejected_stamp.png')}
              style={[s.rejectedStampMock, { opacity: textOp2 }]}
              resizeMode="contain"
            />
          </Animated.View>
          
          <Animated.View style={[s.playerCard, { transform: [{ scaleX }], backgroundColor: goodBg, borderColor: goodBorder }]}>
            <Animated.View style={{ opacity: textOp1, position: 'absolute' }}>
              <AppText style={s.cardBackText}>?????</AppText>
            </Animated.View>
            <Animated.View style={{ opacity: textOp2, position: 'absolute' }}>
              <AppText style={s.playerCardText}>KIWI</AppText>
            </Animated.View>
            <Animated.View style={[s.pointsBubble, { opacity: textOp2, transform: [{ rotate: '10deg' }] }]}>
              <AppText style={s.pointsBubbleText}>+3</AppText>
            </Animated.View>
          </Animated.View>
        </View>

      </View>
      <View style={{ height: 80, justifyContent: 'center' }}>
        <AppText style={s.slideTitle}>{t('rules.judgeTitle', 'The AI Judge')}</AppText>
        <AppText style={s.slideDesc}>{t('rules.judgeDesc', 'In But Different mode, our AI checks if your unique answers actually fit the topic. No making up words!')}</AppText>
      </View>
    </View>
  );
}

function BlitzAnimation({ t }) {
  const t1 = useRef(new Animated.Value(0)).current;
  const t2 = useRef(new Animated.Value(0)).current;
  const t3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(t1, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(t2, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(t3, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1000),
        Animated.parallel([
          Animated.timing(t1, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(t2, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(t3, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]),
        Animated.delay(500)
      ])
    ).start();
  }, []);

  return (
    <View style={s.slideWrapper}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', padding: 10 }}>
        
        <View style={{ gap: 10, width: '100%', maxWidth: 300 }}>
          <Animated.View style={[s.blitzRow, { opacity: t1, transform: [{ scale: t1 }] }]}>
            <View style={s.blitzTopic}><AppText style={s.blitzTopicText}>A Color</AppText></View>
            <View style={s.blitzInput}><AppText style={s.blitzInputText}>RED</AppText></View>
          </Animated.View>
          <Animated.View style={[s.blitzRow, { opacity: t2, transform: [{ scale: t2 }] }]}>
            <View style={s.blitzTopic}><AppText style={s.blitzTopicText}>An Animal</AppText></View>
            <View style={s.blitzInput}><AppText style={s.blitzInputText}>DOG</AppText></View>
          </Animated.View>
          <Animated.View style={[s.blitzRow, { opacity: t3, transform: [{ scale: t3 }] }]}>
            <View style={s.blitzTopic}><AppText style={s.blitzTopicText}>A City</AppText></View>
            <View style={s.blitzInput}><AppText style={s.blitzInputText}>PARIS</AppText></View>
          </Animated.View>
        </View>

      </View>
      <View style={{ height: 80, justifyContent: 'center' }}>
        <AppText style={s.slideTitle}>{t('rules.blitzTitle', 'Blitz Mode')}</AppText>
        <AppText style={s.slideDesc}>{t('rules.blitzDesc', 'Multiple topics, multiple answers. Absolute chaos.')}</AppText>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.secondary,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: '#000',
    width: '100%',
    minHeight: 500,
    padding: 30,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  closeBtn: {
    position: 'absolute',
    top: -16,
    right: -16,
    zIndex: 10,
    backgroundColor: theme.colors.destructive,
    padding: 12,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#000',
  },
  closeBtnText: {
    fontSize: 20,
    color: '#000',
    fontFamily: theme.fonts.headingBold,
  },
  modalTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 28,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 2,
    textTransform: 'uppercase',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  animationContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#000',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 10,
  },
  navBtn: {
    padding: 10,
  },
  arrow: {
    color: '#fff',
    fontSize: 24,
    fontFamily: theme.fonts.headingBold,
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderWidth: 2,
    borderColor: '#000',
  },
  activeDot: {
    backgroundColor: '#fff',
    width: 30,
  },

  // Slide Styles
  slideWrapper: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  slideTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 24,
    color: theme.colors.primary,
    marginBottom: 10,
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  slideDesc: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 16,
    color: '#111',
    textAlign: 'center',
    lineHeight: 24,
  },
  
  // Custom Animation Styles
  topicCard: { backgroundColor: theme.colors.primary, padding: 20, borderRadius: 16, borderWidth: 3, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, zIndex: 10, transform: [{ rotate: '-2deg' }] },
  topicText: { fontFamily: theme.fonts.headingBold, fontSize: 24, color: '#000', textAlign: 'center' },
  playerCard: { backgroundColor: '#fff', width: 120, height: 75, borderRadius: 8, borderWidth: 3, borderColor: '#000', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
  playerCardSmall: { width: 90, height: 60 },
  cardBackText: { fontFamily: theme.fonts.headingBold, fontSize: 24, color: '#000' },
  cardBackTextSmall: { fontFamily: theme.fonts.headingBold, fontSize: 16, color: '#000' },
  playerEmoji: { fontSize: 32 },
  playerCardText: { fontFamily: theme.fonts.headingBold, fontSize: 16, color: '#000' },
  playerCardTextSmall: { fontFamily: theme.fonts.headingBold, fontSize: 14, color: '#000' },
  
  roomCodeBox: { backgroundColor: '#fff', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 16, borderWidth: 3, borderColor: '#000', borderStyle: 'dashed' },
  roomCodeText: { fontFamily: theme.fonts.headingBold, fontSize: 24, color: '#000', letterSpacing: 4 },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E5E7EB', borderWidth: 3, borderColor: '#000', justifyContent: 'center', alignItems: 'center' },
  avatarEmoji: { fontSize: 28 },
  
  inputMock: { width: '80%', height: 50, backgroundColor: '#fff', borderWidth: 3, borderColor: '#000', borderRadius: 12, marginTop: 30, justifyContent: 'center', paddingHorizontal: 15 },
  inputTextMock: { fontFamily: theme.fonts.headingBold, fontSize: 20, color: '#000' },
  submitBtnMock: { backgroundColor: '#10B981', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 12, borderWidth: 3, borderColor: '#000', marginTop: 20, shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
  submitBtnTextMock: { fontFamily: theme.fonts.headingBold, fontSize: 20, color: '#fff' },
  
  pointsBubble: { position: 'absolute', top: -10, right: -10, backgroundColor: '#FCD34D', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 2, borderColor: '#000' },
  pointsBubbleFail: { backgroundColor: '#EF4444' },
  pointsBubbleText: { fontFamily: theme.fonts.bodyBold, fontSize: 14, color: '#000' },

  blitzRow: { flexDirection: 'row', width: '100%', gap: 10, alignItems: 'center' },
  blitzTopic: { flex: 1, backgroundColor: '#E5E7EB', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, borderWidth: 2, borderColor: '#000' },
  blitzTopicText: { fontFamily: theme.fonts.bodyBold, fontSize: 14, color: '#000' },
  blitzInput: { flex: 1, backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, borderWidth: 2, borderColor: '#000' },
  blitzInputText: { fontFamily: theme.fonts.headingBold, fontSize: 14, color: '#10B981' },
  
  rejectedStampMock: { position: 'absolute', top: -15, right: -20, width: 80, height: 50, transform: [{rotate: '15deg'}] }
});
