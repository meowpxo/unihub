import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const TABS = [
  { name: 'index',    label: 'Home',     icon: 'home',           iconOut: 'home-outline',           color: '#4f8ef7' },
  { name: 'schedule', label: 'Schedule', icon: 'calendar',       iconOut: 'calendar-outline',       color: '#38c9a0' },
  { name: 'tasks',    label: 'Tasks',    icon: 'checkmark-done', iconOut: 'checkmark-done-outline', color: '#7b5ea7' },
  { name: 'gpa',      label: 'GPA',      icon: 'bar-chart',      iconOut: 'bar-chart-outline',      color: '#f0a500' },
  { name: 'profile',  label: 'Profile',  icon: 'person',         iconOut: 'person-outline',         color: '#e8604c' },
];

function TabIcon({ tab, focused }) {
  return (
    <View style={{
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: focused ? `${tab.color}22` : 'transparent',
      borderRadius: 12,
      width: 44, height: 30,
    }}>
      <Ionicons
        name={focused ? tab.icon : tab.iconOut}
        size={focused ? 22 : 20}
        color={focused ? tab.color : '#b0b8cc'}
      />
    </View>
  );
}

export default function RootLayout() {
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('unihub_token').then(token => {
      setAuthChecked(true);
      if (!token) router.replace('/login');
    });
  }, []);

  if (!authChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={Colors.bg} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            height: Platform.OS === 'ios' ? 88 : 68,
            paddingBottom: Platform.OS === 'ios' ? 24 : 10,
            paddingTop: 6,
          },
          tabBarInactiveTintColor: '#b0b8cc',
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.3,
            marginTop: 1,
          },
        }}
      >
        {TABS.map(tab => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.label,
              tabBarActiveTintColor: tab.color,
              tabBarIcon: ({ focused }) => (
                <TabIcon tab={tab} focused={focused} />
              ),
            }}
          />
        ))}

        <Tabs.Screen name="login"      options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="register"   options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="pdf-upload" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
