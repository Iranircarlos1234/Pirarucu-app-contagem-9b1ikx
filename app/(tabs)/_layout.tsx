import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          height: 70,
          paddingTop: 8,
          paddingBottom: 8,
          paddingHorizontal: 16,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#1E40AF',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Contagem',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="add-circle" size={size} color={color} />
          ),
          headerTitle: 'Registro de Contagem',
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: 'Resumo',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="analytics" size={size} color={color} />
          ),
          headerTitle: 'Resumo de Contagens',
        }}
      />
      <Tabs.Screen
        name="relatorio"
        options={{
          title: 'Relatório Final',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="table-chart" size={size} color={color} />
          ),
          headerTitle: 'Relatório Final',
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sincronizar',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="sync" size={size} color={color} />
          ),
          headerTitle: 'Sincronização de Dados',
        }}
      />
    </Tabs>
  );
}