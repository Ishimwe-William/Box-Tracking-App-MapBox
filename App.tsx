import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/authContext';
import { MainNavigation } from './src/navigation/MainNavigation';

export default function App() {
  return (
    <AuthProvider>
      <MainNavigation />
      <StatusBar style="dark" />
    </AuthProvider>
  );
}
