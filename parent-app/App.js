import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import OMRViewScreen from './src/screens/OMRViewScreen';
import { colors } from './src/theme/colors';
import { View, ActivityIndicator, Alert } from 'react-native';

const Stack = createStackNavigator();

function NavigationLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          cardStyle: { backgroundColor: colors.background }
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Attendance" component={AttendanceScreen} />
            <Stack.Screen name="Results" component={ResultsScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="OMRView" component={OMRViewScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    async function checkForUpdates() {
      if (__DEV__) return; // Don't check in dev mode
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          Alert.alert(
            "New Update Available",
            "A new version of Career Xone Parent is ready! Let's update it to get the latest features.",
            [
              {
                text: "Update Now",
                onPress: async () => {
                  try {
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                  } catch (err) {
                    console.log("Failed to fetch update:", err);
                  }
                }
              }
            ],
            { cancelable: false } // Force update
          );
        }
      } catch (error) {
        console.log("Error checking for updates:", error);
      }
    }
    
    checkForUpdates();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <NavigationLayout />
    </AuthProvider>
  );
}
