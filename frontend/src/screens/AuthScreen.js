import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { supabase } from '../supabase';
import { theme } from '../styles/theme';

export default function AuthScreen({ setScreen }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  async function handleAuth() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        Alert.alert('Login Failed', error.message);
      } else {
        setScreen('Home');
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        Alert.alert('Signup Failed', error.message);
      } else {
        Alert.alert('Success', 'Account created! You are now logged in.');
        setScreen('Home');
      }
    }
    
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: Platform.OS === 'web' ? window.location.href : undefined,
      }
    });
    if (error) {
      Alert.alert('Google Login Failed', error.message);
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            onChangeText={setEmail}
            value={email}
            placeholder="player@example.com"
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            onChangeText={setPassword}
            value={password}
            placeholder="••••••••"
            placeholderTextColor={theme.colors.muted}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isLogin ? 'LOGIN' : 'SIGN UP'}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity 
          style={[styles.googleButton, loading && styles.buttonDisabled]} 
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toggleButton} 
          onPress={() => setIsLogin(!isLogin)}
          disabled={loading}
        >
          <Text style={styles.toggleButtonText}>
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => setScreen('Home')}>
          <Text style={styles.backButtonText}>Cancel</Text>
        </TouchableOpacity>
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
    padding: theme.spacing.xl,
    justifyContent: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 40,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xxl,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.sm,
    fontSize: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontFamily: theme.fonts.body,
    fontSize: 16,
    color: theme.colors.foreground,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    borderBottomWidth: 6,
    borderBottomColor: '#BE123C',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: theme.colors.onPrimary,
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
    letterSpacing: 1,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  divider: {
    flex: 1,
    height: 2,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.muted,
    marginHorizontal: theme.spacing.md,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderBottomWidth: 6,
    borderBottomColor: theme.colors.border,
  },
  googleButtonText: {
    color: theme.colors.foreground,
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
  },
  toggleButton: {
    marginTop: theme.spacing.xl,
    alignItems: 'center',
  },
  toggleButtonText: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.secondary,
    fontSize: 16,
  },
  backButton: {
    marginTop: theme.spacing.xl,
    alignItems: 'center',
  },
  backButtonText: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.muted,
    fontSize: 16,
  },
});
