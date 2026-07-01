export interface VocabularyItem {
  original: string;
  contextEnglish: string;
  contextRussian: string;
  contextUzbek: string;
  russianMeaning: string;
  uzbekMeaning: string;
  explanation: string;
}

export interface StoryResponse {
  title: string;
  englishStory: string;
  russianTranslation: string;
  uzbekTranslation: string;
  vocabularyMapping: VocabularyItem[];
}

export type LearningLevel =
  | 'Beginner'
  | 'Elementary'
  | 'Pre-Intermediate'
  | 'Intermediate'
  | 'Upper-Intermediate'
  | 'IELTS';

export interface PresetCategory {
  id: string;
  name: string;
  icon: string;
  words: string[];
}
