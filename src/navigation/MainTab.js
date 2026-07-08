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
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';
import MyPostsScreen from '../screens/community/MyPostsScreen';
import PostEditScreen from '../screens/community/PostEditScreen';
import BlockedUsersScreen from '../screens/community/BlockedUsersScreen';
import { colors } from '../constants/colors';
import AnimatedTabBar from './AnimatedTabBar';
import { TabBarScrollProvider } from './TabBarScrollContext';

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
      <ProfileStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <ProfileStack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
    </ProfileStack.Navigator>
  );
}

// 로그인 후 보이는 하단 탭 5개
export default function MainTab() {
  return (
    <TabBarScrollProvider>
    <Tab.Navigator
      sceneContainerStyle={{ backgroundColor: colors.background }}
      // 스크롤 방향에 따라 커지고/작아지는 토스풍 커스텀 탭바 (아이콘+라벨 ↔ 아이콘만)
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{
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
          // 다른 탭으로 벗어나면 게시판 스택을 항상 첫 화면(글 목록)으로 되돌림
          // → 홈에서 글 상세로 진입한 뒤 게시판 탭을 눌러도 글 목록이 보이게
          popToTopOnBlur: true,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={24} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          // 게시판 탭을 누르면 항상 글 목록(PostList)으로 진입시킨다.
          // popToTopOnBlur는 '탭을 벗어날 때'만 리셋하므로, 홈 등에서 글 상세로 딥 진입해
          // 게시판 탭이 blur 없이 focus된 상태로 남으면 탭을 다시 눌러도 상세에 머무는
          // 버그가 있었다(가끔 마지막 페이지로 들어가지던 현상). 이를 tabPress에서 직접 커버.
          tabPress: () => {
            navigation.navigate('Community', { screen: 'PostList' });
          },
        })}
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
    </TabBarScrollProvider>
  );
}
