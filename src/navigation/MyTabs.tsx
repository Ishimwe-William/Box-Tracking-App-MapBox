import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import HomeScreen from '../screens/HomeScreen';
import AdminPanel from '../screens/AdminPanel';
import ProfileScreen from '../screens/ProfileScreen';
import OrderImagesScreen from '../screens/OrderImagesScreen';
import {useAuth} from '../context/authContext';
import {OrdersStack} from './OrdersStack';

export type TabParamList = {
    Home: undefined;
    AdminPanel: undefined;
    Orders: undefined;
    OrderImages: undefined;
    Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const MyTabs: React.FC = () => {
    const {userRole} = useAuth();

    return (
        <Tab.Navigator
            screenOptions={({route}) => ({
                tabBarIcon: ({focused, color, size}) => {
                    let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'home';

                    if (route.name === 'Home') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'AdminPanel') {
                        iconName = focused ? 'settings' : 'settings-outline';
                    } else if (route.name === 'Orders') {
                        iconName = focused ? 'cart' : 'cart-outline';
                    } else if (route.name === 'OrderImages') {
                        iconName = focused ? 'image' : 'image-outline';
                    } else if (route.name === 'Profile') {
                        iconName = focused ? 'person-circle' : 'person-circle-outline';
                    }

                    return <Ionicons name={iconName} size={size} color={color}/>;
                },
                tabBarActiveTintColor: '#5A9AA9',
                tabBarInactiveTintColor: 'gray',
                headerTitleStyle: {
                    fontWeight: 'bold',
                    fontSize: 24,
                    color: '#5A9AA9',
                },
                headerStyle: {
                    backgroundColor: '#f5f5f5',
                },
            })}
        >

            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    title: 'Home',
                }}
            />
            <Tab.Screen
                name="Orders"
                component={OrdersStack}
                options={{
                    headerShown: false,
                }}
            />
            {userRole === 'Admin' && (
                <>
                    <Tab.Screen
                        name="OrderImages"
                        component={OrderImagesScreen}
                        options={{
                            title: 'Order Images',
                        }}
                    />
                    <Tab.Screen
                        name="AdminPanel"
                        component={AdminPanel}
                        options={{
                            title: 'Admin Panel',
                        }}
                    />
                </>
            )}
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    title: 'Profile',
                }}
            />
        </Tab.Navigator>
    );
};

export default MyTabs;