import { Tabs } from "expo-router";

export default function Layout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="send" options={{ title: "Send" }} />
      <Tabs.Screen name="history" options={{ title: "History" }} />
      <Tabs.Screen name="kyc" options={{ title: "KYC" }} />
    </Tabs>
  );
}