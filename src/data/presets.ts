import { PresetCategory } from '../types';

export const PRESETS: PresetCategory[] = [
  {
    id: 'nature',
    name: 'Nature & Adventure',
    icon: 'Trees',
    words: ['path', 'forest', 'rustle', 'ancient', 'whisper', 'shadow']
  },
  {
    id: 'technology',
    name: 'Tech & Digital Life',
    icon: 'Laptop',
    words: ['device', 'virtual', 'connect', 'algorithm', 'innovative', 'screen']
  },
  {
    id: 'emotions',
    name: 'Feelings & Relationships',
    icon: 'Heart',
    words: ['overwhelmed', 'cherish', 'joyful', 'bond', 'anxious', 'sincere']
  },
  {
    id: 'travel',
    name: 'Travel & Exploration',
    icon: 'Plane',
    words: ['wander', 'luggage', 'destination', 'explore', 'local', 'memorable']
  },
  {
    id: 'daily_life',
    name: 'Daily Routines',
    icon: 'Clock',
    words: ['concentrate', 'deadline', 'habit', 'collaborative', 'schedule', 'productive']
  }
];
