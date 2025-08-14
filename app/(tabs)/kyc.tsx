import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { exec } from '@db/db';

import { enqueue } from '@sync/outbox';

export default function KycTab() {
  async function capture() {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: false });
    if (res.canceled) return;
    const asset = res.assets[0];
    const docId = String(Date.now());
    await exec(`INSERT INTO kyc_docs (id,userId,uri,mime,uploadedAt) VALUES (?,?,?,?,?)`, [
      docId,
      'demo-user',
      asset.uri,
      asset.mimeType ?? 'image/jpeg',
      Date.now(),
    ]);
    enqueue('KYC_UPLOAD', 'kyc_docs', docId, {
      docId,
      uri: asset.uri,
      mime: asset.mimeType ?? 'image/jpeg',
    });
    Alert.alert('Queued', 'KYC document queued for upload.');
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text>Take a photo of your ID/Passport (Demo)</Text>
      <TouchableOpacity
        onPress={capture}
        style={{ padding: 16, backgroundColor: '#0A7', borderRadius: 10 }}>
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Capture KYC</Text>
      </TouchableOpacity>
    </View>
  );
}
