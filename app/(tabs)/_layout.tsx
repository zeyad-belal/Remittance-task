import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function Layout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap ='link';

          if (route.name === "index") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "send") {
            iconName = focused ? "send" : "send-outline";
          } else if (route.name === "history") {
            iconName = focused ? "time" : "time-outline";
          } else if (route.name === "kyc") {
            iconName = focused ? "person" : "person-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "blue",
        tabBarInactiveTintColor: "gray",
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="send" options={{ title: "Send" }} />
      <Tabs.Screen name="history" options={{ title: "History" }} />
      <Tabs.Screen name="kyc" options={{ title: "KYC" }} />
    </Tabs>
  );
}