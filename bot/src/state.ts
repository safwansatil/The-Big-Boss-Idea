export type Device = {
  id: string;
  name: string;
  type: 'fan' | 'light';
  room: 'drawing' | 'work1' | 'work2';
  status: 'on' | 'off';
  powerDraw: number;
  lastChanged: string;
};

export type UsagePayload = {
  totalWatts: number;
  perRoom: {
    drawing: number;
    work1: number;
    work2: number;
  };
};

export type Alert = {
  type: 'after-hours' | 'stuck-on';
  room: string;
  deviceIds: string[];
  message: string;
  timestamp: string;
};

export type SSEPayload = {
  devices: Device[];
  usage: UsagePayload;
  alerts: Alert[];
};

export interface BotState {
  devices: Device[];
  usage: UsagePayload | null;
  alerts: Alert[];
  sseConnected: boolean;
}

export const state: BotState = {
  devices: [],
  usage: null,
  alerts: [],
  sseConnected: false,
};
