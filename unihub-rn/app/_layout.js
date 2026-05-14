import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';

function TabIcon({ emoji, focused }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.4 }}>
      {emoji}
    </Text>
  );
}

export default function RootLayout() {
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('unihub_token').then(token => {
      setAuthChecked(true);
      if (!token) {
        router.replace('/login');
      }
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
            height: 70,
            paddingBottom: 10,
            paddingTop: 8,
          },
          tabBarActiveTintColor: Colors.accent,
          tabBarInactiveTintColor: Colors.muted,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => <TabIcon emoji="⊞" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="schedule"
          options={{
            title: 'Schedule',
            tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: 'Tasks',
            tabBarIcon: ({ focused }) => <TabIcon emoji="☑" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="gpa"
          options={{
            title: 'GPA',
            tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => <TabIcon emoji="◎" focused={focused} />,
          }}
        />
        {/* Auth & feature screens — hidden from tab bar, no tab bar shown */}
        <Tabs.Screen name="login"      options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="register"   options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="pdf-upload" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
