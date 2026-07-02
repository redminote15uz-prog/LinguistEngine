import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Volume2, VolumeX, Loader2, BookOpen, Bookmark, BookmarkCheck, Sparkles } from 'lucide-react';
import { StoryResponse } from '../types';

interface StoryViewerProps {
  story: StoryResponse;
  activeLanguage: 'en' | 'ru' | 'uz' | 'parallel';
  onLanguageChange: (lang: 'en' | 'ru' | 'uz' | 'parallel') => void;
  onWordClick: (word: string) => void;
  highlightedWord: string | null;
  isSaved?: boolean;
  onToggleSave?: () => void;
}

export default function StoryViewer({
  story,
  activeLanguage,
  onLanguageChange,
  onWordClick,
  highlightedWord,
  isSaved = false,
  onToggleSave
}: StoryViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackTextSource, setPlaybackTextSource] = useState<'en' | 'ru' | 'uz'>('en');
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);

  // Local browser voices state
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedBrowserVoiceURI, setSelectedBrowserVoiceURI] = useState<string>('');

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Load browser voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        const allVoices = window.speechSynthesis.getVoices();
        setBrowserVoices(allVoices);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Sync selected voice when language tab changes
  useEffect(() => {
    if (browserVoices.length > 0) {
      const targetLang = activeLanguage === 'parallel' ? 'en' : activeLanguage;
      const matching = browserVoices.filter(v => v.lang.toLowerCase().startsWith(targetLang));
      if (matching.length > 0) {
        // Find a "Natural" voice first if possible, otherwise first matching
        const naturalVoice = matching.find(v => v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('google'));
        setSelectedBrowserVoiceURI(naturalVoice ? naturalVoice.voiceURI : matching[0].voiceURI);
      }
    }
  }, [activeLanguage, browserVoices]);

  // Stop any ongoing audio playback when unmounted or when story changes
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [story]);

  const stopAudio = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsLoadingAudio(false);
    setActiveWordIndex(null);
  };

  const activeText = useMemo(() => {
    return activeLanguage === 'en' ? story.englishStory :
           activeLanguage === 'ru' ? story.russianTranslation :
           activeLanguage === 'uz' ? story.uzbekTranslation : story.englishStory;
  }, [activeLanguage, story]);

  // Generate character ranges and tokens for Karaoke mode of active text
  const parsedStory = useMemo(() => {
    let cleanText = '';
    const highlightRanges: { start: number; end: number }[] = [];
    let isHighlight = false;
    let currentHighlightStart = -1;

    for (let i = 0; i < activeText.length; i++) {
      if (activeText.substring(i, i + 4) === '<hl>') {
        isHighlight = true;
        currentHighlightStart = cleanText.length;
        i += 3; // skip '<hl>'
      } else if (activeText.substring(i, i + 5) === '</hl>') {
        isHighlight = false;
        highlightRanges.push({ start: currentHighlightStart, end: cleanText.length });
        i += 4; // skip '</hl>'
      } else {
        cleanText += activeText[i];
      }
    }

    const wordRegex = /[a-zA-Z0-9а-яА-ЯёЁo'g'O'G'ʻ’]+/g;
    let match;
    const words: { wordIndex: number; text: string; start: number; end: number; isHighlight: boolean }[] = [];
    let wordIndex = 0;

    while ((match = wordRegex.exec(cleanText)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      const isWordHighlighted = highlightRanges.some(r => start >= r.start && end <= r.end);

      words.push({
        wordIndex,
        text: match[0],
        start,
        end,
        isHighlight: isWordHighlighted
      });
      wordIndex++;
    }

    const spans: {
      key: string;
      text: string;
      isWord: boolean;
      wordIndex?: number;
      isHighlight?: boolean;
    }[] = [];

    let lastIndex = 0;
    words.forEach((w) => {
      if (w.start > lastIndex) {
        const nonWordText = cleanText.substring(lastIndex, w.start);
        spans.push({
          key: `nonword-${lastIndex}`,
          text: nonWordText,
          isWord: false
        });
      }
      spans.push({
        key: `word-${w.wordIndex}`,
        text: w.text,
        isWord: true,
        wordIndex: w.wordIndex,
        isHighlight: w.isHighlight
      });
      lastIndex = w.end;
    });

    if (lastIndex < cleanText.length) {
      const nonWordText = cleanText.substring(lastIndex);
      spans.push({
        key: `nonword-${lastIndex}`,
        text: nonWordText,
        isWord: false
      });
    }

    return {
      cleanText,
      words,
      spans
    };
  }, [activeText]);

  const playTTS = async (textToSpeak: string, lang: 'en' | 'ru' | 'uz') => {
    if (isPlaying) {
      stopAudio();
      return;
    }

    if (!('speechSynthesis' in window)) {
      alert('Your browser does not support Speech Synthesis.');
      return;
    }

    setIsLoadingAudio(true);
    setPlaybackTextSource(lang);
    setActiveWordIndex(null);

    // Get the clean text
    const cleanText = textToSpeak.replace(/<\/hl>|<hl>/g, "");

    // Generate matching word lists for this text
    const wordList: { wordIndex: number; text: string; start: number; end: number }[] = [];
    const wordRegex = /[a-zA-Z0-9а-яА-ЯёЁo'g'O'G'ʻ’]+/g;
    let match;
    let wordIndex = 0;
    while ((match = wordRegex.exec(cleanText)) !== null) {
      wordList.push({
        wordIndex,
        text: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
      wordIndex++;
    }

    setTimeout(() => {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);

        if (lang === 'en') {
          utterance.lang = 'en-US';
        } else if (lang === 'ru') {
          utterance.lang = 'ru-RU';
        } else if (lang === 'uz') {
          utterance.lang = 'uz-UZ';
        }

        const voices = window.speechSynthesis.getVoices();
        let voice = voices.find(v => v.voiceURI === selectedBrowserVoiceURI);

        if (!voice) {
          voice = voices.find(v => v.lang.toLowerCase().startsWith(lang));
        }

        if (!voice && lang === 'uz') {
          voice = voices.find(v => v.lang.toLowerCase().startsWith('tr')) || voices.find(v => v.lang.toLowerCase().startsWith('ru'));
        }

        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        }

        utterance.onstart = () => {
          setIsLoadingAudio(false);
          setIsPlaying(true);
        };

        utterance.onend = () => {
          setIsPlaying(false);
          setActiveWordIndex(null);
        };

        utterance.onerror = (e) => {
          console.error('Speech synthesis error', e);
          setIsPlaying(false);
          setIsLoadingAudio(false);
          setActiveWordIndex(null);
        };

        utterance.onboundary = (event) => {
          if (event.name === 'word') {
            const charIndex = event.charIndex;
            const currentWord = wordList.find(w => charIndex >= w.start && charIndex < w.end);
            if (currentWord) {
              setActiveWordIndex(currentWord.wordIndex);

              // Smoothly scroll the spoken word span into viewport context
              const prefix = lang === activeLanguage ? 'word-span-' : `${lang}-col-word-span-`;
              const el = document.getElementById(`${prefix}${currentWord.wordIndex}`);
              if (el) {
                el.scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest',
                  inline: 'nearest'
                });
              }
            }
          }
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error(err);
        setIsPlaying(false);
        setIsLoadingAudio(false);
        setActiveWordIndex(null);
      }
    }, 50);
  };

  const changeLanguageWithSync = (newLang: 'en' | 'ru' | 'uz' | 'parallel') => {
    const container = scrollContainerRef.current;
    if (!container) {
      onLanguageChange(newLang);
      return;
    }

    // Get current scroll metrics
    const { scrollTop, scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;
    const ratio = maxScroll > 0 ? scrollTop / maxScroll : 0;

    // Stop current synthesis to prevent confusion
    stopAudio();

    onLanguageChange(newLang);

    // Sync scroll viewport ratio to new view
    setTimeout(() => {
      if (scrollContainerRef.current) {
        const newContainer = scrollContainerRef.current;
        const newMaxScroll = newContainer.scrollHeight - newContainer.clientHeight;
        if (newMaxScroll > 0) {
          newContainer.scrollTop = ratio * newMaxScroll;
        }
      }
    }, 50);
  };

  // Gestures touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    // Trigger swipe if horizontal displacement is greater than vertical and exceeds threshold
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
      if (activeLanguage === 'parallel') return;

      const langs: ('en' | 'ru' | 'uz')[] = ['en', 'ru', 'uz'];
      const currentIndex = langs.indexOf(activeLanguage as any);

      if (currentIndex !== -1) {
        if (diffX > 0) {
          // Swipe Right -> Prev Language
          const prevIndex = (currentIndex - 1 + langs.length) % langs.length;
          changeLanguageWithSync(langs[prevIndex]);
        } else {
          // Swipe Left -> Next Language
          const nextIndex = (currentIndex + 1) % langs.length;
          changeLanguageWithSync(langs[nextIndex]);
        }
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const renderStorySpans = (text: string, langCode: 'en' | 'ru' | 'uz') => {
    const isCurrentActive = activeLanguage === langCode;
    let cleanText = '';
    const highlightRanges: { start: number; end: number }[] = [];
    let isHighlight = false;
    let currentHighlightStart = -1;

    for (let i = 0; i < text.length; i++) {
      if (text.substring(i, i + 4) === '<hl>') {
        isHighlight = true;
        currentHighlightStart = cleanText.length;
        i += 3;
      } else if (text.substring(i, i + 5) === '</hl>') {
        isHighlight = false;
        highlightRanges.push({ start: currentHighlightStart, end: cleanText.length });
        i += 4;
      } else {
        cleanText += text[i];
      }
    }

    const wordRegex = /[a-zA-Z0-9а-яА-ЯёЁo'g'O'G'ʻ’]+/g;
    let match;
    const words: { wordIndex: number; text: string; start: number; end: number; isHighlight: boolean }[] = [];
    let wordIndex = 0;

    while ((match = wordRegex.exec(cleanText)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      const isWordHighlighted = highlightRanges.some(r => start >= r.start && end <= r.end);

      words.push({
        wordIndex,
        text: match[0],
        start,
        end,
        isHighlight: isWordHighlighted
      });
      wordIndex++;
    }

    const spans: {
      key: string;
      text: string;
      isWord: boolean;
      wordIndex?: number;
      isHighlight?: boolean;
    }[] = [];

    let lastIndex = 0;
    words.forEach((w) => {
      if (w.start > lastIndex) {
        const nonWordText = cleanText.substring(lastIndex, w.start);
        spans.push({
          key: `nonword-${lastIndex}`,
          text: nonWordText,
          isWord: false
        });
      }
      spans.push({
        key: `word-${w.wordIndex}`,
        text: w.text,
        isWord: true,
        wordIndex: w.wordIndex,
        isHighlight: w.isHighlight
      });
      lastIndex = w.end;
    });

    if (lastIndex < cleanText.length) {
      const nonWordText = cleanText.substring(lastIndex);
      spans.push({
        key: `nonword-${lastIndex}`,
        text: nonWordText,
        isWord: false
      });
    }

    const isCurrentPlayingColumn = isPlaying && playbackTextSource === langCode;

    return spans.map((span) => {
      if (span.isWord) {
        const isActiveWord = isCurrentPlayingColumn && span.wordIndex === activeWordIndex;
        const isWordHighlight = span.isHighlight;
        const cleanWord = span.text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").trim().toLowerCase();
        const isMatched = highlightedWord?.toLowerCase() === cleanWord;

        const idPrefix = isCurrentActive ? 'word-span-' : `${langCode}-col-word-span-`;

        return (
          <span
            id={`${idPrefix}${span.wordIndex}`}
            key={span.key}
            onClick={() => onWordClick(cleanWord)}
            className={`cursor-pointer px-0.5 py-0.5 rounded transition-all duration-150 inline-block ${
              isActiveWord
                ? 'bg-amber-300 dark:bg-amber-500 text-slate-950 font-bold scale-105 shadow-md border-b-2 border-amber-600 ring-2 ring-amber-400'
                : isMatched
                ? 'bg-indigo-600 text-white shadow-xs scale-105 ring-2 ring-indigo-400 font-semibold dark:bg-indigo-500'
                : isWordHighlight
                ? 'bg-amber-100 text-amber-950 hover:bg-amber-200 border-b border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Click to view definition"
          >
            {span.text}
          </span>
        );
      }
      return <span key={span.key} className="whitespace-pre-line">{span.text}</span>;
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full transition-colors duration-200">
      {/* Viewer Header Toggles */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">
            Story Reader
          </h2>

          {onToggleSave && (
            <button
              onClick={onToggleSave}
              className={`ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                isSaved
                  ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/50'
              }`}
              title={isSaved ? "Saved to Library" : "Save Story to Library"}
            >
              {isSaved ? (
                <>
                  <BookmarkCheck className="w-3 h-3 text-rose-600 fill-rose-600 dark:text-rose-400 dark:fill-rose-400 shrink-0" /> Saved
                </>
              ) : (
                <>
                  <Bookmark className="w-3 h-3 text-slate-400 shrink-0" /> Save Story
                </>
              )}
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap p-1 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-max">
          <button
            onClick={() => changeLanguageWithSync('en')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeLanguage === 'en'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            English
          </button>
          <button
            onClick={() => changeLanguageWithSync('ru')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeLanguage === 'ru'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Russian
          </button>
          <button
            onClick={() => changeLanguageWithSync('uz')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeLanguage === 'uz'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Uzbek
          </button>
          <button
            onClick={() => changeLanguageWithSync('parallel')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeLanguage === 'parallel'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Parallel Columns
          </button>
        </div>
      </div>

      {/* Audio TTS Controls Strip */}
      {activeLanguage !== 'parallel' && (
        <div className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Language Voice:</span>
            <select
              value={selectedBrowserVoiceURI}
              onChange={(e) => {
                setSelectedBrowserVoiceURI(e.target.value);
                if (isPlaying) stopAudio();
              }}
              className="text-[10px] max-w-[180px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer shadow-xs"
            >
              {browserVoices
                .filter(v => {
                  const targetLang = activeLanguage;
                  return v.lang.toLowerCase().startsWith(targetLang) || (targetLang === 'uz' && v.lang.toLowerCase().startsWith('tr'));
                })
                .map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              {browserVoices.filter(v => {
                const targetLang = activeLanguage;
                return v.lang.toLowerCase().startsWith(targetLang) || (targetLang === 'uz' && v.lang.toLowerCase().startsWith('tr'));
              }).length === 0 && (
                <option value="">Default System Voice</option>
              )}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {isLoadingAudio ? (
              <button
                disabled
                className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 text-xs rounded-lg font-medium border border-indigo-200 dark:border-indigo-900"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Initializing Local Speech...
              </button>
            ) : isPlaying && playbackTextSource === activeLanguage ? (
              <div className="flex items-center gap-3">
                {/* Visual equalizer waves */}
                <div className="flex items-center gap-0.5 h-3 shrink-0">
                  <span className="w-0.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-[bounce_1s_infinite_100ms] h-full"></span>
                  <span className="w-0.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-[bounce_1s_infinite_300ms] h-2"></span>
                  <span className="w-0.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-[bounce_1s_infinite_200ms] h-3"></span>
                  <span className="w-0.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-[bounce_1s_infinite_400ms] h-1.5"></span>
                </div>
                <button
                  onClick={stopAudio}
                  className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:text-rose-400 text-xs rounded-lg font-semibold border border-rose-200 dark:border-rose-900 cursor-pointer transition-colors"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  Stop Playback
                </button>
              </div>
            ) : (
              <button
                onClick={() => playTTS(activeText, activeLanguage as 'en' | 'ru' | 'uz')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:text-slate-950 text-xs rounded-lg font-bold cursor-pointer transition-colors shadow-xs"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Read Aloud ({activeLanguage === 'en' ? 'English' : activeLanguage === 'ru' ? 'Russian' : 'Uzbek'})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div
        ref={scrollContainerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="p-6 overflow-y-auto flex-1 dark:text-slate-300"
      >
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-6 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
          <span>{story.title}</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tracking-wider uppercase border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 shrink-0">
            Story Text
          </span>
        </h1>

        {activeLanguage !== 'parallel' ? (
          <div className="prose prose-indigo max-w-none text-slate-700 dark:text-slate-300 leading-relaxed text-sm md:text-base space-y-4 font-sans whitespace-pre-wrap select-text">
            {renderStorySpans(activeText, activeLanguage as 'en' | 'ru' | 'uz')}
          </div>
        ) : (
          /* Parallel View Grid */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* English Column */}
            <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1">
                  🇬🇧 English Story
                </span>
                <button
                  onClick={() => playTTS(story.englishStory, 'en')}
                  className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                  title="Speak English"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="prose prose-indigo text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                {renderStorySpans(story.englishStory, 'en')}
              </div>
            </div>

            {/* Russian Column */}
            <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1">
                  🇷🇺 Русский Перевод
                </span>
                <button
                  onClick={() => playTTS(story.russianTranslation, 'ru')}
                  className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                  title="Speak Russian"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="prose prose-indigo text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                {renderStorySpans(story.russianTranslation, 'ru')}
              </div>
            </div>

            {/* Uzbek Column */}
            <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1">
                  🇺🇿 O&apos;zbek Tarjimasi
                </span>
                <button
                  onClick={() => playTTS(story.uzbekTranslation, 'uz')}
                  className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                  title="Speak Uzbek"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="prose prose-indigo text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                {renderStorySpans(story.uzbekTranslation, 'uz')}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-amber-50/40 dark:bg-amber-950/10 border-t border-slate-200 dark:border-slate-800 px-6 py-3 text-xs text-amber-800 dark:text-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Click on highlighted words to explore meanings. Swipe left/right to toggle translation views!</span>
        </div>
        {activeLanguage !== 'parallel' && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide">Swipe to swap languages (position synced)</span>
        )}
      </div>
    </div>
  );
}
