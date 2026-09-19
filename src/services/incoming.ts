import { requireNativeModule } from 'expo';
export const incomingFiles = requireNativeModule<{ takeFile(): Promise<{ uri: string; name: string } | null> }>('MarchMapIncoming');
