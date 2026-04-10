import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import {AuthScreens, SignupScreen} from '../screens/AuthScreens';

const Stack = createStackNavigator();

export const AuthStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={AuthScreens} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
};

