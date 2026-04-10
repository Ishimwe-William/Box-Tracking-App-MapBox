import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { styles, COLORS } from '../styles/styles';
import MyButton from '../components/MyButton';
import { useAuth } from '../context/authContext';
import { sendEmailVerification } from 'firebase/auth';

export const EmailVerificationScreen: React.FC = () => {
    const { user, logout } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleResendVerification = async () => {
        if (!user) return;
        try {
            setIsLoading(true);
            await sendEmailVerification(user);
            Alert.alert('Email Sent', 'Please check your inbox (and spam folder!) to click the verification link.');
        } catch (error) {
            Alert.alert('Error', 'Failed to send verification email. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = async () => {
        if (!user) return;
        try {
            setIsLoading(true);
            await user.reload();
            // After reload, onAuthStateChanged fires automatically with the refreshed user.
            // If your auth context checks emailVerified, navigation will update on its own.
            // Only alert if still not verified.
            if (!user.emailVerified) {
                Alert.alert('Not Yet Verified', 'Your email is not verified yet. Please check your inbox and spam folder.');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to refresh status. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Verify Your Email</Text>

            <Text style={styles.subtitle}>
                A verification link has been sent to:
            </Text>

            <Text style={[styles.subtitle, { fontWeight: '600', color: COLORS.primary }]}>
                {user?.email}
            </Text>

            <Text style={[styles.subtitle, { marginTop: 16 }]}>
                Click the link in the email, then tap the button below.
            </Text>

            {/* Added the Spam Folder Notice Here */}
            <Text style={[styles.subtitle, { marginTop: 8, fontSize: 14, fontStyle: 'italic', color: '#666' }]}>
                (If you don't see it, please check your spam or junk folder.)
            </Text>

            <View style={{ marginTop: 24, width: '100%' }}>
                <MyButton
                    title="I've Verified My Email"
                    handleSubmit={handleRefresh}
                    isLoading={isLoading}
                />
                <MyButton
                    title="Resend Verification Email"
                    handleSubmit={handleResendVerification}
                    isLoading={isLoading}
                />
                <MyButton
                    title="Logout"
                    handleSubmit={logout}
                    isLoading={false}
                />
            </View>
        </View>
    );
};