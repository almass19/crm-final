import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '../lib/constants';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return <Redirect href={user ? '/(tabs)/clients' : '/(auth)/login'} />;
}
