import React, { useEffect, useRef } from 'react';
import { View, Image, Text, Animated, Easing } from 'react-native';
import { theme } from '../styles/theme';

export default function FramedAvatar({ url, fallbackName, frame, size = 56, style }) {
    const borderRadius = size / 2;
    const animVal = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (frame === 'neon' || frame === 'glitch') {
            animVal.setValue(0);
            Animated.loop(
                Animated.timing(animVal, {
                    toValue: 1,
                    duration: frame === 'neon' ? 1500 : 8000, // Pulse vs slow rotate
                    easing: frame === 'neon' ? Easing.inOut(Easing.ease) : Easing.linear,
                    useNativeDriver: false // some style props don't support native driver
                })
            ).start();
        } else {
            animVal.stopAnimation();
        }
    }, [frame]);
    
    const getFrameStyle = (frameName) => {
        switch(frameName) {
            case 'bronze': return { borderWidth: 4, borderColor: '#CD7F32' };
            case 'silver': return { borderWidth: 4, borderColor: '#C0C0C0' };
            case 'gold': return { borderWidth: 4, borderColor: '#FFD700' };
            case 'neon': {
                const pulseOpacity = animVal.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.4, 1, 0.4]
                });
                return { 
                    borderWidth: 4, 
                    borderColor: '#FF10F0', // Neon Pink
                    shadowColor: '#FF10F0', 
                    shadowRadius: 10, 
                    shadowOpacity: pulseOpacity, 
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 10 
                };
            }
            case 'glitch': {
                const rotate = animVal.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg']
                });
                return { 
                    borderWidth: 4, 
                    borderColor: '#0FF', // Cyan
                    shadowColor: '#F0F', // Magenta shadow
                    shadowRadius: 6,
                    shadowOpacity: 1,
                    shadowOffset: { width: 4, height: 4 },
                    borderStyle: 'dashed',
                    transform: [{ rotate }]
                };
            }
            default: return { borderWidth: 3, borderColor: '#000' };
        }
    }
    
    const frameStyle = getFrameStyle(frame);
    
    // To prevent the image from overlapping the thick borders, we apply border radius to it.
    // We assume 4px as standard custom frame width and 3px for default.
    const innerRadius = Math.max(0, borderRadius - (frame === 'none' ? 0 : 3));

    return (
        <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
            {/* Base Avatar Image */}
            <View style={{ width: size, height: size, borderRadius: innerRadius, overflow: 'hidden' }}>
                {url && url.startsWith('http') ? (
                    <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} />
                ) : (
                    <View style={{ width: '100%', height: '100%', backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontFamily: theme.fonts.headingBold, color: '#000', fontSize: size * 0.4 }}>
                            {fallbackName ? fallbackName.charAt(0).toUpperCase() : '?'}
                        </Text>
                    </View>
                )}
            </View>
            
            {/* Overlay Frame Border (this can rotate/pulse independently) */}
            {frame !== 'none' && (
                <Animated.View 
                    style={[
                        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius }, 
                        frameStyle
                    ]} 
                    pointerEvents="none"
                />
            )}
        </View>
    );
}
