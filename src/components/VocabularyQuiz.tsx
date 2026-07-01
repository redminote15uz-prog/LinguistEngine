import { useState, useEffect } from 'react';
import { 
  Trophy, 
  RotateCcw, 
  HelpCircle, 
  Volume2, 
  Check, 
  X, 
  ArrowRight, 
  Sparkles, 
  ChevronRight, 
  BookOpen, 
  Keyboard, 
  Languages, 
  Award,
  BookmarkCheck
} from 'lucide-react';
import { VocabularyItem } from '../types';

interface VocabularyQuizProps {
  savedWords: VocabularyItem[];
  onToggleSaveWord?: (item: VocabularyItem) => void;
}

type QuizMode = 'flashcards' | 'translation' | 'spelling';

export default function VocabularyQuiz({ savedWords, onToggleSaveWord }: VocabularyQuizProps) {
  const [activeMode, setActiveMode] = useState<QuizMode>('flashcards');
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizWords, setQuizWords] = useState<VocabularyItem[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<'ru' | 'uz'>('ru');
  
  // Flashcard states
  const [isFlipped, setIsFlipped] = useState(false);
  const [flashcardScores, setFlashcardScores] = useState<Record<string, 'mastered' | 'learning'>>({});

  // Multiple Choice states
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [multipleChoiceScore, setMultipleChoiceScore] = useState(0);
  const [incorrectAnswers, setIncorrectAnswers] = useState<Array<{ word: VocabularyItem; selected: string; correct: string }>>([]);

  // Spelling states
  const [spellingInput, setSpellingInput] = useState('');
  const [isSpellingChecked, setIsSpellingChecked] = useState(false);
  const [isSpellingCorrect, setIsSpellingCorrect] = useState(false);
  const [spellingScore, setSpellingScore] = useState(0);

  // Audio helper
  const speak = (word: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Shuffle array helper
  const shuffleArray = <T,>(array: T[]): T[] => {
    return [...array].sort(() => Math.random() - 0.5);
  };

  // Generate options for multiple choice
  const generateMultipleChoiceOptions = (correctWord: VocabularyItem, allWords: VocabularyItem[]) => {
    const correctMeaning = selectedLanguage === 'ru' ? correctWord.russianMeaning : correctWord.uzbekMeaning;
    const correctValue = correctMeaning || correctWord.explanation;
    
    // Fallback options if there are not enough saved words
    const fallbackDistractors = [
      selectedLanguage === 'ru' ? 'удивляться' : 'hayрон qolish',
      selectedLanguage === 'ru' ? 'дорожить' : 'ardoqlash',
      selectedLanguage === 'ru' ? 'исследовать' : 'tadqiq qilmoq',
      selectedLanguage === 'ru' ? 'великолепный' : 'ajoyib',
      selectedLanguage === 'ru' ? 'быстро' : 'tezda',
      selectedLanguage === 'ru' ? 'спокойствие' : 'tinchlik',
      selectedLanguage === 'ru' ? 'понимание' : 'tushunish'
    ];

    // Collect translations from other saved words
    const siblingDistractors = allWords
      .filter(w => w.original !== correctWord.original)
      .map(w => (selectedLanguage === 'ru' ? w.russianMeaning : w.uzbekMeaning) || w.explanation);

    // Merge distractors
    const allDistractors = Array.from(new Set([...siblingDistractors, ...fallbackDistractors]))
      .filter(d => d !== correctValue);

    // Take 3 distractors
    const chosenDistractors = shuffleArray(allDistractors).slice(0, 3);
    
    // Combine with correct and shuffle
    return shuffleArray([correctValue, ...chosenDistractors]);
  };

  // Initialize quiz for a mode
  const startQuiz = () => {
    if (savedWords.length === 0) return;
    const shuffled = shuffleArray(savedWords);
    setQuizWords(shuffled);
    setCurrentQuestionIndex(0);
    setQuizStarted(true);

    // Mode-specific reset
    if (activeMode === 'translation') {
      setSelectedOption(null);
      setIsAnswered(false);
      setMultipleChoiceScore(0);
      setIncorrectAnswers([]);
      setOptions(generateMultipleChoiceOptions(shuffled[0], savedWords));
    } else if (activeMode === 'spelling') {
      setSpellingInput('');
      setIsSpellingChecked(false);
      setIsSpellingCorrect(false);
      setSpellingScore(0);
    } else {
      setIsFlipped(false);
    }
  };

  // Trigger options generation when language or question index shifts
  useEffect(() => {
    if (quizStarted && activeMode === 'translation' && quizWords[currentQuestionIndex]) {
      setSelectedOption(null);
      setIsAnswered(false);
      setOptions(generateMultipleChoiceOptions(quizWords[currentQuestionIndex], savedWords));
    }
  }, [currentQuestionIndex, selectedLanguage, quizStarted, activeMode]);

  const handleNext = () => {
    if (currentQuestionIndex < quizWords.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      
      // Mode resets
      if (activeMode === 'spelling') {
        setSpellingInput('');
        setIsSpellingChecked(false);
        setIsSpellingCorrect(false);
      } else {
        setIsFlipped(false);
      }
    } else {
      // Finished all cards/questions
    }
  };

  // Multiple Choice option click
  const handleOptionSelect = (option: string) => {
    if (isAnswered) return;
    setSelectedOption(option);
    setIsAnswered(true);

    const currentWord = quizWords[currentQuestionIndex];
    const correctMeaning = selectedLanguage === 'ru' ? currentWord.russianMeaning : currentWord.uzbekMeaning;
    const correctValue = correctMeaning || currentWord.explanation;

    if (option === correctValue) {
      setMultipleChoiceScore(prev => prev + 1);
    } else {
      setIncorrectAnswers(prev => [
        ...prev,
        { word: currentWord, selected: option, correct: correctValue }
      ]);
    }
  };

  // Spelling check
  const checkSpelling = () => {
    if (isSpellingChecked) return;
    const currentWord = quizWords[currentQuestionIndex];
    const isCorrect = spellingInput.trim().toLowerCase() === currentWord.original.trim().toLowerCase();
    
    setIsSpellingCorrect(isCorrect);
    setIsSpellingChecked(true);
    
    if (isCorrect) {
      setSpellingScore(prev => prev + 1);
    }
  };

  if (savedWords.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center max-w-xl mx-auto my-6 shadow-sm">
        <div className="w-14 h-14 bg-indigo-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto mb-4">
          <Award className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">No Words Bookmarked Yet</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
          Start reading custom stories and bookmark target vocabulary words! Your bookmarked list will populate here automatically to let you study with interactive quizzes.
        </p>
      </div>
    );
  }

  const currentWord = quizWords[currentQuestionIndex];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
      {/* Quiz Top Action Bar */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 text-base">
            <Trophy className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Linguist Study Deck
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Practice with your {savedWords.length} bookmarked vocabulary cards</p>
        </div>

        {/* Mode Selectors */}
        {!quizStarted && (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(['flashcards', 'translation', 'spelling'] as QuizMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setActiveMode(mode)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg capitalize transition-all cursor-pointer ${
                  activeMode === mode
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {mode === 'flashcards' && <span className="inline-flex items-center gap-1"><BookOpen className="w-3 h-3" /> Flashcards</span>}
                {mode === 'translation' && <span className="inline-flex items-center gap-1"><Languages className="w-3 h-3" /> Translation</span>}
                {mode === 'spelling' && <span className="inline-flex items-center gap-1"><Keyboard className="w-3 h-3" /> Spelling</span>}
              </button>
            ))}
          </div>
        )}

        {/* Quit Quiz button */}
        {quizStarted && (
          <button
            onClick={() => setQuizStarted(false)}
            className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors"
          >
            Quit Practice
          </button>
        )}
      </div>

      {/* QUIZ MAIN BODY SCREEN */}
      {!quizStarted ? (
        <div className="flex-1 p-6 md:p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto w-full">
          {activeMode === 'flashcards' && (
            <>
              <div className="p-4 bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-2xl mb-4">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 capitalize">Active Flashcards Practice</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Flip the card to reveal translation, contextual usage, and definitions. Track your progress manually by marking each card.
              </p>
            </>
          )}

          {activeMode === 'translation' && (
            <>
              <div className="p-4 bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-2xl mb-4">
                <Languages className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 capitalize">Multiple-Choice Translation Quiz</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed mb-4">
                Test your lexical retention! Identify the correct translation matching your bookmarked English word.
              </p>
              
              {/* Language selection */}
              <div className="flex gap-2 mb-4 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
                <button
                  onClick={() => setSelectedLanguage('ru')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    selectedLanguage === 'ru'
                      ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-xs border border-slate-200/80 dark:border-slate-700'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  🇷🇺 Russian Translation
                </button>
                <button
                  onClick={() => setSelectedLanguage('uz')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    selectedLanguage === 'uz'
                      ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-xs border border-slate-200/80 dark:border-slate-700'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  🇺🇿 Uzbek Translation
                </button>
              </div>
            </>
          )}

          {activeMode === 'spelling' && (
            <>
              <div className="p-4 bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-2xl mb-4">
                <Keyboard className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 capitalize">Interactive Spelling Arena</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Hear the word, read the context clues or meaning, and spell the English word correctly to perfect your vocabulary syntax!
              </p>
            </>
          )}

          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl w-full border border-slate-200/60 dark:border-slate-800 text-left space-y-2">
            <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-bold">
              <span>Selected Deck Statistics</span>
              <span>Ready</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                <span>Cards Loaded: {savedWords.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span>Est. Quiz Time: {Math.max(1, Math.ceil(savedWords.length * 0.5))} min</span>
              </div>
            </div>
          </div>

          <button
            onClick={startQuiz}
            className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md transition-all duration-150"
          >
            <Sparkles className="w-4 h-4" /> Start Study Session
          </button>
        </div>
      ) : (
        /* ACTIVE SESSION LAYOUT */
        <div className="flex-1 p-5 md:p-6 flex flex-col min-h-0">
          {/* Progress indicators */}
          <div className="flex items-center justify-between mb-4 text-[10px] text-slate-400 uppercase font-bold">
            <span className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/40">
              {activeMode} Mode
            </span>
            <span>Card {currentQuestionIndex + 1} of {quizWords.length}</span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-6">
            <div 
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / quizWords.length) * 100}%` }}
            ></div>
          </div>

          {/* QUESTION RENDER HOOKS */}
          <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full min-h-0">
            {/* 1. FLASHCARD MODE CARD */}
            {activeMode === 'flashcards' && currentWord && (
              <div className="flex-1 flex flex-col justify-center py-4">
                {/* 3D Flip Card Container */}
                <div 
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="group relative h-64 w-full cursor-pointer [perspective:1000px] mb-6"
                >
                  <div 
                    className={`relative h-full w-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md transition-all duration-500 [transform-style:preserve-3d] ${
                      isFlipped ? '[transform:rotateY(180deg)]' : ''
                    }`}
                  >
                    {/* Front Face (English Word) */}
                    <div className="absolute inset-0 h-full w-full rounded-2xl bg-white dark:bg-slate-900 p-6 flex flex-col justify-between [backface-visibility:hidden]">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded">Front Side</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            speak(currentWord.original);
                          }}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg cursor-pointer transition-colors"
                          title="Speak word"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-center py-4">
                        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white capitalize tracking-tight">
                          {currentWord.original}
                        </h2>
                        <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold mt-2 animate-pulse">Click card to flip and reveal answer</p>
                      </div>

                      <div className="text-center text-[10px] text-slate-400 italic">
                        &quot;Click to study context and translations&quot;
                      </div>
                    </div>

                    {/* Back Face (Translations & Descriptions) */}
                    <div className="absolute inset-0 h-full w-full rounded-2xl bg-indigo-50/20 dark:bg-slate-900 border border-indigo-100 dark:border-indigo-950 p-6 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(180deg)]">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded">Answer Side</span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 capitalize">{currentWord.original}</h3>
                      </div>

                      {/* Content middle */}
                      <div className="space-y-3 my-2 overflow-y-auto max-h-[140px] pr-1">
                        <div className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed bg-white dark:bg-slate-850 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Definition</span>
                          {currentWord.explanation}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="bg-white dark:bg-slate-850 p-2 rounded-xl border border-slate-100 dark:border-slate-800/80">
                            <span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">🇷🇺 Russian</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{currentWord.russianMeaning}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-850 p-2 rounded-xl border border-slate-100 dark:border-slate-800/80">
                            <span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">🇺🇿 Uzbek</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{currentWord.uzbekMeaning}</span>
                          </div>
                        </div>

                        {/* Story Context */}
                        <div className="text-[9px] italic text-slate-500 bg-white dark:bg-slate-850 p-2 rounded-lg border border-slate-100 dark:border-slate-800/80 leading-relaxed">
                          <strong className="not-italic text-slate-400 mr-1 block uppercase text-[8px] mb-0.5">Story Context</strong>
                          &quot;{currentWord.contextEnglish}&quot;
                        </div>
                      </div>

                      <div className="text-center text-[9px] text-slate-400">
                        Click card to flip back
                      </div>
                    </div>
                  </div>
                </div>

                {/* Flashcard Response feedback (Got it vs Needs practice) */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setFlashcardScores(prev => ({ ...prev, [currentWord.original]: 'learning' }));
                      handleNext();
                    }}
                    className="py-2.5 px-4 bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-800 border border-slate-200 dark:border-slate-800 dark:hover:bg-amber-950/20 dark:hover:border-amber-900 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Needs Review
                  </button>
                  <button
                    onClick={() => {
                      setFlashcardScores(prev => ({ ...prev, [currentWord.original]: 'mastered' }));
                      handleNext();
                    }}
                    className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" /> Got it!
                  </button>
                </div>
              </div>
            )}

            {/* 2. MULTIPLE CHOICE TRANSLATION */}
            {activeMode === 'translation' && currentWord && (
              <div className="flex-1 flex flex-col justify-center py-2 space-y-4">
                {/* Question English Word Card */}
                <div className="bg-indigo-50/40 dark:bg-slate-800/30 border border-indigo-100/80 dark:border-slate-800 p-6 rounded-2xl text-center space-y-3 relative overflow-hidden">
                  <div className="absolute top-3 right-3">
                    <button 
                      onClick={() => speak(currentWord.original)}
                      className="p-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg shadow-xs hover:bg-indigo-50 cursor-pointer transition-colors"
                      title="Listen"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Select Translation</span>
                  <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white capitalize">
                    {currentWord.original}
                  </h2>
                  
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[10px] p-2 rounded-lg leading-relaxed italic text-slate-400 max-w-xs mx-auto">
                    &quot;{currentWord.contextEnglish.replace(new RegExp(`(${currentWord.original})`, 'gi'), '_____')}&quot;
                  </div>
                </div>

                {/* Multiple choice options */}
                <div className="space-y-2 pt-2">
                  {options.map((option, index) => {
                    const isSelected = selectedOption === option;
                    const correctMeaning = selectedLanguage === 'ru' ? currentWord.russianMeaning : currentWord.uzbekMeaning;
                    const correctValue = correctMeaning || currentWord.explanation;
                    const isCorrectOption = option === correctValue;
                    
                    let btnClass = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-50';
                    
                    if (isAnswered) {
                      if (isCorrectOption) {
                        btnClass = 'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-400 text-emerald-800 dark:text-emerald-400';
                      } else if (isSelected) {
                        btnClass = 'bg-rose-50 dark:bg-rose-950/35 border-rose-400 text-rose-800 dark:text-rose-400';
                      } else {
                        btnClass = 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/60 text-slate-400 opacity-60';
                      }
                    }

                    return (
                      <button
                        key={index}
                        disabled={isAnswered}
                        onClick={() => handleOptionSelect(option)}
                        className={`w-full p-4.5 rounded-xl border text-left text-xs font-bold transition-all duration-150 flex items-center justify-between cursor-pointer ${btnClass}`}
                      >
                        <span className="line-clamp-2">{option}</span>
                        {isAnswered && isCorrectOption && <Check className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                        {isAnswered && isSelected && !isCorrectOption && <X className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Controls and Feedback */}
                {isAnswered && (
                  <div className="pt-2">
                    <button
                      onClick={handleNext}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                    >
                      {currentQuestionIndex < quizWords.length - 1 ? 'Next Question' : 'Finish Quiz'}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. SPELLING INTERACTIVE PRACTICE */}
            {activeMode === 'spelling' && currentWord && (
              <div className="flex-1 flex flex-col justify-center py-2 space-y-4">
                {/* Definition/Context Card */}
                <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl text-center space-y-3">
                  <div className="flex justify-center mb-1">
                    <button 
                      onClick={() => speak(currentWord.original)}
                      className="p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full cursor-pointer transition-all shrink-0 flex items-center gap-1.5 px-3 py-1.5 font-bold text-[10px]"
                    >
                      <Volume2 className="w-4 h-4" /> Listen to Pronunciation
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Meaning & Definition</span>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed max-w-sm mx-auto">
                      {currentWord.explanation}
                    </p>
                  </div>

                  {/* Horizontal small divider */}
                  <div className="h-px bg-slate-200/50 dark:bg-slate-800 w-16 mx-auto" />

                  <div className="space-y-1">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Story Sentence Clue</span>
                    <p className="text-[10px] text-slate-500 italic max-w-sm mx-auto">
                      &quot;{currentWord.contextEnglish.toLowerCase().replace(new RegExp(`(${currentWord.original})`, 'gi'), '_____')}&quot;
                    </p>
                  </div>
                </div>

                {/* Spelling input block */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Type English Spelling:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Spell the word..."
                      value={spellingInput}
                      disabled={isSpellingChecked}
                      onChange={(e) => setSpellingInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          checkSpelling();
                        }
                      }}
                      className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border focus:outline-hidden ${
                        isSpellingChecked
                          ? isSpellingCorrect
                            ? 'border-emerald-400 bg-emerald-50/20 text-emerald-800 dark:text-emerald-400'
                            : 'border-rose-400 bg-rose-50/20 text-rose-800 dark:text-rose-400'
                          : 'border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                      }`}
                    />
                    {!isSpellingChecked ? (
                      <button
                        onClick={checkSpelling}
                        disabled={!spellingInput.trim()}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors shrink-0"
                      >
                        Submit
                      </button>
                    ) : (
                      <button
                        onClick={handleNext}
                        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors shrink-0"
                      >
                        Next
                      </button>
                    )}
                  </div>

                  {/* Immediate correction feedback */}
                  {isSpellingChecked && (
                    <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-[11px] leading-normal ${
                      isSpellingCorrect 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400'
                        : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400'
                    }`}>
                      {isSpellingCorrect ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Excellent spelling!</span> Mastered correct letters.
                          </div>
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Incorrect spelling.</span> The correct spelling is{' '}
                            <span className="font-mono bg-white dark:bg-slate-800 border border-slate-200 px-1.5 py-0.2 rounded font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                              {currentWord.original}
                            </span>.
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* NEXT TRIGGER FOR UNANSWERED STATES OR MANUAL NAVIGATION */}
          {quizStarted && currentQuestionIndex === quizWords.length - 1 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-center mt-4">
              <button
                onClick={() => setQuizStarted(false)}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs inline-flex items-center justify-center gap-1.5"
              >
                <Award className="w-4 h-4" /> View Complete Session Dashboard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
