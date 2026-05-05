import React, { useEffect, useState, useRef } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import { styles, COLORS } from '../styles/styles';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import CircleLogo from '../components/CircleLogo';
import MyButton from '../components/MyButton';
import LinkButton from '../components/LinkButton';
import MessagePopup from '../components/MessagePopup';

type AuthStackParamList = {
    Login: undefined;
    Signup: undefined;
};

// Shared wrapper that fixes KeyboardAvoidingView on both iOS and Android
const AuthLayout: React.FC<{
    children: React.ReactNode;
    error: string;
    type: 'success' | 'error';
    showError: boolean
}> = ({
          children,
          error,
          type,
          showError,
      }) => (
    <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#f4f6f6' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
        <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            {children}
        </ScrollView>
        {/* Stays outside ScrollView so it floats above keyboard */}
        <MessagePopup text={error} type={type} visible={showError} />
    </KeyboardAvoidingView>
);

// Hook to avoid duplicating error-toast logic
const useErrorToast = () => {
    const [error, setError] = useState('');
    const [showError, setShowError] = useState(false);
    const [type, setType] = useState<'success' | 'error'>('success');

    useEffect(() => {
        if (!error) return;
        setShowError(true);
        setType('error');
        const timer = setTimeout(() => {
            setShowError(false);
            setError('');
        }, 7000);
        return () => clearTimeout(timer);
    }, [error]);

    return { error, setError, showError, type };
};

// ─── Login Screen ────────────────────────────────────────────────────────────

const AuthScreens: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { error, setError, showError, type } = useErrorToast();
    const navigation = useNavigation<StackNavigationProp<AuthStackParamList>>();

    // Ref for the password input to handle programmatic focus
    const passwordRef = useRef<TextInput>(null);

    const handleLogin = async () => {
        if (!email.trim() || !password) {
            setError('Please enter both email and password.');
            return;
        }
        try {
            setIsLoading(true);
            const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
            const user = userCredential.user;
            const userDoc = await getDoc(doc(db, 'users', user.uid));

        } catch (error: any) {
            let err = error.message;
            setError('Failed to login. Please check your credentials.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout error={error} type={type} showError={showError}>
            <View style={{ alignItems: 'center' }}>
                <CircleLogo source={require('../../assets/package.png')} />
                <Text style={styles.title}>Login</Text>
            </View>
            <Text style={styles.subtitle}>Welcome back! Please enter your details.</Text>
            <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
            />
            <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
            />
            <View style={{ marginTop: 10 }}>
                <MyButton title="Login" handleSubmit={handleLogin} isLoading={isLoading} />
                <LinkButton
                    size={14}
                    weight="400"
                    color="#5A9AA9"
                    title="Don't have an account? Sign Up"
                    onClick={() => navigation.navigate('Signup')}
                />
            </View>
        </AuthLayout>
    );
};

// ─── Signup Screen ───────────────────────────────────────────────────────────

const SignupScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { error, setError, showError, type } = useErrorToast();
    const navigation = useNavigation<StackNavigationProp<AuthStackParamList>>();

    // Ref for the password input to handle programmatic focus
    const passwordRef = useRef<TextInput>(null);

    const handleSignup = async () => {
        if (!email.trim() || !password) {
            setError('Please enter both email and password.');
            return;
        }
        try {
            setIsLoading(true);
            const createdUser = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
            await setDoc(doc(db, 'users', createdUser.user.uid), {
                role: 'User',
                email: email.trim().toLowerCase(),
            });
            await sendEmailVerification(createdUser.user);
        } catch (error: any) {
            let err = error.message;
            if (err.includes("Firebase: Error (auth/email-already-in-use)."))
                setError("Email already in use. Please use a different email or log in.")
            else if (err.includes("Password should be at least 6"))
                setError("Password must be at least 6 characters long.")
            else
                setError('Failed to create an account. Please try again.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout error={error} type={type} showError={showError}>
            <View style={{ alignItems: 'center' }}>
                <CircleLogo source={require('../../assets/package.png')} />
                <Text style={styles.title}>Sign Up</Text>
            </View>
            <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
            />
            <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSignup}
            />
            <View style={{ marginTop: 10 }}>
                <MyButton title="Sign Up" handleSubmit={handleSignup} isLoading={isLoading} />
                <LinkButton
                    size={14}
                    weight="400"
                    color="#5A9AA9"
                    title="Already have an account? Log In"
                    onClick={() => navigation.navigate('Login')}
                />
            </View>
        </AuthLayout>
    );
};

export { AuthScreens, SignupScreen };