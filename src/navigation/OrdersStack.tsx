import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OrdersScreen from '../screens/OrdersScreen';
import MapScreen from '../screens/MapScreen';

const Stack = createStackNavigator();

export const OrdersStack = () => {
    return (
        <Stack.Navigator
            screenOptions={({ navigation }) => ({
                headerTitleStyle: {
                    fontWeight: 'bold',
                    fontSize: 24,
                    color: '#5A9AA9',
                },
                headerStyle: {
                    backgroundColor: '#f5f5f5',
                },
                headerTintColor: '#5A9AA9',
                headerLeft: () => (
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 10 }}>
                        <Ionicons name="arrow-back" size={28} color="#5A9AA9" />
                    </TouchableOpacity>
                ),
            })}
        >
            <Stack.Screen
                name="OrdersScreen"
                component={OrdersScreen}
                options={{
                    title: 'Orders',
                    headerLeft: () => <></>
                }}
            />
            <Stack.Screen
                name="MapScreen"
                component={MapScreen}
                options={{ title: 'Map' }}
            />
        </Stack.Navigator>
    );
};
