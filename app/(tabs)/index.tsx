import { View, Text } from "react-native";
export default function Home() {
  return (
    <View style={{ flex:1, alignItems:"center", justifyContent:"center", padding:16 }}>
      <Text style={{ fontSize:18, fontWeight:"600" }}>
        Offline Remittance (Demo)
      </Text>
      <Text style={{ marginTop:8, textAlign:"center" }}>
        Use the tabs below: Send • History • KYC
      </Text>
    </View>
  );
}