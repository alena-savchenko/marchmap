import { requireNativeModule } from 'expo';
import type { IncomingFile } from './incomingFile';
export const incomingFiles = requireNativeModule<{ takeFile(labels: { title: string; cancel: string }): Promise<IncomingFile | null> }>('MarchMapIncoming');
