import { useState, useEffect, useRef } from 'react';
import { Volume2, Sparkles, BookOpen, Search, ArrowRight, Bookmark, BookmarkCheck } from 'lucide-react';
import { VocabularyItem } from '../types';

interface WordListProps {
  mapping: VocabularyItem[];
  highlightedWord: string | null;
  onWordHighlight: (word: string | null) => void;
  savedWords?: VocabularyItem[];
  onToggleSaveWord?: (item: VocabularyItem) => void;
}

export default function WordList({
  mapping,
  highlightedWord,
  onWordHighlight,
  savedWords = [],
  onToggleSaveWord
}: WordListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  const wordRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Scroll to highlighted word when it changes
  useEffect(() => {
    if (highlightedWord) {
      const matchKey = highlightedWord.toLowerCase();
      const matchedItem = mapping.find(
        (m) =>
          m.original.toLowerCase() === matchKey ||
          m.contextEnglish.toLowerCase() === matchKey
      );

      if (matchedItem) {
        const element = wordRefs.current[matchedItem.original.toLowerCase()];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }, [highlightedWord, mapping]);

  const speakWord = async (word: string) => {
    if (playingWord) return;
    setPlayingWord(word);

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(v => v.lang.toLowerCase().startsWith('en'));
        if (englishVoice) {
          utterance.voice = englishVoice;
        }

        utterance.onend = () => {
          setPlayingWord(null);
        };
        utterance.onerror = () => {
          setPlayingWord(null);
        };
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Local synthesis failed, trying fallback:', err);
        tryFallbackTTS(word);
      }
    } else {
      tryFallbackTTS(word);
    }
  };

  const tryFallbackTTS = async (word: string) => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: word, voice: 'Kore' })
      });

      if (!response.ok) {
        throw new Error('TTS failed');
      }

      const { audioData } = await response.json();
      const binaryString = window.atob(audioData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const numSamples = len / 2;
      const int16Array = new Int16Array(bytes.buffer);
      
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass({ sampleRate: 24000 });
      const buffer = audioCtx.createBuffer(1, numSamples, 24000);
      const channelData = buffer.getChannelData(0);
      
      for (let i = 0; i < numSamples; i++) {
        channelData[i] = int16Array[i] / 32768.0;
      }
      
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        setPlayingWord(null);
        audioCtx.close();
      };
      source.start(0);
    } catch (e) {
      console.error(e);
      setPlayingWord(null);
    }
  };

  const filteredMapping = mapping.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      item.original.toLowerCase().includes(term) ||
      item.russianMeaning.toLowerCase().includes(term) ||
      item.uzbekMeaning.toLowerCase().includes(term) ||
      item.explanation.toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">
            Vocabulary Deck
          </h2>
          <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 text-[10px] font-bold px-1.5 py-0.5 rounded-sm ml-auto">
            {mapping.length} words
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search words, meanings or definitions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Word Cards List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredMapping.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No words found matching &quot;{searchTerm}&quot;
          </div>
        ) : (
          filteredMapping.map((item) => {
            const isWordActive =
              highlightedWord?.toLowerCase() === item.original.toLowerCase() ||
              highlightedWord?.toLowerCase() === item.contextEnglish.toLowerCase();

            return (
              <div
                key={item.original}
                ref={(el) => {
                  wordRefs.current[item.original.toLowerCase()] = el;
                }}
                className={`p-4 rounded-xl border transition-all duration-200 flex flex-col gap-3 ${
                  isWordActive
                    ? 'border-indigo-500 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-500/30 dark:border-indigo-600 dark:bg-indigo-950/10'
                    : 'border-slate-100 bg-slate-50/30 dark:border-slate-800 dark:bg-slate-900/10 hover:border-slate-200 hover:bg-slate-50/80 dark:hover:border-slate-800 dark:hover:bg-slate-900/30'
                }`}
              >
                {/* Word Title & TTS Button */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800 dark:text-white capitalize">
                        {item.original}
                      </span>
                      {isWordActive && (
                        <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                          Active
                        </span>
                      )}
                    </div>
                    {/* Definition */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {item.explanation}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onToggleSaveWord && (
                      <button
                        onClick={() => onToggleSaveWord(item)}
                        className={`p-1.5 rounded-lg border cursor-pointer transition-all ${
                          savedWords.some(w => w.original.toLowerCase() === item.original.toLowerCase())
                            ? 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900'
                            : 'text-slate-400 border-slate-200 hover:text-rose-500 hover:bg-rose-50 dark:border-slate-800 dark:hover:bg-slate-800'
                        }`}
                        title={savedWords.some(w => w.original.toLowerCase() === item.original.toLowerCase()) ? "Remove from Saved Words" : "Save Word"}
                      >
                        {savedWords.some(w => w.original.toLowerCase() === item.original.toLowerCase()) ? (
                          <BookmarkCheck className="w-4 h-4 fill-rose-600 text-rose-600" />
                        ) : (
                          <Bookmark className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => speakWord(item.original)}
                      disabled={playingWord !== null}
                      className={`p-1.5 rounded-lg border text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 cursor-pointer dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-indigo-400 transition-colors ${
                        playingWord === item.original ? 'animate-pulse text-indigo-600 bg-indigo-50 border-indigo-200' : ''
                      }`}
                      title="Listen to pronunciation"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Horizontal Divider */}
                <div className="h-px bg-slate-100 dark:bg-slate-800" />

                {/* Translation Mappings */}
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  {/* Russian Translation block */}
                  <div className="bg-slate-100/50 dark:bg-slate-800/40 p-2 rounded-lg space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 uppercase tracking-wider">
                      🇷🇺 RU
                    </span>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {item.russianMeaning}
                    </div>
                    <div className="text-slate-400 dark:text-slate-500 italic mt-0.5">
                      Used: <span className="text-indigo-600 dark:text-indigo-400 font-medium">{item.contextRussian}</span>
                    </div>
                  </div>

                  {/* Uzbek Translation block */}
                  <div className="bg-slate-100/50 dark:bg-slate-800/40 p-2 rounded-lg space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 uppercase tracking-wider">
                      🇺🇿 UZ
                    </span>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {item.uzbekMeaning}
                    </div>
                    <div className="text-slate-400 dark:text-slate-500 italic mt-0.5">
                      Used: <span className="text-indigo-600 dark:text-indigo-400 font-medium">{item.contextUzbek}</span>
                    </div>
                  </div>
                </div>

                {/* In Context Info */}
                <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                  <span className="font-medium text-slate-500 dark:text-slate-400">English Context:</span>
                  <span>&quot;{item.contextEnglish}&quot;</span>
                  <ArrowRight className="w-2.5 h-2.5 mx-0.5 text-slate-300" />
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 capitalize">{item.original}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tip Footer */}
      <div className="bg-indigo-50/30 dark:bg-indigo-950/10 border-t border-slate-100 dark:border-slate-800 px-4 py-3 text-[10px] text-indigo-700/80 dark:text-indigo-300/80 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
        <span>Cards display the dictionary definition, exact native translation, and the inflected forms used in the story.</span>
      </div>
    </div>
  );
}
