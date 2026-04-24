import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import TimetableStack from './TimetableStack';
import AssignmentStack from './AssignmentStack';
import CommunityStack from './CommunityStack';
import ProfileScreen from '../screens/ProfileScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import { colors } from '../constants/colors';

const Tab = createBottomTabNavigator();
const ProfileStack = createNativeStackNavigator();

// 마이페이지 탭: ProfileScreen + PrivacyPolicyScreen 스택
function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </ProfileStack.Navigator>
  );
}

// 로그인 후 보이는 하단 탭 5개
export default function MainTab() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDisabled,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 80,
          paddingBottom: 16,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'ホーム',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="Timetable"
        component={TimetableStack}
        options={{
          tabBarLabel: '時間割',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📅</Text>,
        }}
      />
      <Tab.Screen
        name="Assignment"
        component={AssignmentStack}
        options={{
          tabBarLabel: '課題',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📝</Text>,
        }}
      />
      <Tab.Screen
        name="Community"
        component={CommunityStack}
        options={{
          tabBarLabel: '掲示板',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>💬</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'マイページ',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
}
