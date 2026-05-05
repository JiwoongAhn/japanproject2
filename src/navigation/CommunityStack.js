import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PostListScreen from '../screens/community/PostListScreen';
import PostCreateScreen from '../screens/community/PostCreateScreen';
import PostDetailScreen from '../screens/community/PostDetailScreen';
import PostEditScreen from '../screens/community/PostEditScreen';

// 게시판 탭 안에서만 사용하는 스택 네비게이터
const Stack = createNativeStackNavigator();

export default function CommunityStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PostList" component={PostListScreen} />
      <Stack.Screen name="PostCreate" component={PostCreateScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="PostEdit" component={PostEditScreen} />
    </Stack.Navigator>
  );
}
