import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ManabaLoginScreen from '../screens/manaba/ManabaLoginScreen';
import ManabaNoticeListScreen from '../screens/manaba/ManabaNoticeListScreen';
import ManabaNoticeDetailScreen from '../screens/manaba/ManabaNoticeDetailScreen';
import { colors } from '../constants/colors';

const Stack = createNativeStackNavigator();

export default function ManabaStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="ManabaLogin" component={ManabaLoginScreen} />
      <Stack.Screen name="ManabaNoticeList" component={ManabaNoticeListScreen} />
      <Stack.Screen name="ManabaNoticeDetail" component={ManabaNoticeDetailScreen} />
    </Stack.Navigator>
  );
}
