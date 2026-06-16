import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import TimetableStack from './TimetableStack';
import AssignmentStack from './AssignmentStack';
import CommunityStack from './CommunityStack';
import ProfileScreen from '../screens/ProfileScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import MyPostsScreen from '../screens/community/MyPostsScreen';
import PostEditScreen from '../screens/community/PostEditScreen';
import BlockedUsersScreen from '../screens/community/BlockedUsersScreen';
import { colors } from '../constants/colors';
import { spacing, shadow } from '../constants/spacing';

const Tab = createBottomTabNavigator();
const ProfileStack = createNativeStackNavigator();

// 마이페이지 탭: Profile + MyPosts + PostEdit + PrivacyPolicy 스택
function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="MyPosts" component={MyPostsScreen} />
      <ProfileStack.Screen name="PostEdit" component={PostEditScreen} />
      <ProfileStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <ProfileStack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
    </ProfileStack.Navigator>
  );
}

// 로그인 후 보이는 하단 탭 5개
export default function MainTab() {
  return (
    <Tab.Navigator
      sceneContainerStyle={{ backgroundColor: colors.background }}
      screenOptions={{
        tabBarActiveTintColor: '#4F7CFF',
        tabBarInactiveTintColor: '#A7C4FF',
        // 고정형 탭바 — 흰 배경 + 위쪽으로 향하는 옅은 그림자 (후보 1 톤)
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          height: 80,
          paddingBottom: spacing.lg,
          paddingTop: spacing.sm,
          ...shadow.tabBar,
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
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Timetable"
        component={TimetableStack}
        options={{
          tabBarLabel: '時間割',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Assignment"
        component={AssignmentStack}
        options={{
          tabBarLabel: '課題',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'checkbox' : 'checkbox-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Community"
        component={CommunityStack}
        options={{
          tabBarLabel: '掲示板',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'マイページ',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
