import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import Head from 'expo-router/head';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { auth, db } from '../../firebase';

export default function TabLayout() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
            
            const fetchPending = async () => {
              const today = new Date();
              const curMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
              const snap = await getDocs(collection(db, 'users'));
              let submitted = 0;
              let unsubmitted = 0;
              snap.forEach(d => {
                const u = d.data();
                if (u.role !== 'admin') {
                  const status = u.monthlyStatus?.[curMonthKey];
                  if (status === 'submitted') submitted++;
                  else if (!status && today.getDate() >= 25) unsubmitted++;
                }
              });
              setPendingCount(submitted + unsubmitted);
            };
            fetchPending();
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <>
      {Platform.OS === 'web' && (
        <Head>
          <link rel="manifest" href="/manifest.json" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
        </Head>
      )}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#B8860B',
          tabBarInactiveTintColor: '#64748b',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E2E8F0',
            height: Platform.OS === 'android' ? 100 : 85,
            paddingBottom: Platform.OS === 'android' ? 40 : 25,
            paddingTop: 10,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: 'bold',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: '直近のシフト',
            tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="shift-input"
          options={{
            title: 'シフト希望',
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
          }}
        />
        
        <Tabs.Screen
          name="attendance"
          options={{
            title: '出勤簿',
            tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} />,
            href: isAdmin ? null : undefined,
          }}
        />

        <Tabs.Screen
          name="event-schedule"
          options={{
            title: 'イベント',
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
            href: isAdmin ? '/event-schedule' : null, 
          }}
        />

        <Tabs.Screen
          name="admin-menu"
          options={{
            title: 'メニュー',
            tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
            tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
            tabBarBadgeStyle: { backgroundColor: '#EF4444', color: '#FFF' },
            href: isAdmin ? '/admin-menu' : null, 
          }}
        />
        
        <Tabs.Screen name="account" options={{ href: null }} />
        <Tabs.Screen name="shift-auto-settings" options={{ href: null }} />
        <Tabs.Screen name="approval" options={{ href: null }} />
        <Tabs.Screen name="salary-calc" options={{ href: null }} />
        <Tabs.Screen name="shift-settings" options={{ href: null }} />
        <Tabs.Screen name="event" options={{ href: null }} />
        <Tabs.Screen name="events" options={{ href: null }} />
        <Tabs.Screen name="explore" options={{ href: null }} />
      </Tabs>
    </>
  );
}