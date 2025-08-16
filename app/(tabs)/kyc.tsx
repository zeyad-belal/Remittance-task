// KycScreen.tsx
import { startKyc ,Cybrid } from "@services/cybrid";
import { WebView } from "react-native-webview";
import  { useEffect, useState } from "react";
import { Button } from "react-native";
export default function KycScreen() {
  const [url, setUrl] = useState<string | null>(null);

  async function begin() {
    const iv = await startKyc("<CUSTOMER_GUID>");
    setUrl(iv.redirect_url!); // provided by Cybrid (Persona session)
  }
useEffect(()=>{
  async function fetchKycStatus(guid: string) {

    const iv = await Cybrid.kyc.getIdentityVerification({ identityVerificationGuid: guid }).toPromise();
    if (iv.state === "completed") { /* enable trading */ }
  }
fetchKycStatus("<CUSTOMER_GUID>"); // replace with actual customer GUID
},[])

  return url ? (
    <WebView source={{ uri: url }} onNavigationStateChange={(e) => {
      // detect success/cancel callback urls if configured
      // then mark customer as verified locally and return to app
    }} />
  ) : (
    <Button title="Start KYC" onPress={begin} />
  );
}