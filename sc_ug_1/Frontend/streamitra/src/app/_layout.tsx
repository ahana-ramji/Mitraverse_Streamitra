import { Image } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';

function LogoTitle() {
  return (
    <Image
      style={{ width: 32, height: 32 }}
      source={require('../assets/icon.png')}
    />
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          headerTitleAlign: 'center',
          headerTintColor: '#111',          // hamburger icon + title color
          headerStyle: { backgroundColor: '#fff' },
          drawerActiveTintColor: '#5b4bdb',
        }}
      >
        <Drawer.Screen
          name="index"
          options={{
            title: 'Streamitra',               // top label (header)
            drawerLabel: 'Home',               // label in the drawer menu
            headerTitle: 'Home',            // logo in the header
          }}
        />
        <Drawer.Screen
          name="settings"
          options={{ title: 'Settings', drawerLabel: 'Settings' }}
        />
        <Drawer.Screen
          name="upload_dash"
          options={{ title: 'Upload', drawerLabel: 'Upload video' }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}