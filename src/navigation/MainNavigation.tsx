import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/authContext';
import { Text, View } from 'react-native';
import MyTabs from './MyTabs';
import { EmailVerificationScreen } from '../screens/EmailVerificationScreen';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthStack } from './AuthStack';

const Stack = createStackNavigator();

export const MainNavigation = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text>Loading...</Text>
                <Text>Make sure you are connected to the internet.</Text>
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {user ? (
                    user.emailVerified ? (
                        <Stack.Screen name="MyTabs" component={MyTabs} />
                    ) : (
                        <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
                    )
                ) : (
                    <Stack.Screen name="Auth" component={AuthStack} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};