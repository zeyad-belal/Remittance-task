import { ScreenContent } from 'components/ScreenContent';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

import './global.css';

export default function App() {
  return (
    <>
    <Text className='text-xl text-yellow-300'>Welcome to the App!</Text>
      <ScreenContent title="Home" path="App.tsx"></ScreenContent>
      <StatusBar style="auto" />
    </>
  );
}
