export interface GeoJSONFeature {
  type: "Feature";
  id?: string; // GeoJSON standard often puts id at the root
  properties: {
    name: string;
    id?: string;
    [key: string]: any;
  };
  geometry: {
    type: string;
    coordinates: any[];
  };
}

export interface GeoJSONCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

export enum GameStatus {
  LOADING = "LOADING",
  IDLE = "IDLE",     // Main Menu / Setup
  PLAYING = "PLAYING", // Zoomed in, guessing
  SUCCESS = "SUCCESS", // Correct guess
  FAILURE = "FAILURE"  // Gave up or out of lives
}

export interface Hint {
  text: string;
  level: 'easy' | 'medium' | 'hard';
}

export interface CountryDetails {
  flag: string;
  name: string;
  capital?: string;
  region?: string;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  color: string; // CSS color class for UI distinction
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
}