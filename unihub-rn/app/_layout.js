import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

// One brand colour for every tab keeps the bar calm and consistent.
const TAB_ACTIVE   = Colors.accent;
const TAB_INACTIVE = Colors.muted;   // dark enough to read clearly when not selected

const TABS = [
  { name: 'index',    label: 'Home',     icon: 'home',           color: TAB_ACTIVE },
  { name: 'schedule', label: 'Schedule', icon: 'calendar',       color: TAB_ACTIVE },
  { name: 'tasks',    label: 'Tasks',    icon: 'checkmark-done', color: TAB_ACTIVE },
  { name: 'gpa',      label: 'GPA',      icon: 'bar-chart',      color: TAB_ACTIVE },
  { name: 'profile',  label: 'Profile',  icon: 'person',         color: TAB_ACTIVE },
];

// Icons are always filled so they stay easy to see; the selected tab
// pops up as a raised solid button with a white icon.
function TabIcon({ tab, focused }) {
  return (
    <View style={[
      {
        alignItems: 'center', justifyContent: 'center',
        width: 46, height: 34, borderRadius: 14,
      },
      focused && {
        backgroundColor: tab.color,
        transform: [{ translateY: -6 }, { scale: 1.08 }],
        shadowColor: tab.color, shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
      },
    ]}>
      <Ionicons
        name={tab.icon}
        size={22}
        color={focused ? 'white' : TAB_INACTIVE}
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
            height: Platform.OS === 'ios' ? 94 : 76,
            paddingBottom: Platform.OS === 'ios' ? 24 : 10,
            paddingTop: 12,
          },
          tabBarInactiveTintColor: TAB_INACTIVE,
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
        <Tabs.Screen name="forgot-password" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="pdf-upload" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="portal"     options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="study-planner" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="google-calendar" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="edit-profile"    options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="change-password" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
