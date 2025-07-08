export interface TelemetryData {
  speedMph?: number;
  engineRPM?: number;
  currentGear?: number;
  suggestedGear?: number;
  maxRPM?: number;
  fuelLevel?: number;
  fuelConsumptionRate?: number;
  oilTemp?: number;
  waterTemp?: number;
  boost?: number;
  throttlePercent?: number;
  brakePercent?: number;
  lapCount?: number;
  totalLaps?: number;
  currentPosition?: number;
  deltaTime?: number;
  bestLaptime?: number;
  lastLaptime?: number;
  currentLaptime?: number;
  carCode?: number;
  engineMap?: number;
  brakeBalance?: number;
  tyreTemp?: number[];
  tyreSlipRatio?: number[];
  simulatorFlags?: {
    handbrakeActive?: boolean;
    lightsActive?: boolean;
    revLimiterAlert?: boolean;
    paused?: boolean;
    tcsActive?: boolean;
    tcsLevel?: number;
    asmActive?: boolean;
    absLevel?: number;
  };
  packetId?: number;
}

export interface EngineerAudioFiles {
  startSound: string;
  endSound: string;
  idleSound: string;
}