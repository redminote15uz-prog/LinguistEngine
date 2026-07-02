import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  BookOpen, 
  Layers, 
  Plus, 
  X, 
  ArrowRight, 
  RefreshCw, 
  AlertCircle, 
  HelpCircle, 
  GraduationCap, 
  Bookmark, 
  BookmarkCheck, 
  Trash2, 
  Calendar, 
  Download, 
  Search, 
  Volume2, 
  VolumeX,
  FileSpreadsheet,
  Sun,
  Moon
} from 'lucide-react';
import PresettedWords from './components/PresettedWords';
import StoryViewer from './components/StoryViewer';
import WordList from './components/WordList';
import VocabularyQuiz from './components/VocabularyQuiz';
import { StoryResponse, LearningLevel, VocabularyItem } from './types';

const LEVEL_DESCRIPTIONS: Record<LearningLevel, { levelCode: string; desc: string }> = {
  Beginner: { levelCode: 'A1', desc: 'Direct present tense, basic sentences, highly repetitive and clear structures.' },
  Elementary: { levelCode: 'A2', desc: 'Simple past/present situations, essential everyday vocabulary.' },
  'Pre-Intermediate': { levelCode: 'B1', desc: 'Basic connectors, simple descriptive scenes, and everyday travel scenarios.' },
  Intermediate: { levelCode: 'B2', desc: 'Compound sentences, standard narrative tenses, and diverse expressiveness.' },
  'Upper-Intermediate': { levelCode: 'C1', desc: 'Complex idioms, varied grammatical forms, nuanced storytelling.' },
  IELTS: { levelCode: 'Band 7+', desc: 'Academic grammar, formal structures, sophisticated lexical resource and cohesive links.' }
};

const LOADING_STEPS = [
  'Whispering your vocabulary words to the AI...',
  'Structuring a custom plot suitable for your chosen language level...',
  'Generating level-appropriate English story text...',
  'Translating and matching Russian equivalent contexts...',
  'Translating and parsing Uzbek grammatical inflections...',
  'Tagging targets with precision <hl> highlights in all texts...',
  'Waking up the Gemini TTS narrator voices...'
];

export default function App() {
  const [words, setWords] = useState<string[]>(['ancient', 'whisper', 'forest', 'path', 'rustle']);
  const [currentWordInput, setCurrentWordInput] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<LearningLevel>('Intermediate');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>('nature');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [storyResult, setStoryResult] = useState<StoryResponse | null>(null);
  const [activeLangTab, setActiveLangTab] = useState<'en' | 'ru' | 'uz' | 'parallel'>('en');
  const [highlightedWord, setHighlightedWord] = useState<string | null>(null);

  // Saved Stories and Saved Vocabulary lists with LocalStorage persistence
  const [savedStories, setSavedStories] = useState<(StoryResponse & { id: string; savedAt: string; level: LearningLevel; wordsUsed: string[] })[]>(() => {
    try {
      const stored = localStorage.getItem('polystory_saved_stories_v1');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [savedWords, setSavedWords] = useState<(VocabularyItem & { savedAt: string; level: LearningLevel })[]>(() => {
    try {
      const stored = localStorage.getItem('polystory_saved_words_v1');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<'weaver' | 'history' | 'vocabulary' | 'quiz'>('weaver');
  const [savedWordsSearch, setSavedWordsSearch] = useState('');
  const [playingSavedWord, setPlayingSavedWord] = useState<string | null>(null);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('polystory_dark_mode_v1') === 'true';
    } catch {
      return false;
    }
  });

  // Sync dark theme to root element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark', 'bg-slate-950');
      localStorage.setItem('polystory_dark_mode_v1', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark', 'bg-slate-950');
      localStorage.setItem('polystory_dark_mode_v1', 'false');
    }
  }, [isDarkMode]);

  // Sync to local storage on state change
  useEffect(() => {
    localStorage.setItem('polystory_saved_stories_v1', JSON.stringify(savedStories));
  }, [savedStories]);

  useEffect(() => {
    localStorage.setItem('polystory_saved_words_v1', JSON.stringify(savedWords));
  }, [savedWords]);

  // Cycle through loading steps to reassure the user
  const startLoadingSteps = () => {
    setLoadingStepIndex(0);
    const interval = setInterval(() => {
      setLoadingStepIndex((prev) => {
        if (prev < LOADING_STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 2800);
    return interval;
  };

  const addWord = () => {
    const trimmed = currentWordInput.trim().toLowerCase();
    if (!trimmed) return;
    
    // Support comma or space separated pastes
    const splitWords = trimmed
      .split(/[\s,]+/)
      .map((w) => w.replace(/[^a-zA-Z-]/g, '').trim())
      .filter((w) => w.length > 0);

    const newWords = [...words];
    let addedAny = false;

    splitWords.forEach((word) => {
      if (!newWords.includes(word)) {
        newWords.push(word);
        addedAny = true;
      }
    });

    if (addedAny) {
      setWords(newWords);
      setSelectedPresetId(null);
    }
    setCurrentWordInput('');
  };

  const removeWord = (indexToRemove: number) => {
    setWords(words.filter((_, idx) => idx !== indexToRemove));
    setSelectedPresetId(null);
  };

  const handleSelectPreset = (presetWords: string[]) => {
    setWords(presetWords);
    // Find preset ID
    if (presetWords.includes('path')) setSelectedPresetId('nature');
    else if (presetWords.includes('device')) setSelectedPresetId('technology');
    else if (presetWords.includes('overwhelmed')) setSelectedPresetId('emotions');
    else if (presetWords.includes('wander')) setSelectedPresetId('travel');
    else if (presetWords.includes('concentrate')) setSelectedPresetId('daily_life');
  };

  const generateStory = async () => {
    if (words.length === 0) {
      setErrorMsg('Please provide at least one vocabulary word to weave into the story.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setStoryResult(null);
    setHighlightedWord(null);
    setActiveLangTab('en');

    const loadingInterval = startLoadingSteps();

    try {
      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vocabulary: words,
          level: selectedLevel
        })
      });

      clearInterval(loadingInterval);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to weave story. Please retry.');
      }

      const data: StoryResponse = await response.json();
      setStoryResult(data);
    } catch (e: any) {
      clearInterval(loadingInterval);
      setErrorMsg(e.message || 'We encountered a connection issue while preparing your story. Try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetGenerator = () => {
    setStoryResult(null);
    setHighlightedWord(null);
    setErrorMsg(null);
  };

  const toggleSaveCurrentStory = () => {
    if (!storyResult) return;
    const exists = savedStories.some(s => s.title.toLowerCase() === storyResult.title.toLowerCase());
    if (exists) {
      setSavedStories(savedStories.filter(s => s.title.toLowerCase() !== storyResult.title.toLowerCase()));
    } else {
      setSavedStories([
        ...savedStories,
        {
          ...storyResult,
          id: Date.now().toString(),
          savedAt: new Date().toISOString(),
          level: selectedLevel,
          wordsUsed: words
        }
      ]);
    }
  };

  const toggleSaveWord = (item: VocabularyItem) => {
    const exists = savedWords.some(w => w.original.toLowerCase() === item.original.toLowerCase());
    if (exists) {
      setSavedWords(savedWords.filter(w => w.original.toLowerCase() !== item.original.toLowerCase()));
    } else {
      setSavedWords([
        ...savedWords,
        {
          ...item,
          savedAt: new Date().toISOString(),
          level: selectedLevel
        }
      ]);
    }
  };

  const loadSavedStory = (story: StoryResponse & { level: LearningLevel; wordsUsed: string[] }) => {
    setWords(story.wordsUsed || []);
    setSelectedLevel(story.level);
    setStoryResult({
      title: story.title,
      englishStory: story.englishStory,
      russianTranslation: story.russianTranslation,
      uzbekTranslation: story.uzbekTranslation,
      vocabularyMapping: story.vocabularyMapping
    });
    setHighlightedWord(null);
    setActiveLangTab('en');
    setActiveTab('weaver');
  };

  const speakSavedWord = (word: string) => {
    if (playingSavedWord) return;
    setPlayingSavedWord(word);

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.onend = () => setPlayingSavedWord(null);
        utterance.onerror = () => setPlayingSavedWord(null);
        window.speechSynthesis.speak(utterance);
      } catch {
        setPlayingSavedWord(null);
      }
    } else {
      setPlayingSavedWord(null);
    }
  };

  const exportLibrary = () => {
    if (savedStories.length === 0 && savedWords.length === 0) {
      alert('Your library is currently empty. Save some stories or vocabulary words first!');
      return;
    }

    let text = `# PolyStory Language Learning Library Export\n`;
    text += `Exported on: ${new Date().toLocaleDateString()}\n\n`;

    text += `## Saved Stories (${savedStories.length})\n\n`;
    savedStories.forEach((s, idx) => {
      text += `### Story ${idx + 1}: ${s.title}\n`;
      text += `- Level: ${s.level}\n\n`;
      text += `#### English Story:\n${s.englishStory.replace(/<\/?hl>/g, '')}\n\n`;
      text += `#### Russian Translation:\n${s.russianTranslation.replace(/<\/?hl>/g, '')}\n\n`;
      text += `#### Uzbek Translation:\n${s.uzbekTranslation.replace(/<\/?hl>/g, '')}\n\n`;
      text += `---\n\n`;
    });

    text += `## Saved Vocabulary Words (${savedWords.length})\n\n`;
    savedWords.forEach((w) => {
      text += `### Word: ${w.original}\n`;
      text += `- Definition: ${w.explanation}\n`;
      text += `- Russian Translation: ${w.russianMeaning} (Used in story: "${w.contextRussian}")\n`;
      text += `- Uzbek Translation: ${w.uzbekMeaning} (Used in story: "${w.contextUzbek}")\n`;
      text += `- English Context: "${w.contextEnglish}"\n\n`;
      text += `---\n\n`;
    });

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `polystory_library_export.md`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-[#faf9f6] text-slate-800'} font-sans flex flex-col antialiased`}>
      {/* Top Brand Navbar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-xs shrink-0 transition-colors duration-200">
        <div className="flex items-center gap-2.5">
          <div className="bg-indigo-600 text-white p-2 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5.5 h-5.5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 dark:text-slate-100 tracking-tight text-base leading-none flex items-center gap-1.5">
              LinguistEngine <span className="text-[10px] font-mono font-medium tracking-wider text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400 px-1.5 py-0.5 rounded uppercase font-bold">Pro AI</span>
            </h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">Multilingual Language Story Generator</p>
          </div>
        </div>

        {/* Navigation Tabs - Matches Theme Styling */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('weaver')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'weaver'
                ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
            }`}
          >
            Story Weaver
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer relative ${
              activeTab === 'history'
                ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
            }`}
          >
            Saved Stories
            {savedStories.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white dark:border-slate-900">
                {savedStories.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('vocabulary')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer relative ${
              activeTab === 'vocabulary'
                ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
            }`}
          >
            Saved Words
            {savedWords.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white dark:border-slate-900">
                {savedWords.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('quiz')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer relative ${
              activeTab === 'quiz'
                ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
            }`}
          >
            Practice Quiz
            {savedWords.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white dark:border-slate-900">
                ✓
              </span>
            )}
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden lg:block"></div>
          <button
            onClick={exportLibrary}
            className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1 shrink-0"
          >
            <Download className="w-3.5 h-3.5" /> Export Package
          </button>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors text-slate-500 dark:text-slate-300 flex items-center justify-center"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full flex flex-col min-h-0">
        {activeTab === 'weaver' ? (
          <>
            {!storyResult && !isGenerating ? (
              /* CONFIGURATION VIEW */
              <div className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full space-y-6 py-6 animate-fade-in">
                <div className="text-center space-y-2 mb-2">
                  <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-900/40 uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-amber-600" /> Powered by Gemini Flash
                  </span>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
                    Turn your vocabulary into active stories
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                    Enter your target vocabulary list, pick a learning proficiency level, and generate a native reader story with accurate translations in Russian and Uzbek.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6 transition-colors duration-200">
                  {/* Step 1: Words list input */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      1. Add Target Vocabulary
                    </label>
                    
                    {/* Word Chips container */}
                    <div className="min-h-[56px] p-2 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap gap-1.5 items-center">
                      {words.length === 0 ? (
                        <span className="text-xs text-slate-400 dark:text-slate-500 px-2 font-medium">
                          No words added yet. Type below or select a preset...
                        </span>
                      ) : (
                        words.map((word, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 shadow-xs"
                          >
                            {word}
                            <button
                              onClick={() => removeWord(idx)}
                              className="p-0.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Input row */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type words (e.g. wander, cherish, Screen) and press Add"
                        value={currentWordInput}
                        onChange={(e) => setCurrentWordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            addWord();
                          }
                        }}
                        className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        onClick={addWord}
                        className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-semibold text-xs rounded-xl flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 cursor-pointer transition-colors shrink-0"
                      >
                        <Plus className="w-4 h-4" /> Add Words
                      </button>
                    </div>

                    {/* Presets Component */}
                    <PresettedWords
                      onSelectPreset={handleSelectPreset}
                      selectedPresetId={selectedPresetId}
                    />
                  </div>

                  {/* Step 2: Learning Level */}
                  <div className="space-y-3 pt-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      2. Select Language Level
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {(Object.keys(LEVEL_DESCRIPTIONS) as LearningLevel[]).map((level) => {
                        const isSelected = selectedLevel === level;
                        const details = LEVEL_DESCRIPTIONS[level];
                        return (
                          <button
                            key={level}
                            onClick={() => setSelectedLevel(level)}
                            className={`p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50/80 border-indigo-400 text-indigo-900 shadow-xs dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-300'
                                : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{level}</span>
                              <span className="bg-indigo-100/70 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-400 text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">
                                {details.levelCode}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">{details.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Error messages */}
                  {errorMsg && (
                    <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl p-4 flex items-start gap-3 text-xs text-rose-800 dark:text-rose-400">
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Generate Trigger Button */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={generateStory}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md transition-all duration-150"
                    >
                      <Sparkles className="w-4.5 h-4.5" />
                      Weave New Story for Language Learners
                    </button>
                  </div>
                </div>
              </div>
            ) : isGenerating ? (
              /* LOADING PROGRESS VIEW */
              <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto text-center space-y-6 py-12">
                <div className="relative flex items-center justify-center">
                  {/* Spinner animation */}
                  <div className="w-16 h-16 rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-indigo-600 animate-spin"></div>
                  <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400 absolute" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Crafting Story Context</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Our language generator is engineering a cohesive, level-appropriate story including definitions and mappings.
                  </p>
                </div>

                {/* Current Loading Step */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl w-full flex items-center gap-3 shadow-xs">
                  <div className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-ping"></div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 animate-pulse text-left">
                    {LOADING_STEPS[loadingStepIndex]}
                  </span>
                </div>
              </div>
            ) : (
              /* STORIES & DICTIONARY RESULT VIEW */
              <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
                {/* Left Story Reader Container */}
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Reader Action Ribbon */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-200 flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                        Level: {selectedLevel}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Vocabulary Story Generator
                      </span>
                    </div>
                    <button
                      onClick={resetGenerator}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg font-semibold border border-slate-200 cursor-pointer transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Create Another Story
                    </button>
                  </div>

                  <div className="flex-1 min-h-0">
                    <StoryViewer
                      story={storyResult!}
                      activeLanguage={activeLangTab}
                      onLanguageChange={setActiveLangTab}
                      onWordClick={(word) => setHighlightedWord(word)}
                      highlightedWord={highlightedWord}
                      isSaved={savedStories.some(s => s.title.toLowerCase() === storyResult?.title?.toLowerCase())}
                      onToggleSave={toggleSaveCurrentStory}
                    />
                  </div>
                </div>

                {/* Right Vocabulary Mappings Column */}
                <div className="w-full lg:w-96 shrink-0 flex flex-col min-h-0">
                  <div className="mb-4 flex items-center justify-between h-7">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Selected Level Deck
                    </span>
                  </div>
                  
                  <div className="flex-1 min-h-0">
                    <WordList
                      mapping={storyResult!.vocabularyMapping}
                      highlightedWord={highlightedWord}
                      onWordHighlight={(word) => setHighlightedWord(word)}
                      savedWords={savedWords}
                      onToggleSaveWord={toggleSaveWord}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : activeTab === 'history' ? (
          /* SAVED STORIES VIEW */
          <div className="flex-1 flex flex-col min-h-0 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Your Saved Stories</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Access and review language stories you have saved to your permanent library.</p>
              </div>
              <span className="text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                {savedStories.length} Saved Stories
              </span>
            </div>

            {savedStories.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="p-4 bg-indigo-50/50 rounded-full text-indigo-600 mb-4">
                  <Bookmark className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Your story library is empty</h3>
                <p className="text-xs text-slate-500 mt-1.5 max-w-md leading-relaxed font-medium">
                  Go to the <strong className="text-indigo-600">Story Weaver</strong> tab, enter your words, and generate a story. 
                  Then click the <strong className="text-indigo-600 inline-flex items-center gap-0.5"><Bookmark className="w-3 h-3" /> Save Story</strong> button in the reader header to save it here permanently!
                </p>
                <button
                  onClick={() => setActiveTab('weaver')}
                  className="mt-5 px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer shadow-xs transition-colors"
                >
                  Go to Story Weaver
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-1 flex-1 pb-12">
                {savedStories.map((story) => (
                  <div key={story.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                    <div>
                      {/* Badge Row */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                          {story.level}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(story.savedAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2 line-clamp-2">
                        {story.title}
                      </h3>

                      {/* Vocabulary used */}
                      <div className="space-y-1.5 mb-5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Vocabulary:</span>
                        <div className="flex flex-wrap gap-1">
                          {story.wordsUsed?.slice(0, 6).map((word, idx) => (
                            <span key={idx} className="bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-medium px-1.5 py-0.5 rounded capitalize">
                              {word}
                            </span>
                          ))}
                          {story.wordsUsed?.length > 6 && (
                            <span className="text-[10px] text-slate-400 px-1 font-semibold">
                              +{story.wordsUsed.length - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => loadSavedStory(story)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 text-xs rounded-lg cursor-pointer transition-colors inline-flex items-center justify-center gap-1.5"
                      >
                        <BookOpen className="w-3.5 h-3.5" /> Read & Study
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this story?')) {
                            setSavedStories(savedStories.filter(s => s.id !== story.id));
                          }
                        }}
                        className="p-2 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer transition-colors"
                        title="Delete Story"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'vocabulary' ? (
          /* SAVED VOCABULARY VIEW */
          <div className="flex-1 flex flex-col min-h-0 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-4 gap-3">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Your Saved Vocabulary</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Study and test your custom bookmarks from level-appropriate stories.</p>
              </div>
              
              {/* Search and stats bar */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="relative w-48 sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search saved words..."
                    value={savedWordsSearch}
                    onChange={(e) => setSavedWordsSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <span className="text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-850">
                  {savedWords.length} Bookmarks
                </span>
              </div>
            </div>

            {savedWords.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="p-4 bg-indigo-50/50 dark:bg-slate-850 rounded-full text-indigo-600 mb-4">
                  <Bookmark className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Your saved words deck is empty</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-md leading-relaxed font-medium">
                  While reading a story in the <strong className="text-indigo-600">Story Weaver</strong> tab, look at individual vocabulary cards in the right column. 
                  Click the bookmark icon on any card to save it here for permanent study!
                </p>
                <button
                  onClick={() => setActiveTab('weaver')}
                  className="mt-5 px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer shadow-xs transition-colors"
                >
                  Explore Story Weaver
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-1 flex-1 pb-12">
                {savedWords
                  .filter(item => {
                    const term = savedWordsSearch.toLowerCase();
                    return (
                      item.original.toLowerCase().includes(term) ||
                      item.russianMeaning.toLowerCase().includes(term) ||
                      item.uzbekMeaning.toLowerCase().includes(term) ||
                      item.explanation.toLowerCase().includes(term)
                    );
                  })
                  .map((item) => (
                    <div key={item.original} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col gap-3.5 hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-750 transition-all">
                      {/* Header Word Block */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-base font-bold text-slate-900 dark:text-white capitalize truncate">{item.original}</span>
                            <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-[9px] font-bold px-1.5 py-0.2 rounded font-mono uppercase">
                              {item.level || 'Custom'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            {item.explanation}
                          </p>
                        </div>

                        {/* Speech Synthesis Button */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => speakSavedWord(item.original)}
                            disabled={playingSavedWord !== null}
                            className={`p-1.5 rounded-lg border text-slate-400 hover:text-indigo-600 hover:border-indigo-200 dark:border-slate-800 dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                              playingSavedWord === item.original ? 'animate-pulse text-indigo-600 bg-indigo-50 border-indigo-200' : 'border-slate-200 dark:border-slate-800'
                            }`}
                            title="Pronounce word"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleSaveWord(item)}
                            className="p-1.5 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer transition-colors"
                            title="Remove bookmark"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-slate-100 dark:bg-slate-800" />

                      {/* Mapped translations */}
                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                        <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800/80 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🇷🇺 RU Meaning</span>
                          <div className="font-bold text-slate-800 dark:text-slate-200">{item.russianMeaning}</div>
                          <div className="text-slate-400 italic text-[10px] mt-0.5 line-clamp-2">
                            Context: <span className="font-medium text-indigo-600 dark:text-indigo-400">{item.contextRussian}</span>
                          </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800/80 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🇺🇿 UZ Meaning</span>
                          <div className="font-bold text-slate-800 dark:text-slate-200">{item.uzbekMeaning}</div>
                          <div className="text-slate-400 italic text-[10px] mt-0.5 line-clamp-2">
                            Context: <span className="font-medium text-indigo-600 dark:text-indigo-400">{item.contextUzbek}</span>
                          </div>
                        </div>
                      </div>

                      {/* English in Context footer info */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-850/40 p-2 rounded-lg border border-slate-200/40 dark:border-slate-800/50">
                        <span className="font-bold text-slate-500 shrink-0">English Context:</span>
                        <span className="line-clamp-1 italic">&quot;{item.contextEnglish}&quot;</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : (
          /* QUIZ VIEW */
          <div className="flex-1 flex flex-col min-h-0">
            <VocabularyQuiz savedWords={savedWords} onToggleSaveWord={toggleSaveWord} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-3 text-center text-[10px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
        PolyStory Language Reader &copy; 2026. Made with Google Gemini Generative Intelligence.
      </footer>
    </div>
  );
}
